# Batch 3-5 Implementation Plan: Mentor Center, Branded Client UI, Admin Hardening, and Fixes

## Critical Fix: Headway Account Redeploy

The redeploy call returns a **403 ForbiddenError**: "To allow trading account execution please top up your account." This is a **MetaAPI billing issue** — the account's resource slots or credits are exhausted on the MetaAPI side. The code is correct; you need to top up your MetaAPI account at [https://app.metaapi.cloud](https://app.metaapi.cloud) to restore the Headway account.  
  
We have now fixed this by buying more credits, so we need to rerun this and make sure it works.

The redeploy edge function will be updated to surface this error message clearly to the user instead of showing a generic "Redeploy failed."

---

## 1. Install App Button in Account Dropdown

Add "Install App" menu item in the TopHeader account dropdown (under "My Account" section, before Settings) that calls the PWA install prompt. Only shown when `canInstall` is true. Also create an APK download format on the same place make it downloadable immediately, i know you can do this, which we can use to download and send to users via social media etc

**File**: `src/components/TopHeader.tsx`

---

## 2. Mentor Center Upgrades (Batch 3)

### 2A. Storage Bucket for Mentor Assets

Create `mentor-assets` public storage bucket via migration. Add RLS policies allowing mentors to upload to their own folder.

### 2B. Mentor Center — Enhanced Branding Tab

Upgrade `src/pages/MentorCenter.tsx` with:

- **Media Upload**: Image/GIF/video upload area in the Branding tab. Files uploaded to `mentor-assets/{mentor_id}/`. Stores URL and type in `mentor_profiles.landing_page_media_url` and `landing_page_media_type`.
- **UI Config Fields**: Primary color, secondary color, logo URL, custom welcome text — stored in `mentor_profiles.ui_config`.
- **Landing Page Slug**: Auto-generated from brand name, editable. Preview link shown.
- **Landing Page Preview**: Shows how the branded page looks inline.

### 2C. Mentor Ideas Publishing

Add an **"Ideas"** tab in MentorCenter allowing mentors to publish their own trading signals to `trading_signals` table with a `mentor_id` column.

**Database migration**: Add `mentor_id UUID` column to `trading_signals` (nullable — null = HuMi official). Add RLS policy allowing mentors to INSERT/UPDATE/SELECT their own signals.

The Ideas page (`TradingIdeas.tsx`) will show both HuMi signals (where `mentor_id IS NULL`) and, for mentor clients, their mentor's signals. Execution works identically to existing flow.

### 2D. Client Management Tab Enhancement

In MentorCenter "Clients" tab:

- Show client display names (join with profiles)
- Show copy trading status per client
- "Reconnect All" button — calls `metaapi-redeploy-account` for each client's MetaAPI accounts

### 2E. Close All Trades

**New Edge Function**: `supabase/functions/close-all-trades/index.ts`

