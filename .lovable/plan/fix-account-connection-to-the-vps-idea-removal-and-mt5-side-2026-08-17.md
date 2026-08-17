# Fix account connection to the VPS, idea removal, and MT5-side copy trading

## What's actually broken (verified)

**1. The app never even tries the VPS bridge.** The project's `.env` contains only the three Supabase variables — `VITE_API_URL` is **not** present (only `.env.example` has a blank placeholder). Every VPS call path is gated on it:

- `src/services/primaryApi.ts` returns `isPrimaryConfigured() === false`
- `ConnectAccountModal` therefore logs "VITE_API_URL not configured — skipping VPS" and jumps straight to MetaAPI
- MetaAPI answers with quota depletion, which the edge function converts into exactly the message users see: *"Trading Bridge capacity is temporarily exhausted. Please retry — the app will attempt the VPS bridge automatically."* The retry message is a lie today, because there is no VPS attempt.

This is not user-specific. Confirmed for both reported accounts: `nkululekongqobe@gmail.com` and `joohcehacks@gmail.com` have **active `basic` subscriptions** (expiring 17 Sep and 14 Sep) and **zero** rows in `trading_accounts` — so the admin renewal worked and no quota trigger is blocking them. The failure is purely the missing VPS route.

**2. Mentors can't remove a published idea.** No delete/remove control exists in Mentor Hub. Confirmed on the DB side too: `trading_signals` has mentor INSERT and UPDATE policies but no mentor DELETE policy — so soft-delete via the existing UPDATE policy is the correct fix and needs no schema change.

**3. AI-generated ideas store the literal string `"N/A"**` for SL/TP in `KhumoForexSessions` when parsing fails.

## The fix

### A. Make the VPS bridge configuration-proof (root cause)

Stop depending on a browser build variable that can vanish. The `vps-proxy` edge function already holds `VPS_API_URL` + `VPS_API_SECRET` server-side and already whitelists the `connect` route with an ownership check.

- Re-add `VITE_API_URL` to `.env` (the ngrok reserved domain) so local/preview keeps working.
- Change `primaryApi.ts` so `isPrimaryConfigured()` no longer depends on `VITE_API_URL`: all calls go through `vps-proxy`, and the proxy reports "VPS not configured on server" if the secret is missing. The browser URL becomes optional (used only for the direct `/health` badge).
- Add a `health` route to `vps-proxy` and point `PrimaryStatusBadge` + the "Test VPS" button at it, so the status badge reflects the same path the connect flow uses instead of a direct ngrok call from the browser.
- In `ConnectAccountModal`, when MetaAPI comes back with `code: 'METAAPI_QUOTA'` after a failed VPS leg, show the real VPS reason (login rejected / bridge offline / not configured) instead of the misleading capacity message.
- Verify with a live connect attempt through the proxy and read the edge-function logs.

### B. Remove a published idea (Mentor Hub)

- Add `removeSignal(signalId)` that updates `status: 'removed'` scoped to `.eq('mentor_id', profile.id)` — allowed by the existing UPDATE policy.
- Add a small destructive-styled "Remove" button next to the timestamp on each Ideas-tab signal card, with a confirm step.
- Add `.neq('status', 'removed')` to the Mentor Hub signals query so removed ideas don't reappear. Removed ideas also drop out of client views automatically, since the public SELECT policy only exposes `status = 'active'`.

### C. AI idea pricing / SL-TP correctness

- Replace the `"N/A"` fallbacks with empty strings in `KhumoForexSessions`.
- Normalize SL/TP on insert: parse numerically, reject non-numeric, and if the model omits a level, derive a standard one from the live entry price (instrument-aware pip distance) rather than inserting null.
- Sanity-check direction (BUY: SL below entry, TP above; inverse for SELL) and swap/recompute if the model returns them inverted — that is the most likely reason a generated idea gets rejected at the broker.
- Route generated-idea publishing through the same normalized insert → `broadcastSignal` → `runCopyFanOut` path used by manual ideas, so execution behaviour is identical.

### D. Generate Idea on the main dashboard Trading Ideas page

Mount the existing `KhumoForexSessions` component into `src/pages/TradingIdeas.tsx` (placement only, no new generation logic), wired to the same normalized insert + fan-out path.

### E. Copy trading directly from the MT5 platform

The mirroring of trades a mentor places by hand in the MT5 terminal runs on the VPS, not in this app. Deliverable here:

- Finalize `master_watcher.py` (poll master terminal positions, diff against last snapshot, post new trades to `copy-trade-listener`) and provide the exact VPS install/run steps — it is not in this repo, so it needs to be (re)delivered as a file for you to drop on the Windows VPS.
- Add a Supabase-side ingest guard so watcher-originated trades are attributed to the mentor's master account and fan out through the existing listener.
- This step needs the VPS console output (lines prefixed `[master_watcher]`) to confirm the watcher starts, finds the master account, and logs in — without it the XAUUSD mirroring failure can't be diagnosed.

## Order of work

1. A (unblocks all users connecting accounts) — highest priority
2. B (mentor idea removal)
3. C + D (idea pricing + dashboard placement)
4. E (MT5 terminal mirroring, needs VPS logs)

## What I still need from you

- The **exact toast/error text** shown when an AI-generated idea fails to execute (to confirm C is the cause rather than a symptom). - This is what we get from the Metatrader 5 platform which maybe shows the issue - 2026.08.17 07:10:56.700	Trades	'43114765': failed market buy 0.01 EURUSD_i sl: 1.07950 tp: 1.08850 [Invalid stops]
  These are points that are executed by our generator, these somewho do not get to be executable. but when we manually post ideas, the trades do go through.
- The **VPS console output** for `[master_watcher]` lines.
- Confirmation that the ngrok reserved domain is still the correct VPS base URL, and that the same URL is set as `VPS_API_URL` in Supabase secrets and in the Vercel env.