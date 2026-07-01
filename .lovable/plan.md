## Scope

Apply the exact edits provided, nothing else. Grouped into one build pass with commits per file group.

## Changes

### 1. `src/components/ConnectAccountModal.tsx`

- Locate `if (vpsJson?.success && vpsJson?.data) {`.
- Add `vpsSuccess`/`vpsData` locals above it.
- Change condition to `if (vpsSuccess) {`.
- Replace `vpsJson.data.balance/equity/company` refs inside the update with `vpsData?.*`.
- Ensure the success branch also stores `mt5_password: formData.password` and `connection_status: 'connected'` (per Change 1 of 3 in first block).

### 2. `src/pages/CopyTradingNew.tsx`

- Extend the `ready` const to also accept `provider === 'vps' || connection_type === 'vps'`.
- In `createCopyFactoryStrategy`, before the "No MT4/MT5 Account" guard, detect a VPS account and, if present, flip `is_master = true` on it and return.
- Check for any `is_virtual` filter excluding demo accounts; if present, remove and append `(Demo)` label next to the account name. If absent, leave untouched.

### 3. `src/pages/MentorHub.tsx` and `src/pages/MentorCenter.tsx`

- In each `publishSignal`, after `broadcastSignal(...)` and before the success toast, invoke `copy-trade-listener` with `{ signal_id: sig.id, master_user_id: user.id }` wrapped in `.catch`.

### 4. `supabase/functions/copy-trade-listener/index.ts`

- Before the `metaapi-execute-trade` invoke inside the follower loop, add a VPS-first branch:
  - Read `VPS_API_URL`, detect `connection_type === 'vps' || provider === 'vps'`.
  - POST to `${VPS_URL}/order` with `ngrok-skip-browser-warning` header.
  - On success push result with `via: 'vps'` and `continue`. On failure fall through.

### 5. `supabase/functions/auto-execute-signal/index.ts`

- Before the Deriv/MetaAPI provider branches, add the same VPS-first block using signal fields (`signal.lot_size`, `signal.direction`).
- Extend the local `Database` interface `trading_accounts.Row` to include `connection_type: string | null` and `provider: string` (already present — verify).
- Trade-history insert on success not required here (loop `continue`s with `results.push`), matching provided patch.

### 6. `src/pages/Settings.tsx`

- In the "Change Password" section, compute `isOAuthUser` from `user?.app_metadata?.provider === 'google'` or `providers?.includes('google')`.
- If OAuth user, render a muted note linking to Google account security; else render existing password inputs + button.

### 7. `src/App.tsx` — auth loop reverse guard

- `PublicRoute` already redirects authenticated users away from `/auth` to `/`. No loop present → leave `App.tsx` untouched (per "if no loop, leave").

### 8. WhatsApp→Support label rename

- Search `src/` for a Telegram (`t.me`/`telegram`) link whose visible label is "WhatsApp". If found, rename label only to "Support"; do not touch href or any `wa.me` links.

## Secrets

