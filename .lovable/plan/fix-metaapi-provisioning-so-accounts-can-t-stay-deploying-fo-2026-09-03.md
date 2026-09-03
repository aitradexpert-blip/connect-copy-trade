# Fix MetaAPI provisioning so accounts can't stay "deploying" forever

## What's wrong today (verified)

- `metaapi-provision-account` polls for deployment for at most **15s** (5 × 3s), then returns `success: true` regardless of the real state. Nothing follows up afterwards.
- The row is written with `connection_status: 'connected'` even when MetaAPI reported `CREATED`/`DEPLOYING`. So the app believes the account is ready while MetaAPI never finished.
- No provisioning state or error is stored anywhere: for **all 19 MetaAPI accounts** `metaapi_health_status = 'unknown'`, `metaapi_last_error = NULL`, `metaapi_health_checked_at = NULL`. Those columns are only written when an admin clicks the MetaAPI Health tab.
- No background job exists (the only cron job is `expire-stale-subscriptions-hourly`), so a half-deployed account is retried only opportunistically at trade time, which is why it reports "still starting up" indefinitely.

## The fix

### 1. Record the truth at provisioning time

In `metaapi-provision-account`, after the existing 15s poll window:

- If the account reached `DEPLOYED`, write `metaapi_health_status = 'healthy'`.
- If not, keep the row but write `connection_status = 'provisioning'`, `metaapi_health_status = 'deploying'`, `metaapi_last_error` = MetaAPI's last reported `state` + `connectionStatus`, and `metaapi_health_checked_at = now()`.
- On a hard MetaAPI error (E_AUTH, E_SERVER_NOT_FOUND, quota), store the reason in `metaapi_last_error` and set `metaapi_health_status = 'error'`.

`provisioning` is already an allowed value in the `enforce_metaapi_consistency` trigger, so this is safe.

### 2. New follow-up worker: `metaapi-finalize-deployments`

A new edge function that:

- Selects MetaAPI accounts that are not yet healthy (`metaapi_health_status in ('deploying','error',null)` or `connection_status = 'provisioning'`), oldest-checked first, capped per run (e.g. 20).
- For each, reads the real account from the provisioning API. If `state = DEPLOYED` and `connectionStatus = CONNECTED` → mark `connected` / `healthy`, clear the error. If `UNDEPLOYED`/`CREATED` → issue one `deploy` (or `redeploy`) call. If MetaAPI returns an auth/server error → mark `metaapi_health_status = 'error'` with the exact message and stop retrying that account.
- Applies an escalating give-up rule: after ~30 minutes still not deployed, set `connection_status = 'needs_reconnect'` with the reason, so it is excluded from fan-out instead of silently failing every publish.
- Writes `metaapi_health_checked_at` on every pass.

Scheduled every 5 minutes via `pg_cron` + `pg_net` (same pattern as the existing hourly job).

### 3. Make the state visible and actionable

- **Trading Accounts page**: for accounts in `provisioning` / `deploying`, show a "Finishing setup…" badge with the last checked time and a "Check now" button that invokes the finalize function for that one account; for `error`, show the stored reason and a "Reconnect" action.
- **Admin → MetaAPI Health tab**: already renders `metaapi_health_status` / `metaapi_last_error`, so it starts showing real data once the columns are populated; add a "Finalize all pending" button that runs the worker on demand.

### 4. Immediate one-off reconciliation

Run the finalize worker once against the three currently stuck accounts to get their real MetaAPI `state`, `connectionStatus`, and error reason on the record — that determines whether they need a redeploy or a credential/server fix.

## Not touched

Per the protected baseline: `copy-trade-listener`, `publishFanOut.ts`, `primaryApi.ts` rebind logic, and `verify-vps-connection` are left exactly as they are. The only behavioural overlap is that accounts flagged `needs_reconnect` by the worker are already skipped by the existing fan-out logic — no change needed there.

## Technical notes

- New file: `supabase/functions/metaapi-finalize-deployments/index.ts` (service-role client, `verify_jwt = false` entry in `config.toml`, accepts optional `accountId` for the single-account "Check now" path).
- Migration: cron schedule only; no schema change is required — `metaapi_health_status`, `metaapi_last_error`, `metaapi_health_checked_at` and `mt5_password` all already exist on `trading_accounts`.
- Edits: `supabase/functions/metaapi-provision-account/index.ts` (persist state), `src/pages/TradingAccounts.tsx` (badge + Check now), `src/components/admin/MetaApiHealthTab.tsx` (Finalize all).  
  
Suggest ways to look at, check if they work and check if they will help with Copy Trading system issue where we are unable to execute trades directly to metatrader accounts on the VPS when publishing Trade Ideas, remember we are able to manually execute trade ideas from the ideas page on the app, with Copy Trading this needs to go straight the Metatrader account which activated Copy Trading:  
  
**Asynchronous Request Queuing** If the bridge endpoint waits for the MT5 terminal to fully process the order (e.g`mt5.order_send()`) before returning an HTTP response, any broker latency or internal queue lock will cause the 8-second window to breach. Modify the local bridge script to accept the webhook, instantly return a `200 OK` (acknowledging receipt), and push the signal into a local background queue (e.g`asyncio.Queue` or `queue.Queue`) for sequential execution.
  **Strict Thread-Locking for MT5 API Calls** The official MetaTrader 5 Python package is notoriously sensitive to concurrent calls. If multiple signals hit the follower bridge at roughly the same time, simultaneous calls to initialize, login, or place orders will freeze the terminal API. Wrap all `mt5` interactions in a global threading lock (similar to your `mt5_lock` in the master watcher) to ensure commands execute one by one without deadlocking.
  **Extend the Timeout Threshold** An 8-second timeout is very aggressive for trading operations, especially during high-volatility market openings or when broker execution speeds dip. Increase the Edge Function's fetch timeout (e.g., from 8s to **15–20 seconds**) to give the VPS bridge enough breathing room to complete network handshakes with the broker server.
  **Check for Sequential Login Conflicts on Single Terminals** If a single VPS instance hosts the bridge script for multiple follower accounts and attempts to cycle through them using `mt5.shutdown()` and `mt5.login()` dynamically, race conditions will occur. Ensure that if multiple accounts share a VPS, each account runs inside its own isolated terminal instance (with its own dedicated port/path) or that the switching logic has sufficient cool-down delays (e.g., 1–2 seconds) between account switches.