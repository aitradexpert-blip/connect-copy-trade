# HuMi Stabilization Plan — Sessions 1-4 + Core Flows + Notifications

This plan executes the four Lovable sessions you drafted, then closes the outstanding functional gaps in Ideas, Account Connect, Copy Trading (Dashboard + Mentor Hub/Center parity), AI Bot, and the Notification Center (in-app + phone push).

## Part A — Your 4 sessions (as specified)

1. **Session 1 — `src/pages/Index.tsx**`: remove horizontal `Tabs`, ship the single-column mobile layout (Welcome → Quick Actions → LatestSignalCard → Community & Support → Metrics/Voice/History → Khumo Sessions → Broker links → Economic Calendar). Add `LatestSignalCard` inline.
2. **Session 2 — `src/pages/Index.tsx**`: VPS-first `load()` / `refreshData()` using `primaryApi.getAccount/getPositions/getHistory` with silent fallback; drop the failing `metaapi-get-history` call.
3. **Session 3 — `src/pages/CopyTradingNew.tsx**`: active-copy status banner + `stopAllCopying`, VPS badges in account picker, VPS-aware mentor messaging.
4. **Session 4 — Security**: `vercel.json` headers + CSP, new `public/robots.txt`, Settings OAuth password guard via `user.identities`.

## Part B — Ideas pipeline (make Trading Ideas reliably deliver)

- Verify `MentorHub.publishSignal` and `MentorCenter.publishSignal` both:
a) insert into `trading_signals` with `mentor_id` (trigger `attach_default_mentor_to_signal` handles admin), b) call `broadcastSignal(..., { toAiBot: true, toCopyFactory: true })`, c) invoke `copy-trade-listener`.
- `TradingIdeas.tsx`: ensure realtime subscription on `trading_signals` (INSERT) with proper cleanup, and "Copy to my account" button routes through `signalBroadcast` so a single idea fans to CopyTrading + AI Bot followers.
- Add DB index `idx_trading_signals_created_at` for fast "latest" queries used by `LatestSignalCard`.

## Part C — Add Trading Account (VPS-first, MetaAPI fallback)

- `ConnectAccountModal.tsx`: keep VPS `/connect` path; on success write `provider='vps'`, `connection_type='vps'`, `connection_status='connected'`, `mt5_password` (temporary — see security note), `balance/equity/company` from VPS response.
- On VPS failure, fall back to `metaapi-provision-account` and surface the exact broker error (server unresolved, IPC timeout, invalid creds).
- Ensure the Weltrade + PrimeXBT + OctaFX server dropdowns render above other z-indices (fixes prior overlay bug).
- Guarded UX: block "Start Copying" / "Activate Bot" until `connection_status === 'connected'`.

## Part D — Copy Trading parity (Dashboard ⇄ Mentor Hub/Center)

- Consolidate the follow → execute flow behind a single service (`signalBroadcast.fanOutDirect`) called from:
  - `CopyTradingNew` "Follow / Self-Copy" buttons
  - Mentor Hub / Mentor Center "Publish Signal"
  - `copy-trade-listener` edge function
- Enforce master resolution via existing `enforce_master_user_id` trigger; backfill any `master_user_id` gaps.
- In `copy-trade-listener` and `auto-execute-signal`: VPS branch first (`VPS_API_URL` + optional `VPS_API_SECRET` header), MetaAPI fallback, Deriv WebSocket for Deriv accounts. Log every attempt to `trade_history` with `source` = `vps|metaapi|deriv`.
- Show unified "Copy Trading Active" banner on both Dashboard (compact) and CopyTradingNew (from Session 3).

## Part E — AI Bot end-to-end

- On "Activate Khumo Bot" in `AIAutoTrading.tsx`: upsert row into `ai_bot_assignments` with `subscription_mentor_id`, `trading_account_id`, `user_id`, `active=true` (fixes empty-table issue).
- `auto-execute-signal` queries assignments by `subscription_mentor_id` matching the signal's `mentor_id`, then executes via VPS → MetaAPI → Deriv in that order.
- Emit a `notifications` row per execution so users see it in the Notification Center.

## Part F — Notification Center + Phone Push

- **In-app**: audit `useNotifications` hook — ensure Supabase Realtime subscription on `notifications` uses `useEffect` + `removeChannel` cleanup (prevents the silent drop from re-render leaks). Verify DB triggers `notify_new_signal`, `notify_trade_executed`, `notify_bot_assignment`, `notify_account_connected`, `notify_subscription_change` all fire (they exist — will smoke-test).
- **Phone push (Web Push via VAPID, PWA)**: since the app is installed via Median/PWA:
  1. Add a `push_subscriptions` table (`user_id`, `endpoint`, `p256dh`, `auth`, `user_agent`) + RLS.
  2. Add `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` secrets (I'll generate these).
  3. Extend `public/sw.js` with `push` + `notificationclick` handlers routing to `data.link`.
  4. New `src/hooks/usePushNotifications.ts` that requests permission and registers the subscription.
  5. New edge function `send-push-notification` invoked by a DB trigger on `notifications` INSERT (via `pg_net`) — delivers to every subscription for that user.
  6. Add opt-in toggle in `Settings.tsx` under Notifications.
- Note: iOS requires the PWA to be installed to the home screen for push; Android/desktop work in-browser. Median APK inherits the service worker.

## Part G — Housekeeping (from your audit)

- Add the three `ai_bot_assignments` indexes + `REVOKE EXECUTE` statements via one migration.
- Delete dead code: `src/pages/CopyTrading.tsx` (old), redirect `/mentor-dashboard` → `/mentor-hub` (keep MentorCenter for client-facing mentor page — clarify below).
- Add `VPS_API_SECRET` secret + header check documented for the FastAPI side.

## Technical details (for reference)

```text
Signal fan-out (target)
 Mentor publishes ─► trading_signals INSERT
   │
   ├─► broadcastSignal()
   │     ├─► fanOutDirect() ──► [VPS /order | metaapi-execute-trade | deriv WS] per follower
   │     ├─► auto-execute-signal ──► ai_bot_assignments (by subscription_mentor_id)
   │     └─► copyfactory-send-signal (if master has strategy_id)
   │
   └─► DB triggers ──► notifications INSERT ──► pg_net ──► send-push-notification ──► Web Push
```

## Open questions before I build

1. **MentorCenter vs MentorHub**: keep MentorCenter as the *client-facing* branded landing (per `render-mentor-landing`) and MentorHub as the mentor workspace? Or fully consolidate?  - Keep them seperate for now, tell me what works best but keep them separate for now.
2. **VPS auth**: do you want me to add the `VPS_API_SECRET` header now (I'll generate the value) so edge functions send it — you then add matching check on the FastAPI side? Yes please
3. **Push scope**: enable push for signals + trade executions + account events by default, with per-category toggles in Settings - yes

Once you confirm, I'll switch to build mode and ship Parts A→G in that order.