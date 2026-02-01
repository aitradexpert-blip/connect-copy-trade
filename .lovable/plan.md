
# HuMi MetaAPI Integration Fix & Enhancement Plan

## Root Cause Analysis

### Issue 1: MetaAPI Provisioning Error (Code 64524)
**Location:** Edge function returns `{"success":false,"error":"Validation failed","code":64524,"details":"Validation failed"}`

**Root Cause:** The MetaAPI Provisioning URL in the edge function has a **typo with a double domain**:
```typescript
// INCORRECT (line 13 in metaapi-provision-account/index.ts):
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

// CORRECT:
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.ai'
```

This causes all provisioning requests to fail with a validation error because the URL doesn't resolve correctly.

**Additional Issue:** The `src/services/metaapi.ts` file was previously fixed but the edge function was not.

### Issue 2: Viewing Deriv Balances Works
The existing Deriv account (VRTC3710616) shows balance correctly because it uses:
- Deriv WebSocket API via `authorizeDerivAccount()` and `getDerivBalance()`
- These functions in `src/services/derivBroker.ts` are working correctly
- This confirms the Deriv integration is **fully functional**

### Issue 3: MetaAPI Accounts Not Displaying Data
Accounts provisioned via MetaAPI (like "Mpho Maphanga Deriv MT5") cannot fetch data because:
1. The provisioning failed due to the URL typo, so no valid `metaapi_account_id` was stored
2. Without a valid `metaapi_account_id`, the `metaapi-account-info` edge function cannot query MetaAPI

---

## Phase 1: Fix MetaAPI Connection Error

### 1.1 Fix Edge Function URL
**File:** `supabase/functions/metaapi-provision-account/index.ts`

Change line 13:
```typescript
// FROM:
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai'

// TO:
const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.ai'
```

### 1.2 Add Detailed Logging
Enhance the edge function with better error reporting to diagnose future issues:
- Log the exact MetaAPI response
- Parse specific error codes (E_AUTH, E_SERVER_TIMEZONE, ERR_OTP_REQUIRED)
- Return actionable error messages

### 1.3 Add Server Name Suggestions
Create a dropdown with common broker server names to prevent user typos:
- Headway-Real, Headway-Demo
- Deriv-Server, Deriv-Demo
- ICMarkets-Live01, ICMarkets-Demo01
- XM-Real-1, XM-Demo-1
- Exness-Real, Exness-Demo

**File:** `src/components/ConnectAccountModal.tsx`

Add autocomplete/suggestions for the server field.

---

## Phase 2: Implement LotSizeInput Component

### 2.1 Create Reusable Component
**New File:** `src/components/ui/lot-size-input.tsx`

Features:
- Default value: 0.01 (micro lot)
- [-] and [+] buttons for increment/decrement
- Manual text input with validation
- Min: 0.01, Max: configurable (default 100)
- Step: 0.01
- 2 decimal precision
- Disable minus button at minimum
- Synced state between buttons and input

```typescript
interface LotSizeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}
```

### 2.2 Integrate Into Trading Interfaces
Update the following components to use the new LotSizeInput:
- `src/components/deriv/DerivQuickTrade.tsx` - For MT4/MT5 trades
- `src/pages/TradingIdeas.tsx` - For signal execution
- `src/pages/Admin.tsx` - For signal creation

---

## Phase 3: Full MetaAPI Trading Implementation

### 3.1 Ensure Trade Execution Works
**File:** `supabase/functions/metaapi-execute-trade/index.ts`

Current implementation is correct. Verify:
- Symbol format (no slash: EURUSD instead of EUR/USD)
- Volume in lots (0.01 for micro)
- Direction mapping (ORDER_TYPE_BUY, ORDER_TYPE_SELL)

### 3.2 Update DerivQuickTrade for Lot Size
**File:** `src/components/deriv/DerivQuickTrade.tsx`

For MetaAPI accounts:
- Replace stake-based input with lot size input
- Use the new LotSizeInput component
- Remove duration selection (not applicable to CFD)
- Add proper symbol formatting

Current problematic code (line 250-253):
```typescript
volume: parseFloat(stake) / 1000 || 0.01, // Convert stake to lots
```

This conversion is confusing. Replace with direct lot size input.

### 3.3 Add Position Management
**File:** `supabase/functions/metaapi-close-position/index.ts` (NEW)

Create endpoint to close positions:
```typescript
POST /trade with actionType: 'POSITION_CLOSE_ID'
body: { positionId: string }
```

---

## Phase 4: MetaAPI Copy Trading (CopyFactory)

### 4.1 CopyFactory Architecture
MetaAPI uses CopyFactory for copy trading, which is separate from the main Trading API:

**Base URL:** `https://copyfactory-api-v1.agiliumtrade.ai`

