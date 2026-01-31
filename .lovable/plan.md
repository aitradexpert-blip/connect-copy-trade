
# Automated MetaAPI Account Provisioning & Admin Fixes

## Overview
This plan implements fully automated MetaAPI account provisioning when users add MT4/MT5 accounts, fixes the admin subscription approval error, and adds password visibility toggle to the Connect Account modal.

---

## Part 1: Fix Admin Subscription Unique Constraint Error

### Problem
The error `duplicate key value violates unique constraint "user_subscriptions_user_id_key"` occurs because the `upsert` operation isn't specifying the correct conflict target.

### Solution
Update `UserManagementTab.tsx` to use proper `upsert` with `onConflict`:

**File: `src/components/admin/UserManagementTab.tsx`**
- Line 161-169: Change `upsert` to specify `onConflict: 'user_id'`
- Line 218-226: Same fix for `updateSubscription` function

```typescript
// Change this:
const { error: subError } = await supabase
  .from('user_subscriptions')
  .upsert({
    user_id: selectedUser.id,
    // ...
  });

// To this:
const { error: subError } = await supabase
  .from('user_subscriptions')
  .upsert({
    user_id: selectedUser.id,
    // ...
  }, {
    onConflict: 'user_id'
  });
```

---

## Part 2: Create MetaAPI Provisioning Edge Function

### New Edge Function: `metaapi-provision-account`
This function will call MetaAPI's Provisioning API to create account connections automatically.

**File: `supabase/functions/metaapi-provision-account/index.ts`**

```typescript
// Purpose: Automatically provision MT4/MT5 accounts via MetaAPI
// Called when user submits account credentials

const PROVISIONING_API_URL = 'https://mt-provisioning-api-v1.agiliumtrade.ai';

Deno.serve(async (req) => {
  // Input: { login, password, server, platform, name }
  // 1. Call POST /users/current/accounts on MetaAPI
  // 2. Return { metaapi_account_id, state, error }
  // 3. Handle specific errors (E_AUTH, E_SERVER_TIMEZONE, etc.)
});
```

**Key Features:**
- Calls MetaAPI Provisioning API with user's broker credentials
- Returns the `metaapi_account_id` on success
- Handles specific MetaAPI errors with user-friendly messages
- Uses METAAPI_TOKEN from secrets

---

## Part 3: Update Connect Account Modal

### Changes to `src/components/ConnectAccountModal.tsx`

#### 3.1 Add Password Field with Eye Toggle
- Add `password` to form state
- Add password input with visibility toggle
- Import `Eye`, `EyeOff` from lucide-react

#### 3.2 Call MetaAPI Provisioning on Submit
Instead of just saving credentials with `pending_approval`, call the new edge function:

```typescript
// New flow:
const handleMetaApiSubmit = async (e: React.FormEvent) => {
  // 1. Call metaapi-provision-account edge function
  const { data, error } = await supabase.functions.invoke('metaapi-provision-account', {
    body: {
      login: formData.login,
      password: formData.password,
      server: formData.server,
      platform: formData.platform,
      name: formData.name
    }
  });

  if (error || data?.error) {
    // Show user-friendly error
    toast({ title: 'Connection Failed', description: data?.error || error.message });
    return;
  }

  // 2. Save to database with metaapi_account_id
  await supabase.from('trading_accounts').insert({
    user_id: user.id,
    provider: 'metaapi',
    metaapi_account_id: data.metaapi_account_id, // Auto-populated!
    connection_type: 'metaapi',
    connection_status: data.state === 'DEPLOYED' ? 'connected' : 'provisioning',
    // ...
  });
};
```

#### 3.3 Form State Updates
```typescript
const [formData, setFormData] = useState({
  name: "",
  login: "",
  password: "",  // NEW
  server: "",
  platform: "",
});
const [showPassword, setShowPassword] = useState(false);  // NEW
```

---

## Part 4: Update Admin Panel for New Flow

### Changes to `src/components/admin/UserManagementTab.tsx`

#### 4.1 Remove MetaAPI ID Manual Entry
- Remove the MetaAPI Account ID input field (no longer needed)
- Admin now only manages subscriptions

#### 4.2 Show Account Connection Status
- Display connection status clearly: `connected`, `provisioning`, `failed`
- Show MetaAPI error message if account failed to provision

