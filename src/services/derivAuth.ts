// Deriv OAuth Authentication Service
// Handles OAuth flow and token management for Deriv accounts

const DERIV_APP_ID = '90127';
const DERIV_OAUTH_URL = 'https://oauth.deriv.com/oauth2/authorize';

export interface DerivAccount {
  account: string;      // e.g., "CRW1157" or "VRTC1234"
  token: string;        // API token for this account
  currency?: string;    // e.g., "USD", "BTC"
}

/**
 * Safe decode helper - URLSearchParams.get() already returns decoded values
 * but some providers may double-encode, so we guard against that
 */
function safeDecode(v: string | null): string | undefined {
  if (!v) return undefined;
  try {
    // Check if it looks double-encoded (contains %25 which is encoded %)
    if (v.includes('%25') || v.includes('%2')) {
      return decodeURIComponent(v);
    }
    return v;
  } catch {
    return v;
  }
}

/**
 * Get the Deriv OAuth login URL
 * Redirects user to Deriv login, then back to our callback URL
 */
export function getDerivLoginUrl(callbackUrl?: string): string {
  const callback = callbackUrl || `${window.location.origin}/deriv-callback`;
  
  // Log for debugging - helps users verify correct redirect URL is registered
  console.log('[DerivAuth] OAuth callback URL:', callback);
  console.log('[DerivAuth] Ensure this URL is registered at https://app.deriv.com/account/api-token for app_id:', DERIV_APP_ID);
  
  // Note: Deriv OAuth doesn't use redirect_uri param - it uses the registered URL in app settings
  return `${DERIV_OAUTH_URL}?app_id=${DERIV_APP_ID}&l=en&brand=deriv`;
}

/**
 * Parse tokens from Deriv OAuth redirect URL
 * Deriv returns: ?acct1=XXX&token1=YYY&cur1=USD&acct2=...
 * Also supports hash parameters: #acct1=XXX&token1=YYY
 * Handles parameter name variations (acct/account, cur/currency, access_token)
 */
export function parseDerivRedirectTokens(search: string, hash: string = ''): DerivAccount[] {
  const accounts: DerivAccount[] = [];
  
  // Parse BOTH query params and hash params
  const queryParams = new URLSearchParams(search || '');
  const hashParams = new URLSearchParams((hash || '').replace(/^#/, ''));
  
  // Helper to get from both sources with alternate names
  const getParam = (qp: URLSearchParams, hp: URLSearchParams, ...keys: string[]): string | undefined => {
    for (const key of keys) {
      const val = qp.get(key) || hp.get(key);
      if (val) return safeDecode(val);
    }
    return undefined;
  };
  
  // Support up to 10 accounts from Deriv OAuth response
  for (let i = 1; i <= 10; i++) {
    // Try multiple param name variations
    const account = getParam(queryParams, hashParams, `acct${i}`, `account${i}`);
    const token = getParam(queryParams, hashParams, `token${i}`, `access_token${i}`);
    const currency = getParam(queryParams, hashParams, `cur${i}`, `currency${i}`);
    
    if (account && token) {
      accounts.push({
        account,
        token,
        currency,
      });
    }
  }
  
  // Also support single-token formats like ?token= or #access_token=
  const singleToken = getParam(queryParams, hashParams, 'token', 'access_token');
  const singleAccount = getParam(queryParams, hashParams, 'acct', 'account');
  const singleCur = getParam(queryParams, hashParams, 'cur', 'currency');
  
  if (singleToken && singleAccount && !accounts.some(a => a.account === singleAccount)) {
    accounts.push({
      account: singleAccount,
      token: singleToken,
      currency: singleCur,
    });
  }
  
  return accounts;
}

/**
 * Check if an account is a virtual/demo account
 * Deriv virtual accounts start with "VRTC" or similar patterns
 */
export function isVirtualAccount(accountId: string): boolean {
  return accountId.toUpperCase().startsWith('VRT') || 
         accountId.toUpperCase().startsWith('VRTC') ||
         accountId.toUpperCase().includes('DEMO');
}

/**
 * Get account type label
 */
export function getAccountTypeLabel(accountId: string): string {
  if (isVirtualAccount(accountId)) {
    return 'Demo';
  }
  
  // Real account prefixes
  if (accountId.startsWith('CR')) return 'Real (Crypto)';
  if (accountId.startsWith('MF')) return 'Real (Financial)';
  if (accountId.startsWith('MLT')) return 'Real (Gaming)';
  if (accountId.startsWith('MX')) return 'Real (Multipliers)';
  
  return 'Real';
}

/**
 * Store Deriv accounts temporarily during OAuth flow
 */
export function storeDerivAccounts(accounts: DerivAccount[]): void {
  sessionStorage.setItem('deriv_pending_accounts', JSON.stringify(accounts));
}

/**
 * Retrieve stored Deriv accounts
 */
export function getStoredDerivAccounts(): DerivAccount[] | null {
  const stored = sessionStorage.getItem('deriv_pending_accounts');
  if (!stored) return null;
  
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Clear stored Deriv accounts
 */
export function clearStoredDerivAccounts(): void {
  sessionStorage.removeItem('deriv_pending_accounts');
}

/**
 * Validate a Deriv API token by connecting to WebSocket and authorizing
 * Returns account info if valid, error message if invalid
 */
export async function validateDerivToken(token: string): Promise<{
  valid: boolean;
  accountInfo?: {
    loginid: string;
    currency: string;
    balance: number;
    is_virtual: boolean;
    account_list?: Array<{
      loginid: string;
      currency: string;
      is_virtual: number;
    }>;
  };
  error?: string;
}> {
  return new Promise((resolve) => {
    const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=90127');
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ valid: false, error: 'Connection timeout' });
    }, 10000);

    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };

    ws.onmessage = (event) => {
      clearTimeout(timeout);
      try {
        const data = JSON.parse(event.data);
        if (data.authorize) {
          ws.close();
          resolve({
            valid: true,
            accountInfo: {
              loginid: data.authorize.loginid,
              currency: data.authorize.currency,
              balance: data.authorize.balance,
              is_virtual: data.authorize.is_virtual === 1,
              account_list: data.authorize.account_list,
            },
          });
        } else if (data.error) {
          ws.close();
          resolve({ valid: false, error: data.error.message });
        }
      } catch (err) {
        ws.close();
        resolve({ valid: false, error: 'Invalid response' });
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      ws.close();
      resolve({ valid: false, error: 'Connection failed' });
    };
  });
}
