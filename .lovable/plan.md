
# Mentor Center, Branded Client UI, and Visibility Fixes — Implementation Plan

## Problem Summary

Many features were coded but never wired into the actual user flows. The result is that changes are invisible to users. This plan fixes every broken link, missing route, and dead-code component identified during the audit.

---

## What's Broken (Root Causes)

1. **MentorClientLayout is dead code** — the component exists at `src/components/MentorClientLayout.tsx` but is never imported or rendered by any page or route in `App.tsx`. Mentor clients see the normal HuMi dashboard with zero branding.

2. **Auth sign-in always redirects to `/`** — when a referred user signs in (with `?ref=slug`), they land on the main HuMi dashboard instead of a branded mentor client experience. The referral link is stored but the redirect ignores it.

3. **MentorReferral page (`/ref/:slug`) is a plain card** — it doesn't use the mentor's uploaded media, branding colors, or the `render-mentor-landing` edge function. The landing page the mentor customized is only accessible via a raw Supabase function URL.

4. **`--mentor-primary` CSS variable is set but never consumed** — no component or stylesheet reads this variable, so mentor colors have zero effect on the UI.

5. **No Copy Trading tab in client layout** — the MentorClientLayout only has 3 tabs (Home, Ideas, Bot). Copy Trading — the most requested feature — is missing.

6. **No auto-link of mentor's master account to client for copy trading** — when a client clicks "Activate Copy Trading," nothing links their trading account to the mentor's master account automatically.

7. **No "Go to HuMi Dashboard" button** — neither mentors nor clients can navigate between the Mentor Center and the main HuMi dashboard from within the mentor UI.

8. **Khumo AI Ideas suggestions not surfaced to mentors** — the plan called for Khumo to suggest signal ideas to mentors in the Mentor Center, but this was never implemented.

9. **Install App / APK download** — the install button exists in the TopHeader dropdown but only shows when `canInstall` is true (browser-triggered). There's no always-visible download/install guidance or APK/IPA link.

---

## Implementation Steps

### Step 1: Create Branded Mentor Client Dashboard Page

**New file**: `src/pages/MentorClientDashboard.tsx`

A full-page component that replaces the normal dashboard for mentor-referred users. Uses the uploaded image/video and mentor colors as the background/hero. Includes 4 tabs: **Home**, **Ideas**, **Copy Trading**, **AI Bot** (using mentor-renamed labels).