#### 4.3 Allow Re-provisioning Failed Accounts
- Add "Retry Connection" button for failed accounts
- Calls the edge function again with stored credentials

---

## Part 5: Fix MetaAPI Service URL Typo

### File: `src/services/metaapi.ts`
**Line 3:** Fix typo in provisioning URL

```typescript
// Change:
const PROVISIONING_API_URL = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";

// To:
const PROVISIONING_API_URL = "https://mt-provisioning-api-v1.agiliumtrade.ai";
```

---

## Implementation Files

| File | Action | Description |
|------|--------|-------------|
| `supabase/functions/metaapi-provision-account/index.ts` | CREATE | New edge function for account provisioning |
| `supabase/config.toml` | UPDATE | Add new function entry |
| `src/components/ConnectAccountModal.tsx` | UPDATE | Add password field, auto-provision on submit |
| `src/components/admin/UserManagementTab.tsx` | UPDATE | Fix upsert, remove manual MetaAPI ID entry |
| `src/services/metaapi.ts` | UPDATE | Fix provisioning URL typo |

---

## New User Flow (Automated)

```text
User clicks "Add MT4/MT5 Account"
    │
    ▼
User enters: Name, Login, Password, Server, Platform
    │
    ▼
HuMi calls metaapi-provision-account edge function
    │
    ├── SUCCESS: MetaAPI returns account ID
    │   │
    │   ▼
    │   Save to DB with metaapi_account_id
    │   connection_status = 'connected' or 'provisioning'
    │   │
    │   ▼
    │   User sees account in list immediately
    │
    └── FAILURE: MetaAPI returns error
        │
        ▼
        Show user-friendly error:
        - "Invalid credentials" (E_AUTH)
        - "Broker server not reachable" (E_SERVER_TIMEZONE)
        - "Please enable 2FA in MT terminal" (ERR_OTP_REQUIRED)
        │
        ▼
        Account NOT saved (or saved as 'failed')
```

---

## Admin Flow (Simplified)

```text
Admin opens User Management
    │
    ▼
Sees accounts with status:
- connected (green) - Working account
- provisioning (yellow) - MetaAPI is syncing
- failed (red) - Provisioning failed, shows error
    │
    ▼
Admin can:
1. Approve/modify subscription tier
2. Retry failed account connections
3. View MetaAPI error details
```

---

## MetaAPI Error Handling

| Error Code | User Message | Action |
|------------|--------------|--------|
| `E_AUTH` | "Invalid login credentials. Please check with your broker." | Don't save account |
| `E_SERVER_TIMEZONE` | "Broker server not reachable. Please verify server name." | Don't save account |
| `ERR_OTP_REQUIRED` | "Please disable 2FA in your MT terminal to connect." | Don't save account |
| `E_NO_SYMBOLS` | "No trading symbols enabled. Contact your broker." | Save but mark as 'failed' |
| `E_PASSWORD_CHANGE_REQUIRED` | "Please change your password in MT terminal first." | Don't save account |

---

## Technical Details

### MetaAPI Provisioning API Call
```typescript
const response = await fetch(`${PROVISIONING_API_URL}/users/current/accounts`, {
  method: 'POST',
  headers: {
    'auth-token': METAAPI_TOKEN,
    'transaction-id': generateTransactionId(),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: `HuMi-${login}`,
    type: 'cloud',
    login: login,
    password: password,
    server: server,
    platform: platform, // 'mt4' or 'mt5'
    magic: 0,
    application: 'MetaApi',
    connectionStatus: 'connected'
  })
});
```

### Response Handling
```typescript
if (response.ok) {
  const { _id: metaapi_account_id, state } = await response.json();
  return { success: true, metaapi_account_id, state };
} else {
  const error = await response.json();
  return { success: false, error: error.message, code: error.id };
}
```

---

## Security Considerations

1. **Password Handling**: User passwords are sent to edge function, used to call MetaAPI, then discarded (not stored in our DB)
2. **MetaAPI Token**: Stored securely in Supabase secrets
3. **RLS**: Account data protected by user_id policies

---

## Testing Checklist

1. [ ] Add new MT4/MT5 account → Should auto-provision via MetaAPI
2. [ ] Invalid credentials → Should show clear error message
3. [ ] Admin approve subscription → Should work without unique constraint error
4. [ ] Refresh account balance → Should fetch from MetaAPI correctly
5. [ ] Password visibility toggle → Eye icon should show/hide password
