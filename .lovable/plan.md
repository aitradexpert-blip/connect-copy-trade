

# Fix Registration Error, Subscription Flow & Navigation

## 1. Fix "Database error saving new user" Registration Bug

**Root Cause:** The `create_default_wallets` trigger fires on every `auth.users` INSERT but has no error handling. If any wallet insertion fails (e.g., a race condition or duplicate), the entire signup transaction rolls back, causing the "Database error saving new user" error.

**Fix:** Update the `create_default_wallets` function to add `ON CONFLICT DO NOTHING` (matching the pattern used by `handle_new_user`) and wrap in an exception handler:

```sql
CREATE OR REPLACE FUNCTION public.create_default_wallets()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO crypto_wallets (user_id, currency, balance, address) VALUES
    (NEW.id, 'BTC', 0, 'bc1q' || substr(md5(NEW.id::text), 1, 38)),
    ...
    (NEW.id, 'USD', 0, NULL)
  ON CONFLICT (user_id, currency) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_default_wallets failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
```

Also fix the `search_path` security warning flagged by the DB linter on `create_default_wallets`, `reset_monthly_limits`, and `has_subscription_access`.

---

## 2. Subscription-First Registration Flow

**Current state:** Users register on `/auth`, then get direct access to the dashboard. The "subscription-first" flow (pay on `/pricing` first, then register) is partially implemented but optional.

**Change:** After signup/signin, check if the user has an active subscription. If not, redirect them to `/subscription` instead of `/` (the dashboard). This is done by updating the `ProtectedRoute` component in `App.tsx`:

```text
ProtectedRoute logic:
1. If no user -> redirect to /auth
2. If user but no active subscription -> redirect to /subscription
3. If user + active subscription -> show requested page
```

The `/subscription` page itself will NOT be behind the subscription guard (it must be accessible to select a plan).

---

## 3. Link All Unlinked Pages to Navigation

**Missing from BottomNav "More" menu:**
- Notifications (`/notifications`)
- Subscription (`/subscription`)
- Profile (`/profile`)
- API Docs (`/api-docs`)

**Changes to `BottomNav.tsx`:**
Add these items to the "More" sheet menu:
- Bell icon - "Notifications" -> `/notifications`
- User icon - "Profile" -> `/profile`
- CreditCard icon - "Subscription" -> `/subscription`
- Code icon - "API Docs" -> `/api-docs`

**Changes to `AppSidebar.tsx`:**
- Fix stale `/signals` link (should be `/ideas`)
- Add missing nav items: Notifications, Charts, Wallet, Credits, Profile, Subscription, API Docs

---

## 4. Database Security Fixes

Address the linter warnings:
- Add `SET search_path TO 'public'` to `create_default_wallets`, `reset_monthly_limits`, and `has_subscription_access` functions
- The "RLS Policy Always True" warning will be noted but likely intentional for public-facing tables like `subscription_plans`

---

## Technical Summary

### Database Migration
- Update `create_default_wallets` function with ON CONFLICT and exception handling
- Fix `search_path` on 3 functions

### Files to Modify
| File | Change |
|------|--------|
| `src/App.tsx` | Update `ProtectedRoute` to check subscription status |
| `src/components/BottomNav.tsx` | Add Notifications, Profile, Subscription, API Docs links |
| `src/components/AppSidebar.tsx` | Fix `/signals` link, add missing pages |

### Files to Create
None -- all changes are to existing files and database functions.

