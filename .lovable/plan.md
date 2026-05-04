# Plan: Default Mentor Linking, MetaAPI Provisioning Fix, MT Terminal Copy Trading & UI Polish

## 1. Auto-link direct registrants to the main mentor ([mphoforex5@gmail.com](mailto:mphoforex5@gmail.com))

**Goal:** Users who register directly (no `/ref/:slug`) should be silently linked to the default mentor `KHUMO AI COPY TRADING` (slug: `apex-copy-trading-m9ef`). Their **Home** stays the HuMi dashboard, but clicking **Mentor Center** opens the **client view** (`/mentor-dashboard`), not the mentor's admin view.

### DB

- Migration: insert a config row in a new `app_settings` table (key `default_mentor_slug` = `apex-copy-trading-m9ef`) so the default can be changed later without a redeploy.
- New trigger / edge function `link-default-mentor`: on new auth user, if no `mentor_clients` row exists for them after 5s (no referral cookie was applied), insert one pointing at the default mentor's `id`.

### Frontend

- `MentorContext.tsx`: when `mentor_clients` lookup returns the default-mentor record, set `isMentorClient = true` but also expose `isDefaultMentorClient` so that:
  - `MentorAwareHome` in `App.tsx` does **NOT** redirect them to `/mentor-dashboard` (they keep the regular HuMi dashboard).
  - The sidebar/bottom-nav "Mentor Center" link routes them to `/mentor-dashboard` (client view) instead of `/mentor-center` (which is the mentor admin tool).
- `AppSidebar.tsx` + `BottomNav.tsx`: when `isMentor === false`, the "Mentor Center" entry points to `/mentor-dashboard`. Mentors keep `/mentor-center` and `/mentor-hub`.

## 2. Subscription prompt on Copy & Ideas tabs (MentorClientDashboard)

Currently only the Home "Connect Account" button gates on subscription. Add the same `showSubscribePrompt` check to:

- Ideas tab → "Execute" button.
- Copy tab → "Activate Copy Trading" button.
- Bot tab → activate-bot button.

If the user is on Free tier, open the existing upgrade dialog with copy explaining the required tier (Basic for copy/ideas execution; Professional+ for AI bot).

## 3. Remove visible "metaapi" branding

- `MentorHub.tsx` line 443 and `MentorClientDashboard.tsx` line 354: replace `<Badge>{acc.provider}</Badge>` with a helper `getProviderLabel(acc)` that maps `metaapi` → `MT4/MT5`, `deriv` → `Deriv`. Reuse the helper from `TradingIdeas.tsx` (already exists).
- Audit and rename remaining user-visible "MetaAPI" strings in `TradingAccounts.tsx`, `brokerExecution.ts` log labels stay (internal), and `ConnectAccountModal` ("Trading Bridge" already).

## 4. MetaAPI provisioning — enforce real account IDs

**Problem in DB:** rows like `metaapi_account_id = '131'` and `'136373'` exist — these are MT login numbers, not MetaAPI UUIDs. The provisioning function returned a non-UUID id and we stored it.

### Edge function `metaapi-provision-account`

