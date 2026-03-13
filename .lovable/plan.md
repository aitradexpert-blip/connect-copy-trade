Goal: fix Headway trade execution failures, stabilize MetaAPI account linkage (including HFM), and enforce subscription-cycle usage limits (especially account additions) in a server-enforced way.

1. Findings from current code/data (root causes)

- Headway account (`02b58a87-89bf-4785-ac75-a0a48ad491b9`) currently returns `connectionStatus: DISCONNECTED` and 504 timeout from MetaAPI client API, even though region resolves to `london`.
- `metaapi-execute-trade` does region resolution, but does not handle the disconnected+timeout path robustly (no redeploy retry flow).
- `metaapi-account-info` and `metaapi-get-positions` also do not use `/redeploy` fallback.
- HFM account row stores `metaapi_account_id = 136373`; MetaAPI returns `NotFoundError` for this ID. This indicates a bad stored provider ID (not the live MetaAPI account ID).
- One account has `provider='metaapi'` but `connection_type='deriv_api'`, which can misroute execution.
- No backend-enforced monthly/cycle quota exists for trading account additions; users can delete/re-add without usage accounting.

2. Trade execution + connection recovery (Headway fix)

- Update `supabase/functions/metaapi-execute-trade/index.ts`:
  - Add resilient flow: `get account details -> if DISCONNECTED or timeout -> POST /redeploy -> short wait -> retry trade once`.
  - If trade still times out, return structured `status: reconnecting` (not generic fail), with clear UI-safe message.
  - Add timeout reconciliation: if timeout occurs, query recent deals/orders and return success when trade actually landed.
  - Stop silently defaulting to london when account lookup fails; return explicit upstream auth/region diagnostics.
- Update `supabase/functions/metaapi-account-info/index.ts` and `metaapi-get-positions/index.ts`:
  - Same DISCONNECTED handling: `/redeploy` + retry pattern.
  - Return `state`, `connectionStatus`, `region`, and human-readable next action in response payload.

3. Fix bad MetaAPI IDs and routing inconsistencies (HFM + data integrity)

- Add a migration to correct/guard account linkage:
  - Data cleanup update for known misrouted rows (`provider='metaapi'` should have `connection_type='metaapi'`).
  - Add guard trigger for `trading_accounts` inserts/updates:
    - if `provider='metaapi'`, require non-empty `metaapi_account_id`.
    - if `provider='deriv'`, enforce `metaapi_account_id IS NULL`.
- Improve `metaapi-provision-account`:
  - Validate returned account id format.
  - If returned id looks invalid, immediately resolve account via `/users/current/accounts` lookup by login/server and persist canonical `_id`.
  - Add explicit `E_RESOURCE_SLOTS` handling and user-facing message for HFM-like cases.
- In client save path (`ConnectAccountModal.tsx`), include fallback validation call after provision success before insert.

4. Add explicit “Reconnect Account” action

- Add new edge function `metaapi-redeploy-account` (or extend existing account-info function with action mode):
  - Input: `accountId`
  - Calls `/users/current/accounts/{id}/redeploy`
  - Returns operation state for UI.
- Add reconnect button on `TradingAccounts.tsx` for MetaAPI rows in `disconnected/provisioning/failed` states.
- On Ideas execution failure due reconnecting status, show actionable toast (“Account reconnecting, retry in 30–60s”).

5. Enforce account-add limits per subscription cycle (server-side, non-bypassable)

- Add new table (migration): `subscription_usage_events`
  - `id, user_id, feature_key, quantity, cycle_start, cycle_end, source, created_at`
  - immutable event log; deletions of trading accounts do not reduce usage.
- Add SECURITY DEFINER function:
  - `consume_subscription_quota(_user_id, _feature_key, _qty)`:
    - resolves tier (free if no active subscription),
    - resolves cycle window,
    - resolves limit from plan,
    - checks used+qty <= limit,
    - inserts usage event atomically or throws.
- Add DB trigger on `trading_accounts` BEFORE INSERT:
  - Calls `consume_subscription_quota(user_id, 'trading_account_additions', 1)`.
  - This enforces “add/remove/add still counts”.
- Extend same mechanism for other capped features (auto-trades, copy connections, etc.) by calling the same function from relevant edge functions and flows.

6. Admin reliability (users/plans/manual operations)

- Harden `admin-list-users` edge function:
  - avoid manual JWT decode (`atob`) and verify caller using Supabase auth endpoint.
  - keep strict admin role check via `has_role`.
- Update `UserManagementTab.tsx`:
  - Display auth users + profiles consistently,
  - Ensure free/paid plan updates are visible for newly registered users,
  - Add lightweight “Create User” admin action (new edge function using Auth Admin API) if manual add is required operationally.

7. Technical implementation map

- Edge functions:
  - `supabase/functions/metaapi-execute-trade/index.ts` (redeploy/retry/reconcile)
  - `supabase/functions/metaapi-account-info/index.ts` (redeploy-aware account status)
  - `supabase/functions/metaapi-get-positions/index.ts` (redeploy-aware)
  - `supabase/functions/metaapi-provision-account/index.ts` (canonical ID + resource slots handling)
  - `supabase/functions/admin-list-users/index.ts` (auth verification hardening)
  - new: `supabase/functions/metaapi-redeploy-account/index.ts`
- Frontend:
  - `src/pages/TradingAccounts.tsx` (Reconnect action + status UX)
  - `src/pages/TradingIdeas.tsx` + `src/services/brokerExecution.ts` (surface reconnecting/pending states cleanly)
  - `src/components/ConnectAccountModal.tsx` (post-provision ID validation)
  - `src/components/admin/UserManagementTab.tsx` (admin visibility/manual add flow)
- DB migration:
  - `subscription_usage_events` table + indexes
  - `consume_subscription_quota` function
  - `trading_accounts` insert trigger for quota consumption
  - data cleanup for invalid `connection_type` and provider/id consistency policies

8. Rollout order (safe)

- Phase A: Headway execution stabilization (redeploy+retry) + reconnect UI.
- Phase B: HFM canonical ID/resource slots fixes + data cleanup migration.
- Phase C: Subscription-cycle quota backend enforcement + trigger.
- Phase D: Admin hardening + manual add capability.
- Phase E: Regression testing across Ideas, Accounts, Admin, and connect flows.

9. Expected outcomes

- Headway trades from Ideas no longer fail with false negatives during temporary disconnect states.
- HFM account linkage uses correct MetaAPI IDs and clear remediation for resource-slot issues.
- Users cannot bypass account-add limits by deleting and re-adding accounts.
- Admin page consistently shows all signups and supports subscription updates/manual user operations.  
  
On our subscription page, the box for the Enterprise has -1 auto trades we need to fix it to 1000   
Pricing page does not show other teir names, only the free on, that needs to be fixed