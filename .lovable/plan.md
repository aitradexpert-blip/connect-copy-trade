
# Synthetic Indexes Trading & UX Enhancement Plan

## Overview
This plan implements comprehensive Synthetic Indexes trading support, fixes the /charts page account selection bug, adds an Install App PWA button to Quick Actions, adds Trading Accounts button to Quick Actions, and replaces all visible "MetaAPI"/"Deriv API" branding with user-friendly terminology.

---

## Phase 1: Bug Fixes & Quick Wins

### 1.1 Fix /charts Page Account Selection Bug

**Root Cause Analysis:**
Looking at `src/pages/Charts.tsx` (lines 139-157), the `loadAccounts()` function fetches:
```typescript
.select('id, name, balance, provider, deriv_token, is_virtual')
```

This is **missing critical fields**:
- `connection_type`
- `metaapi_account_id`
- `connection_status`

Meanwhile, `DerivQuickTrade.tsx` (lines 71-76) correctly fetches all fields including `connection_type` and `connection_status='connected'`.

**The Fix:**
Update `src/pages/Charts.tsx` line 143-146:

```typescript
// FROM:
.select('id, name, balance, provider, deriv_token, is_virtual')

// TO:
.select('id, name, balance, provider, deriv_token, is_virtual, metaapi_account_id, connection_type, connection_status, broker_name, platform')
.eq('connection_status', 'connected')
```

Also update the `TradingAccount` interface (line 32-39) to include the missing fields.

---

### 1.2 Add "Install App" Button to Quick Actions

**Current State:** PWA install prompt exists as `PWAInstallPrompt.tsx` - a floating banner at bottom.

**Enhancement:** Add an explicit "Install App" button in Quick Actions section for better visibility.

**File:** `src/pages/Index.tsx`

Add a new state hook and button:
```typescript
// Add state for PWA install
const [canInstall, setCanInstall] = useState(false);
const [installPrompt, setInstallPrompt] = useState<any>(null);

useEffect(() => {
  const handler = (e: Event) => {
    e.preventDefault();
    setInstallPrompt(e);
    setCanInstall(true);
  };
  window.addEventListener('beforeinstallprompt', handler);
  return () => window.removeEventListener('beforeinstallprompt', handler);
}, []);

const handleInstallApp = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  if (outcome === 'accepted') {
    setCanInstall(false);
    setInstallPrompt(null);
  }
};
```

Add button to Quick Actions section (around line 394-425):
```tsx
{canInstall && (
  <Button onClick={handleInstallApp} variant="outline" className="flex items-center gap-2">
    <Download className="w-4 h-4" />
    Install App
  </Button>
)}
```

---

### 1.3 Add "Trading Accounts" Button to Quick Actions

**File:** `src/pages/Index.tsx`

In the Quick Actions section (line ~394-425), add:
```tsx
<Button onClick={() => navigate('/accounts')} variant="outline" className="flex items-center gap-2">
  <CreditCard className="w-4 h-4" />
  Trading Accounts
</Button>
```

Import `CreditCard` from lucide-react (already imported on line 3).

---

## Phase 2: API Branding Cleanup

### 2.1 Replace "MetaAPI" with User-Friendly Terms

**Goal:** Users should not see internal API names. Replace with broker-centric terminology.

| Current Text | Replacement |
|-------------|-------------|
| "MetaAPI" | "MT4/MT5 Broker" or "Trading Bridge" |
| "Deriv API" | "Deriv" or "Direct Connection" |
| "metaapi" | "mt4_mt5" (internal) |
| "via MetaAPI" | "via Trading Bridge" |
| "deriv_api" | Show as "Deriv Direct" |

**Files to Update:**

1. **`src/components/ConnectAccountModal.tsx`** (lines 160-200):
   - Line 195: "connected successfully via MetaAPI" → "connected successfully"
   - Line 265-268: "Connect your MT4 or MT5 account" → keep (good)

