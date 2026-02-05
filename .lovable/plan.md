
# Full Implementation Plan: Notifications, API Docs, Credits & Admin System

## Executive Summary

This plan addresses five critical areas:
1. **Notification Center** - Real-time alerts for copy trading, ideas, AI bot trades
2. **API Documentation Page** - Public-facing docs for broker & enterprise integration
3. **Credits Monitoring** - Fix non-functional credit tracking system
4. **Subscription & Admin System** - Sync pricing, fix admin access, enable plan assignment
5. **Platform Documentation** - Comprehensive business/investor-ready documentation

---

## Phase 1: Fix Credits Monitoring System

### Problem Identified
The `credit_usage` table exists but is **never populated**. Edge functions and client-side actions don't log credit usage.

### Solution

#### 1.1 Create Credit Service (`src/services/creditService.ts`)
```text
New service file with:
- CREDIT_COSTS constant defining costs per service
- deductCredits() function to log usage to database
- getRemainingCredits() function to check balance
```

**Credit Costs:**
- `khumo_ai_query`: 5 credits
- `trade_execution`: 2 credits
- `copy_trade_setup`: 3 credits
- `signal_unlock`: 1 credit
- `voice_assistant`: 3 credits

#### 1.2 Instrument Edge Functions

**Files to modify:**
| Edge Function | Credit Type | Credits |
|--------------|-------------|---------|
| `voice-ai-assistant/index.ts` | `khumo_ai_query` | 5 |
| `metaapi-execute-trade/index.ts` | `trade_execution` | 2 |
| `deriv-execute-signal/index.ts` | `trade_execution` | 2 |
| `auto-execute-signal/index.ts` | `ai_bot_trade` | 2 per execution |

Add credit logging after successful operations.

#### 1.3 Database Migration
Add INSERT policy to allow authenticated users to log their own credit usage:
```sql
CREATE POLICY "Users can insert own credit usage"
ON public.credit_usage FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

---

## Phase 2: Fix Subscription & Admin System

### Problem Identified
**Major pricing inconsistency:**

| Source | Basic | Professional | Enterprise |
|--------|-------|--------------|------------|
| Database (`subscription_plans`) | R9.90 | R29.90 | R39.99 |
| Frontend (`Pricing.tsx`) | R178.20 | R538.20 | R719.82 |
| Admin (`UserManagementTab.tsx`) | R99 | R299 | R399 |

### Solution

#### 2.1 Update Database Pricing (Migration)
Align database with intended ZAR pricing:
```sql
UPDATE subscription_plans SET price_zar = 99, price_usd = 5.50 WHERE name = 'basic';
UPDATE subscription_plans SET price_zar = 299, price_usd = 16.61 WHERE name = 'professional';
UPDATE subscription_plans SET price_zar = 399, price_usd = 22.17 WHERE name = 'enterprise';
```

#### 2.2 Create Subscription Plans Hook (`src/hooks/useSubscriptionPlans.ts`)
```text
New hook that:
- Fetches plans from subscription_plans table
- Returns plans with price_zar, price_usd, features
- Caches data to avoid repeated queries
```

#### 2.3 Update Pricing Pages
**Files to modify:**
- `src/pages/Pricing.tsx` - Replace hardcoded `plans` array with database query
- `src/pages/Subscription.tsx` - Replace hardcoded `plans` array with database query
- `src/components/admin/UserManagementTab.tsx` - Replace `SUBSCRIPTION_PLANS` constant with database query

#### 2.4 Admin Subscription Assignment
The existing `UserManagementTab.tsx` already supports plan assignment. Changes:
- Fetch plans from database instead of hardcoded array
- Ensure subscription modal displays accurate pricing
- Add activity logging for admin actions

---

## Phase 3: Real-Time Notification Center

### Database Schema

**New table: `notifications`**
```text
Columns:
- id (UUID, primary key)
- user_id (UUID, references auth.users)
- type (TEXT) - e.g., 'COPY_TRADE_EXECUTED', 'NEW_IDEA_PUBLISHED', 'AI_BOT_TRADE'
- title (TEXT)
- message (TEXT)
- data (JSONB) - For links, IDs, metadata
- read (BOOLEAN, default false)
- created_at (TIMESTAMPTZ, default now())