- **Home tab**: Branded welcome with mentor media as hero/background (dark overlay + gradient using mentor's primary color), account summary cards, and a "Connect Trading Account" button if no accounts exist.
- **Ideas tab**: Fetches `trading_signals` filtered by `mentor_id` OR `mentor_id IS NULL`, with execute-trade dialog (reuse existing execution logic from `brokerExecution.ts`).
- **Copy Trading tab**: Shows mentor's master account. Single "Activate Copy Trading" button that: (a) if no trading account, opens ConnectAccountModal; (b) if account exists, creates a `copy_trading_relationships` row linking client's account to mentor's master account. Shows active/inactive status with stop button.
- **AI Bot tab**: Links to `/ai-trading` with mentor-branded name.

Applies mentor's `primary_color` and `secondary_color` via inline styles and CSS variables. Uses mentor's `landing_page_media_url` as the background/hero image.

Includes a **"Go to HuMi Dashboard"** button in the header that navigates to `/`.

### Step 2: Wire Mentor Client Dashboard into Routes

**File**: `src/App.tsx`

- Add new route: `/mentor-dashboard` → `MentorClientDashboard` (ProtectedRoute).
- Import `useMentor` into the routing logic. Create a `MentorClientRoute` wrapper that checks `isMentorClient` from MentorContext — if true, render children; if false, redirect to `/`.

### Step 3: Fix Auth Redirect for Referred Users

**File**: `src/pages/Auth.tsx`

- After successful sign-in (not just sign-up), check if the user has a `referred_by` value in profiles or a `mentor_clients` record. If yes, redirect to `/mentor-dashboard` instead of `/`.
- After successful sign-up with `?ref=slug`, also set the redirect target to `/mentor-dashboard`.
- Update `linkMentorReferral` to also set `referred_by` in the `profiles` table.

### Step 4: Upgrade MentorReferral Landing Page

**File**: `src/pages/MentorReferral.tsx`

Replace the plain card with a full-screen branded landing page:
- Fetch mentor's `landing_page_media_url`, `landing_page_media_type`, `ui_config`, `brand_name` from `mentor_profiles`.
- Render full-screen media background (video autoplay muted loop or image cover) with dark overlay.
- Overlay: mentor brand name with gradient text (using primary_color), welcome text from `ui_config`, and a prominent "Join Now" CTA button linking to `/auth?ref={slug}`.
- Style inspired by the uploaded reference images (bold, high-contrast, trading-themed).

### Step 5: Make Mentor Branding Actually Visible

**File**: `src/index.css` or inline in components

- Define CSS utility classes that consume `--mentor-primary` and `--mentor-secondary`:
  ```css
  .mentor-branded { --primary: var(--mentor-primary, hsl(var(--primary))); }
  ```
- Apply the `mentor-branded` class to the MentorClientDashboard wrapper so all child components using `bg-primary`, `text-primary` etc. automatically pick up mentor colors.

### Step 6: Mentor Center — Add "Go to HuMi Dashboard" Button

**File**: `src/pages/MentorCenter.tsx`

- Add a button in the header area: "Open HuMi Dashboard" with an `ExternalLink` icon that navigates to `/`.
- This lets mentors switch between their Mentor Center admin view and the normal HuMi dashboard.

### Step 7: Mentor Center — Add Copy Trading Management

**File**: `src/pages/MentorCenter.tsx`

- Add a "Copy Trading" tab showing:
  - Which of the mentor's trading accounts is set as master (`is_master = true`).
  - A toggle to set/unset master status.
  - A "Quick Trade" form (symbol, direction, lot size) that: (a) publishes a signal to `trading_signals` with the mentor's `mentor_id`, AND (b) calls `copy-trade-listener` edge function to execute the signal on all followers' accounts.
  - List of active copy relationships with client names.

### Step 8: Auto-Link Copy Trading for Mentor Clients

**File**: `src/pages/MentorClientDashboard.tsx` (Copy Trading tab)

When client clicks "Activate Copy Trading":
1. If no trading account connected → open ConnectAccountModal.
2. If account exists → find mentor's master account (query `trading_accounts` where `user_id = mentor's user_id` AND `is_master = true`).
3. Insert into `copy_trading_relationships`: `{ follower_user_id: client, follower_account_id: client's account, master_account_id: mentor's master, master_user_id: mentor's user_id, status: 'active' }`.
4. Show success state with "Stop Copy Trading" button that updates status to 'inactive'.

### Step 9: Khumo Ideas Suggestions for Mentors

**File**: `src/pages/MentorCenter.tsx` — Ideas tab

- Add a "Get AI Suggestion" button that calls the `khumo-chat` edge function with a prompt like: "Suggest a trading signal for {popular forex pairs} with entry, SL, TP, and brief analysis."
- Display the response in a card with a "Publish This" button that pre-fills the signal form.

### Step 10: Install App — Always-Visible Guidance + Platform Links

**File**: `src/components/TopHeader.tsx`

- Change the install dropdown item to always show (not just when `canInstall` is true).
- When `canInstall` is true: trigger PWA install prompt.
- When `canInstall` is false (already installed or unsupported): show a small dialog with platform-specific instructions:
  - **Android**: "Open this page in Chrome → tap menu → 'Add to Home Screen'" + link to the published URL.
  - **iOS**: "Open in Safari → tap Share → 'Add to Home Screen'".
- Add this same guidance as a card on the Settings page.

**Note on APK/IPA**: True native APK/IPA builds require Capacitor setup and app store publishing pipelines, which cannot be done purely within this web project. The plan adds clear install instructions for both platforms using the browser-based install flow, which produces an app-like experience on both Android and iOS.

### Step 11: Fix MentorContext to Expose Mentor's User ID

**File**: `src/contexts/MentorContext.tsx`

- Add `mentorUserId` to the context (the `user_id` from `mentor_profiles`), needed for copy trading auto-linking.
- Expose `mentorUiConfig` (the full ui_config object) for color application.

### Step 12: Database — Add RLS for Copy Trading Relationship Management

**Migration**: Allow clients to UPDATE their own copy trading relationships (currently blocked by RLS).

```sql
CREATE POLICY "Users can update own copy relationships"
ON copy_trading_relationships FOR UPDATE
USING (auth.uid() = follower_user_id)
WITH CHECK (auth.uid() = follower_user_id);
```

---

## Files to Create
- `src/pages/MentorClientDashboard.tsx`

## Files to Modify
- `src/App.tsx` — add `/mentor-dashboard` route
- `src/pages/Auth.tsx` — redirect referred users to `/mentor-dashboard`
- `src/pages/MentorReferral.tsx` — full-screen branded landing page
- `src/pages/MentorCenter.tsx` — Copy Trading tab, Khumo suggestions, "Go to HuMi" button
- `src/contexts/MentorContext.tsx` — expose `mentorUserId` and `mentorUiConfig`
- `src/components/TopHeader.tsx` — always-visible install guidance
- `src/index.css` — mentor branding CSS variable consumption

## Database Migration
- Add UPDATE policy on `copy_trading_relationships` for followers

## No New Edge Functions Needed
All existing functions (`copy-trade-listener`, `khumo-chat`, `metaapi-execute-trade`, `render-mentor-landing`) are reused.

## Implementation Order
1. MentorContext enhancement (Step 11)
2. Database migration (Step 12)
3. CSS branding variables (Step 5)
4. MentorReferral landing page upgrade (Step 4)
5. MentorClientDashboard page (Step 1)
6. Route wiring + Auth redirect (Steps 2, 3)
7. MentorCenter upgrades — copy trading tab, Khumo suggestions, navigation (Steps 6, 7, 9)
8. Auto-link copy trading (Step 8)
9. Install app guidance (Step 10)