2. **`src/components/deriv/DerivQuickTrade.tsx`**:
   - Line 314: "Execute CFD trades on ${selectedAccountData?.broker_name || 'MT5'}" → keep (shows broker name)
   - Line 326: "No Deriv accounts connected" → "No trading accounts connected"
   - Line 333: "Connect Deriv Account" → "Connect Trading Account"

3. **`src/pages/TradingAccounts.tsx`**:
   - Line 198-200: Provider badge shows "MT4/MT5" → keep (good)
   - Line 223: "Deriv, MetaTrader, etc." → "your broker accounts (Deriv, MT4, MT5)"

4. **`src/pages/Charts.tsx`**:
   - Line 48: `source: 'deriv' | 'metaapi'` → `source: 'deriv' | 'broker'`
   - Line 254: `source: 'metaapi'` → `source: 'broker'`

5. **`src/pages/Index.tsx`**:
   - Line 43: `source: 'deriv' | 'metaapi' | 'local'` → `source: 'deriv' | 'broker' | 'local'`
   - Line 547: Badge showing `{trade.source}` - map to friendly names

---

## Phase 3: Synthetic Indexes Trading Integration

### 3.1 Update Watchlist with Proper Deriv Symbol Mapping

**Current State:** `src/config/watchlist.ts` has synthetic symbols like "VOLATILITY_25" but these need proper mapping.

**Fix:** Update watchlist to use Deriv-compatible display names:

```typescript
"SYNTHETIC INDEXES (25)": [
  "Volatility 10 (1s)", "Volatility 25 (1s)", "Volatility 50 (1s)", "Volatility 75 (1s)", "Volatility 100 (1s)",
  "Volatility 10", "Volatility 25", "Volatility 50", "Volatility 75", "Volatility 100",
  "Boom 300", "Boom 500", "Boom 1000",
  "Crash 300", "Crash 500", "Crash 1000",
  "Step Index",
  "Jump 10", "Jump 25", "Jump 50", "Jump 75", "Jump 100",
  "Range Break 100", "Range Break 200"
],
```

The symbol mapping in `src/services/derivWebSocket.ts` (lines 294-316) already handles these correctly.

---

### 3.2 Add Dynamic Instrument Discovery via Deriv API

**New Service Function:** `src/services/derivMarketData.ts`

Add function to fetch and categorize active symbols:

```typescript
export interface InstrumentCategory {
  name: string;
  symbols: ActiveSymbol[];
}

export async function getInstrumentsByCategory(
  ws?: DerivWS
): Promise<Record<string, ActiveSymbol[]>> {
  const symbols = await getActiveSymbols(ws, 'full');
  
  const categories: Record<string, ActiveSymbol[]> = {
    'forex': [],
    'synthetic': [],
    'crypto': [],
    'commodities': [],
    'indices': [],
    'stocks': []
  };
  
  for (const sym of symbols) {
    if (sym.market === 'synthetic_index') {
      categories.synthetic.push(sym);
    } else if (sym.market === 'forex') {
      categories.forex.push(sym);
    } else if (sym.market === 'cryptocurrency') {
      categories.crypto.push(sym);
    } else if (sym.market === 'commodities') {
      categories.commodities.push(sym);
    } else if (sym.market === 'indices') {
      categories.indices.push(sym);
    }
  }
  
  return categories;
}
```

---

### 3.3 Update WatchlistDropdown for Dynamic Synthetics

**File:** `src/components/WatchlistDropdown.tsx`

Add dynamic fetching of available synthetics from Deriv:

```typescript
const [derivSymbols, setDerivSymbols] = useState<Record<string, string[]>>({});

useEffect(() => {
  const loadDerivSymbols = async () => {
    try {
      const ws = getSharedDerivWS();
      await ws.connect();
      const response = await ws.send({ active_symbols: 'brief', product_type: 'basic' });
      
      // Filter synthetic indices
      const synthetics = (response.active_symbols || [])
        .filter((s: any) => s.market === 'synthetic_index' && !s.is_trading_suspended)
        .map((s: any) => s.display_name);
      
      if (synthetics.length > 0) {
        setDerivSymbols(prev => ({
          ...prev,
          'SYNTHETICS (Live)': synthetics
        }));
      }
    } catch (err) {
      console.warn('Could not fetch Deriv synthetics:', err);
    }
  };
  
  loadDerivSymbols();
}, []);

// Merge with static watchlist
const mergedWatchlist = useMemo(() => ({
  ...COMPREHENSIVE_WATCHLIST,
  ...derivSymbols
}), [derivSymbols]);
```

