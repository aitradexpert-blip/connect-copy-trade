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
 */
export function parseDerivRedirectTokens(search: string): DerivAccount[] {
  const params = new URLSearchParams(search);
  const accounts: DerivAccount[] = [];
  
  // Deriv can return up to 10 accounts
  for (let i = 1; i <= 10; i++) {
    const account = params.get(`acct${i}`);
    const token = params.get(`token${i}`);
    const currency = params.get(`cur${i}`) || params.get(`currency${i}`);
    
    if (account && token) {
      accounts.push({
        account,
        token,
        currency: currency || undefined
      });
    }
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
