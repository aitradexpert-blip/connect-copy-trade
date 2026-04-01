Goal: fix Headway trade execution failures, stabilize MetaAPI account linkage (including HFM), and enforce subscription-cycle usage limits (especially account additions) in a server-enforced way.

1. Findings from current code/data (root causes)

- Headway account (`02b58a87-89bf-4785-ac75-a0a48ad491b9`) currently returns `connectionStatus: DISCONNECTED` and 504 timeout from MetaAPI client API, even though region resolves to `london`.
- `metaapi-execute-trade` does region resolution, but does not handle the disconnected+timeout path robustly (no redeploy retry flow).
- `metaapi-account-info` and `metaapi-get-positions` also do not use `/redeploy` fallback.
- HFM account row stores `metaapi_account_id = 136373`; MetaAPI returns `NotFoundError` for this ID. This indicates a bad stored provider ID (not the live MetaAPI account ID).
- One account has `provider='metaapi'` but `connection_type='deriv_api'`, which can misroute execution.
- No backend-enforced monthly/cycle quota exists for trading account additions; users can delete/re-add without usage accounting.

2. Trade execution + connection recovery (Headway fix)

- Update `supabase/functions/metaapi-execute-trade/index.ts`:
  - Add resilient flow: `get account details -> if DISCONNECTED or timeout -> POST /redeploy -> short wait -> retry trade once`.
  - If trade still times out, return structured `status: reconnecting` (not generic fail), with clear UI-safe message.
  - Add timeout reconciliation: if timeout occurs, query recent deals/orders and return success when trade actually landed.
  - Stop silently defaulting to london when account lookup fails; return explicit upstream auth/region diagnostics.
- Update `supabase/functions/metaapi-account-info/index.ts` and `metaapi-get-positions/index.ts`:
  - Same DISCONNECTED handling: `/redeploy` + retry pattern.
  - Return `state`, `connectionStatus`, `region`, and human-readable next action in response payload.

3. Fix bad MetaAPI IDs and routing inconsistencies (HFM + data integrity)

- Add a migration to correct/guard account linkage:
  - Data cleanup update for known misrouted rows (`provider='metaapi'` should have `connection_type='metaapi'`).
  - Add guard trigger for `trading_accounts` inserts/updates:
    - if `provider='metaapi'`, require non-empty `metaapi_account_id`.
    - if `provider='deriv'`, enforce `metaapi_account_id IS NULL`.
- Improve `metaapi-provision-account`:
  - Validate returned account id format.
  - If returned id looks invalid, immediately resolve account via `/users/current/accounts` lookup by login/server and persist canonical `_id`.
  - Add explicit `E_RESOURCE_SLOTS` handling and user-facing message for HFM-like cases.
- In client save path (`ConnectAccountModal.tsx`), include fallback validation call after provision success before insert.

4. Add explicit “Reconnect Account” action

- Add new edge function `metaapi-redeploy-account` (or extend existing account-info function with action mode):
  - Input: `accountId`
  - Calls `/users/current/accounts/{id}/redeploy`
  - Returns operation state for UI.
- Add reconnect button on `TradingAccounts.tsx` for MetaAPI rows in `disconnected/provisioning/failed` states.
- On Ideas execution failure due reconnecting status, show actionable toast (“Account reconnecting, retry in 30–60s”).

5. Enforce account-add limits per subscription cycle (server-side, non-bypassable)

- Add new table (migration): `subscription_usage_events`
  - `id, user_id, feature_key, quantity, cycle_start, cycle_end, source, created_at`
  - immutable event log; deletions of trading accounts do not reduce usage.
- Add SECURITY DEFINER function:
  - `consume_subscription_quota(_user_id, _feature_key, _qty)`:
    - resolves tier (free if no active subscription),
    - resolves cycle window,
    - resolves limit from plan,
    - checks used+qty <= limit,
    - inserts usage event atomically or throws.
