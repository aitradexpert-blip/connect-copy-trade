# Trade Ideas ↔ AI Bot ↔ Copy Trading Unification + MetaAPI Fixes

Scope: surgical upgrades to existing files only. No replacement of working logic.

## 1. Mentor registration lock (PROVIDER role)

File: `supabase/functions/metaapi-provision-account/index.ts` + new auto-enable step.

- After successful provisioning + DEPLOYED state, if the caller's email is `mphoforex5@gmail.com` (or `is_master = true` later in DB), call `metaapi-enable-copy-factory` with `copyFactoryRoles: ['PROVIDER', 'SUBSCRIBER']` (both, so the master can also self-follow).
- In `copyfactory-create-strategy`: when MetaAPI returns "copy factory roles" error, automatically call `metaapi-enable-copy-factory` with PROVIDER role then retry once, instead of bubbling the error.
- In `copyfactory-subscribe`: same auto-recovery — on "copyFactoryRoles" error, enable SUBSCRIBER role on subscriberId and retry once.

## 2. Master self-copying

File: `src/pages/CopyTradingNew.tsx` (already removed the `.neq("user_id", user.id)` filter — verified).

- Add a `Following accounts` selector that surfaces all of the user's own connected non-master accounts when the strategy belongs to one of their own master accounts.
- When user is the master, allow the follow flow with a confirmation toast: "Self-copy: trades from &nbsp; will mirror into &nbsp;".
- Ensure `copy_trading_relationships` insert allows `master_user_id = follower_user_id` (RLS already allows; just remove any client-side guard).

## 3. Server dropdown + input overlay

File: `src/components/ConnectAccountModal.tsx` (lines ~338-365).

- Append `<option value="Weltrade-Live" />`, `<option value="Weltrade-Demo" />` to `<datalist id="server-suggestions">`.
- Fix overlay: the `relative` wrapper around `<Input id="server">` has no positioning children — but the datalist popup in some browsers floats above sibling fields. Add `className="relative z-10"` on the server `<Input>` wrapper and `z-0` on the platform select group so the autosuggest list always sits on top.
- Allow manual typing: input is already free-text (`<Input>` + `list=`). Add helper text "Type freely if your server isn't listed."

## 4. Bridge Trade Ideas + AI Bot → CopyFactory + clients

Files:

- `src/pages/TradingIdeas.tsx` — publish handler.
- `src/components/KhumoForexSessions.tsx` — already has `onPublishIdea`, `onAddToBot`, `onCopyTrade`. Wire all three to one "Publish to AI Bot & Copy" combined action.
- New edge function `copyfactory-send-signal` (small wrapper):
  - Input: `{ strategyId, symbol, direction, volume, stopLoss, takeProfit, comment }`.
  - Calls CopyFactory external signals endpoint: `POST {COPYFACTORY_API_URL}/users/current/configuration/strategies/:strategyId/external-signals/:signalId` with the trade payload.
- `supabase/functions/auto-execute-signal/index.ts`: after the per-assignment loop, also fetch the master's CopyFactory `strategyId` (from `trading_accounts.copyfactory_strategy_id` where `is_master = true`) and call the new `copyfactory-send-signal` once per signal so all CopyFactory subscribers receive it.
- Trigger chain on signal insert (`trading_signals`):
  - Existing `notify_new_signal` keeps client notifications.
  - Add SQL trigger `auto_execute_after_publish` that calls `pg_net.http_post` to `auto-execute-signal` (or simpler: keep existing path where TradingIdeas publish UI invokes `auto-execute-signal`). Decision: keep client-side invoke; just ensure publish always fires it.

UI:

- Trading Ideas publish modal: single "Publish" button now does (a) insert `trading_signals` row, (b) invoke `auto-execute-signal`, (c) invoke `copyfactory-send-signal` for the master strategy. Replace the existing "Add to AI Bot" with a checkbox group `[x] Broadcast to AI Bot subscribers  [x] Broadcast to Copy Trading subscribers` (both checked by default).
- Khumo Sessions "Use this trade" → opens the same publish modal pre-filled, same dual-channel publish.

## 5. Transparent MetaAPI errors + guarded buttons

