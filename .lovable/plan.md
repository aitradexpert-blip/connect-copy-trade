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
