# Close Idea and Verify the EUR/USD Copies

## Assessment of the proposed response

The app already has a shared close engine: `master-position-sync` can close a Master position and then closes follower copies sequentially through the existing VPS `/close` or MetaAPI path. `MentorHub` currently offers only Remove for Ideas. There is no `close-idea` function and no database trigger on `master_positions`; the existing close helper marks the linked Idea closed only after it finds follower rows. The easiest safe approach is to extend the existing close engine, not create a competing function, and add the missing database trigger.

The pasted response's statements about removing or restarting `master_watcher.py` cannot be confirmed from this project: that VPS file is not in the app repository, and I will not change VPS code or restart it. The app-side detector already exists. I will avoid watcher changes.

## Verified EUR/USD records

Live database reads show three `open` rows from October 28 linked to Idea `12052014-53f8-456b-a20c-eb027424bb48`, all with `master_ticket` unset:

- Yonela Fx: broker ticket `1386367119`, logged volume `6.79`, broker symbol `EURUSD`.
- Mpho PrimeXBT: broker ticket `71120121`, logged volume `0.3`.
- My trading Account: broker ticket `71120108`, logged volume `0.01`.

The Idea's lot size is `0.02`; Yonela's account metadata says connected VPS, risk 1%, and balance about 109,010. The currently-read copy listener caps its calculated volume at 1.00 lot, so the 6.79 record cannot be attributed to that current code path from these facts alone. I will inspect the live broker positions and execution evidence before concluding why it differs. I will not adjust the account or change a lot rule without evidence.

## Build and safety steps

1. Expose a read-only audit mode in the existing `master-position-sync` function, reusing its broker-position reader. It will verify account logins and exact broker tickets before any requested close; no trade-history status changes occur during audit.
2. For the three named EUR/USD rows, audit first. If a ticket is open, close largest first and one at a time, using the broker's currently reported position volume. Only accept the requested successful broker close result before marking that row closed. If a ticket is absent or the broker check fails, do not send a close order or mark it closed; report that result.
3. Add a Mentor Hub Close Idea action with an explicit confirmation. The existing edge function will validate that the signed-in user owns the Idea. If the Idea has an open linked Master position, use the existing Master-close flow and its sequential follower closes. If there is no open linked Master position, close only open follower rows linked to that exact Idea; never place an order on the Master's account in this fallback. Already-closed rows are skipped. Return per-account outcomes and show `N closed, M failed` with reasons, allowing a retry when follower closes fail.
4. Add a database trigger that changes the linked Idea to `closed` when a Master position transitions to closed, whether the close came from the app or terminal sync. This ensures client feeds remove the Idea even when follower matching returns no rows. Keep the Idea visible in Mentor Hub so failures can be retried or reviewed.
5. Add focused tests for owner-only authorization, no-Master fallback targeting followers only, idempotent skip of closed rows, and Idea status transition. Keep all VPS source/configuration and unrelated trading logic unchanged.

## Technical approach

- Extend `master-position-sync` with authenticated audit and `close_idea` modes; do not add a second edge function or new table.
- Use a database migration only for the trigger. The trigger will update only the linked `trading_signals` row and use a fixed `search_path`.
- Preserve the existing VPS `/close` contract and serial terminal behavior; do not send any close request until the audit confirms the exact ticket is open.
- Verify UI confirmation/result states, run focused tests and inspect the preview build logs. Do not run unrelated live trades.

## Not included

- Editing or restarting `master_watcher.py` or any VPS code.
- Bulk-closing or bulk-marking old trade rows.
- Changing the lot-sizing formula or account configuration without confirming the cause of the 6.79-lot discrepancy.