- `src/lib/supabaseInvoke.ts` (already extracts non-2xx JSON) — confirm `copyfactory-subscribe`, `metaapi-enable-copy-factory`, `metaapi-execute-trade`, `metaapi-redeploy-account` are called through `invokeEdgeFunctionJson` and not `supabase.functions.invoke`. Convert remaining call-sites in `CopyTradingNew.tsx` and `AIAutoTrading.tsx`.
- Guard buttons:
  - In `CopyTradingNew.tsx`: "Start Copying" disabled unless selected follower account has `connection_status === 'connected'` AND (`provider === 'deriv'` AND `deriv_token`) OR (`metaapi_account_id` matches UUID regex AND `metaapi_health_status === 'healthy'` or unknown). Add tooltip via shadcn `Tooltip`: "Account must be fully connected to start copying."
  - In `AIAutoTrading.tsx`: "Activate Bot" disabled with same check, same tooltip.

## Technical details

```text
[Trade Ideas Publish modal]
        │
        ▼ insert trading_signals
        │
        ├─► notify_new_signal (existing trigger) → notifications to mentor_clients
        ├─► invoke auto-execute-signal ──► loops ai_bot_assignments → metaapi-execute-trade / deriv-execute-signal
        └─► invoke copyfactory-send-signal(strategyId) ──► CopyFactory cascades to all subscribers (incl. master's own self-follow account)
```

New edge function file:

- `supabase/functions/copyfactory-send-signal/index.ts` — small, mirrors `copyfactory-subscribe` structure (PUT external signal).

DB additions (one migration):

- Add `auto_to_copyfactory boolean default true` to `trading_signals` (optional checkbox toggle for the publish modal).
- No new tables.

Files touched (≈9):

1. `src/components/ConnectAccountModal.tsx` — Weltrade + z-index.
2. `src/pages/TradingIdeas.tsx` — unified publish handler.
3. `src/components/KhumoForexSessions.tsx` — combined Bot+Copy action.
4. `src/pages/CopyTradingNew.tsx` — self-copy UX + guard tooltips.
5. `src/pages/AIAutoTrading.tsx` — guard tooltips + invokeEdgeFunctionJson.
6. `supabase/functions/metaapi-provision-account/index.ts` — auto-enable both roles for master.
7. `supabase/functions/copyfactory-create-strategy/index.ts` — auto-enable+retry on role error.
8. `supabase/functions/copyfactory-subscribe/index.ts` — auto-enable+retry on role error.
9. `supabase/functions/copyfactory-send-signal/index.ts` — NEW.
10. One migration: add `auto_to_copyfactory` column.

Out of scope (keep working logic intact): Deriv copy bridge, Khumo chat, payment/Yoco, Telegram, mentor referral landing, journal, KYC, training content.

## Validation

- Publish a test idea as `mphoforex5@gmail.com` → confirm: notification fires, ai_bot_assignments execute, CopyFactory signal posted (200 from new function).
- Self-follow: as master, follow own strategy with secondary account → `copy_trading_relationships` row inserts, CopyFactory subscriber config returns 200/204.
- Wrong MT password → toast shows MetaAPI's real "Invalid login credentials" message, not "non-2xx".
- "Start Copying" disabled on a `provisioning` account, tooltip visible.

After approval, I will execute steps 1–10 in parallel where safe, then run migration last.  
  
Please execute the approved structural blueprint for the Trade Ideas ↔ AI Bot ↔ Copy Trading Unification and MetaAPI diagnostic fixes. Perform surgical upgrades exclusively to our existing files and logic pathways. Do not rebuild working logic from scratch; optimize what is currently there. Follow this exact technical specification:

Please execute the approved structural blueprint for the Trade Ideas ↔ AI Bot ↔ Copy Trading Unification and MetaAPI diagnostic fixes. Perform surgical upgrades exclusively to our existing files and logic pathways. Do not rebuild working logic from scratch; optimize what is currently there. Follow this exact technical specification:

1. ARCHITECTURAL BYPASS: DIRECT SIGNAL COPIES (NO MT DEPENDENCY)

   - Crucial Architecture Rule: When a trade idea is published or an AI session trade is triggered from the master dashboard, these trades DO NOT need to successfully hit or execute on a primary Master MetaTrader broker account before cascading to others.

   - The dashboard publish action must serve as the immediate source of truth. The system can copy and distribute the trade details directly from the Ideas/AI Publish payload straight into the followers' and AI Bot users' respective trading accounts, provided they have opted in.

