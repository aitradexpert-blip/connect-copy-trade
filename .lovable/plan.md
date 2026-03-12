

# Implementation Plan

This plan addresses three critical bugs and adds a screenshot-based account connection feature. The add-on features (weekly PDF, trade replay, strategy simulator, etc.) are noted but deferred to a follow-up to keep this focused on what's broken and the immediate feature request.

---

## Critical Bug Fixes

### 1. Trade Execution Fails (MetaAPI Region Mismatch)

**Root cause**: `metaapi-execute-trade` Edge Function uses a hardcoded London URL (`mt-client-api-v1.london.agiliumtrade.ai`). The Headway account `02b58a87-...` is in a different region — confirmed by repeated `TimeoutError` logs saying "account is not connected to broker yet or request URL does not match the account region."

**Fix**: Update `metaapi-execute-trade` to dynamically resolve the account region from the Provisioning API (same pattern already used in `metaapi-account-info`). Also handle UNDEPLOYED state with auto-deploy.

**File**: `supabase/functions/metaapi-execute-trade/index.ts`

Changes:
- Query Provisioning API for account region before executing trade
- Build region-specific Client API URL
- If account state is not DEPLOYED, trigger deploy and return a retry message
- Remove hardcoded `CLIENT_API_URL` constant

### 2. Admin Panel Can't See Users (RLS + Email Resolution)

**Root cause (two issues)**:
1. The `profiles` table RLS only allows users to see their own profile (`auth.uid() = user_id`). There is **no admin SELECT policy** on `profiles`. When admin loads users, the query returns only the admin's own profile.
2. User emails are fetched from `user_roles` table, but new signups don't have a `user_roles` entry — so they show "N/A".

**Fix**:
- Add RLS policy on `profiles`: "Admins can view all profiles" using `has_role(auth.uid(), 'admin')`.
- Add RLS policy on `trading_accounts`: "Admins can view all accounts" for the same.
- Update `UserManagementTab.tsx` to fetch email from `profiles.display_name` as fallback, and also use `auth.users` metadata via a new edge function or by storing email in profiles.

**Database migration**: Add admin SELECT policies to `profiles` and `trading_accounts`.

**Code change**: Update `UserManagementTab.tsx` `loadUsers` to not depend on `user_roles` for email. Instead, store email in profiles (via `handle_new_user` trigger update) and read from there. Also add a "Free" option to subscription plans dropdown.

### 3. Admin Can't Update Subscriptions for New Users

**Root cause**: The `user_subscriptions` table INSERT policy only allows admins. The upsert works, but the subscription plans dropdown doesn't include "Free" as an option. Also, new users without any subscription row show "None" — admin needs to be able to create the row.

**Fix**: Add "Free" plan to SUBSCRIPTION_PLANS in UserManagementTab. The upsert logic already works for admins (has INSERT + UPDATE policies).

---

## New Feature: Screenshot-Based Account Connection

### How it works:
1. User clicks "Upload Screenshot" in the Connect Account modal
2. User takes a photo/screenshot of their broker login details
3. Image is uploaded and sent to an Edge Function that uses OCR to extract login, server, password
4. A pre-populated form appears with extracted data
5. User selects platform (MT4/MT5/Deriv), edits if needed, agrees to T&Cs, submits

### Implementation:
- **New Edge Function**: `ocr-credentials` — receives image, uses a lightweight approach (regex pattern matching on base64 image sent to an AI vision API, or manual approach with instructions to user)
- **Update `ConnectAccountModal.tsx`**: Add a third tab/option "Upload Screenshot" with file upload, preview, and pre-populated form
- **Privacy note**: Show disclaimer that screenshot is processed securely and not stored

Given the complexity of reliable OCR without a dedicated API key, the pragmatic approach is: accept the image upload, display it to the user, and provide a structured form where the user manually enters data from the screenshot — with the screenshot visible alongside the form for reference. This avoids needing an additional AI/OCR API key.

---

## Database Changes (Migration)

```sql
-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to update all profiles  
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Allow admins to view all trading accounts
CREATE POLICY "Admins can view all trading accounts"
ON public.trading_accounts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Update handle_new_user to store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
```

Note: Since we can't add an `email` column to profiles without a migration, and display_name already contains the email prefix, we'll use a different approach — create a small admin edge function to list users with emails.

Actually, simpler: create an `admin-list-users` Edge Function that queries `auth.users` via the service role key and returns user IDs + emails. The admin panel calls this instead of relying on `user_roles`.

---

## Files to Create
- `supabase/functions/admin-list-users/index.ts` — returns auth.users list for admin use

## Files to Modify
- `supabase/functions/metaapi-execute-trade/index.ts` — dynamic region resolution
- `src/components/admin/UserManagementTab.tsx` — use admin-list-users, add Free plan, fix email display
- `src/components/ConnectAccountModal.tsx` — add screenshot upload option
- Database migration for admin RLS policies on profiles and trading_accounts

## Deferred (Add-On Features)
The following are noted for a follow-up iteration:
- Weekly Performance PDF
- Trade Replay Mode
- Strategy Simulator
- Mentor Review / Voice Notes
- Social Trading Leaderboard
- Strategy Library (AI-generated)
- Interactive Quizzes (AI-generated)
- Book Summaries (AI-generated)
- Trading Plan Template (AI-generated)
- Strategy Lab (Paper Trading)