Instruct user to add `VPS_API_URL = https://municipal-posh-shading.ngrok-free.dev` in Edge Function Secrets (I'll offer the add_secret call during build).

## Out of scope

- No other files touched. No schema changes. No MetaAPI/Deriv logic modified.  
  
**POINT 1 — ConnectAccountModal.tsx**
  Lovable's plan is correct. The `vpsSuccess`/`vpsData` fix is right. One thing to watch: it says "ensure `mt5_password` and `connection_status: 'connected'` are stored" — these are already in our version of the file we committed. So Lovable reading the current file may see them already there. If it re-adds them it could cause a duplicate field error. **Risk: low. Watch for duplicate keys in the update object.**
  ---
  **POINT 2 — CopyTradingNew.tsx**
  Three sub-tasks here, each with a different risk:
  `ready` **fix** — correct and safe.
  **VPS master creation** — Lovable's plan says detect a VPS account and flip `is_master = true`. This is correct BUT there's a subtle race: `createCopyFactoryStrategy` also calls `loadData()` at the end only in the CopyFactory success path. The VPS branch returns early. If Lovable doesn't add `loadData()` to the VPS early return, the UI won't refresh after enabling master. **Risk: UI stays stale. Fix: ensure** `loadData()` **is called in the VPS branch before returning.**
  **Demo account /** `is_virtual` **filter** — Lovable says "check for any `is_virtual` filter excluding demo accounts; if present remove it." I read the full `CopyTradingNew.tsx` and there is NO `is_virtual` filter in the accounts query or master list. The query is:
  typescript
  ```typescript
  .eq("connection_status", "connected")
  ```
  No `is_virtual` filter exists. So Lovable will do nothing here — which is correct per its own instruction ("if absent, leave untouched"). **Risk: zero. But also means demo accounts are already visible — no change needed and no credit wasted.**
  ---
  **POINT 3 — MentorHub.tsx and MentorCenter.tsx**
  The plan is correct — add `copy-trade-listener` call after `broadcastSignal`. But here's the argument against it: **MentorCenter.tsx's** `publishSignal` **function is actually only called when a mentor publishes from the older MentorCenter page, not MentorHub.** Looking at the codebase, `MentorHub.tsx` is the primary working dashboard (it has the `KhumoForexSessions` component, the newer UI, and is the one users actually land on). `MentorCenter.tsx` is the settings/management page — its Ideas tab exists but is less used.
  The counter-argument for still fixing both: it costs the same whether Lovable edits 1 or 2 files in the same run, and a signal published from either page should reach followers. **Verdict: fix both, plan is correct.**
  One risk though: both files already call `copy-trade-listener` inside `executeQuickTrade()`. Lovable might accidentally add the call there too instead of only in `publishSignal`. The prompt needs to be specific about which function. **Risk: medium. If it adds to wrong function, quick trades get double-executed.**
  ---
  **POINT 4 — copy-trade-listener edge function**
  The VPS branch logic is correct. But here's a real problem Lovable's plan misses: **the follower account data fetched in this function uses a typed** `Database` **interface at the top of the file that only declares** `metaapi_account_id` **on** `trading_accounts.Row`**:**
  typescript
  ```typescript
  trading_accounts: {
    Row: {
      id: string;
      metaapi_account_id: string;
      balance: number;
      name: string;
    };
  };
  ```
  `connection_type` and `provider` are NOT in this interface. When Lovable adds `relationship.follower_account.connection_type` and `relationship.follower_account.provider`, TypeScript will throw a compile error and the edge function will fail to deploy.
  **Fix: Lovable must also update the** `Database` **interface in** `copy-trade-listener/index.ts` **to add** `connection_type: string | null` **and** `provider: string`**.**
  Lovable's plan mentions this for `auto-execute-signal` ("verify already present") but doesn't explicitly say to add it to `copy-trade-listener`. **Risk: HIGH. Deployment will fail with a TypeScript error.**
  ---
  **POINT 5 — auto-execute-signal edge function**
  Lovable says "verify `connection_type` and `provider` already present in the Database interface." I read the actual file — the interface is:
  typescript
  ```typescript
  trading_accounts: {
    Row: {
      id: string;
      metaapi_account_id: string | null;
      provider: string;          ← provider IS there ✅
      deriv_token: string | null;
      deriv_currency: string | null;
      is_virtual: boolean | null;
      name: string;
    };
  };
  ```
  `provider` is there but `connection_type` is NOT. Lovable will add the VPS check using `account.connection_type` but the interface doesn't declare it — same TypeScript error risk as Point 4. **Risk: HIGH. Must add** `connection_type: string | null` **to this interface too.**
  Also: the VPS branch uses `signal.direction` as the `action` field in the POST body. The FastAPI `/order` endpoint likely expects `"buy"` or `"sell"` lowercase, but signals store `"BUY"` or `"SELL"` uppercase. This could cause the VPS to reject the order silently. **Fix: add** `.toLowerCase()` **→** `action: signal.direction.toLowerCase()`**.**
  ---
  **POINT 6 — Settings.tsx OAuth check**
  The logic is correct but there's one subtle issue: `user?.app_metadata` in Supabase is only accessible server-side by default. On the client, `user.app_metadata` may be an empty object `{}` for security reasons depending on your Supabase JWT configuration. If `app_metadata` is empty on the client, `isOAuthUser` will always be `false` and the form will show for Google users anyway — making the fix useless.
  **Alternative that actually works on the client:** check `user?.identities` instead:
  typescript
  ```typescript
  const isOAuthUser = user?.identities?.some(i => i.provider === 'google') ?? false;
  ```
  `identities` IS exposed in the client-side JWT. **Risk: MEDIUM. The plan's approach may silently not work. Push back and tell Lovable to use** `user?.identities` **instead.**
  ---
  **POINT 7 — App.tsx auth loop**
  Lovable correctly identified no loop exists and says leave it untouched. This is right. **No issue here.**
  ---
  **POINT 8 — WhatsApp label search**
  Lovable says "search `src/` for a Telegram link whose visible label is 'WhatsApp'." The actual situation is different from what this implies. `WhatsAppButton.tsx` is a shim that renders `TelegramButton` — the label "WhatsApp" is passed as a prop from `Index.tsx`, not hardcoded in the component. So Lovable's search for a Telegram link with label "WhatsApp" in the same file won't find it — the label and the link are in different files.
  What actually needs changing is in `Index.tsx`: the prop `label="Join WhatsApp Community"` and the CardTitle "Free WhatsApp Trading Tools." Lovable's search approach will likely find nothing and do nothing. **Risk: HIGH. This fix won't happen because Lovable is looking in the wrong place.**
  **Fix: tell Lovable explicitly to edit** `src/pages/Index.tsx`**, find** `label="Join WhatsApp Community"` **and change it, and find the CardTitle text.**
  ---
  **SUMMARY — What to push back on before Lovable runs:**

  | Point                                       | Risk     | Action                                                           |
  | ------------------------------------------- | -------- | ---------------------------------------------------------------- |
  | 1 ConnectAccountModal                       | Low      | Watch for duplicate keys                                         |
  | 2 VPS master + `loadData()`                 | Medium   | Confirm `loadData()` is called in VPS branch                     |
  | 2 Demo filter                               | Zero     | Correct to skip                                                  |
  | 3 Wrong function targeted                   | Medium   | Specify `publishSignal` explicitly, not `executeQuickTrade`      |
  | 4 Missing `connection_type` in DB interface | **HIGH** | Must add to `copy-trade-listener` interface                      |
  | 5 Missing `connection_type` in DB interface | **HIGH** | Must add to `auto-execute-signal` interface                      |
  | 5 Uppercase direction                       | Medium   | Add `.toLowerCase()` on `action` field                           |
  | 6 `app_metadata` not client-accessible      | Medium   | Switch to `user?.identities?.some(i => i.provider === 'google')` |
  | 7 No loop                                   | Zero     | Correct                                                          |
  | 8 Label search won't find anything          | **HIGH** | Point Lovable explicitly to `src/pages/Index.ts`                 |
