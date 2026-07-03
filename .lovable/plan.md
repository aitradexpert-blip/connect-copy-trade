## HuMi Stabilization — Consolidated Execution Plan

Executing the sessions in the order you specified. Each session is a self-contained commit; I will not touch files outside those listed per session.

---

### Session 0 — Secret rotation

- Save the new `VPS_API_SECRET = b27c87581e27d989c23a64d41831ab696f7dfa7820a2146f29ca2201` via `set_secret` (overwrites the current value in Supabase Edge Function secrets).
- Reminder to you: paste the same value into your FastAPI `main.py` env / `.env` on the VPS so header checks match. Lovable cannot edit the VPS host.

---

### Session 1 — Cleanup (isolated, no logic risk)

Files:

- `src/App.tsx` — verify import points to `CopyTradingNew` (no edit expected).
- `src/pages/CopyTrading.tsx` — **delete** (dead placeholder).
- `src/components/WhatsAppButton.tsx` — after migrating callers, **delete**.
- Any file under `src/` importing `WhatsAppButton` — rewrite import to `TelegramButton`, replace `<WhatsAppButton …>` → `<TelegramButton …>`, drop `keyword` prop, keep all other props.
- `src/pages/MentorHub.tsx` — add ghost "Brand Settings" button next to the title, `navigate('/mentor-center')`, import `Settings` icon.
- `src/pages/MentorCenter.tsx` — verify Dashboard tab has `onClick={() => navigate('/mentor-hub')}`; add if missing. No other changes.

Commit: `Cleanup: delete old CopyTrading.tsx, migrate WhatsAppButton to TelegramButton, add MentorHub↔MentorCenter links`

---

### Session 2 — Phase 1: copy-trade-listener parallel fan-out

File: `supabase/functions/copy-trade-listener/index.ts`

- Refactor sequential `for (const relationship …)` loop to `Promise.allSettled(relationships.map(async rel => { … }))`.
- Keep the existing VPS-first branch (already in place) and MetaAPI fallback inside each mapped async function.
- On any per-follower throw: `console.error` + push a failed result entry; never let one failure abort the batch.
- Insert failed executions into `trade_history` with error text so failures are auditable (per your validation requirement).

Commit: `copy-trade-listener: parallel Promise.allSettled fan-out + per-follower error logging`

---

### Session 3 — Phase 1: MetaAPI cost & timeout fixes

Files:

- `supabase/functions/metaapi-provision-account/index.ts`
  - **Governance:** Query `user_subscriptions` for tier. If `basic` AND `trading_accounts` count for user ≥ 1 → return `403 {"error":"Subscription Limit Exceeded: Basic tier is limited to 1 trading account."}`.
  - **Reuse:** Before calling provisioning API, `SELECT id, metaapi_account_id FROM trading_accounts WHERE user_id=… AND login=… AND provider='metaapi' AND metaapi_account_id IS NOT NULL`. If found → return early with `{success:true, metaapi_account_id, reused:true}`.
- `supabase/functions/metaapi-account-info/index.ts`
  - Wrap the client-API `fetch` in `AbortController` with 5000ms timeout; existing 504 redeploy-and-retry logic stays but uses the same controller pattern on the retry.

Commit: `MetaAPI: basic-tier limit, reuse existing account, 5s AbortController timeout`

---

### Session 4 — Phase 2: AI Bot activation for VPS

File: `src/pages/AIAutoTrading.tsx` — three surgical edits exactly as you specified:

1. `ready` check adds `provider === 'vps' || connection_type === 'vps'`.
2. Account selector `SelectItem` shows "VPS Direct" badge for VPS accounts.
3. Active Bots list badge branch shows `VPS Direct` when `provider === 'vps'`.

Commit: `Fix AI bot: VPS accounts can now activate Khumo bot`

---

### Session 5 — Phase 2: Trading Ideas realtime + VPS badge

File: `src/pages/TradingIdeas.tsx`

1. Add Supabase realtime channel on `trading_signals` INSERT inside the existing `useEffect`, with `removeChannel` cleanup.
2. Replace `getProviderBadge` to return VPS Direct / Deriv / MT4-MT5 badges as specified. Import `Zap` if missing.

Commit: `Trading Ideas: realtime signals + VPS account badge`

---

### Session 6 — Phase 2: brokerExecution VPS-first

File: `src/services/brokerExecution.ts`

- Add VPS-first branch at the top of `executeOnAccount` using `primaryApi.sendOrder` when `provider==='vps'` (or `connection_type==='vps'`) and `isPrimaryConfigured()`. On timeout/failure → fall through to existing MetaAPI/Deriv paths (which remain untouched).

Commit: `Broker execution: VPS-first path for VPS-connected accounts`

---

### Session 7 — Phase 3: Copy Trading UI banner + parity

Files:

