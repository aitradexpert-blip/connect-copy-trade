# Plan — Master/Follower Handshake, AI Bot Linking, Gateway Failover

This focuses on three confirmed bugs and the new gateway/health-check work. Backend (`mt5_service.py`, FastAPI) is out of scope for code edits — I'll only list the one VPS-side route you need to add.

## Bug 1 — `master_user_id` is set to the FOLLOWER's user id (root cause of broken copy chain)

`src/pages/CopyTradingNew.tsx:465` writes `master_user_id: user?.id` when a follower clicks Follow. This makes every relationship look like a self-copy, and `broadcastSignal` filtering by `master_user_id = mentor.user_id` returns zero followers — so trades never propagate.

Fix:

- Carry the master's real `user_id` into `masterTraders[]` (lines 158-180) as a new `master_user_id` field.
- In `followTrader`, set `master_user_id` to the master account's owner, never `user?.id`.
- Add a server-side guard via migration: trigger on `copy_trading_relationships BEFORE INSERT` that resolves `master_user_id` from `trading_accounts WHERE id = NEW.master_account_id` and overwrites whatever the client sent. This prevents future regressions and self-healing for existing wrong rows via a one-shot UPDATE.

## Bug 2 — AI bot subscription is signal-scoped, not account-scoped

`AIAutoTrading.tsx` writes one `ai_bot_assignments` row per *past* `signal_id`. `signalBroadcast.fanOutDirect` filters by `signal_id = NEW.id`, so a freshly published signal matches no assignments and AI-bot accounts never execute.

Fix:

- New nullable column `ai_bot_assignments.subscription_mentor_id uuid` (mentor whose signals this bot should auto-execute, NULL = any mentor).
- Activation path inserts a row with `signal_id = NULL`, `subscription_mentor_id = <mentor of selected master>` (or `NULL` for "all mentors"), `auto_execute = true`, `status = 'active'`.
- `broadcastSignal.fanOutDirect` selects bot accounts via `signal_id IS NULL AND auto_execute=true AND status='active' AND (subscription_mentor_id IS NULL OR subscription_mentor_id = signal.mentor_id)`.
- Keep the legacy per-signal flow working (don't break old assignment rows).

## Bug 3 — Master-status lifecycle has no MT5 validation

Toggling `is_master` is a raw UPDATE with no credential check, so a half-provisioned account can become a "master" that no broker request will ever match.

Fix in `toggleMasterStatus`:

- Block enable when `connection_status !== 'connected'` (already on the row) and surface a clear toast.
- Before flipping the flag, call `primaryApi.getAccount(metaapi_account_id)`; only on 200 set `is_master=true`. On failure: toast "Master activation failed — terminal unreachable. Try again or run Health Check".
- Add a "Re-sync" button next to disabled Follow buttons: re-runs `getAccount` and flips local `connection_status` once the engine answers.

## New — Gateway health, status badge, MetaAPI failover

VPS-side (you'll add this to `main.py` — outside Lovable):

```python
@app.get("/health")
async def health_check():
    return {"status":"online","engine":"FastAPI","mt5_status": mt5.initialize() if hasattr(mt5,"initialize") else False}
```

Frontend:

- Update `PrimaryStatusBadge` to ping `/health` (not the `/account?id=health` sentinel). Show three states: `VPS Online`, `Reconnecting…`, `Fallback (MetaAPI Cloud)`. On three consecutive failures the badge switches to red and a tooltip shows last successful sync.
- Failover is already partially in place: `executeMetaApiTrade` tries `primaryApi.sendOrder` first and falls back to the `metaapi-execute-trade` edge function on `PrimaryUnavailableError`. Extend the same pattern to `withFailover` reads — already done for `/account`, `/positions`, `/history`.
- New `src/components/admin/GatewayStatusCard.tsx` for the admin Trading Accounts area: rows for **VPS Gateway**, **MetaAPI Failover**, **Last DB Sync**. Pure read-only.

## Admin override — mentor / master flags

Extend `src/components/admin/UserManagementTab.tsx`:

- Per-user actions: "Make Mentor" / "Revoke Mentor" — inserts or deletes a `user_roles(role='mentor')` row (the sync trigger from last turn keeps `mentor_profiles` aligned only one-way, so this gives admins the manual switch).
- Per-account action on the user's trading accounts list: "Mark as Master" — runs the same validated path as Bug 3 above.
- Both actions go through a new `admin-set-flags` edge function so the service-role write bypasses RLS without exposing the key.

## Resilience messaging (offline-first)

- Wrap trade-execution toasts: catch network errors from `primaryApi.sendOrder` and show `"Syncing with engine…"` (amber toast) instead of red error, while the MetaAPI fallback runs in the background. Final outcome toast (success/fail) replaces it.
- No client-side credentials cache: the VPS owns `credentials_cache.json`. Frontend stays stateless on credentials — we only mirror engine connection status in UI.

## Migrations (one file)

1. `ALTER TABLE ai_bot_assignments ADD COLUMN subscription_mentor_id uuid REFERENCES mentor_profiles(id);` + index on `(status, auto_execute, subscription_mentor_id) WHERE signal_id IS NULL`.
2. Backfill: `UPDATE copy_trading_relationships r SET master_user_id = a.user_id FROM trading_accounts a WHERE r.master_account_id = a.id AND r.master_user_id = r.follower_user_id;`
3. Trigger `BEFORE INSERT OR UPDATE OF master_account_id ON copy_trading_relationships` that forces `NEW.master_user_id := (SELECT user_id FROM trading_accounts WHERE id = NEW.master_account_id)`.

## Files touched

- **Edit**: `src/pages/CopyTradingNew.tsx`, `src/pages/AIAutoTrading.tsx`, `src/services/signalBroadcast.ts`, `src/components/PrimaryStatusBadge.tsx`, `src/components/admin/UserManagementTab.tsx`, `src/components/admin/MetaApiHealthTab.tsx` (mount GatewayStatusCard).
- **New**: `src/components/admin/GatewayStatusCard.tsx`, `supabase/functions/admin-set-flags/index.ts`.
- **Migration**: one SQL file covering the three items above.

## Out of scope

- `mt5_service.py` and FastAPI route changes (you own the VPS deploy).
- Embedding `credentials_cache.json` in the browser — security risk and architecturally redundant with the VPS-owned cache.
- Pricing/billing surfaces.  
  
**The SQL Trigger:** The plan suggests a `BEFORE INSERT` trigger to resolve `master_user_id`. Ensure that your database (Supabase/PostgreSQL) has the correct permissions for the `authenticated` role to execute this trigger. If the trigger fails, your trade execution will fail. **Test this in the SQL Editor first.**
- **The Gateway Failover:** The plan assumes the frontend can handle a state change from "VPS Gateway" to "MetaAPI Gateway" smoothly. Ensure that when this failover happens, the *UI* communicates this clearly to the user. You don't want a user thinking they are trading on the VPS gateway when they are actually failing over to the cloud.

### My Recommendation for the "Final Boss" execution:

1. **Approve the Plan:** Tell Lovable: *"The plan is approved. Proceed with the migration and the refactor of the copy-trading engine."*
2. **The Manual Override (Crucial):** Regarding the `mphoforex5@gmail.com` issue: Ensure the `admin-set-flags` function is tested immediately after they implement it. You want to be able to fix that specific account in seconds.
3. **The "One-Shot" Update:** The migration plan includes a `Backfill` update. **Ask them to provide a dry-run log** before they run the migration on production. You want to see which rows are currently "broken" before the SQL command overwrites them.