---

### 3.4 Add Synthetic-Specific Risk Warning

**File:** `src/components/deriv/DerivQuickTrade.tsx`

Add risk warning when synthetic is selected:

```typescript
const isSyntheticSymbol = (symbol: string): boolean => {
  const syntheticPatterns = ['Volatility', 'Boom', 'Crash', 'Step', 'Jump', 'Range Break'];
  return syntheticPatterns.some(p => symbol.includes(p));
};

// In the JSX, after direction tabs:
{isSyntheticSymbol(symbol) && (
  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
    <div className="flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
      <div className="text-sm">
        <p className="font-medium text-amber-600">Synthetic Index</p>
        <p className="text-muted-foreground text-xs">
          24/7 simulated market. High volatility. Not tied to real-world assets.
        </p>
      </div>
    </div>
  </div>
)}
```

---

### 3.5 Validate Account Supports Synthetic Trading

**File:** `src/components/deriv/DerivQuickTrade.tsx`

Add validation before trade execution:

```typescript
// MetaAPI accounts cannot trade Deriv synthetics
if (isMetaApiAccount && isSyntheticSymbol(symbol)) {
  toast({
    title: 'Unsupported Instrument',
    description: 'Synthetic indices can only be traded on Deriv accounts, not MT4/MT5.',
    variant: 'destructive'
  });
  return;
}
```

---

## Phase 4: Mobile UX Enhancements

### 4.1 Touch Target Sizing

**File:** `src/index.css`

Add global mobile-friendly touch targets:

```css
@media (max-width: 768px) {
  button, 
  [role="button"],
  input,
  select,
  textarea,
  .touch-target {
    min-height: 48px;
    min-width: 48px;
  }
  
  /* Ensure lot size buttons are easily tappable */
  .lot-size-button {
    min-width: 48px;
    min-height: 48px;
  }
}
```

### 4.2 Trade Ticket as Bottom Sheet on Mobile

**Enhancement for `DerivQuickTrade.tsx`:**

Use `vaul` (already installed) for bottom sheet on mobile:

```typescript
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

// In component:
const isMobile = useIsMobile();

// In render:
if (isMobile) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick Trade - {symbol}</DrawerTitle>
        </DrawerHeader>
        {/* Same content as Dialog */}
      </DrawerContent>
    </Drawer>
  );
}

return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    {/* Existing Dialog content */}
  </Dialog>
);
```

---

## Phase 5: Performance Optimizations

### 5.1 Debounce Lot Size Input

**File:** `src/components/ui/lot-size-input.tsx`

Add debounce to prevent rapid state updates:

```typescript
import { useCallback, useState, useEffect, useRef } from 'react';

// Debounced onChange
const debouncedOnChange = useRef(
  debounce((value: number) => onChange(value), 150)
).current;

const handleChange = (newValue: number) => {
  setInternalValue(newValue);
  debouncedOnChange(newValue);
};
```

### 5.2 Stale-While-Revalidate for Account List

**File:** `src/pages/Charts.tsx` and `src/pages/Index.tsx`

Cache account list in localStorage:

```typescript
const CACHE_KEY = 'humi_accounts_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedAccounts = () => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;
  const { data, timestamp } = JSON.parse(cached);
  if (Date.now() - timestamp < CACHE_TTL) return data;
  return null;
};

const setCachedAccounts = (data: TradingAccount[]) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
};

// In loadAccounts:
const cached = getCachedAccounts();
if (cached) {
  setAccounts(cached); // Show immediately
}
// Then fetch fresh data in background
```