- Add strict validation: `metaapi_account_id` must match UUID regex `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. If not, run the `?query=login` lookup fallback (already partially there) and only persist a UUID. If still none, return `success: false` with a clear error so the client surfaces the failure instead of writing junk.
- Also write `connection_status = 'failed'` on the client side when the function returns no UUID, so the user sees the broken state in `TradingAccounts`.

### Backfill

- Migration script: set `connection_status = 'failed'` and clear `metaapi_account_id` for rows where the value is not a UUID (logins `2001995049`, `47021450`). User can re-attempt connection.

### Client (`ConnectAccountModal.tsx`)

- After invoking `metaapi-provision-account`, validate the returned id is a UUID before inserting into `trading_accounts`. Surface "Could not auto-provision — please retry or contact support" toast on failure.

## 5. Copy trading from the MT4/MT5 terminal (mirror trades placed in MetaTrader)

**Goal:** When a mentor places a trade directly inside MT4/MT5 on their master account, the trade should appear on every linked client's account automatically.

### Architecture

We already have CopyFactory enabling (`metaapi-enable-copy-factory`) and a `copy-trade-listener` that fires from app-published signals. We need a server-side **broker-side** listener:

1. **Provider strategy creation** (one-time per master account): when a mentor toggles `is_master = true`, call `metaapi-enable-copy-factory` (PROVIDER role) and `copyfactory-create-strategy`. Store the strategy id on `trading_accounts.copyfactory_strategy_id` (new column).
2. **Subscriber subscription**: when a client clicks "Activate Copy Trading", call `copyfactory-subscribe` to link their account to the mentor's strategy. CopyFactory then mirrors any trade the mentor places inside MT terminal automatically — no polling needed.
3. **Resolving the mentor's master account:**
  - Referred clients: use the master account belonging to `mentor_profiles.user_id` where `is_master = true`.
  - Direct/default-mentor clients: use the master account of `mphoforex5@gmail.com`'s `mentor_profiles.user_id`. Currently `PXBTT` (login 1044161) is already flagged `is_master = true` ✅. Here we want to use the account that we have currently slected to be Copy Enabled (Users can copy that account's trades).  The Trading Account enabled was the best one connected and now we need it to be reconnected and attached on the MetaAPI Dashboard, e.g The Headway-Live Account was connected successfully at some point, but now after not having credits we are now unable to use the account, which seems to be removed or deprovisioned, this account shows on the MetaAPI Dashboard but we cannot connect to the broker (Through MetaAPI) this shouldn't happen at all with linked trading accounts.

### Schema additions (migration)

```sql
ALTER TABLE trading_accounts ADD COLUMN copyfactory_strategy_id text;
ALTER TABLE copy_trading_relationships ADD COLUMN copyfactory_subscriber_id text;
```

### Edge function changes

- `copyfactory-create-strategy`: ensure strategy is created/idempotent on master toggle. Persist `copyfactory_strategy_id`.
- `copyfactory-subscribe`: on client activation, register subscription with multiplier 1.0 (configurable later). Persist subscriber id.
- Remove the in-app polling fallback path for MT-terminal trades — CopyFactory handles mirroring server-side.

### Frontend

- `MentorClientDashboard.tsx` "Activate Copy Trading": after the subscription tier check, call `copyfactory-subscribe` with `{ masterAccountId, followerAccountId }`. Show success toast: "You're now mirroring [mentor]'s MetaTrader trades automatically."
- `MentorHub.tsx`: when mentor toggles `is_master`, call `enable-copy-factory` then `create-strategy`. Surface strategy status badge on the master account card.

## 6. Mobile UI polish (Mentor Center, Mentor Hub, Admin Panel)

- Wrap top-level tab lists in `<div className="overflow-x-auto -mx-4 px-4">` with `whitespace-nowrap` on `TabsList` so tabs scroll horizontally on phones (already partial in MentorCenter — extend to MentorHub + AdminPanel).
- Admin Panel `UserManagementTab.tsx`: convert action button row to `flex flex-wrap gap-2`; make the table horizontally scrollable (`overflow-x-auto`); shrink action labels to icons-only below `sm` breakpoint.
- Same treatment for `MentorManagementTab.tsx` and `TransferMonitoringTab.tsx`.

## Implementation Order

1. Migration: backfill bad `metaapi_account_id` rows; add `copyfactory_strategy_id` & `copyfactory_subscriber_id` columns; add `app_settings` table with default mentor slug.
2. Fix `metaapi-provision-account` UUID validation + client validation in `ConnectAccountModal`.
3. Default-mentor auto-link (DB trigger + `MentorContext` flag + nav routing).
4. Provider-label helper, replace `acc.provider` badges in MentorHub & MentorClientDashboard.
5. Subscription prompts on Ideas/Copy/Bot tabs in MentorClientDashboard.
6. CopyFactory wiring: master toggle creates strategy; client activate subscribes.
7. Mobile responsiveness pass on Admin Panel, Mentor Hub, Mentor Center tabs/tables.

## Out of scope (flag to user)

- Building a brand-new MetaAPI account from broker credentials with zero MetaAPI charges — provisioning still consumes MetaAPI credits per account; no way around that.
- Rewriting Deriv copy trading (this plan only covers MT4/MT5 → MT4/MT5 via CopyFactory).  
  
MetaAPI Account Health, De‑Provisioning Detection & Repair System
  **Admin Panel Only**
  ---
  ## Objective
  Implement a **robust, admin‑only MetaAPI account health and recovery system** that allows **Admins (and only Admins)** to:
  - See all broken, paused, or de‑provisioned MetaAPI trading accounts
  - Understand *why* an account is broken
  - Fix or recover accounts using **clear buttons and guided instructions**
  - Never lose visibility of an account due to MetaAPI credit loss or de‑provisioning
  - Avoid silent failures or “ghost” accounts
  This system **must integrate only into the Admin Panel**.  
  No client or mentor UI changes are required.
  ---
  ## 1️⃣ Core Requirement: Persistent Account Visibility
  **Trading accounts must never disappear or silently fail**, even if:
  - MetaAPI credits are exhausted
  - MetaAPI de‑provisions or pauses the account
  - The account cannot sync or connect
  - Credentials become invalid
  Instead:
  - Accounts remain visible
  - Accounts are marked with a **clear health state**
  - Admins are given tools to fix them
  ---
  ## 2️⃣ Computed MetaAPI Health Status (Admin‑Only)
  Introduce a **computed account health state** derived from live MetaAPI responses, **not only stored DB flags**.
  ### Derived Field (computed)
  `metaapi_health_status`
  Allowed values:
  - `healthy`
  - `metaapi_deprovisioned`
  - `metaapi_paused`
  - `insufficient_metaapi_credits`
  - `credentials_invalid`
  - `connection_failed`
  - `unknown_error`
  ✅ This value is **computed on demand** (and optionally cached), not blindly trusted from old data.
  ---
  ## 3️⃣ Detection Logic (Admin Panel)
  Create an **Admin‑only MetaAPI Health Check** that runs when:
  - Admin opens the Trading Accounts section
  - Admin views an individual trading account
  - Admin presses a “Refresh Status” button
  ### Detection Rules

  | MetaAPI Response              | Health Status                  |
  | ----------------------------- | ------------------------------ |
  | Valid MetaAPI UUID + sync OK  | `healthy`                      |
  | Account not found / 404       | `metaapi_deprovisioned`        |
  | Insufficient credits error    | `insufficient_metaapi_credits` |
  | Account paused                | `metaapi_paused`               |
  | Invalid broker login/password | `credentials_invalid`          |
  | Sync/connection failure       | `connection_failed`            |
  | Any other error               | `unknown_error`                |

  🚨 **Never overwrite** `metaapi_account_id` **with MT login numbers**  
  🚨 **Never mark an account “ok” without validating the UUID**
  ---
  ## 4️⃣ Admin Panel UI Requirements (Only Admins)
  ### Trading Accounts Table (Admin)
  Add:
  - Column: **MetaAPI Status**
  - Colored badge for each status
  - Filter: **Show only unhealthy accounts**
  - Summary badge in admin header:  
  “⚠ X MetaAPI accounts need attention”
  ---
  ## 5️⃣ Admin Repair Actions (Buttons)
  For each unhealthy account, show **context‑aware actions**:
  ### Always Available
  - **Refresh Status**
  - **Open MetaAPI Dashboard** (deep link)
  ### Conditionally Available
  - **Retry Provisioning**
  - **Reconnect Account**
  - **Mark as Inactive** (soft‑disable, no deletion)
  Buttons must be **safe**, **idempotent**, and clearly labeled.
  ---
  ## 6️⃣ Guided Fix Modal (Critical)
  Clicking **“Fix Account”** opens an **Admin‑only diagnostic modal**.
  ### Modal Content (Dynamic)
  #### Example: De‑Provisioned Account
  > 🔴 This trading account has been de‑provisioned on MetaAPI.
  **Possible causes**
  - MetaAPI credits exhausted
  - Account paused or removed in MetaAPI dashboard
  **Steps to fix**
  1. Open the MetaAPI dashboard via the button below
  2. Ensure sufficient credits are available
  3. Re‑enable or recreate the account
  4. Return here and click **Reconnect**
  Include:
  - “Open MetaAPI Dashboard” button
  - “Reconnect” button
  - Last known MetaAPI error message
  ✅ Modal content must vary based on `metaapi_health_status`.
  ---
  ## 7️⃣ Strict Provisioning & Reconnection Rules
  ### Hard Rules
  - If MetaAPI does **not** return a UUID → provisioning fails
  - On failure:
    - Set `connection_status = 'failed'`
    - Update `metaapi_health_status`
    - Show failure clearly in Admin Panel
  ### Never:
  - Store MT login numbers as MetaAPI IDs
  - Silently retry without admin visibility
  ---
  ## 8️⃣ Optional but Recommended: Admin Alerting
  - Scheduled job checks MetaAPI health (e.g. every X hours)
  - Newly broken accounts flagged automatically
  - Admin header shows alert count
  ---
  ## 9️⃣ UX Principle (Admin Panel)
  > **Admins must immediately see what is broken, why it’s broken, and how to fix it.**
  No logs required.  
  No guesswork.  
  No silent failures.
  ---
  ## ✅ Final Outcome
  After this implementation:
  - All MetaAPI failures are visible in the **Admin Panel**
  - De‑provisioned accounts are clearly flagged
  - Admins can fix or reconnect accounts with buttons or guided steps
  - MetaAPI credit issues are never confusing or hidden
  - Copy trading and execution issues are easier to diagnose
  - Support and debugging time is dramatically reduced