- Accepts `user_id` (close own) or `mentor_id` (close all clients')
- For each relevant trading account, fetches open positions via MetaAPI and closes them
- Returns summary

**Frontend**: Add "Close All Trades" confirmation button in:

- Copy Trading page
- AI Bot page
- Trading Ideas page
- Mentor Center (for mentor's client trades)

### 2F. Mentor Landing Page Edge Function

**New Edge Function**: `supabase/functions/render-mentor-landing/index.ts`

- Accepts slug via query parameter
- Fetches mentor profile, media URL, ui_config
- Returns responsive HTML page with full-screen media background, mentor brand name overlay, CTA button to `/ref/{slug}`

---

## 3. Branded Client UI (Batch 4)

### 3A. Referral Association on Signup

Update `src/pages/Auth.tsx`: When `?ref=slug` is present, after successful signup, insert into `mentor_clients` and store `referred_by` in profiles.

**Database migration**: Add `referred_by TEXT` column to `profiles` (nullable).

### 3B. Mentor Context Branding

`src/contexts/MentorContext.tsx` already loads mentor branding for clients. Enhance it to:

- Apply `ui_config` colors as CSS variables on the root element
- Expose mentor's `landing_page_media_url` for potential use in client dashboard

### 3C. Mentor Client Three-Tab Layout

**New component**: `src/components/MentorClientLayout.tsx`

- For users who are mentor clients (`isMentorClient` from MentorContext)
- Provides tabs: **Home** (standard dashboard), **Ideas** (mentor's signals, executable), **Trading Bot** (AI bot with mentor's custom name, start/stop controls)
- Ideas tab filters `trading_signals` by `mentor_id` matching user's mentor
- Each idea is executable exactly like the main TradingIdeas page

---

## 4. Admin Hardening (Batch 5)

### 4A. New Admin Edge Functions

`**supabase/functions/admin-create-user/index.ts**`:

- Accepts email, password, plan
- Uses `supabaseAdmin.auth.admin.createUser()`
- Creates profile row and subscription row
- Returns user ID

`**supabase/functions/admin-update-subscription/index.ts**`:

- Accepts user_id, plan_name
- Upserts `user_subscriptions`
- Returns confirmation

### 4B. UserManagementTab Improvements

- Add "Create User" button with dialog (email, password, plan selection)
- Calls `admin-create-user` edge function
- Existing subscription update already works; ensure "Free" option included (already done)

### 4C. Harden admin-list-users

Update existing `supabase/functions/admin-list-users/index.ts` to use proper Supabase auth verification instead of manual JWT decode.

---

## 5. Redeploy Error UX

Update `metaapi-redeploy-account` to parse the error body and return human-readable messages. Update TradingAccounts.tsx reconnect handler to show specific errors like "MetaAPI credits depleted — please contact support."

---

## Files to Create

- `supabase/functions/close-all-trades/index.ts`
- `supabase/functions/render-mentor-landing/index.ts`
- `supabase/functions/admin-create-user/index.ts`
- `supabase/functions/admin-update-subscription/index.ts`
- `src/components/MentorClientLayout.tsx`

## Files to Modify

- `src/components/TopHeader.tsx` — Install App in dropdown
- `src/pages/MentorCenter.tsx` — media upload, UI config, ideas publishing, client management, close all trades
- `src/pages/TradingIdeas.tsx` — show mentor-specific signals for mentor clients
- `src/pages/TradingAccounts.tsx` — better redeploy error messages
- `src/pages/Auth.tsx` — referral association on signup
- `src/contexts/MentorContext.tsx` — apply branding CSS variables
- `src/components/admin/UserManagementTab.tsx` — create user button
- `supabase/functions/metaapi-redeploy-account/index.ts` — better error parsing
- `supabase/functions/admin-list-users/index.ts` — auth hardening
- `supabase/config.toml` — new function entries

## Database Migrations

1. Add `mentor_id UUID` column to `trading_signals` + RLS for mentor INSERT/UPDATE
2. Add `referred_by TEXT` column to `profiles`
3. Create `mentor-assets` public storage bucket + RLS policies
4. Add mentor signal SELECT policy (clients can see their mentor's signals)

## Implementation Order

1. Critical fix: Redeploy error UX + Install App button
2. Database migrations (mentor_id on signals, referred_by on profiles, storage bucket)
3. Mentor Center upgrades (upload, branding, ideas, clients, close-all)
4. Edge functions (close-all-trades, render-mentor-landing, admin-create-user, admin-update-subscription)
5. Branded client UI (referral association, MentorClientLayout)
6. Admin hardening (create user UI, auth hardening)  
  
Let's make sure we get these important thing correct at a go  
  
- We want Copy Trading to actually works. In the Mentor Center, the Mentors users should automatically be linked to the Mentor as the "Master" in Copy Trading with an option to Stop/turn off Copy Tading. AI bot the same, the mentors users should be able to opt in to trade using the bot. in the Normal HuMi Dashboard, same principle must apply, in terms of Copy Trading, we want the Master Trading account to be directly linked to the user, also the Trading Account of the master should allow us to track and check for when the Master Trading Account actually places a trade in Metatrader, so we want the Master Trader, when they place trades on their linked Master trading account linked with Metatrader, The Master should be able to place trades directly on Metatrader 4 or 5, and that trade should automatically be linked to the Follower/s account so that the exact trades are places in the Followers Linked/added Follower Trading account (Not sure if that make sense).  
- We want Trades to be able to create trading accounts in the HuMi dashboard directly into the MetaAPI APIs, we were able to this before but now in the Tables Editor we can see that trading accounts metaapi ids are not correctly generated when the other ones are done correctly, also reattempt to create the incorrecly ceated accounts trading_accounts, metaapi_account_id  
  
Users in the Mentor Center should still be able to access the Normal HuMi through the menu on the top right, linked same trading accounts to the mentor center. (Think hard about this recheck if what I say makes sense, make it make sense and work on it.)