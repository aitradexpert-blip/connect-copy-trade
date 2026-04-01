

# Mega Implementation Plan — MetaAPI Overhaul, Mentor Upgrades, Subscription Enforcement, and Cleanup

This is a large-scale upgrade spanning 9 areas. Split into 5 implementation batches to keep deployments stable.

---

## Batch 1: MetaAPI Token Update + Trade Execution Fix + Data Integrity

### 1A. Update METAAPI_TOKEN Secret
- Update the `METAAPI_TOKEN` Supabase secret with the new JWT provided
- Update the hardcoded token in `src/services/metaapi.ts` (this file exposes the token client-side — should be removed entirely and all calls routed through edge functions only)

### 1B. Rewrite `metaapi-provision-account` Edge Function
- Accept `user_id`, `broker_type`, `login`, `password`, `server`, `platform`
- Use MetaAPI REST Provisioning API with the new token
- After account creation, attempt to wait for deployment (poll status up to 30s)
- Return `metaapi_account_id`, `state`, `connectionStatus`, `region`
- Store `connection_type: 'metaapi'` enforced

### 1C. Connection Recovery in All MetaAPI Edge Functions
- `metaapi-execute-trade`: Already has dynamic region. Add retry after `/redeploy` on DISCONNECTED/504
- `metaapi-account-info`: Add redeploy retry
- `metaapi-get-positions`: Add redeploy retry
- Create new `metaapi-redeploy-account` Edge Function for manual reconnect

### 1D. Data Integrity Migration
```sql
-- Fix existing inconsistent rows
UPDATE trading_accounts SET connection_type = 'metaapi' 
WHERE provider = 'metaapi' AND connection_type != 'metaapi';

-- Add enforcement trigger
CREATE FUNCTION enforce_metaapi_consistency() ...
CREATE TRIGGER enforce_metaapi_consistency BEFORE INSERT OR UPDATE ON trading_accounts ...
```

### 1E. Remove Client-Side MetaAPI Token
- Delete `src/services/metaapi.ts` entirely (exposes token client-side)
- Route all MetaAPI calls through Supabase Edge Functions
- Update any imports in `TradingAccounts.tsx`, `brokerExecution.ts` etc.

### 1F. Frontend Reconnect Button
- Add "Reconnect" button on `TradingAccounts.tsx` for DISCONNECTED/PROVISIONING accounts
- Calls new `metaapi-redeploy-account` edge function

---

## Batch 2: Remove OctaFx UI + Subscription Quota Enforcement