- `src/pages/CopyTradingNew.tsx` — hoist "Copy Trading Active" card to the FIRST child inside the main content wrapper, above all tabs. Confirm `stopAllCopying` exists (add if missing) and `StopCircle` is imported.
- `src/pages/MentorHub.tsx` and `src/pages/MentorCenter.tsx` — mirror the same active-copy banner at the top of the client-facing area so the UI is consistent across dashboards (this addresses the inconsistency you flagged).

Commit: `Copy trading: active banner hoisted + mirrored to Mentor Hub/Center`

---

### Session 8 — Smoke test scaffolding

Files:

- `src/components/ConnectAccountModal.tsx` (or account settings surface) — add a small "Test VPS Connection" button visible for VPS-provider accounts. It calls `GET ${VITE_API_URL}/health` with the `ngrok-skip-browser-warning` header and toasts online/offline + latency.
- Confirm no legacy MetaAPI-only execution paths run for VPS accounts in `CopyTradingNew.tsx`/`MentorHub.tsx` (route all publish/execute through `signalBroadcast.fanOutDirect` + `brokerExecution.executeOnAccount`, which now branches VPS-first from Session 6).

Commit: `VPS smoke test button + fan-out unification via signalBroadcast`

---

### Verification checklist (run after each session)

1. Basic tier: try adding a 2nd account → expect 403.
2. Publish a signal with N followers → logs show concurrent per-follower entries in the same second.
3. Re-link an existing MT5 login → no provisioning charge; response has `reused:true`.
4. Publish a signal from MentorHub → appears live in Trading Ideas via realtime; VPS follower receives order via `/order`.
5. Copy Trading Active banner visible at top of CopyTradingNew, MentorHub, MentorCenter.
6. `/health` VPS button returns 200.
7. Send-push-notification: insert a test row in `notifications` → device receives push (requires the app_settings rows + VAPID keys already configured).

---

### Not touched

- `vercel.json`, `robots.txt`, `sw.js`, `usePushNotifications.ts`, `send-push-notification` function, `Index.tsx` mobile layout, `BottomNav.tsx`, `AppLayout.tsx`, `ConnectAccountModal` VPS routing logic (only adds the Test button), Deriv/MetaAPI execution internals.

Once you approve, I will execute Sessions 0→8 in order.  
  
Check this below before you implemet and reiterate your plan accordingly:  
**QUANTUM ARCHITECT EXECUTION: FINAL STABILIZATION & GOVERNANCE PROXY**

**Task 1: Concurrent Governance (copy-trade-listener)**

- **File:** `supabase/functions/copy-trade-listener/index.ts`
- **Logic:** Use `Promise.allSettled` with a batching utility (process max 5 trades concurrently) to prevent broker rate-limiting.
- **Audit:** Each promise must write to `trade_history` with `status: 'failed'` or `'success'`, including the `error_message` for auditable troubleshooting.

**Task 2: Atomic Subscription Governance**

- **File:** `supabase/functions/metaapi-provision-account/index.ts`
- **Logic:** Perform an atomic check. Use a Supabase Transaction:
  1. `SELECT count(*)` from `trading_accounts` for `user_id`.
  2. If `tier == 'basic'` AND `count >= 1`, `ROLLBACK` and return `403`.
  3. If safe, `SELECT ... FOR UPDATE` (or unique check) to see if `login` already exists.
  4. Only if not found, proceed to `provision`.

**Task 3: Execution Funnel Consolidation**

- **File:** `src/services/brokerExecution.ts`
- **Logic:** Establish this as the **sole authority**. All UI components (MentorHub, CopyTradingNew) must route signals exclusively through `executeOnAccount`.
- **VPS-First Middleware:** Implementation must check `provider === 'vps'`. If `isPrimaryConfigured()`, execute `primaryApi.sendOrder`. If this returns `503` or timeout, catch and attempt secondary `MetaAPI` route.

**Task 4: Shared Lifecycle Hooks**

- **File:** `src/hooks/useCopyTrading.ts` (Create this)
- **Logic:** Encapsulate `stopAllCopying` and `activeBannerState`. Import this hook in `CopyTradingNew.tsx`, `MentorHub.tsx`, and `MentorCenter.tsx` to ensure uniform UI behavior and state consistency across the dashboard.

**Task 5: Resilience & Timeout**

- **File:** `supabase/functions/metaapi-account-info/index.ts`
- **Logic:** Implement `AbortController` (5000ms) + `exponential backoff` (max 2 retries) for external API fetch calls.

**Commit Messages:**

1. 'Governance: Atomic provisioning with 403 enforcement'
2. 'Reliability: Batched concurrent execution with error auditing'
3. 'Architecture: Consolidated execution funnel in brokerExecution'
4. 'UX: Shared useCopyTrading hook for unified banner state'"

**Final Logic Check:** By moving to a `useCopyTrading` hook, we solve the code-duplication problem; by using transactional SQL, we solve the race-condition problem; by using batching, we solve the API-rate-limit problem.