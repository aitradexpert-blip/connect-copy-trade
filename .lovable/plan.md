

# Fix Plan: Install Button, Auth Flow, Mentor Center Mobile UX, and Forgot Password

## Issues Identified

1. **No Install/Download button in Mentor Center** — MentorClientDashboard and MentorCenter lack the account dropdown menu with Install App option. Only the main HuMi dashboard (via TopHeader in AppLayout) has it.

2. **"HuMi Dashboard" button not working** — The button at line 234 of MentorClientDashboard navigates to `/` which triggers `MentorAwareHome`, which checks `isMentorClient` and redirects back to `MentorClientDashboard`. Infinite loop / wrong destination.

3. **Media & Landing tab overlaps on mobile** — The MentorCenter TabsList at line 530 uses `flex-wrap` with 5 tabs that likely overlap on small screens.

4. **Google Auth error** — The `redirectTo` in `signInWithOAuth` uses `window.location.origin`, which in the Lovable preview is the preview URL. Google OAuth redirect URIs must be configured in Google Cloud Console to include the published URL. This is a configuration issue, not a code issue. The code is correct for the published URL.

5. **Email confirmation redirects to localhost** — The `emailRedirectTo` in `signUp` uses `window.location.origin`. In dev preview this works, but the Supabase project's "Site URL" setting (in Authentication > URL Configuration) is likely set to `localhost:XXXX`. It must be set to the published URL.

6. **No Forgot Password button** — Auth.tsx has no password reset flow.

7. **No welcome/onboarding message after registration** — Users land on dashboard with no intro.

---

## Implementation

### 1. Add Account Dropdown (with Install App) to MentorClientDashboard

Add a user menu dropdown in the MentorClientDashboard header (top-right of hero section) with:
- Profile
- Settings
- Install App (with PWA prompt or install guide dialog)
- Open HuMi Dashboard
- Logout

**File**: `src/pages/MentorClientDashboard.tsx`

### 2. Add Account Dropdown to MentorCenter

Replace the simple "HuMi Dashboard" button in MentorCenter header with a dropdown menu matching TopHeader's pattern, including Install App.

**File**: `src/pages/MentorCenter.tsx`

### 3. Fix "Return to HuMi Dashboard" Navigation

The issue: `navigate("/")` goes to `MentorAwareHome` which redirects mentor clients back to `/mentor-dashboard`. Fix by navigating to a dedicated bypass route or by using a query param.

Solution: Change `MentorAwareHome` in `App.tsx` to check for `?dashboard=main` query param — if present, render `<Index />` regardless of mentor status. Update all "HuMi Dashboard" buttons to navigate to `/?dashboard=main`.

**Files**: `src/App.tsx`, `src/pages/MentorClientDashboard.tsx`, `src/pages/MentorCenter.tsx`

### 4. Fix Mobile Tab Overflow in MentorCenter

Change TabsList from `flex-wrap` to a horizontally scrollable container on mobile. Use `overflow-x-auto` and ensure each tab trigger has `whitespace-nowrap` and adequate min-width.

**File**: `src/pages/MentorCenter.tsx` (line 530)

### 5. Google Auth — Configuration Note

Google Auth fails because the OAuth redirect URIs in Google Cloud Console don't include the correct callback URL. The code is correct. The user needs to:
- Add `https://tkgguyjoynnrsayfxzvj.supabase.co/auth/v1/callback` as an Authorized Redirect URI in Google Cloud Console
- Add `https://connect-copy-trade.lovable.app` as an Authorized JavaScript Origin
- Set the Site URL in Supabase Auth settings to `https://connect-copy-trade.lovable.app`

No code changes needed — just configuration.

### 6. Fix Email Confirmation Redirect

The `emailRedirectTo` in signup uses `window.location.origin` which is correct in production. The real fix is ensuring Supabase's **Site URL** (Authentication > URL Configuration) is set to `https://connect-copy-trade.lovable.app` instead of `localhost`.

Additionally, update the redirect to be mentor-aware: if `refSlug` exists, redirect to `/mentor-dashboard`, otherwise `/`.

**File**: `src/pages/Auth.tsx` — already done correctly in code. The issue is Supabase config.

### 7. Add Forgot Password

Add a "Forgot Password?" link below the sign-in password field. When clicked, show an inline form to enter email and call `supabase.auth.resetPasswordForEmail()`. Create a `/reset-password` page that handles the recovery token and lets users set a new password.

**Files**:
- `src/pages/Auth.tsx` — add forgot password link and email input
- `src/pages/ResetPassword.tsx` — new page for setting new password
- `src/App.tsx` — add `/reset-password` public route

### 8. Welcome Onboarding After First Login

Show a welcome dialog/modal on first login (check `localStorage` for `humi_onboarded` flag). The dialog welcomes the user, shows key features, and includes an "Install App" CTA with platform-specific instructions.

**File**: `src/components/WelcomeModal.tsx` — new component
**File**: `src/pages/Index.tsx` and `src/pages/MentorClientDashboard.tsx` — render the modal

---

## Files to Create
- `src/pages/ResetPassword.tsx`
- `src/components/WelcomeModal.tsx`

## Files to Modify
- `src/pages/Auth.tsx` — forgot password link
- `src/pages/MentorClientDashboard.tsx` — account dropdown with install, fix HuMi navigation
- `src/pages/MentorCenter.tsx` — account dropdown, fix tab overflow on mobile, fix HuMi navigation
- `src/App.tsx` — add `/reset-password` route, fix `MentorAwareHome` bypass

## Configuration Required (User Action)
- Set Supabase Site URL to `https://connect-copy-trade.lovable.app`
- Configure Google OAuth redirect URIs in Google Cloud Console
- These are not code changes — they are dashboard settings

## Implementation Order
1. Fix MentorAwareHome bypass (`App.tsx`)
2. Add ResetPassword page + forgot password link in Auth
3. Add account dropdown to MentorClientDashboard and MentorCenter
4. Fix mobile tab overflow in MentorCenter
5. Create WelcomeModal
6. Wire WelcomeModal into Index and MentorClientDashboard

