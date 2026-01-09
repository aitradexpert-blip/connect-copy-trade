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
 * 
 * CRITICAL: The redirect URL MUST be registered in Deriv App Dashboard
 * Go to: https://api.deriv.com/dashboard → Applications → Edit your app
 * Set "Redirect URL" to your callback URL
 */
export function getDerivLoginUrl(callbackUrl?: string): string {
  const callback = callbackUrl || `${window.location.origin}/deriv-callback`;
  
  // Store callback URL for reference on callback page
  sessionStorage.setItem('deriv_expected_callback', callback);
  
  // Critical: Log exact URL that MUST be registered in Deriv Dashboard
  console.log("=".repeat(70));
  console.log("[DerivAuth] ⚠️ CRITICAL: OAUTH REDIRECT URL CONFIGURATION");
  console.log("[DerivAuth] ");
  console.log("[DerivAuth] This EXACT URL must be registered in Deriv App Dashboard:");
  console.log("[DerivAuth] ➡️ ", callback);
  console.log("[DerivAuth] ");
  console.log("[DerivAuth] If OAuth redirects back to login (infinite loop), the URL is NOT registered.");
  console.log("[DerivAuth] ");
  console.log("[DerivAuth] Steps to fix:");
  console.log("[DerivAuth] 1. Go to: https://api.deriv.com/dashboard");
  console.log("[DerivAuth] 2. Click 'Applications' tab");
  console.log("[DerivAuth] 3. Find your app (ID: " + DERIV_APP_ID + ") and click edit (pencil icon)");
  console.log("[DerivAuth] 4. In 'Redirect URL' field, paste: " + callback);
  console.log("[DerivAuth] 5. Save and try OAuth again");
  console.log("=".repeat(70));
  
  // Note: Deriv OAuth uses the registered Redirect URL from app settings, not a URL param
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
  const upper = accountId.toUpperCase();
  return upper.startsWith('VRT') || 
         upper.startsWith('VRTC') ||
         upper.startsWith('VRW') ||
         upper.includes('DEMO');
}

/**
 * Check if an account is a wallet account (cannot trade via API)
 * Wallet accounts: CRW (real wallet), VRW (virtual wallet)
 */
export function isWalletAccount(accountId: string): boolean {
  const upper = accountId.toUpperCase();
  return upper.startsWith('CRW') || upper.startsWith('VRW');
}

/**
 * Check if an account can trade via API
 * Only CR (real trading) and VRTC (virtual trading) can trade
 */
export function canTradeViaAPI(accountId: string): boolean {
  return !isWalletAccount(accountId);
}

/**
 * Get account type label
 */
export function getAccountTypeLabel(accountId: string): string {
  const upper = accountId.toUpperCase();
  
  if (upper.startsWith('VRW')) return 'Virtual Wallet';
  if (upper.startsWith('VRTC')) return 'Virtual Trading';
  if (upper.startsWith('CRW')) return 'Wallet';
  if (upper.startsWith('CR')) return 'Trading';
  if (upper.startsWith('MF')) return 'Financial';
  if (upper.startsWith('MLT')) return 'Gaming';
  if (upper.startsWith('MX')) return 'Multipliers';
  
  if (isVirtualAccount(accountId)) return 'Demo';
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