RLS Policies:
- Users can SELECT own notifications
- Users can UPDATE own notifications (mark as read)
- Service role can INSERT (for edge functions)
```

### Implementation Files

#### 3.1 Notification Service (`src/services/notificationService.ts`)
```text
Functions:
- createNotification(userId, type, title, message, data)
- markAsRead(notificationId)
- markAllAsRead(userId)
```

#### 3.2 Notification Hook (`src/hooks/useNotifications.ts`)
```text
Hook that:
- Fetches recent notifications on mount
- Subscribes to Supabase Realtime for new notifications
- Returns notifications, unreadCount, markAsRead(), markAllAsRead()
```

#### 3.3 Update TopHeader.tsx
```text
Replace static notification popover with:
- Real-time unread count from useNotifications hook
- Dropdown showing recent notifications
- Click to navigate based on notification.data
- "Mark all as read" button
- "View All" link to /notifications page
```

#### 3.4 New Notifications Page (`src/pages/Notifications.tsx`)
```text
Full-page notification history:
- Filter by type (Copy Trading, Ideas, AI Bot, System)
- Mark individual/all as read
- Pagination for history
```

#### 3.5 Trigger Notifications from Edge Functions

**`auto-execute-signal/index.ts`:**
After successful AI bot execution, insert notification:
```text
Type: AI_BOT_TRADE
Title: "AI Bot Trade Executed"
Message: "Khumo AI executed BUY EURUSD on {account}"
```

**`Admin.tsx` (client-side):**
After publishing trading idea:
```text
Type: NEW_IDEA_PUBLISHED
Title: "New Trading Idea"
Message: "{symbol} {direction} signal published"
(Broadcast to all subscribed users)
```

**`copy-trade-listener/index.ts` or subscription handler:**
```text
Type: COPY_TRADE_EXECUTED
Title: "Trade Copied"
Message: "Master {name} opened {direction} {symbol}. Copied to {account}."
```

### Route Addition
Add to `src/App.tsx`:
```typescript
<Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
```

---

## Phase 4: API Documentation Page

### New Page: `src/pages/ApiDocs.tsx`

**Structure:**
```text
┌─────────────────────────────────────────────────────────────┐
│ HuMi Partner Integration Hub                                │
│ "Integrate Your Brokerage or Enterprise with HuMi"         │
├─────────────────────────────────────────────────────────────┤
│ [Overview] [For Brokers] [For Enterprise] [API Reference]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Integration Pathways                                        │
│ ┌─────────────────────┐ ┌─────────────────────┐            │
│ │ MetaAPI Bridge      │ │ Direct API          │            │
│ │ Quick MT4/MT5       │ │ Custom Enterprise   │            │
│ │ integration via     │ │ integration with    │            │
│ │ provisioning        │ │ full API access     │            │
│ └─────────────────────┘ └─────────────────────┘            │
│                                                             │
│ Required Endpoints for Direct Integration:                  │
│ • Authentication: OAuth 2.0 flow                            │
│ • Trading: POST /trade, GET /open-positions                 │
│ • Funding: POST /deposit-url, POST /withdraw-request        │
│ • Data: GET /account-info, GET /trade-history               │
│ • Webhooks: trade-update, balance-update                    │
│                                                             │
│ ┌─────────────────────────────────────────────────┐        │
│ │ Contact Our Partnerships Team                   │        │
│ │ partnerships@humi.app                           │        │
│ └─────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Tabs Content:**

**Overview:**
- What is HuMi Platform
- Integration benefits for brokers
- Client volume & market reach

**For Brokers:**
- MetaAPI provisioning profile setup
- Required broker server configuration
- Sample cURL for account connection test

**For Enterprise:**
- White-label options
- Custom branding
- Dedicated infrastructure
- SLA guarantees

**API Reference:**
- OAuth2 authorization flow
- Trading endpoints specification
- Funding endpoints specification
- Webhook payload examples

### Route Addition
Add to `src/App.tsx`:
```typescript
<Route path="/api-docs" element={<ApiDocs />} />
```

### Settings Menu Integration
Add to `src/pages/Settings.tsx`:
```text
New Card "Developer & API" section with:
- "API Documentation" button linking to /api-docs
- Brief description: "For brokers and enterprise clients"
```

