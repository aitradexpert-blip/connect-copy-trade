# Dual-Engine Backend Migration Prep

Goal: wire FastAPI (`VITE_API_URL`) as primary engine with MetaAPI as silent fallback, decouple trade-idea publishing from a master MT fill, fix the mphoforex5 mentor lock, and harden the Connect Account modal + copy/AI-bot guards. MetaAPI stays fully live today; FastAPI is dormant until you flip the switch.

## 1. Env + central API client (new, small)

- Add `VITE_API_URL="https://municipal-posh-shading.ngrok-free.dev"` to `.env`.
- Create `src/services/primaryApi.ts` — a single thin wrapper exposing:
  - `getAccount()`, `getPositions()`, `getHistory(from,to)`, `sendOrder(payload)`, `calcMargin(...)`, `orderCheck(...)`.
  - Always returns the unwrapped inner object from `{source:"mt5", data:{...}}`.
  - 6s timeout + `AbortController`; throws `PrimaryUnavailableError` on network/5xx/timeout so callers can fall back cleanly.
- Create `src/services/tradingDataGateway.ts` — `withFailover(primaryFn, fallbackFn)` helper used by every data hook. Silent console.warn on primary failure; surfaces error only if both fail.

## 2. Re-route data reads through gateway (edit-in-place)

Touch only the data-fetch layer, not UI:

- `src/services/brokerExecution.ts` — `fetchAccountData`, `fetchTradingHistory`: wrap existing MetaAPI calls in `withFailover(primary, metaapi)`. Primary path tries FastAPI `/account`, `/positions`, `/history`; fallback keeps current `metaapi-account-info` / `metaapi-get-positions` / `metaapi-get-history` edge calls verbatim.
- Any direct `supabase.functions.invoke('metaapi-account-info'|'metaapi-get-positions'|'metaapi-get-history' ...)` sites in pages/hooks get redirected through `brokerExecution` helpers (or `tradingDataGateway` directly) — no UI markup changes.

## 3. Trade execution: direct-copy pipeline

Edit `src/services/signalBroadcast.ts` (already the central broadcaster):

- New broadcast order:
  1. Insert `trading_signals` row (analytics of record).
  2. Concurrently `Promise.allSettled`:
    - `primaryApi.sendOrder(...)` per opted-in follower / AI-bot account (direct distribution, no master fill required).
    - Legacy `copyfactory-send-signal` + `auto-execute-signal` as before.
  3. If primary `/order` rejects for a given follower, that follower's call automatically retries via existing MetaAPI execute path (`metaapi-execute-trade`) — per-follower isolation, no global desync.
- `TradingIdeas.tsx` and `KhumoForexSessions.tsx` publish handlers already call `broadcastSignal` — no UI edits, just the service upgrade.

## 4. Mentor lock fix ([mphoforex5@gmail.com](mailto:mphoforex5@gmail.com))

- `supabase/functions/metaapi-provision-account/index.ts` already auto-enables `['PROVIDER','SUBSCRIBER']` for that email / `isMaster`. Extend the same helper into:
  - `supabase/functions/copyfactory-create-strategy/index.ts`
  - `supabase/functions/copyfactory-subscribe/index.ts`
  Pattern: on any "copyFactoryRoles" / "must be provider" error from MetaAPI, call `metaapi-enable-copy-factory` with `['PROVIDER','SUBSCRIBER']` and retry once. Surface MetaAPI's raw message verbatim on second failure.

## 5. ConnectAccountModal polish

`src/components/ConnectAccountModal.tsx`:

- Append `<option value="Weltrade-Live" />`, `<option value="Weltrade-Demo" />` to `datalist#server-suggestions`.
- Custom server `<Input>` wrapper → `className="relative z-10"`; sibling platform group → `z-0`.
- Placeholder: `"Type freely if your server isn't listed."`

## 6. CopyTradingNew + AIAutoTrading guards

- Route every edge call through `src/lib/supabaseInvoke.ts` (`invokeEdgeFunctionJson`) so MetaAPI JSON error bodies (E_AUTH, OTP_REQUIRED, password change) reach the toast verbatim.
- "Start Copying" / "Activate Bot" buttons: disabled unless `connection_status === 'connected'` AND `metaapi_health_status !== 'unhealthy'`. Wrap in shadcn `Tooltip`: `"Account must be fully connected to start copying."`

## 7. One DB migration

`trading_signals` already has `auto_to_copyfactory boolean DEFAULT true` (per current schema dump). Verify via SELECT; if absent, run:

```sql
ALTER TABLE public.trading_signals
  ADD COLUMN IF NOT EXISTS auto_to_copyfactory boolean NOT NULL DEFAULT true;
```

