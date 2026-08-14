# Fail-fast copy trading + client-side connection verify

## 1. Revert the /order timeout (root cause of the new failures)

In `supabase/functions/copy-trade-listener/index.ts`:

- `/order` fetch timeout goes from 25s back to **8s**.
- **No retry on timeout.** The current code retries on any non-success, which doubles the hold on the single shared MT5 terminal. New rule: retry once only when the first attempt failed with a *genuine transient* signal (network unreachable / HTTP 5xx). A timeout or a broker-level rejection returns immediately.
- Keep the one-time bridge `/health` probe (it already fails fast when the bridge is down).
- `ensureVpsSession()` stays, but it becomes cheap: session is cached per account per invocation (already true) and the `/connect` timeout is capped short so a bad login (e.g. OctaFx) cannot hold the shared lock. On a failed connect we skip `/order` entirely and go straight to the MetaAPI fallback / audit row with the exact reason.
- Net effect: worst case per bad follower is one short connect + one short order, not two 25s hangs — so a Mentor Hub publish can no longer block a main-dashboard publish.

## 2. "Add Account" should just open the Trading Accounts page

`src/pages/Index.tsx` quick action currently navigates to `/accounts?connect=1`, which auto-opens the connect dialog. Change it to `/accounts` so the user lands on the page and chooses from there. (The shield/verify button already lives on that page — nothing else to build.)

## 3. Verify Trading Connection on the client-facing branded dashboard

`src/pages/MentorClientDashboard.tsx`: add a **Verify Trading Connection** item to the account dropdown, right under Subscription. It finds the user's VPS-capable account, calls the existing `verify-vps-connection` edge function, and toasts one of three outcomes: verified, reconnect needed (send them to Trading Accounts), or verification failed with the returned error. Adds the `ShieldCheck` icon import.

## Not included (VPS-side, outside this project)

`master_watcher.py` and the `main.py` startup hook run inside your FastAPI app on the Windows VPS. This repo is the React app + Supabase edge functions; it cannot host or deploy Python. Your pasted code is correct as written and shares the same `mt5_lock`, so drop it in on the VPS as-is. One note: the watcher inserts into `trading_signals` with the service key — that's fine, and `copy-trade-listener` will fan it out through the same fail-fast path above.

Also flagging: the `service_role` JWT was pasted in the message above. It bypasses RLS entirely — rotate it in the Supabase dashboard once the watcher is deployed, and keep it only in the VPS environment, never in app code.
