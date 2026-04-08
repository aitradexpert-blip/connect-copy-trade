

# Implementation Plan: Dashboard Cleanup, Mentor Split, MetaAPI Scrub, Auth & Subscription Fixes

---

## 1. Google OAuth Configuration

The code is correct. The Google Client ID and Secret need to be set in **Supabase Authentication > Providers > Google**:
- Client ID: `99538444569-b8r6h0v09a4bmo1d5anh1p5gcs3935p8.apps.googleusercontent.com`
- Client Secret: `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`

This is a Supabase dashboard configuration — no code changes needed. The `redirectTo` in `Auth.tsx` already uses `window.location.origin`.

**Action**: Configure Google provider in Supabase dashboard.

---

## 2. Remove All User-Facing "MetaAPI" / "metaapi" Branding

Scrub visible text references in these files (variable names and internal identifiers stay):

- **`src/pages/ApiDocs.tsx`** — Replace "MetaAPI Bridge", "MetaAPI Provisioning Setup", references to `support@metaapi.cloud` with generic terms like "Trading Bridge", "MT4/MT5 Provisioning Setup"
- **`src/pages/TradingIdeas.tsx`** — Comment on line 207 already says "no MetaAPI branding" — verify provider badge text
- **`src/services/brokerExecution.ts`** — Only console.log mentions; no user-facing changes needed
- **`src/components/ConnectAccountModal.tsx`** — Check button labels; replace any "MetaAPI" text with "MT4/MT5 Connection"
- **`src/pages/TradingAccounts.tsx`** — Replace any visible "MetaAPI" labels with "Trading Bridge" or "MT4/MT5"
- **`src/components/AppSidebar.tsx`** — Line 90: Replace "Meta Ai Xpert Trader" with "HuMi"
- **`src/components/admin/UserManagementTab.tsx`** — Replace any user-facing "metaapi" labels
- **`src/pages/CopyTradingNew.tsx`** — Replace "MetaAPI" in error messages and UI text
- **`src/components/DerivDiagnostic.tsx`** — Check for visible references
- **`src/pages/About.tsx`** — Check and remove MetaAPI mentions

---

## 3. Fix Home Button Redirect for Mentors/Clients on HuMi Dashboard

**Problem**: `MentorAwareHome` in `App.tsx` redirects mentor clients to `/mentor-dashboard` even when clicking "Home" on the HuMi main dashboard sidebar/bottom nav. The sidebar `Dashboard` link goes to `/` which triggers the redirect.

**Fix**: 
- Change `BottomNav.tsx` Home link from `/` to `/?dashboard=main`
- Change `AppSidebar.tsx` Dashboard link from `/` to `/?dashboard=main`
- This ensures clicking Home within the HuMi layout always stays on the main dashboard

**Files**: `src/components/BottomNav.tsx`, `src/components/AppSidebar.tsx`

---

## 4. Dashboard Cleanup — Consolidate into Tabs

**File**: `src/pages/Index.tsx`

Replace the 4 separate card sections (Free WhatsApp Trading Tools, Market Charts, Broker Operations, Quick Actions) with a single `Tabs` component:

- **Tab: Trading Tools** — WhatsApp buttons
- **Tab: Market Charts** — Chart buttons
- **Tab: Broker Operations** — Broker links
- **Tab: Quick Actions** — Add Account, Deposit, Withdraw, View Ideas (paid only)
- **Tab: Mentor Center** — Only visible for users with `referred_by` in profile (mentor clients). Button redirects to `/mentor-dashboard`.

Remove the **Crypto Wallet** card entirely from the dashboard.

Also remove "Crypto Wallet" from `AppSidebar.tsx` and `BottomNav.tsx` navigation items.

---

## 5. Update Auto-Trade Limits

**Database**: Update `subscription_plans` table via the insert tool (data update, not schema change):

```sql
UPDATE subscription_plans SET auto_trades_limit = 30 WHERE lower(name) = 'basic';
UPDATE subscription_plans SET auto_trades_limit = 100 WHERE lower(name) = 'professional';
UPDATE subscription_plans SET auto_trades_limit = 1000 WHERE lower(name) = 'enterprise';
UPDATE subscription_plans SET auto_trades_limit = 3000 WHERE lower(name) = 'mentor';
```

---

## 6. Mentor Center Page Restructure