2. FIX MENTOR REGISTRATION LOCK & AUTO-RECOVERY

   - Files: 'supabase/functions/metaapi-provision-account/index.ts', 'supabase/functions/copyfactory-create-strategy/index.ts', 'supabase/functions/copyfactory-subscribe/index.ts'

   - In 'metaapi-provision-account': After successful provisioning + DEPLOYED state, if the user's email is '[mphoforex5@gmail.com](mailto:mphoforex5@gmail.com)' (or is_master = true), automatically trigger 'metaapi-enable-copy-factory' passing `copyFactoryRoles: ['PROVIDER', 'SUBSCRIBER']` so the master account is structurally capable of self-following.

   - Auto-Recovery: In 'copyfactory-create-strategy', if MetaAPI throws a "copy factory roles" validation error, intercept it, automatically call 'metaapi-enable-copy-factory' with the PROVIDER role, and retry once. Implement the same mirror logic in 'copyfactory-subscribe' for the SUBSCRIBER role to resolve role mismatch errors automatically.

3. IMPLEMENT MASTER SELF-COPYING (MULTI-ACCOUNT LOOP)

   - File: 'src/pages/CopyTradingNew.tsx'

   - Leverage the fact that the `.neq("user_id", user.id)` filter is already removed. Add a "Following Accounts" selector that populates and surfaces all of the user's own connected non-master trading accounts whenever the target strategy belongs to one of their own master profiles.

   - When a master chooses to follow their own strategy, remove any client-side blocking rules and allow the relationship insert `master_user_id = follower_user_id`). Show a confirmation toast: "Self-copy activated: trades from [Master] will mirror into [Follower Account]."

4. FIX SERVER DROPDOWN & INPUT OVERLAY LAYOUT

   - File: 'src/components/ConnectAccountModal.tsx'

   - Append `<option value="Weltrade-Live" />` and `<option value="Weltrade-Demo" />` explicitly into the `<datalist id="server-suggestions">` block.

   - Resolve the text-input overlap bug: add `className="relative z-10"` directly to the server `<Input>` component wrapper and `z-0` to the adjacent platform selection group. This ensures the browser's native autocomplete suggest dropdown overlays cleanly on top of sibling form elements. Add the subtle inline helper string: "Type freely if your server isn't listed."

5. UNIFY CHANNELS (TRADE IDEAS → COPYFACTORY + AI BOT DIRECT BROADCAST)

   - Files: 'src/pages/TradingIdeas.tsx', 'src/components/KhumoForexSessions.tsx', and CREATE a new edge function 'supabase/functions/copyfactory-send-signal/index.ts'

   - In 'KhumoForexSessions.tsx': Combine the legacy isolated actions ('onPublishIdea', 'onAddToBot', 'onCopyTrade') into a single unified "Publish to AI Bot & Copy" execution modal.

   - In the Trading Ideas Publish Modal: Replace individual buttons with a unified "Publish" action paired with a dual-checkbox toggle group: `[x] Broadcast to AI Bot subscribers` and `[x] Broadcast to Copy Trading subscribers` (both checked by default). 

   - Execution Sequence: When published, the interface must immediately and synchronously (a) insert the `trading_signals` row, (b) invoke the existing 'auto-execute-signal' edge worker to handle direct AI bot allocations, and (c) invoke our new 'copyfactory-send-signal' function so the master strategy transmits the execution directly to MetaAPI CopyFactory subscribers without waiting for a master broker fill response.

6. TRANSPARENT METAAPI ERROR STREAMING & UI BUTTON GUARDS

   - Files: 'src/pages/CopyTradingNew.tsx', 'src/pages/AIAutoTrading.tsx'

   - Audit and confirm that all core requests invoke via our internal `invokeEdgeFunctionJson` wrapper instead of the generic base `supabase.functions.invoke`, ensuring detailed raw JSON errors (like incorrect password or OTP required) stream directly to user toasts.

   - Guard Rails: Wrap both the "Start Copying" button (in CopyTradingNew) and the "Activate Bot" button (in AIAutoTrading) with a strict validation condition: disable the interaction unless the selected account shows `connection_status === 'connected'` and is verified. Display a clean shadcn Tooltip stating: "Account must be fully connected to start copying."

7. DATABASE MIGRATION PATHWAY

   - Run a single clean migration to append an `auto_to_copyfactory` boolean column (defaulting to true) directly to our `trading_signals` table to support the modal's broadcast checkbox selection state. No new tables are allowed.