**Key Endpoints:**
1. Configure account as Provider: Update account with `copyFactoryRoles: ['PROVIDER']`
2. Create Strategy: `POST /users/current/configuration/strategies`
3. List Available Strategies: `GET /users/current/configuration/strategies`
4. Subscribe to Strategy: `POST /users/current/configuration/subscribers/{subscriberId}/subscriptions`

### 4.2 Enable CopyFactory Role
**File:** `supabase/functions/metaapi-enable-copy-factory/index.ts` (UPDATE)

Update the existing function to properly configure an account as a Provider or Subscriber:
```typescript
await fetch(`${PROVISIONING_URL}/users/current/accounts/${accountId}`, {
  method: 'PUT',
  headers: { 'auth-token': token },
  body: JSON.stringify({
    copyFactoryRoles: ['PROVIDER', 'SUBSCRIBER']
  })
});
```

### 4.3 Create CopyFactory Strategy Endpoints
**New Files:**
- `supabase/functions/copyfactory-create-strategy/index.ts`
- `supabase/functions/copyfactory-list-strategies/index.ts`
- `supabase/functions/copyfactory-subscribe/index.ts`
- `supabase/functions/copyfactory-unsubscribe/index.ts`

### 4.4 Update Copy Trading UI
**File:** `src/pages/CopyTradingNew.tsx`

Add a third tab: "MetaAPI Masters" for CopyFactory strategies:
- List available strategies from CopyFactory API
- Show performance metrics
- Allow subscribing with custom multiplier and risk settings

---

## Phase 5: Unified Dashboard Experience

### 5.1 getAllAccounts() Unified Function
**File:** `src/services/unifiedAccountService.ts` (NEW)

```typescript
export async function getAllAccounts(userId: string) {
  const { data: dbAccounts } = await supabase
    .from('trading_accounts')
    .select('*')
    .eq('user_id', userId);
  
  // Fetch live balances for each account
  const enrichedAccounts = await Promise.all(
    dbAccounts.map(async (account) => {
      if (account.provider === 'deriv' && account.deriv_token) {
        const balance = await fetchDerivBalance(account.deriv_token);
        return { ...account, balance, equity: balance };
      } else if (account.metaapi_account_id) {
        const { balance, equity } = await fetchMetaApiBalance(account.metaapi_account_id);
        return { ...account, balance, equity };
      }
      return account;
    })
  );
  
  return enrichedAccounts;
}
```

### 5.2 Unified Portfolio View
**File:** `src/pages/Charts.tsx`

Already partially implemented. Enhance to:
- Show combined equity across all accounts
- Display positions from all sources with source badges
- Calculate total P&L

### 5.3 Admin Panel Updates
**File:** `src/components/admin/UserManagementTab.tsx`

Current implementation correctly:
- Fixed the upsert with `onConflict: 'user_id'`
- Removed manual MetaAPI ID entry
- Shows connection status

Add:
- View MetaAPI account synchronization status
- Retry failed provisioning button
- Display MetaAPI error messages

---

## Implementation Summary

### Files to Modify:
| File | Changes |
|------|---------|
| `supabase/functions/metaapi-provision-account/index.ts` | Fix URL typo, enhance error handling |
| `src/components/ui/lot-size-input.tsx` | NEW - Reusable lot size component |
| `src/components/deriv/DerivQuickTrade.tsx` | Add lot size input for MetaAPI accounts |
| `src/pages/TradingIdeas.tsx` | Use LotSizeInput component |
| `src/components/ConnectAccountModal.tsx` | Add server suggestions, improve UX |
| `supabase/functions/metaapi-enable-copy-factory/index.ts` | Fix CopyFactory role configuration |
| `supabase/functions/copyfactory-create-strategy/index.ts` | NEW - Create provider strategy |
| `supabase/functions/copyfactory-subscribe/index.ts` | NEW - Subscribe to strategy |
| `src/pages/CopyTradingNew.tsx` | Add MetaAPI CopyFactory tab |

### Verification Steps:
1. **Test Provisioning**: Add a new Headway-Demo account → Should succeed with metaapi_account_id
2. **Test Balance Fetch**: Refresh the newly added account → Should show balance/equity
3. **Test Trade Execution**: Place 0.01 lot BUY EURUSD → Should execute via MetaAPI
4. **Test Lot Size Input**: Verify +/- buttons and manual entry work correctly
5. **Test Copy Trading**: Enable account as provider → Should appear in copy trading list

### Priority Order:
1. **CRITICAL**: Fix the provisioning URL typo (Phase 1.1)
2. **HIGH**: Create LotSizeInput component (Phase 2)
3. **MEDIUM**: Implement CopyFactory endpoints (Phase 4)
4. **LOW**: Unified dashboard enhancements (Phase 5)