### Current state:
- `/mentor-center` — Full mentor admin (Clients, Ideas, Copy Trading, Branding, Media & Landing)
- `/mentor-dashboard` — Branded client dashboard (Home, Ideas, Copy Trading, AI Bot)

### Target state:
- `/mentor-center` — Mentor setup/config only: Clients, Branding, Media & Landing tabs + a new **"Dashboard"** tab that redirects to `/mentor-hub`
- `/mentor-hub` — **New page** for mentor's operational dashboard (similar design to `/mentor-dashboard`): Home, Ideas, Copy Trading, AI Bot tabs with mentor functionality (publish ideas, manage master account, close all trades, quick-trade to followers, rename features)
- `/mentor-dashboard` — Client-only dashboard (unchanged, but add subscription checks)

### Implementation:

**New file**: `src/pages/MentorHub.tsx`
- Modeled after `MentorClientDashboard.tsx` but with mentor-specific functionality
- **Home tab**: Stats (clients, followers, signals published), link back to `/mentor-center` for config
- **Ideas tab**: Publish signals form + Khumo AI suggestions (moved from MentorCenter)
- **Copy Trading tab**: Master account management, follower list, quick trade form, close all trades (moved from MentorCenter)
- **AI Bot tab**: Bot configuration, renamed per branding
- Header dropdown with Install App, Settings, HuMi Dashboard (`/?dashboard=main`), Logout

**Modified file**: `src/pages/MentorCenter.tsx`
- Remove Ideas and Copy Trading tabs
- Keep: Clients, Branding, Media & Landing
- Add: **Dashboard** tab that redirects to `/mentor-hub`
- This page becomes purely a configuration/setup page

**Modified file**: `src/App.tsx`
- Add route: `/mentor-hub` → `MentorHub` (PaidRoute, mentor-tier required)

### Subscription checks on client dashboard:

**Modified file**: `src/pages/MentorClientDashboard.tsx`
- On Copy Trading and AI Bot tabs, check if user has active subscription before showing controls
- If no subscription, show "Subscribe to activate" prompt with link to `/subscription`
- Same for "Add Trading Account" — prompt subscription if on free tier

---

## 7. Partnership Hub Access (Professional+ tiers)

There is no existing "Partnership Hub" page. This needs clarification — is it the `/api-docs` page, or a new page? For now, I'll assume it refers to `/api-docs`.

**File**: `src/App.tsx`
- Change `/api-docs` from public route to `PaidRoute` (or create a `ProfessionalRoute` guard that checks tier >= professional)

---

## Files Summary

### Create
- `src/pages/MentorHub.tsx` — Mentor's operational dashboard

### Modify
- `src/App.tsx` — Add `/mentor-hub` route, restrict `/api-docs`
- `src/pages/Index.tsx` — Tab consolidation, remove Crypto Wallet, add Mentor Center tab
- `src/pages/MentorCenter.tsx` — Remove Ideas/Copy Trading tabs, add Dashboard redirect tab
- `src/pages/MentorClientDashboard.tsx` — Subscription checks on Copy/Bot/Account features
- `src/components/AppSidebar.tsx` — Fix Dashboard link, remove Crypto Wallet, fix "Meta Ai Xpert Trader" → "HuMi"
- `src/components/BottomNav.tsx` — Fix Home link, remove Crypto Wallet
- `src/pages/ApiDocs.tsx` — Remove MetaAPI branding
- `src/pages/TradingAccounts.tsx` — Remove MetaAPI branding from UI text
- `src/components/ConnectAccountModal.tsx` — Remove MetaAPI branding from UI text
- `src/pages/CopyTradingNew.tsx` — Remove MetaAPI branding from UI text
- `src/pages/About.tsx` — Remove MetaAPI mentions

### Database (via insert tool)
- Update `subscription_plans` auto_trades_limit values

### Supabase Dashboard (manual)
- Configure Google OAuth provider with provided Client ID/Secret

---

## Implementation Order

1. Google OAuth config (Supabase dashboard)
2. Database: Update auto-trade limits
3. MetaAPI branding scrub (all files)
4. Dashboard cleanup + tab consolidation + hide Crypto Wallet
5. Fix Home navigation for mentors/clients
6. Create MentorHub page + restructure MentorCenter
7. Add subscription checks to MentorClientDashboard
8. Partnership Hub access restriction