---

## Implementation Files Summary

| File | Changes |
|------|---------|
| `src/pages/Charts.tsx` | Fix account query, add missing fields, rename 'metaapi' source |
| `src/pages/Index.tsx` | Add Install App + Trading Accounts buttons, PWA state, source label mapping |
| `src/config/watchlist.ts` | Update synthetic symbol names to match Deriv format |
| `src/components/WatchlistDropdown.tsx` | Add dynamic Deriv synthetics fetching |
| `src/components/deriv/DerivQuickTrade.tsx` | Add synthetic validation, risk warning, mobile drawer |
| `src/components/ConnectAccountModal.tsx` | Remove "MetaAPI" from user-facing text |
| `src/pages/TradingAccounts.tsx` | Update empty state text |
| `src/services/derivMarketData.ts` | Add getInstrumentsByCategory function |
| `src/index.css` | Add mobile touch target styles |
| `src/components/ui/lot-size-input.tsx` | Add debounce |

---

## Testing Checklist

1. **Charts Page Bug:**
   - [ ] Navigate to /charts → All connected accounts appear in dropdown
   - [ ] Both Deriv and MT4/MT5 accounts show correctly
   - [ ] Account switching works

2. **PWA Install:**
   - [ ] On mobile browser, "Install App" button appears in Quick Actions
   - [ ] Clicking triggers browser install prompt
   - [ ] Button hides after installation

3. **Trading Accounts Button:**
   - [ ] "Trading Accounts" button appears in Quick Actions
   - [ ] Clicking navigates to /accounts

4. **Branding Cleanup:**
   - [ ] No "MetaAPI" text visible to users
   - [ ] No "Deriv API" text visible (except official Deriv references)
   - [ ] Trade sources show "Deriv" or "Broker" not "metaapi"

5. **Synthetic Trading:**
   - [ ] Volatility indices appear in symbol search
   - [ ] Risk warning shows for synthetics
   - [ ] MT4/MT5 accounts blocked from trading synthetics
   - [ ] Deriv accounts can successfully trade R_100

6. **Mobile UX:**
   - [ ] Trade ticket opens as bottom sheet on mobile
   - [ ] All buttons have 48px touch targets
   - [ ] Lot size +/- buttons easily tappable

---

## Technical Notes

### Synthetic Symbol Detection Logic
```typescript
const SYNTHETIC_PREFIXES = ['R_', '1HZ', 'BOOM', 'CRASH', 'JD', 'stpRNG', 'RDBEAR', 'RDBULL'];

function isSyntheticDerivSymbol(derivSymbol: string): boolean {
  return SYNTHETIC_PREFIXES.some(p => derivSymbol.startsWith(p));
}
```

### Account Capability Matrix
| Account Type | Forex | Crypto | Synthetics | CFD |
|-------------|-------|--------|------------|-----|
| Deriv (CR/VRTC) | ✅ | ✅ | ✅ | ❌ |
| Deriv MT5 | ✅ | ✅ | ❌ | ✅ |
| Other MT4/MT5 | ✅ | ✅* | ❌ | ✅ |

*Depends on broker

---

## Priority Order

1. **CRITICAL**: Fix /charts account selection bug (Phase 1.1)
2. **HIGH**: Branding cleanup - remove MetaAPI references (Phase 2)
3. **HIGH**: Add Trading Accounts + Install App buttons (Phase 1.2, 1.3)
4. **MEDIUM**: Synthetic trading validation & warnings (Phase 3.4, 3.5)
5. **MEDIUM**: Dynamic synthetic symbol fetching (Phase 3.2, 3.3)
6. **LOW**: Mobile UX enhancements (Phase 4)
7. **LOW**: Performance optimizations (Phase 5)

Let's make sure that we also Integrate the CopyFactory to the App, we want to be sure that our users can access and use the Copy Trading from the HuMi App efficiently. This should be easy to use and easy on the eyes of our users.
