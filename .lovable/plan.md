# Plan — Primary-First UI + Mentor Fix + Dual-Mode Broadcast

Backend (`https://municipal-posh-shading.ngrok-free.dev`) is verified live (`/account`, `/positions`). We already have `primaryApi`, `withFailover`, and `signalBroadcast`. This plan finishes wiring the UI to the primary engine, fixes the mphoforex5 mentor flow, and tightens the dual-mode broadcast contract. No backend code is written here — FastAPI service stays as-is on the VPS.

## 1. Mentor role fix ([mphoforex5@gmail.com](mailto:mphoforex5@gmail.com))

Current DB state (verified): user `11a1db6b-…`, `mentor_profiles.is_active = true`, `referral_slug = khumo-copy-ai-l99j`, but `user_roles.role = 'admin'` only — no `'mentor'` row. The "not a mentor" guard fails because it checks `user_roles`, not `mentor_profiles`.

Migration:

- `INSERT INTO user_roles (user_id, role) VALUES ('11a1db6b-…','mentor') ON CONFLICT DO NOTHING;`
- Backfill: insert `'mentor'` for every `user_id` present in `mentor_profiles` where `is_active = true` and missing the role.
- Add a trigger on `mentor_profiles` AFTER INSERT/UPDATE that upserts the matching `user_roles` row when `is_active = true`, so future mentors stay in sync automatically.
- ([mphoforex@gmail.com](mailto:mphoforex@gmail.com) does not exist in `auth.users` — skipped; user must sign up first.)

Referral link flow: `MentorReferral.tsx` already resolves by `referral_slug` and `Auth.tsx` already attaches `mentor_clients` on signup. After the role fix the existing flow works — no code change needed there. Verify by walking `/m/khumo-copy-ai-l99j` in incognito.

## 2. Point UI reads/writes at the primary engine

Keep `withFailover` so MetaAPI edge functions remain silent fallback. Refactor only the call sites; no UI/layout edits.

- `src/pages/TradingAccounts.tsx`, `src/pages/AIAutoTrading.tsx`, `src/pages/CopyTradingNew.tsx`, `src/pages/Analytics.tsx`, `src/components/admin/MetaApiHealthTab.tsx`: route balance/equity/positions/history reads through `fetchAccountData` / `fetchTradingHistory` (already failover-wrapped) instead of direct `supabase.functions.invoke('metaapi-…')`.
- Quick-trade / manual execution forms (`DerivQuickTrade` is Deriv-only — leave alone; MT5 execution paths in `MentorHub`, `MentorCenter`, `TradingIdeas`): call `primaryApi.sendOrder({...})` first via a new helper `executePrimaryOrder()` in `brokerExecution.ts`; on `PrimaryUnavailableError` fall back to existing `metaapi-execute-trade` edge function.
- Account-connected status: after provisioning, poll `primaryApi.getAccount(metaapi_account_id)` — a 200 flips local `connection_status` to `'connected'` immediately so the "Start Copying" / "Activate Bot" guards unlock.

## 3. Dual-mode Copy / AI engine

`signalBroadcast.broadcastSignal` already fans out via primary `/order` with per-follower MetaAPI fallback. Tighten and document the two modes:

- **Mode A (Idea publish)** — already wired in `MentorHub`, `MentorCenter`, Khumo sessions. Add: when building the eligible-account list, include accounts where `copy_trading_relationships.master_user_id = signal.mentor_user_id AND status='active'` (currently filters by `status` only, not by master). This guarantees only followers of the publishing mentor receive trades.
- **Mode B (Master-Slave mirror)** — extend the existing `copy-trade-listener` edge function: when triggered (cron / webhook from VPS), for each master with `is_master=true` it pulls fresh trades via `primaryApi.getHistory`, diffs against `trade_history`, and calls `primaryApi.sendOrder` per follower (fallback to `metaapi-execute-trade`). Insert a `trading_signals` row tagged `source='master_mirror'` so the same downstream pipeline handles it.

## 4. Connection status UI

New small component `src/components/PrimaryStatusBadge.tsx`:

- Pings `${VITE_API_URL}/account?id=health` (or a `/health` route if you add one) every 30s.
- Shows `Online` (green), `Reconnecting…` (amber, on 1st failure), `Offline — using fallback` (red, on 3 consecutive failures).
- Mount in `TopHeader.tsx` next to the existing user menu. No layout shift; purely presentational.

## 5. Local credentials cache (optional resilience)

Add `src/services/credentialsCache.ts`: persists `{ accountId, login, server, metaapi_account_id }` per user in `localStorage` after each successful Supabase fetch. If `supabase.from('trading_accounts').select(...)` throws a network error, hydrate from cache so the UI keeps rendering. No secrets cached — only public identifiers already exposed to the client.

