# Publish → Copy Trading confirmation, landing above-the-fold, client dashboard subscription surfaces

Verified against live files before writing this plan. Findings first, then the scoped changes.

## What is actually live right now

- **MentorHub publish** (`src/pages/MentorHub.tsx`, `publishSignal` ~line 240): inserts into `trading_signals` with `auto_to_ai_bot` / `auto_to_copyfactory` from the checkboxes, calls `broadcastSignal(...)`, then invokes `copy-trade-listener` with `{ signal_id, master_user_id: user.id }`. Wiring exists.
- **MentorCenter publish** (`src/pages/MentorCenter.tsx` ~line 330 and a second flow ~line 445): it is NOT missing the fan-out — it also calls `broadcastSignal` and `copy-trade-listener`, but with `auto_to_ai_bot: true` / `auto_to_copyfactory: true` hardcoded (no opt-out checkboxes, unlike Mentor Hub).
- **Admin publish** (`src/pages/Admin.tsx` ~line 122): fans out `copy-trade-listener` once per distinct master `user_id`.
- **The reason nobody can confirm it works**: in all three flows the invoke result is discarded — `.catch(e => console.warn(...))`. `copied_count` / `failed_count` / per-follower errors returned by `copy-trade-listener` are never shown or stored, and the toast says "published & broadcast!" even when every follower failed. That is the actual blocker on open issue 1, not missing wiring.
- **Landing page** (`src/pages/Auth.tsx` line 251): hero is `min-h-[100svh]`, so the three `FeatureCard`s (lines ~347-358) always sit below the fold. `Lightbulb`, `Copy`, `Bot` are already imported.
- **Mentor Client Dashboard** (`src/pages/MentorClientDashboard.tsx`): the expired-subscription banner and Subscription menu link were NEVER applied. The page only has a "Subscription Required" dialog (line ~625) triggered by `isFree`, and the account dropdown (lines ~302-312) has Profile / Settings / Main dashboard only — no Subscription item. Confirmed not present.

## Changes to make

### 1. Make publish → copy fan-out observable and truthful
`src/pages/MentorHub.tsx`, `src/pages/MentorCenter.tsx` (both publish flows), `src/pages/Admin.tsx`:
- Await the `copy-trade-listener` invoke and read `data.copied_count` / `failed_count` / `results`.
- Report the real outcome in the toast: "Published — copied to N followers" or "Published, but 0 of N followers filled: <first error>" (destructive variant when `copied_count === 0` and followers existed).
- `console.info` the full `results` array so the per-follower reason (insufficient margin, missing credentials, terminal deploying) is visible in the browser console during a live publish test.
- Also surface the `broadcastSignal` result (`aiBot` / `copyFactory` / `primary` legs) in the same console log so the AI Bot leg is testable from the same button press.

### 2. MentorCenter parity with Mentor Hub
Add "Broadcast to Copy Trading" and "Send to AI Bots" checkboxes to the MentorCenter publish dialog and pass them into both the insert (`auto_to_copyfactory` / `auto_to_ai_bot`) and `broadcastSignal` options, instead of hardcoded `true`. When copy broadcast is unchecked, skip the `copy-trade-listener` invoke.

### 3. Landing page — features above the fold
`src/pages/Auth.tsx`: insert a compact three-chip row (Trade Ideas / Copy Trading / AI Bot Access, with the already-imported icons) directly under the CTA buttons inside the `min-h-[100svh]` hero, so it is on screen with the buttons on mobile and desktop. The detailed `FeatureCard` grid below stays untouched.

### 4. Mentor Client Dashboard subscription surfaces
`src/pages/MentorClientDashboard.tsx`:
- Add a dismissable-free banner at the top of the page when `!subscription || subscription.status !== 'active'` (or `isFree`), stating access is limited, with a "View Plans" button to `/subscription`, styled with the mentor's `primaryColor`.
- Add a `Subscription` (CreditCard icon) item to the account dropdown navigating to `/subscription`.

### 5. Verification I will run after the edits
- Typecheck the touched files.
- Drive the landing page in a headless browser at mobile (390x844) and desktop viewport and screenshot to prove the three feature chips are visible without scrolling.
- Query `trading_signals` and `trade_history` (read-only) to confirm the most recent published signal produced follower rows, and report the actual rows/errors found.
- Report the exact `copied_count` / `failed_count` observed. Where failures are real broker rejections (e.g. retcode 10019 insufficient margin on an underfunded demo), I will report the account balance rather than treat it as a code bug.

## Out of scope (not touching)
`vps-proxy`, `primaryApi.ts`, `trades.py` / VPS `/copy-trade`, `brokerExecution.ts` execution semantics and the `metaapi_fallback_approved` gate, `copy-trade-listener` internals (probe / session reuse / retry / redeploy), payments and the pending-payments queue, subscription expiry cron, Trading Accounts verify-connection button.