- Add DB trigger on `trading_accounts` BEFORE INSERT:
  - Calls `consume_subscription_quota(user_id, 'trading_account_additions', 1)`.
  - This enforces “add/remove/add still counts”.
- Extend same mechanism for other capped features (auto-trades, copy connections, etc.) by calling the same function from relevant edge functions and flows.

6. Admin reliability (users/plans/manual operations)

- Harden `admin-list-users` edge function:
  - avoid manual JWT decode (`atob`) and verify caller using Supabase auth endpoint.
  - keep strict admin role check via `has_role`.
- Update `UserManagementTab.tsx`:
  - Display auth users + profiles consistently,
  - Ensure free/paid plan updates are visible for newly registered users,
  - Add lightweight “Create User” admin action (new edge function using Auth Admin API) if manual add is required operationally.

7. Technical implementation map

- Edge functions:
  - `supabase/functions/metaapi-execute-trade/index.ts` (redeploy/retry/reconcile)
  - `supabase/functions/metaapi-account-info/index.ts` (redeploy-aware account status)
  - `supabase/functions/metaapi-get-positions/index.ts` (redeploy-aware)
  - `supabase/functions/metaapi-provision-account/index.ts` (canonical ID + resource slots handling)
  - `supabase/functions/admin-list-users/index.ts` (auth verification hardening)
  - new: `supabase/functions/metaapi-redeploy-account/index.ts`
- Frontend:
  - `src/pages/TradingAccounts.tsx` (Reconnect action + status UX)
  - `src/pages/TradingIdeas.tsx` + `src/services/brokerExecution.ts` (surface reconnecting/pending states cleanly)
  - `src/components/ConnectAccountModal.tsx` (post-provision ID validation)
  - `src/components/admin/UserManagementTab.tsx` (admin visibility/manual add flow)
- DB migration:
  - `subscription_usage_events` table + indexes
  - `consume_subscription_quota` function
  - `trading_accounts` insert trigger for quota consumption
  - data cleanup for invalid `connection_type` and provider/id consistency policies

8. Rollout order (safe)

- Phase A: Headway execution stabilization (redeploy+retry) + reconnect UI.
- Phase B: HFM canonical ID/resource slots fixes + data cleanup migration.
- Phase C: Subscription-cycle quota backend enforcement + trigger.
- Phase D: Admin hardening + manual add capability.
- Phase E: Regression testing across Ideas, Accounts, Admin, and connect flows.

9. Expected outcomes

- Headway trades from Ideas no longer fail with false negatives during temporary disconnect states.
- HFM account linkage uses correct MetaAPI IDs and clear remediation for resource-slot issues.
- Users cannot bypass account-add limits by deleting and re-adding accounts.
- Admin page consistently shows all signups and supports subscription updates/manual user operations.  
  
