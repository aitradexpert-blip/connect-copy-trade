# Fix Close Mirroring End-to-End + Copy Switching

## Verified current state (real data, not guesses)

**Close fan-out (why XAUUSD didn't close followers):**

- Every follower `trade_history` row has `master_ticket = NULL` — verified across all open rows.
- `closeFollowers` matches followers only by `master_ticket` OR `signal_id`. Closes that worked (EURUSD, EURJPY, AUDUSD, one XAUUSD) matched via `signal_id`; the XAUUSD ticket 69711065 close matched 0 because the Master position points to signal `2c170ffc…` while the follower copies live under signal `977de8cd…` (the old dual-watcher split).
- The `master_ticket` backfill runs only once, at position-detection time — before the fan-out creates follower rows — so it never links and never retries.

**Copy switching:**

- Unique index `unique_master_follower (master_account_id, follower_account_id)` exists.
- `MentorClientDashboard.tsx` already has the correct upsert-by-exact-row-id flow (deactivate other accounts → find exact row → update by `id` / insert).
- `mphoforex5+copy@gmail.com` has two inactive rows to the same master; the fixed flow should switch without error — but the **Copy Trading page (CopyTradingNew.tsx)** path has not been checked/aligned yet, and that is where the user hit the duplicate-key error.

**VPS `/close`:** reached the route but died with `module 'services.mt5_service' has no attribute 'close_position'` — the Python service function is the missing piece. HuMi-side close logic is complete.

**Already built and untouched:** duplicate-trade claims (`copy_execution_claims` + SL/TP key), duplicate-signal trigger, `status='active'` filter on the Ideas feed, Master Positions card, in-app Close Trade button, one-watcher sync cron.

## The argument (and why this is the easiest effective design)

**Option 1 — perfect ticket mapping (how fxapis-style copiers do it):** record each follower's broker ticket against the Master's ticket the moment both exist, then closes are exact. Problem: we can't know the Master's ticket at fan-out time — the terminal watcher discovers it seconds *after* the copies are placed. Requires a background reconciliation loop. Close to what we already have, but heavy.

**Option 2 — match closes by account + symbol + direction only (no linking at all):** simplest possible; zero bookkeeping. Problem: if the Master holds two XAUUSD BUYs, closing one would close both follower copies. Acceptable only if the Master never hedges the same pair twice — a real risk we shouldn't accept silently.

**Option 3 (chosen) — layered matching, cheapest first:** at close time try, in order: exact `master_ticket` → `signal_id` → fallback `master_account_id + symbol + direction` for open rows that carry no links. Plus a cheap reconciliation: every sync pass backfills `master_ticket` onto open follower rows (by signal when known, else when exactly one open Master position matches symbol+direction). This makes Option 1's accuracy emerge over time for free, while Option 2's fallback guarantees a close can never again silently match 0 rows. No new tables, no VPS detection changes — the watcher already detects terminal closes correctly (close_source: terminal was recorded at 19:51).

A production-grade "confirm close on two readings" guard is deliberately **not** added: the watcher already re-checks the terminal login mid-read and claims the row atomically before fanning out; a second confirmation pass would add a full sync-cycle delay (up to a minute) to every close for a scenario the login check already covers.

## Changes

**1. Migration — one-off data repair (SQL only):**

- Backfill `master_ticket` on open `trade_history` rows from open/closed `master_positions` matched by `master_account_id` + normalized symbol + direction (only where exactly one match, so no ambiguity).

**2. `master-position-sync` edge function:**

- Every sync pass: backfill `master_ticket` onto open follower rows for that master (persistent linking, kills the race permanently).
- `closeFollowers`: layered matching (ticket → signal → symbol+direction fallback on unlinked open rows); always report matched count, and if 0 matched after a detected close, write an explicit warning row so silence is impossible.
- On successful close fan-out: set the linked `trading_signals.status = 'closed'` so the Idea leaves the active feed (the feed already filters `status='active'`).
- New `mode: 'repair'`: finds open follower copies whose master position is closed, closes them via the VPS `/close`, marks rows `closed` with `close_reason: 'master_closed_repair'`. Used once now to clean the ~10 orphaned open copies (XAUUSD, USDZAR, GBPUSD, AUD/CAD, USDCAD), reusable any time.

**3. VPS bridge (user pastes, we supply exact code):**

- Provide the `close_position(ticket, symbol)` function for `services/mt5_service.py` (ticket-based close, hedging-safe, structured retcode returned) and the `/close` route next to `/order`.
- Verify: `/docs` shows `/close`; a call with a fake ticket must return a structured "position not found" — never `AttributeError`.

**4. Copy switching:**

- Read the activation code path in `CopyTradingNew.tsx`; if it still bulk-updates, apply the same deactivate-others → exact-row upsert pattern as MentorClientDashboard.
- Browser-verify the switch with `mphoforex5+copy@gmail.com`: switch between Mpho Fx and Mpho PrimeXBT accounts, no duplicate-key error, relationship count stays 2 with exactly one active.

## Verification

1. `tsgo` typecheck + `bunx vite build` — real output reported.
2. VPS `/close` structured-response test with a fake ticket.
3. Run `repair` mode: the ~10 orphaned follower copies close and mark closed.
4. **Real-trade test, both paths:** open a small XAUUSD trade on the Master → confirm followers copy → close it via the in-app Close Trade button → confirm follower closes (`followers_closed > 0`). Repeat once closing directly in the MT5 terminal and confirm the watcher mirrors it. This is the acceptance test for "it works according to how we described".
5. Ideas feed shows the closed trade's idea removed.

Not in scope (per your instruction): the "Main Master publishes to all clients" rule, any VPS watcher changes, dedup rework.  
  
VPS bridge (user pastes, we supply exact code): - I do not think we have any problems here, we have seen that trades have been able to close when closing on the VPS and the Close Trade button in the app also worked at some point using the same VPS Code, changing it may only cause more errors so if we can try to keep the same VPS code and just adjust elsewhere.  
  
Ideas feed shows the closed trade's idea removed. - Sometimes trades do not close, we need to investigate why these trades do not close while others can