## Files touched

- **Migration**: 1 new SQL file (role backfill + trigger).
- **Edit**: `src/services/brokerExecution.ts` (add `executePrimaryOrder`), `src/services/signalBroadcast.ts` (filter by `master_user_id`), `src/pages/MentorHub.tsx`, `src/pages/MentorCenter.tsx`, `src/pages/TradingIdeas.tsx`, `src/pages/TradingAccounts.tsx`, `src/pages/AIAutoTrading.tsx`, `src/pages/CopyTradingNew.tsx`, `src/pages/Analytics.tsx`, `src/components/admin/MetaApiHealthTab.tsx`, `src/components/TopHeader.tsx`, `supabase/functions/copy-trade-listener/index.ts`.
- **New**: `src/components/PrimaryStatusBadge.tsx`, `src/services/credentialsCache.ts`.

## Out of scope

- FastAPI / `mt5_service.py` changes (VPS already serves the contract).
- Visual redesign of any page — only adding the status badge and rewiring data sources.
- Per-user OAuth, Celery/TaskQ infra (use existing Supabase cron + edge functions instead).  
  
I need to refactor the core backend and UI logic for our Mentor/Copy Trading system. We have critical gaps in how Mentors are identified and how trades propagate. Please align the codebase with these requirements:
  **1. Mentor Authentication & Referral Logic (The 'mphoforex5' Fix):**
  - **Role Enforcement:** Implement an admin-side check to explicitly set/verify the `MENTOR` role for `mphoforex5@gmail.com`.
  - **Referral Flow:** When a user registers via a Mentor’s unique link, the `mentor_id` must be injected into the user's profile metadata immediately upon registration.
  - **Center Association:** If the `mentor_id` exists on a user record, the UI must automatically route them to that specific Mentor's Center/Dashboard. If this fails, the system must show a 'Mentor Connection Pending' status instead of an error.
  **2. Dual-Engine Copy Trading Architecture:** We need two distinct execution flows implemented in our backend service:
  - **Flow A (Idea-Triggered Execution):** When a Mentor publishes an 'Idea' (via our publishing tool), trigger a background job that:
    1. Queries all users linked to that Mentor who have 'Copy Trading' or 'AI Bot' toggled ON.
    2. Pushes a trade execution command to each client's linked MT5 account with the parameters defined in the published idea.
  - **Flow B (Real-time Mirroring):** Implement a service that monitors the Master Mentor’s MT5 trading account via our `mt5_service.py`. When a new trade is opened on the Master account, the service must:
    1. Identify all active Followers of that specific Master.
    2. Mirror the trade (Open/Modify/Close) onto those followers' trading accounts immediately.
  **3. Infrastructure Alignment:**
  - **API Routing:** All frontend API calls must be directed to our active VPS endpoint: `https://municipal-posh-shading.ngrok-free.dev`.
  - **Resilience Layer:** If the connection to the primary database or MT5 server fails, the system should log the error and check the `credentials_cache.json` for stored account credentials to maintain local uptime.
  - **Connection Monitor:** Add a component to the Dashboard that pings the VPS backend and provides a clear status indicator (Online/Reconnecting).
  **4. Goal:** Remove the 'account is not a mentor' error and ensure that every user registered under a Mentor's link is correctly 'docked' into that Mentor's Center with Copy Trading active by default if they opt-in."
  ### Why this prompt will work:
  - **Separation of Concerns:** It separates the **Role Fix** (Mentor ID assignment) from the **Execution Fix** (Copy Trading).
  - **Dynamic Logic:** It asks Lovable to implement a "State Monitor" (checking for `mentor_id` in metadata) rather than relying on hardcoded checks that were failing.
  - **VPS Integration:** By explicitly mentioning the Ngrok URL and the `credentials_cache.json`, you are forcing Lovable to stop trying to use local `localhost` logic and start building for your actual production VPS environment.
  Ensure your `credentials_cache.json` is perfectly formatted (as we discussed previously). When Lovable asks for the backend configuration, you can now confidently point them to this file as the "source of truth" for your trading accounts, which makes their job of writing the integration code much easier.  
    
  Remember that we are not looking to change the structure that we are currently operating in, uh, but we want to place our new, newly, um, implemented server to be the primary one where, uh, you should be able to communicate to, uh, the VPS as a primary engine. And you, you will use the Meta API-- APIs as our backup, as our fallback. And we need to make sure that this is done properly and is aligned properly with our UI, is aligned properly with the, uh, the code that is currently there, and also aligns properly with the MetaTrader documentation, API documentation that actually, um, guides us on how to achieve this.  
    
