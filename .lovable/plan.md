# Restore merge-truncated files, close the master-flag loophole, raise /order timeout

## What I found (verified, not guessed)

**The corruption is not limited to two files.** Merge commit `b68568d` ("Merge branch 'main' ... into v0/copy-trading-platform-3a69b867", Sep 3 13:19 UTC) left **seven** conflicted files written as zero bytes. All seven are still empty in the working tree right now:

| File | empty now | branch parent `05196a8` | main parent `c0142b5` |
|---|---|---|---|
| src/services/brokerExecution.ts | 0 | 583 | 553 |
| src/pages/MentorHub.tsx | 0 | 930 | 975 |
| src/pages/Admin.tsx | 0 | 454 | 474 |
| src/pages/TradingAccounts.tsx | 0 | 488 | 625 |
| supabase/functions/copy-trade-listener/index.ts | 0 | 275 | 424 |
| supabase/functions/extract-account-screenshot/index.ts | 0 | 88 | 67 |
| supabase/functions/metaapi-finalize-deployments/index.ts | 0 | 83 | 198 |

So `MentorHub.tsx` is empty again as well — the earlier repair did not survive. `src/pages/MentorClientDashboard.tsx` (747 lines) and `src/services/primaryApi.ts` (137 lines, `sendOrderWithRebind` present at line 98, exported through `primaryApi.sendOrder`) are **intact** — they were not in the conflict set.

Note: `sendOrderWithRebind` lives in `primaryApi.ts`, not in `brokerExecution.ts`. The last good `brokerExecution.ts` (`380e20f`, 553 lines) contains `executeOnAccount` (exported, line 194), `interpretVpsOrderResult` (158), the `metaapi_fallback_approved` gate (234), and `logExecution` (58) — four of the five; the fifth is satisfied by `primaryApi.ts`.

**Issue 1 root cause — found, exact code path:** `src/pages/CopyTradingNew.tsx` (route `/copy-trading`, wrapped only in `ProtectedRoute` — any signed-in user) writes `is_master = true` with **no mentor check** in three places:
- `toggleMasterStatus` (line ~442): a UI Switch (line ~815) "Enable Master" per account; only guard is `connection_status === 'connected'`.
- `createCopyFactoryStrategy` VPS branch (line ~571): sets `is_master: true` on the first VPS account outright.
- `createCopyFactoryStrategy` CopyFactory branch (line ~657): sets `is_master: true` after strategy creation.

Secondary, admin-gated but not mentor-gated: `supabase/functions/admin-set-flags/index.ts` `set_master` (line 59) flips `is_master` on any account after only an admin check. `src/pages/MentorCenter.tsx` toggles are on the mentor-only page. No seed/bulk script writes the flag.

**Issue 2:** the `/order` timeout is `8000` in the main-parent version of `copy-trade-listener` at two call sites (line 310 primary, line 323 retry).

## Plan

1. **Restore the seven emptied files** by choosing per file the parent version that is the true superset, and merging in anything unique to the other parent so no recent addition is silently dropped:
   - `brokerExecution.ts`: base on `05196a8` (583) vs `380e20f`/main (553); diff the two and keep the union of exports and the VPS/fallback logic.
   - `copy-trade-listener/index.ts`, `TradingAccounts.tsx`, `MentorHub.tsx`, `Admin.tsx`, `metaapi-finalize-deployments/index.ts`: main parent is larger; diff against the branch parent and re-add branch-only additions (e.g. last turn's provisioning-state UI in `TradingAccounts.tsx`).
   - `extract-account-screenshot/index.ts`: branch parent is larger; same union check.
2. **Verify the restore by symbol inventory**, not line count: confirm `executeOnAccount` exported, `interpretVpsOrderResult`, `metaapi_fallback_approved` gate, `logExecution` in `brokerExecution.ts`, and `sendOrderWithRebind` still exported via `primaryApi.ts`.
3. **Issue 2:** in the restored `copy-trade-listener/index.ts`, change only the two `/order` `fetchJson` timeouts from `8000` to `20000`. Retry conditions, skip logic, session handling, `/connect` 8000 and the 12000 settle delay stay untouched.
4. **Issue 1 fix (UI gate):** in `CopyTradingNew.tsx`, load the signed-in user's `mentor_profiles` row on mount; hide the "Enable Master" switch and the master-strategy panel for non-mentors, and hard-return with an explanatory toast from `toggleMasterStatus` and both `createCopyFactoryStrategy` master writes when no active mentor profile exists. Then in `admin-set-flags`, reject `set_master: true` unless the target account's owner has a `mentor_profiles` row. This mirrors the DB trigger client-side so users get a clear message instead of a silent revert.
5. **Verify:** full-project typecheck `bunx tsgo -p tsconfig.app.json --noEmit` plus `bunx vite build`, and load `/copy-trading` and `/mentor-hub` in the browser to confirm no `does not provide an export named` SyntaxError. Report the actual command output.

## Notes

- The seven-file emptying pattern means this can recur on the next merge from main; after the restore I can list which files carry branch-only content so those conflicts get resolved manually rather than accepted blind.
- Protected-baseline logic (`copy-trade-listener` retry/skip, `publishFanOut` classify/format, `primaryApi.sendOrderWithRebind`, `verify-vps-connection` invalid-credential handling) is restored verbatim; the only intentional change to it is the two `/order` timeout constants you approved.