No new tables.

## Out of scope (explicit)

UI redesign, branding, new charts, marketing pages, tests/CI, Deriv path changes, new edge functions beyond the two patched above.

## Files touched

- `.env` (1 line)
- `src/services/primaryApi.ts` (new, ~80 lines)
- `src/services/tradingDataGateway.ts` (new, ~30 lines)
- `src/services/brokerExecution.ts`
- `src/services/signalBroadcast.ts`
- `src/components/ConnectAccountModal.tsx`
- `src/pages/CopyTradingNew.tsx`
- `src/pages/AIAutoTrading.tsx`
- `supabase/functions/copyfactory-create-strategy/index.ts`
- `supabase/functions/copyfactory-subscribe/index.ts`
- (conditional) one ALTER migration

## Safety

MetaAPI remains the live engine end-to-end today; FastAPI calls only fire when `VITE_API_URL` is reachable and respond within 6s. Every fallback path is the current production code path, untouched.  
  
# CORE OBJECTIVE

Wire FastAPI (VITE_API_URL) as primary engine with MetaAPI as a silent fallback. Fix the mentor lock, decouple trade-idea publishing, and harden UI guards completely within a strict token-saving framework.

# 1. CENTRAL API CLIENT & GATEWAY

- Add VITE_API_URL="[https://municipal-posh-shading.ngrok-free.dev](https://municipal-posh-shading.ngrok-free.dev)" to .env.

- Create src/services/primaryApi.ts:

  * Expose: getAccount(id), getPositions(id), getHistory(id, from, to), sendOrder(p), calcMargin(p), orderCheck(p).

  * 6s timeout + AbortController. Throw PrimaryUnavailableError on network/5xx/timeout.

  * Safety: Check if response shape contains { source: "mt5", data: [...] }. If structural validation fails or data is absent, safely throw PrimaryUnavailableError instead of crashing.

- Create src/services/tradingDataGateway.ts:

  * withFailover(primaryFn, fallbackFn) helper. Catch PrimaryUnavailableError, emit console.warn, silently route to fallbackFn.

# 2. DATA READ RE-ROUTING (src/services/brokerExecution.ts)

- Intercept fetchAccountData, fetchPositionsData, fetchTradingHistory.

- Map endpoints strictly via withFailover. Ensure param normalization: primary uses internal accountId, fallback forwards metaApiAccountId verbatim to Edge functions ('metaapi-account-info', 'metaapi-get-positions', 'metaapi-get-history').

# 3. DIRECT-COPY TRADE PIPELINE (src/services/signalBroadcast.ts)

- On publish: Insert trading_signals row (auto_to_copyfactory: true).

- Concurrently execute via Promise.allSettled:

  1. Loop through opted-in followers: primaryApi.sendOrder(followerParams). On failure, instantly route that specific follower's payload to fallback edge function 'metaapi-execute-trade' (Per-follower execution isolation).

  2. Legacy legacy copyfactory-send-signal + auto-execute-signal execution chain.

# 4. MENTOR PROVISION LOCK BYPASS ([mphoforex5@gmail.com](mailto:mphoforex5@gmail.com))

- Apply to copyfactory-create-strategy/index.ts and copyfactory-subscribe/index.ts:

  * Wrap MetaAPI calls in a try-catch.

  * If error contains "copyFactoryRoles" or "must be provider", intercept, invoke 'metaapi-enable-copy-factory' with ['PROVIDER', 'SUBSCRIBER'] for "[mphoforex5@gmail.com](mailto:mphoforex5@gmail.com)", then retry original transaction once. Throw raw second failure message verbatim.

# 5. UI HARDENING & EDGE GUARDS

- src/components/ConnectAccountModal.tsx: Append "Weltrade-Live" and "Weltrade-Demo" to datalist#server-suggestions. Set relative z-10 on custom server Input; z-0 on sibling groups.

- src/pages/CopyTradingNew.tsx & src/pages/AIAutoTrading.tsx:

  * Filter edge calls through src/lib/supabaseInvoke.ts for raw JSON error toast propagation.

  * Disable "Start Copying"/"Activate Bot" unless connection_status === 'connected' AND metaapi_health_status !== 'unhealthy'.

  * Radix Fix: Wrap the disabled Button inside an active <span> component within TooltipTrigger so hover pointer events fire the text: "Account must be fully connected to start copying."

# 6. STORAGE IDENTIFIER DB MIGRATION

- Assert schema consistency: 

  ALTER TABLE [public.trading](http://public.trading)_signals ADD COLUMN IF NOT EXISTS auto_to_copyfactory boolean NOT NULL DEFAULT true;