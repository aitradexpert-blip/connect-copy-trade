## 4 Surgical Fixes — VPS Visibility + Deriv Noise Suppression

### CHANGE 1 — `src/pages/TradingAccounts.tsx` (3 edits)

- **1A**: Add VPS badge branch at top of `getProviderBadge` (checks `provider === 'vps'` or `connection_type === 'vps'`, renders "VPS Direct" outline badge).
- **1B**: Add VPS branch to `handleRefresh` before the final `else` — dynamic import of `primaryApi`, calls `getAccount(account.id)`, writes `balance`/`equity` back to `trading_accounts` and updates local state; toasts on success/failure.
- **1C**: In `handleAccountConnected`, add 800ms delay before `loadAccounts()` to let the ConnectAccountModal DB write commit.

### CHANGE 2 — `src/services/derivWebSocket.ts`

- In `handleMessage`, before the existing `console.error('[DerivWS] API Error:', ...)`, add a guard: if `message.error?.code === 'AccountDisabled'` or message includes `'disabled'`, `console.warn` once and `return` (no throw, no pending-request reject noise for this specific case).

### CHANGE 3 — `src/components/ConnectAccountModal.tsx` (Deriv tab warning)

- Add a dismissible `Alert` banner directly above the "How it works:" heading in the Deriv OAuth tab, warning about disabled Deriv accounts with link to `app.deriv.com`.

### CHANGE 4 — `src/components/ConnectAccountModal.tsx` (`resetAndClose`)

- Replace the tail `navigate('/accounts')` with `navigate('/'); setTimeout(() => navigate('/accounts'), 100);` so `TradingAccounts` remounts and re-fires `loadAccounts()` even if `user` is unchanged.

### Untouched (per instructions)

`primaryApi.ts`, `vercel.json`, `copy-trade-listener`, `auto-execute-signal`, `signalBroadcast.ts`, `useCopyTrading.ts`, `AppLayout.tsx`, plus all VPS routing / ghost-row / quota logic in `ConnectAccountModal.tsx`.

### Verification

After apply: check build is clean, then manually — refresh button on the Weltrade VPS account should hit FastAPI and update balance; new VPS connect should show account in list without manual reload; console should no longer spam `AccountDisabled` errors on load.

Commit: `fix: VPS badge + refresh on accounts page, force UI reload after connect, suppress Deriv disabled error`  
  
**CHANGE 2 (derivWebSocket.ts) — PARTIALLY WRONG ⚠️**

I read the full `derivWebSocket.ts`. The plan says:

> "In handleMessage, before the existing `console.error('[DerivWS] API Error:', ...)`, add a guard: if `message.error?.code === 'AccountDisabled'`..."

Here is the actual `handleMessage` code:

typescript

```typescript
if (message.error) {
  console.error('[DerivWS] API Error:', message.error.message, message.error.code);
  
  // Reject pending request if exists
  if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
    const { reject } = this.pendingRequests.get(String(message.req_id))!;
    this.pendingRequests.delete(String(message.req_id));
    reject(new Error(message.error.message));
  }
  return;
}
```

**Two problems with the plan:**

**Problem A** — The plan says add a guard and `return` without rejecting the pending request. But there IS a pending request being rejected here. If we `return` early before the reject block, the pending request will never resolve or reject — it will hang for 30 seconds until the timeout fires. Then it will throw "Request timeout" which is WORSE than the original error.

**Problem B** — The console error shows `[DerivBroker] Authorization failed` appearing AFTER the WebSocket error. That comes from `derivBroker.ts`, not `derivWebSocket.ts`. Lovable's plan only silences the WebSocket layer. The `derivBroker.ts` will still throw and log its own error. You'll still see console noise — just slightly less of it.

**The correct fix** is: suppress the log AND still reject the pending request (so it doesn't hang), AND the error thrown should be a specific subclass that `derivBroker.ts` can catch and silently ignore.  
  
**CHANGE 4 (ConnectAccountModal.tsx resetAndClose) — CORRECT but has a side effect ⚠️**  
The `navigate('/'); setTimeout(() => navigate('/accounts'), 100)` trick works but briefly flashes the home page (`/`) for 100ms. On a fast phone connection this is imperceptible. On a slow connection it's visible as a flicker. A cleaner approach is to add a `key` prop to the accounts page that forces remount, but that requires changing `App.tsx`. The navigate trick is acceptable for now — just know it causes a flash.

---

### The Fix for Change 2

Here is the corrected version that actually handles the `AccountDisabled` error properly — suppresses the log, still rejects the pending request with a recognisable error type, and doesn't leave requests hanging:

**Paste this into Lovable INSTEAD of the Change 2 it planned:**

---

Read ONLY `src/services/derivWebSocket.ts`. Do not touch any other file.

FIND this exact block inside the `handleMessage` method:

typescript

```typescript
      // Handle errors
      if (message.error) {
        console.error('[DerivWS] API Error:', message.error.message, message.error.code);
        
        // Reject pending request if exists
        if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
          const { reject } = this.pendingRequests.get(String(message.req_id))!;
          this.pendingRequests.delete(String(message.req_id));
          reject(new Error(message.error.message));
        }
        return;
      }
```

REPLACE WITH:

typescript

```typescript
      // Handle errors
      if (message.error) {
        const isDisabled =
          message.error?.code === 'AccountDisabled' ||
          String(message.error?.message || '').toLowerCase().includes('disabled');

        if (isDisabled) {
          // Suppress console noise — disabled account is not user-actionable from HuMi.
          // Still reject the pending request so it doesn't hang for 30s timeout.
          if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
            const { reject } = this.pendingRequests.get(String(message.req_id))!;
            this.pendingRequests.delete(String(message.req_id));
            // Use a named error so callers can distinguish disabled vs other errors
            const err = new Error('AccountDisabled');
            (err as any).code = 'AccountDisabled';
            reject(err);
          }
          return; // Do NOT log — this is expected and not actionable
        }

        console.error('[DerivWS] API Error:', message.error.message, message.error.code);
        
        // Reject pending request if exists
        if (message.req_id && this.pendingRequests.has(String(message.req_id))) {
          const { reject } = this.pendingRequests.get(String(message.req_id))!;
          this.pendingRequests.delete(String(message.req_id));
          reject(new Error(message.error.message));
        }
        return;
      }
```

Do not change anything else in this file.