---

## Phase 5: Platform Documentation

### New File: `HUMI_PLATFORM_OVERVIEW.md`

**Document Structure:**

```text
# HuMi: Africa's Capital Management Operating System

## I. Executive Summary (For Investors)
- Core value proposition
- Market opportunity in South African/African market
- Revenue model (tiered subscriptions + transfer fees)
- Competitive moats

## II. Technical Architecture (For Developers)
- Tech stack: React, Supabase, MetaAPI, Deriv, Bankii
- Core modules:
  - Multi-Broker Orchestration
  - Social & Copy Trading
  - Khumo AI Suite
  - Capital Mobility Engine
  - Unified Wallet

## III. Market Analysis (For Investors)
- The African Problem: fragmented brokers, slow transfers, low trust
- HuMi's Solution: unification, speed (crypto settlement), community
- Competitive Moats:
  - Integration complexity
  - Local trust & community
  - Data network effects
- Future Roadmap:
  - Short-term: Stokvel pools, local payment rails
  - Long-term: RegTech, expansion to Nigeria/Kenya

## IV. For Users
- Advantages:
  - One dashboard for all trading
  - Move money between brokers in hours
  - Copy top traders
  - AI market analysis
- Honest Limitations:
  - Not a broker (need broker accounts)
  - Learning curve for advanced features
  - AI signals are not financial advice

## V. Feature Matrix
| Feature | Basic | Professional | Enterprise |
|---------|-------|--------------|------------|
| Auto-trades/month | 10 | 30 | Unlimited |
| Trading accounts | 2 | 5 | 10 |
| Copy connections | 1 | 3 | 5 |
| AI Bots | No | Yes | Yes |
| Priority support | No | Yes | 24/7 |
```

---

## Implementation Summary

### New Files to Create
| File | Purpose |
|------|---------|
| `src/services/creditService.ts` | Credit deduction logic |
| `src/services/notificationService.ts` | Notification creation |
| `src/hooks/useNotifications.ts` | Real-time notification hook |
| `src/hooks/useSubscriptionPlans.ts` | Database-sourced plans hook |
| `src/pages/Notifications.tsx` | Full notification history page |
| `src/pages/ApiDocs.tsx` | Partner API documentation |
| `HUMI_PLATFORM_OVERVIEW.md` | Platform documentation |

### Files to Modify
| File | Changes |
|------|---------|
| `src/pages/Pricing.tsx` | Replace hardcoded plans with database query |
| `src/pages/Subscription.tsx` | Replace hardcoded plans with database query |
| `src/components/admin/UserManagementTab.tsx` | Fetch plans from DB, improve UI |
| `src/components/TopHeader.tsx` | Real-time notification dropdown |
| `src/pages/Settings.tsx` | Add API docs link in new "Developer" section |
| `src/App.tsx` | Add routes for /notifications, /api-docs |
| `supabase/functions/auto-execute-signal/index.ts` | Add notification + credit logging |
| `supabase/functions/metaapi-execute-trade/index.ts` | Add credit logging |
| `supabase/functions/voice-ai-assistant/index.ts` | Add credit logging |

### Database Migrations
1. Create `notifications` table with RLS policies
2. Add INSERT policy to `credit_usage` for authenticated users
3. Update `subscription_plans` pricing to match intended values (R99/R299/R399)

---

## Priority Order

1. **Week 1**: 
   - Fix subscription pricing sync (database migration + hooks)
   - Implement credit monitoring (service + edge function instrumentation)
   
2. **Week 2**: 
   - Build notification center (table, service, hook, UI components)
   - Update TopHeader with real-time notifications
   
3. **Week 3**: 
   - Create API documentation page
   - Add to Settings menu
   
4. **Week 4**: 
   - Finalize platform documentation
   - Polish and testing

---

## Success Criteria

- [ ] Credits page shows actual usage data after AI/trade actions
- [ ] All pricing pages display consistent values from database (R99/R299/R399)
- [ ] Admins can assign any user to any subscription plan
- [ ] Users receive real-time notifications for copy trades, ideas, AI trades
- [ ] Bell icon shows accurate unread count
- [ ] Brokers can visit /api-docs and understand integration requirements
- [ ] Platform documentation ready for investor presentations