**1. MetaAPI Integration Overhaul – Fully Automated Account Creation**
  ### **1.1 New API Token**
  Use the following MetaAPI JWT token for all MetaAPI edge functions (replace the existing `METAAPI_TOKEN` environment variable):
  text
  ```
  eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI0YjZjNzJlNGFkMmQyN2M1ZjRkNTU1MmMwNjUxYTMwYiIsImFjY2Vzc1J1bGVzIjpbeyJpZCI6InRyYWRpbmctYWNjb3VudC1tYW5hZ2VtZW50LWFwaSIsIm1ldGhvZHMiOlsidHJhZGluZy1hY2NvdW50LW1hbmFnZW1lbnQtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVzdC1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcnBjLWFwaSIsIm1ldGhvZHMiOlsibWV0YWFwaS1hcGk6d3M6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6Im1ldGFhcGktcmVhbC10aW1lLXN0cmVhbWluZy1hcGkiLCJtZXRob2RzIjpbIm1ldGFhcGktYXBpOndzOnB1YmxpYzoqOioiXSwicm9sZXMiOlsicmVhZGVyIiwid3JpdGVyIl0sInJlc291cmNlcyI6WyIqOiRVU0VSX0lEJDoqIl19LHsiaWQiOiJtZXRhc3RhdHMtYXBpIiwibWV0aG9kcyI6WyJtZXRhc3RhdHMtYXBpOnJlc3Q6cHVibGljOio6KiJdLCJyb2xlcyI6WyJyZWFkZXIiLCJ3cml0ZXIiXSwicmVzb3VyY2VzIjpbIio6JFVTRVJfSUQkOioiXX0seyJpZCI6InJpc2stbWFuYWdlbWVudC1hcGkiLCJtZXRob2RzIjpbInJpc2stbWFuYWdlbWVudC1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfSx7ImlkIjoiY29weWZhY3RvcnktYXBpIiwibWV0aG9kcyI6WyJjb3B5ZmFjdG9yeS1hcGk6cmVzdDpwdWJsaWM6KjoqIl0sInJvbGVzIjpbInJlYWRlciIsIndyaXRlciJdLCJyZXNvdXJjZXMiOlsiKjokVVNFUl9JRCQ6KiJdfV0sImlnbm9yZVJhdGVMaW1pdHMiOmZhbHNlLCJ0b2tlbklkIjoiMjAyMTAyMTMiLCJpbXBlcnNvbmF0ZWQiOmZhbHNlLCJyZWFsVXNlcklkIjoiNGI2YzcyZTRhZDJkMjdjNWY0ZDU1NTJjMDY1MWEzMGIiLCJpYXQiOjE3NzQ5NjA1ODF9.H0GRMal1sFmFWHIjcpBOVXYw1R39pQlBnX7ugenccRemCBm3SQmAzkZar0TWsOJ0rFuSkJ96CXojPZzqsXDv8Ad7yfqBo3RwLA1zAWDzI495mZgHRXnE8m9NVjBkd9gV-LG6cUK56KZz9nl1k2vdHhCmOpmwzA9Rz1vPohqJ_Mk6VbEBNF3nvQfyzVHs1r4l9YDSY-Ibym2ZO8wvAAR3JXuxAwgudsv57ayv8_E7cboXXiwsi3fkMPjKURRI70yQaduvUKPLjhM4iuapMWUGZQE_b1y6Xem4ezuPW7wkUDkTzMQQpmrYD9TgTs5dbI1Tm2HwX0j3tItZ7gvufzxBk4hsWoqa5aibyxH-oYhcadZf6GGvjmqO8Y6oWG0bUNql0PRHitrYqrIV0U2vjPk1HcFAWht99LRwqxtRmM_ZM6sDq5NRLnsN14ZIKKAJnezCvvzUk808X3RVM8IKRNN2nlGI_a1Mefr9kWoRAVYf2FQ6BSbIvATRwo7kVtJNA8efBPqyaI8-9MZOEam7PfbDrfVUg0npwBi6IhJRSOTG7Y2tIyyAKIYebr9SQ6P3-OLebhh6kHa4KYaXTe5vdBj-PauMOLZs9I_aZPCfffbujFiZK_t3A8VahSPeCKfXr7Uz58ANbPzYTiNW6TRN1ofTbESNIewxo-7iD4LRM0Ifn7k
  ```
  ### **1.2 Automated Account Creation (No Manual Intervention)**
  **Edge Function:** `metaapi-provision-account` (or rename to `metaapi-create-account`)
  **Flow:**
  1. Receive from frontend: `user_id`, `broker_type` (e.g., `primexbt`), `login`, `password`, `server` (optional, use default if not provided).
  2. Use the MetaAPI SDK with the new token.
  3. Call `api.metatraderAccountApi.createAccount()` with:
    - `name`: `"HuMi - ${user_id} - ${broker_type}"`
    - `login`, `password`, `server` (e.g., `PrimeXBT-MT5` for PrimeXBT)
    - `type: 'cloud'`
    - `magic`: a unique identifier (can be a random number or derived from user_id)
  4. Capture the returned `account.id` → this is the `metaapi_account_id`.
  5. **Wait for synchronisation:** Call `account.waitSynchronized()` with a timeout (e.g., 30 seconds). If it times out, log error but proceed; the UI will handle reconnection later.
  6. **Store the account** in `trading_accounts` with:
    - `provider: 'metaapi'`
    - `metaapi_account_id: id`
    - `connection_type: 'metaapi'` (enforce this)
    - `connection_status: 'CONNECTED'` (or the status from MetaAPI after sync)
    - `region`, `server`, etc.
  7. **Immediately fetch symbols** from the terminal state and upsert into `symbols` table (see Section 1.3).
  8. Return the account details to the frontend, including the `metaapi_account_id`.
  **Error Handling:**
  - If `createAccount` fails, return a clear error to the user (e.g., invalid credentials, server unreachable).
  - If `waitSynchronized` fails, still store the account with status `PROVISIONING` and trigger a background sync (or rely on reconnect button).
  ### **1.3 Symbol Synchronisation (All Brokers)**
  **Requirement:** For every broker account connected via MetaAPI, after successful account creation (or on-demand via a sync button), the system must fetch the exact symbol list from the terminal state and ensure the `symbols` table contains the **exact strings** as returned by MetaAPI.
  **Implementation:**
  - After account creation, after `waitSynchronized`, call:
    typescript
    ```
    const connection = account.getStreamingConnection();
    await connection.connect();
    await connection.waitSynchronized();
    const specMap = connection.terminalState.specificationMap;
    const symbols = Object.keys(specMap).map(symbol => ({
      broker: broker_name, // derived from account server or from user input
      symbol: symbol,      // e.g., "EURUSDp"
      name: specMap[symbol].description || symbol,
      type: determineSymbolType(symbol), // forex, commodity, etc.
      // other fields as needed
    }));
    await supabase.from('symbols').upsert(symbols, { onConflict: 'broker,symbol' });
    ```
  - Ensure that the `broker` field is consistent (e.g., `'PrimeXBT'`, `'Deriv'`, etc.). The broker name can be derived from the server name or from a mapping.
  - **Trade execution** must use the exact symbol string from the `symbols` table (or from the terminal state directly) without stripping suffixes.
  **Edge Function:** `metaapi-sync-symbols` can be created to manually trigger a sync for an account (useful for reconnection or when symbols change).
  ### **1.4 Connection Recovery & Reconnect UI**
  **Edge Functions:** `metaapi-execute-trade`, `metaapi-account-info`, `metaapi-get-positions`, `metaapi-redeploy-account`
  - In each function, implement a retry pattern: if the account is `DISCONNECTED` or a 504 timeout occurs, call `api.metatraderAccountApi.redeployAccount(accountId)`, wait a few seconds, then retry once.
  - Return a structured response with `status: 'reconnecting'` to inform the UI.
  - Frontend: Add a “Reconnect” button on `TradingAccounts.tsx` for accounts with status `DISCONNECTED` or `PROVISIONING` that calls `metaapi-redeploy-account`.
  ### **1.5 Data Integrity & Cleanup**
  **Migration SQL:**
  - Ensure `provider='metaapi'` rows have `connection_type='metaapi'` and `metaapi_account_id` non‑null.
  - Add trigger to enforce this on inserts/updates.
  sql
  ```
  -- Clean up existing rows
  UPDATE trading_accounts SET connection_type = 'metaapi' WHERE provider = 'metaapi' AND connection_type != 'metaapi';

  -- Trigger
  CREATE OR REPLACE FUNCTION enforce_metaapi_consistency()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.provider = 'metaapi' AND NEW.metaapi_account_id IS NULL THEN
      RAISE EXCEPTION 'metaapi_account_id required for provider=metaapi';
    END IF;
    IF NEW.provider = 'deriv' AND NEW.metaapi_account_id IS NOT NULL THEN
      RAISE EXCEPTION 'metaapi_account_id must be NULL for deriv provider';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER enforce_metaapi_consistency
  BEFORE INSERT OR UPDATE ON trading_accounts
  FOR EACH ROW EXECUTE FUNCTION enforce_metaapi_consistency();
  ```
  ---
  ## **2. Copy Trading for Basic Plan**
  - Update `copyfactory-subscribe` edge function to allow Basic plan users, but enforce a limit of **1 active copy connection** (Pro: 5, Enterprise: 10).
  - Frontend: Remove any conditional rendering that hides copy trading UI for Basic users.
  - Ensure the UI shows the limit and blocks attempts to exceed it.
  ---
  ## **3. Mentor Center Upgrade**
  ### **3.1 Database Additions**
  sql
  ```
  ALTER TABLE mentor_profiles ADD COLUMN landing_page_media_url TEXT;
  ALTER TABLE mentor_profiles ADD COLUMN landing_page_media_type TEXT; -- 'image' or 'video'
  ALTER TABLE mentor_profiles ADD COLUMN landing_page_slug TEXT UNIQUE;
  ALTER TABLE mentor_profiles ADD COLUMN ui_config JSONB DEFAULT '{}';

  CREATE TABLE mentor_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mentor_id UUID NOT NULL REFERENCES mentor_profiles(user_id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(mentor_id, client_id)
  );

  CREATE INDEX idx_mentor_clients_mentor ON mentor_clients(mentor_id);
  CREATE INDEX idx_mentor_clients_client ON mentor_clients(client_id);
  ```
  ### **3.2 Storage Bucket for Mentor Assets**
  Create `mentor-assets` bucket with public read access. Uploads go to `mentor-assets/{mentor_id}/landing.{ext}`.
  ### **3.3 Frontend Upload UI (Mentor Center → Branding)**
  - Drag‑and‑drop area (react-dropzone) for image/video.
  - On upload, store file and update `mentor_profiles` with public URL and media type.
  - Generate a unique slug if not set (based on brand name).
  - Show a preview of the landing page (using an iframe) and a shareable link.
  ### **3.4 Edge Function: Render Mentor Landing Page**
  **File:** `supabase/functions/render-mentor-landing/index.ts`
  - Accept a `slug` parameter via URL path.
  - Fetch mentor profile and media.
  - Return an HTML page with full‑screen background media, overlay text, and a CTA button linking to `https://humi.app/ref/{slug}`.
  - Use responsive CSS; include a `<video>` tag for video media, CSS `background-image` for images.
  ### **3.5 Dynamic Route for Landing Page**
  Set up a route in the frontend framework (e.g., Next.js or React Router) that serves the Edge Function's HTML instead of the SPA. This can be done via a catch‑all route that proxies to the Edge Function.
  ### **3.6 Client Management & Reconnect All**
  - **Edge Function:** `reconnect-all-clients` – For a given mentor, fetch all clients from `mentor_clients` and re‑subscribe them to the mentor's copy strategy (or re-establish connections).
  - **Frontend:** Add “Clients” tab in Mentor Center, list clients with copy status, and a “Reconnect All” button.
  ### **3.7 Mentor‑Editable UI Config**
  - In `MentorCenter` → Branding, add fields: primary color, secondary color, logo URL, custom welcome text.
  - Store in `ui_config` JSONB.
  - On client login, if the user is associated with a mentor, apply these styles via CSS variables or a theme provider.
  ### **3.8 Close All Trades**
  - **Edge Function:** `close-all-trades` – Accept `user_id` (for user) or `mentor_id` (for all clients).
  - For each relevant trading account, fetch open positions and close them via MetaAPI.
  - Return a summary.
  - **Frontend:** Add buttons in Copy Trading, AI Bot, and Ideas sections (with confirmation). For mentors, add a “Close All Client Trades” button in Mentor Center.
  ---
  ## **4. Branded Client UI (Home, Ideas, Trading Bot)**
  ### **4.1 Referral Association**
  - When a user signs up via `https://humi.app/ref/{slug}`, capture the mentor from `mentor_profiles` and insert into `mentor_clients`. Also store `referred_by` in `profiles`.
  - On login, fetch mentor’s `ui_config` and branding names.
  ### **4.2 Three‑Tab Layout**
  Create a new layout component (e.g., `MentorClientLayout.tsx`) with tabs:
  - **Home:** Standard HuMi dashboard (could reuse existing home page but with mentor branding).
  - **Ideas:** Fetch trading ideas from `trading_ideas` where `mentor_id = user.referred_by`. Display each idea with a share button that copies a link (`/idea/{ideaId}`). Visiting that link shows a landing page with the idea details and a CTA to sign up (which associates with the mentor).
  - **Trading Bot:** Show start/stop controls. When “Start Bot” is clicked, it initiates trading based on mentor's bot logic (e.g., AI signals). While active, show a blinking “Trade” button and a “Stop” button.
  ### **4.3 Shareable Idea Links**
  - **Edge Function:** `render-idea-landing` – similar to mentor landing page, but shows the idea content and a CTA to sign up.
  - After signup, redirect to the app and automatically follow the mentor (by inserting into `mentor_clients` if not already).
  ---
  ## **5. Subscription Limits Enforcement (Server‑Side)**
  ### **5.1 Usage Events Table**
  sql
  ```
  CREATE TABLE subscription_usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    cycle_start TIMESTAMPTZ NOT NULL,
    cycle_end TIMESTAMPTZ NOT NULL,
    source TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  CREATE INDEX idx_usage_events_user_feature_cycle ON subscription_usage_events (user_id, feature_key, cycle_start, cycle_end);
  ```
  ### **5.2 Quota Consumption Function**
  sql
  ```
  CREATE OR REPLACE FUNCTION consume_subscription_quota(
    p_user_id UUID,
    p_feature_key TEXT,
    p_quantity INTEGER
  ) RETURNS VOID AS $$
  DECLARE
    v_tier TEXT;
    v_limit INTEGER;
    v_used INTEGER;
    v_cycle_start TIMESTAMPTZ;
    v_cycle_end TIMESTAMPTZ;
  BEGIN
    -- Get current tier (free if no active subscription)
    SELECT plan INTO v_tier FROM subscriptions WHERE user_id = p_user_id AND status = 'active' ORDER BY created_at DESC LIMIT 1;
    IF NOT FOUND THEN v_tier := 'free'; END IF;

    v_limit := CASE v_tier
      WHEN 'free' THEN 0
      WHEN 'basic' THEN 2   -- trading accounts
      WHEN 'pro' THEN 5
      WHEN 'enterprise' THEN 10
      ELSE 0
    END;

    v_cycle_start := date_trunc('month', now());
    v_cycle_end := date_trunc('month', now()) + interval '1 month';

    SELECT COALESCE(SUM(quantity), 0) INTO v_used
    FROM subscription_usage_events
    WHERE user_id = p_user_id AND feature_key = p_feature_key
      AND cycle_start = v_cycle_start;

    IF (v_used + p_quantity) > v_limit THEN
      RAISE EXCEPTION 'Quota exceeded for feature % (limit: %)', p_feature_key, v_limit;
    END IF;

    INSERT INTO subscription_usage_events (user_id, feature_key, quantity, cycle_start, cycle_end, source)
    VALUES (p_user_id, p_feature_key, p_quantity, v_cycle_start, v_cycle_end, 'trigger');
  END;
  $$ LANGUAGE plpgsql;
  ```
  ### **5.3 Trigger on** `trading_accounts` **Insert**
  sql
  ```
  CREATE OR REPLACE FUNCTION check_account_quota()
  RETURNS TRIGGER AS $$
  BEGIN
    PERFORM consume_subscription_quota(NEW.user_id, 'trading_account_additions', 1);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER enforce_account_quota
  BEFORE INSERT ON trading_accounts
  FOR EACH ROW EXECUTE FUNCTION check_account_quota();
  ```
  **Note:** Deletion of accounts does not free up quota in the current cycle. This prevents users from bypassing limits by deleting and re‑adding.
  ---
  ## **6. Admin & User Management Hardening**
  ### **6.1 Fix** `admin-list-users` **Edge Function**
  - Use Supabase Admin client with `service_role` key.
  - Call `supabaseAdmin.auth.admin.listUsers()` and join with `profiles`.
  - Ensure only admin users can access (check `user_roles` table).
  ### **6.2 New Admin Edge Functions**
  - `admin-create-user`: Accepts `email`, `password`, `plan`; creates auth user and profile, sets subscription.
  - `admin-update-subscription`: Updates a user’s plan.
  ### **6.3 Frontend:** `UserManagementTab.tsx`
  - Use the new admin endpoints.
  - Add “Create User” button with modal for email/password/plan.
  - Add ability to change plan for existing users.
  ---
  ## **7. Remove OctaFx Promotional UI**
  - Scan frontend for OctaFx banners, WhatsApp messages, email templates, etc., and remove them.
  - Keep backend integration for existing OctaFx accounts (do not delete database records or edge functions that support them).
  ---
  ## **8. Testing Checklist**
  - **MetaAPI automated account creation:** Add a new PrimeXBT account via UI; verify that `metaapi_account_id` is stored, account status becomes `CONNECTED`, symbols table populated with `EURUSDp`, etc.
  - **Trade execution:** Place a trade on `EURUSDp`; should succeed without symbol error.
  - **Symbol sync for other brokers:** Add a Deriv account; ensure correct symbols (e.g., `Volatility 75 Index`) are stored.
  - **Disconnection recovery:** Simulate disconnected account; trade should trigger redeploy and retry; UI shows reconnecting state.
  - **Quota enforcement:** Attempt to add more than allowed trading accounts; server rejects with error. Delete some, then try to add again within same month; still rejects.
  - **Copy trading for Basic:** Basic user sees copy trading UI, can subscribe to one master, cannot subscribe to second.
  - **Mentor landing page:** Upload video, get link, view page; video plays full‑screen, CTA works.
  - **Referral flow:** New user signs up via `/ref/{slug}`; appears in `mentor_clients`; client app shows mentor branding.
  - **Mentor client list:** Mentor sees list of clients; “Reconnect All” re‑establishes copy subscriptions.
  - **Close all trades:** Button closes all open positions on user’s accounts; mentor version closes all client positions.
  - **Admin panel:** Lists users; can create user and change plan.
  ---
  ## **9. Risk Mitigation**

  | **Risk**                                               | **Mitigation**                                                                                            |
  | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
  | New MetaAPI token may have different permissions.      | Test token in staging with createAccount and trade execution.                                             |
  | `waitSynchronized` may hang or timeout.                | Set a reasonable timeout (30s); store account with status `PROVISIONING` and allow manual sync/reconnect. |
  | Symbol sync may fail if account not ready.             | Implement a retry mechanism; provide a “Sync Symbols” button in UI.                                       |
  | Quota trigger could lock users out if misconfigured.   | Test with multiple scenarios; provide admin override.                                                     |
  | Mentor landing page media may be large.                | Enforce file size limit (10 MB) and compress on upload.                                                   |
  | Admin functions with service role key must be secured. | Verify admin role via `user_roles` table before executing.                                                |

  ---
  This specification ensures that all account creation is automated via APIs, symbol handling is accurate for all brokers, and all other features are implemented consistently.