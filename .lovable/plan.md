# HuMi Unified Trading Platform - Implementation Plan

## Vision

Enable full trading functionality (trades, history, positions) for ANY MT4/MT5 broker via MetaAPI, while maintaining seamless Deriv API integration for Deriv-native accounts. Empower all features through an intelligent, conversational Voice Assistant (Khumo).

---

## Core Problem & Solution Architecture

### Problem
The "Trading is not offered for this duration" error occurs because Deriv's API does not support MT5 trading. The current system incorrectly tries to use Deriv APIs for MT5 accounts.

### Solution
Implement a unified **Broker Adapter Layer**. The system intelligently routes requests:

- **For Deriv Accounts (CR, VRTC)**: Use the Deriv API (buy, sell, portfolio, statement)
- **For MT4/MT5 Accounts (any broker, including Deriv MT5)**: Use the MetaAPI (Trade.submit, getAccounts)

### Database Schema

The `trading_accounts` table includes:
- `provider` - 'deriv', 'metaapi', etc.
- `connection_type` - 'deriv_api' or 'metaapi' 
- `metaapi_account_id` - Stores MetaAPI's account.id
- `broker_name` - e.g., 'Deriv MT5', 'IC Markets', 'FxPro'

### Trade Routing Logic

```
User Request → Broker Adapter Layer
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
[connection_type = 'deriv_api']  [connection_type = 'metaapi']
    ↓                               ↓
 Deriv WebSocket               MetaAPI REST
 - buy/sell contracts          - POST /trade
 - portfolio                   - GET /positions
 - statement                   - GET /transactions
```

---

## MetaAPI Integration

### Required Endpoints

| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Trade Execution | `POST /accounts/{id}/trade` | Place market/limit orders |
| Open Positions | `GET /accounts/{id}/positions` | Get current trades |
| Trade History | `GET /accounts/{id}/history-deals` | Get closed trades |
| Account Info | `GET /accounts/{id}/account-information` | Balance, equity, margin |

### Edge Functions

1. `metaapi-execute-trade` - Execute trades ✅ (exists)
2. `metaapi-get-positions` - Get open positions ✅ (exists)
3. `metaapi-account-info` - Get account info ✅ (exists)
4. `metaapi-get-history` - Get trade history ✅ (to be created)

---

## Voice Assistant Capabilities (Khumo)

### Full Trading Commands

| Voice Command | Action | Provider |
|--------------|--------|----------|
| "List my accounts" | Returns all connected accounts | Both |
| "Select my [account name]" | Sets active account | Both |
| "What's my balance?" | Live balance from selected account | Both |
| "Show open positions" | Current trades | Both |
| "Buy EUR/USD on my MT5" | Execute trade with account selection | MetaAPI |
| "Sell 0.1 lots of gold" | Execute with volume | Both |
| "What did I trade today?" | Trade history | Both |
| "Close my EUR/USD position" | Close specific trade | Both |

### Technical Flow

```
User: "Buy EUR/USD on my IC Markets account"
    │
    ▼
┌─────────────────────────────────────────┐
│ voice-ai-assistant edge function        │
│                                         │
│ 1. Parse intent: BUY EUR/USD            │
│ 2. Resolve account: "IC Markets"        │
│ 3. Detect connection_type: metaapi      │
│ 4. Store pending trade                  │
│ 5. Request confirmation                 │
└─────────────────────────────────────────┘
    │
    ▼
Khumo: "Just to confirm, BUY EUR/USD 
on your IC Markets MT5 account?"
    │
    ▼
User: "Yes, confirm"
    │
    ▼
┌─────────────────────────────────────────┐
│ Route to metaapi-execute-trade          │
│ Execute trade, return confirmation      │
└─────────────────────────────────────────┘
    │
    ▼
Khumo: "Trade executed at 1.0950!"
```

---

## Implementation Phases

### Phase 1: Foundation ✅
- [x] Database has provider/metaapi_account_id columns
- [x] Broker Adapter service exists (brokerExecution.ts)
- [x] MetaAPI edge functions exist
- [ ] Add connection_type and broker_name columns
- [ ] Migrate existing MT5 accounts

### Phase 2: Full MetaAPI Operations 
- [ ] Create metaapi-get-history edge function
- [ ] Unified positions/history fetching in UI
- [ ] MT4/MT5 account onboarding flow

### Phase 3: Voice Trading Intelligence
- [ ] Account selection via voice
- [ ] Live balance/positions from both providers
- [ ] Trade execution with account context
- [ ] Multi-step confirmation flow

### Phase 4: Unified Dashboard
- [ ] Global portfolio (all accounts)
- [ ] Combined trade history
- [ ] Total equity across all sources

---

## Files Modified

| File | Changes |
|------|---------|
| `supabase/functions/voice-ai-assistant/index.ts` | Full account management, live data, trade execution |
| `supabase/functions/metaapi-get-history/index.ts` | NEW: Trade history endpoint |
| `src/components/EnhancedVoiceAssistant.tsx` | Account indicator, confirmation UI |
| `src/services/brokerExecution.ts` | Enhanced routing logic |
| Database migration | Add connection_type, broker_name columns |

---

## Security Considerations

1. All broker tokens stored encrypted in Supabase
2. Edge functions use METAAPI_TOKEN from secrets
3. Trade execution requires voice/UI confirmation
4. RLS ensures user-only data access
