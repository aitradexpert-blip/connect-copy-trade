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
 * Get the Deriv OAuth login URL
 * Redirects user to Deriv login, then back to our callback URL
 */
export function getDerivLoginUrl(callbackUrl?: string): string {
  const callback = callbackUrl || `${window.location.origin}/deriv-callback`;
  return `${DERIV_OAUTH_URL}?app_id=${DERIV_APP_ID}&l=en&brand=deriv`;
}

/**
 * Parse tokens from Deriv OAuth redirect URL
 * Deriv returns: ?acct1=XXX&token1=YYY&cur1=USD&acct2=...
 * Also supports hash parameters: #acct1=XXX&token1=YYY
 */
export function parseDerivRedirectTokens(search: string, hash: string = ''): DerivAccount[] {
  const accounts: DerivAccount[] = [];
  
  // Parse BOTH query params and hash params
  const queryParams = new URLSearchParams(search || '');
  const hashParams = new URLSearchParams((hash || '').replace(/^#/, ''));
  
  // Support up to 10 accounts from Deriv OAuth response
  for (let i = 1; i <= 10; i++) {
    // Check query first, then hash
    const account = queryParams.get(`acct${i}`) || hashParams.get(`acct${i}`);
    const token = queryParams.get(`token${i}`) || hashParams.get(`token${i}`);
    const currency = queryParams.get(`cur${i}`) || hashParams.get(`cur${i}`) || queryParams.get(`currency${i}`) || hashParams.get(`currency${i}`);
    
    if (account && token) {
      accounts.push({
        account: decodeURIComponent(account),
        token: decodeURIComponent(token),
        currency: currency ? decodeURIComponent(currency) : undefined,
      });
    }
  }
  
  // Also support single-token formats like ?token= or #access_token=
  const singleToken = queryParams.get('token') || hashParams.get('token') || hashParams.get('access_token');
  const singleAccount = queryParams.get('acct') || hashParams.get('acct');
  const singleCur = queryParams.get('cur') || hashParams.get('cur');
  
  if (singleToken && singleAccount && !accounts.some(a => a.account === singleAccount)) {
    accounts.push({
      account: decodeURIComponent(singleAccount),
      token: decodeURIComponent(singleToken),
      currency: singleCur ? decodeURIComponent(singleCur) : undefined,
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