### 2A. Remove OctaFx Promotional UI
- Delete `src/components/OctaFxBanner.tsx`
- Remove OctaFx import/usage from `src/pages/Index.tsx`
- Remove OctaFx references from `About.tsx`, `Pricing.tsx`, `Subscription.tsx`
- Remove OctaFx WhatsApp button text from Index.tsx
- Keep the OctaFx broker link in the "Open Account" broker list (it's a legitimate partner, not promotional)

### 2B. Subscription Usage Events Table + Quota Function
Migration:
```sql
CREATE TABLE subscription_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users can view own, admins can view all
-- Index on (user_id, feature_key, cycle_start)

CREATE FUNCTION consume_subscription_quota(...) -- checks limit per tier per feature per cycle
CREATE FUNCTION check_account_quota() -- BEFORE INSERT trigger on trading_accounts
CREATE TRIGGER enforce_account_quota BEFORE INSERT ON trading_accounts ...
```

Tier limits for `trading_account_additions`: Free=1, Basic=2, Pro=5, Enterprise=10

### 2C. Copy Trading for Basic Plan
- Update `src/App.tsx`: Move `/copy-trading` from `PaidRoute` to `ProtectedRoute`
- In `CopyTradingNew.tsx`: Add tier-based limit check (Basic=1 active copy, Pro=5, Enterprise=10)
- Show limit info in UI

---

## Batch 3: Mentor Center Upgrades

### 3A. Database Additions
```sql
ALTER TABLE mentor_profiles ADD COLUMN landing_page_media_url TEXT;
ALTER TABLE mentor_profiles ADD COLUMN landing_page_media_type TEXT;
ALTER TABLE mentor_profiles ADD COLUMN landing_page_slug TEXT UNIQUE;
ALTER TABLE mentor_profiles ADD COLUMN ui_config JSONB DEFAULT '{}';
```

### 3B. Storage Bucket
- Create `mentor-assets` public bucket for landing page media

### 3C. Mentor Center Branding Tab
- Add media upload (image/video) to MentorCenter.tsx branding section
- Upload to `mentor-assets/{mentor_id}/` bucket
- Store URL and media type in `mentor_profiles`
- Add UI config fields: primary color, secondary color, logo URL, welcome text
- Preview of landing page with shareable link

### 3D. Mentor Landing Page Edge Function
- `render-mentor-landing`: Accepts slug, returns HTML page with full-screen media, overlay text, CTA linking to `/ref/{slug}`

### 3E. Client Management Tab
- Add "Clients" tab in MentorCenter showing all mentor_clients with copy status
- "Reconnect All" button to re-subscribe all clients to mentor's strategy

### 3F. Close All Trades
- New edge function `close-all-trades`: fetches open positions per account and closes them via MetaAPI
- Add "Close All Trades" button in Copy Trading, AI Bot, Ideas with confirmation dialog
- For mentors: "Close All Client Trades" button

---

## Batch 4: Branded Client UI + Referral Enhancements

### 4A. Referral Association
- On signup via `/ref/{slug}`, store `referred_by` in profiles
- On login, fetch mentor's `ui_config` and apply branding via CSS variables

### 4B. Shareable Idea Links
- Edge function `render-idea-landing`: shows idea details + CTA to sign up
- After signup via idea link, auto-associate with mentor

### 4C. Three-Tab Layout for Mentor Clients
- `MentorClientLayout.tsx` with Home/Ideas/Trading Bot tabs
- Ideas tab: shows mentor's trading ideas with share buttons
- Trading Bot tab: start/stop controls for AI bot execution

---

## Batch 5: Admin Hardening

### 5A. Fix admin-list-users
- Use Supabase Admin API (`supabaseAdmin.auth.admin.listUsers()`) properly
- Strengthen auth verification

### 5B. New Admin Edge Functions
- `admin-create-user`: create auth user + profile + subscription
- `admin-update-subscription`: update user plan

### 5C. UserManagementTab Improvements
- "Create User" button with modal
- Ability to change plan for any user
- Show all users including free tier with no subscription row

---

## Files to Create
- `supabase/functions/metaapi-redeploy-account/index.ts`
- `supabase/functions/close-all-trades/index.ts`
- `supabase/functions/render-mentor-landing/index.ts`
- `supabase/functions/render-idea-landing/index.ts`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-subscription/index.ts`
- `src/components/MentorClientLayout.tsx` (Batch 4)

## Files to Delete
- `src/services/metaapi.ts` (client-side token exposure)
- `src/components/OctaFxBanner.tsx`

## Files to Modify
- `supabase/functions/metaapi-provision-account/index.ts`
- `supabase/functions/metaapi-execute-trade/index.ts`
- `supabase/functions/metaapi-account-info/index.ts`
- `supabase/functions/metaapi-get-positions/index.ts`
- `src/App.tsx` (route access for copy trading)
- `src/pages/Index.tsx` (remove OctaFx)
- `src/pages/About.tsx` (remove OctaFx refs)
- `src/pages/Pricing.tsx` (remove OctaFx refs)
- `src/pages/Subscription.tsx` (remove OctaFx refs)
- `src/pages/TradingAccounts.tsx` (reconnect button, remove metaapi.ts imports)
- `src/pages/CopyTradingNew.tsx` (tier-based limits)
- `src/pages/MentorCenter.tsx` (branding upload, clients tab, close all)
- `src/services/brokerExecution.ts` (remove metaapi.ts dependency)
- `src/components/admin/UserManagementTab.tsx` (create user, update sub)
- `src/components/ConnectAccountModal.tsx` (remove metaapi.ts dependency)
- `supabase/config.toml` (new function entries)

## Database Migrations
1. Data cleanup: fix `connection_type` for existing MetaAPI rows
2. Trigger: `enforce_metaapi_consistency` on `trading_accounts`
3. Table: `subscription_usage_events` + RLS + index
4. Functions: `consume_subscription_quota`, `check_account_quota`
5. Trigger: `enforce_account_quota` on `trading_accounts` INSERT
6. Alter `mentor_profiles`: add `landing_page_media_url`, `landing_page_media_type`, `landing_page_slug`, `ui_config`
7. Create `mentor-assets` storage bucket

## Prerequisite
- Update `METAAPI_TOKEN` secret in Supabase with the new JWT token provided

## Implementation Order
Batch 1 → Batch 2 → Batch 3 → Batch 4 → Batch 5

Each batch is independently deployable and testable.

