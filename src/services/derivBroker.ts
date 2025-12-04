// Deriv Broker Service
// Handles broker operations: authorize, balance, cashier, transfers

import { getSharedDerivWS, DerivWS } from './derivWebSocket';

export interface AuthorizeResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      currency: string;
      is_disabled: number;
      is_virtual: number;
      landing_company_name: string;
      loginid: string;
    }>;
    balance: number;
    country: string;
    currency: string;
    email: string;
    fullname: string;
    is_virtual: number;
    landing_company_fullname: string;
    landing_company_name: string;
    local_currencies: Record<string, { fractional_digits: number }>;
    loginid: string;
    preferred_language: string;
    scopes: string[];
    upgradeable_landing_companies: string[];
    user_id: number;
  };
}

export interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    id: string;
    loginid: string;
  };
}

export interface CashierResponse {
  cashier?: string; // URL for deposit/withdraw
  error?: {
    code: string;
    message: string;
  };
}

export interface TransferResponse {
  transfer_between_accounts?: {
    accounts: Array<{
      account_type: string;
      balance: string;
      currency: string;
      demo_account: number;
      loginid: string;
      mt5_group?: string;
      status: number;
    }>;
    client_to_full_name: string;
    client_to_loginid: string;
    transaction_id: number;
  };
}

/**
 * Authorize a Deriv account using API token
 * Must be called before any account-specific operations
 */
export async function authorizeDerivAccount(
  token: string,
  ws?: DerivWS
): Promise<AuthorizeResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ authorize: token });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as AuthorizeResponse;
  } catch (error) {
    console.error('[DerivBroker] Authorization failed:', error);
    throw error;
  }
}

/**
 * Get account balance
 */
export async function getDerivBalance(ws?: DerivWS): Promise<BalanceResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ balance: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as BalanceResponse;
  } catch (error) {
    console.error('[DerivBroker] Get balance failed:', error);
    throw error;
  }
}

/**
 * Subscribe to balance updates
 */
export function subscribeDerivBalance(
  onBalance: (balance: number, currency: string) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  
  const subscription = client.subscribe(
    { balance: 1, subscribe: 1 },
    (message) => {
      if (message.msg_type === 'balance' && message.balance) {
        onBalance(message.balance.balance, message.balance.currency);
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}

/**
 * Get cashier info for deposit or withdraw
 * Returns URL to open in iframe/modal or external browser
 */
export async function getDerivCashierInfo(
  type: 'deposit' | 'withdraw',
  ws?: DerivWS
): Promise<CashierResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ cashier: type });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as CashierResponse;
  } catch (error) {
    console.error(`[DerivBroker] Get ${type} info failed:`, error);
    throw error;
  }
}

/**
 * Get list of accounts available for transfer
 */
export async function getTransferableAccounts(ws?: DerivWS): Promise<TransferResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    // Calling with empty params returns list of available accounts
    const response = await client.send({ transfer_between_accounts: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as TransferResponse;
  } catch (error) {
    console.error('[DerivBroker] Get transferable accounts failed:', error);
    throw error;
  }
}

/**
 * Transfer funds between Deriv accounts
 * account_from must match the currently authorized account
 */
export async function transferBetweenDerivAccounts(
  params: {
    account_from: string;
    account_to: string;
    amount: number;
    currency: string;
  },
  ws?: DerivWS
): Promise<TransferResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      transfer_between_accounts: 1,
      ...params
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as TransferResponse;
  } catch (error) {
    console.error('[DerivBroker] Transfer failed:', error);
    throw error;
  }
}

/**
 * Get account settings
 */
export async function getDerivAccountSettings(ws?: DerivWS): Promise<any> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ get_settings: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.get_settings;
  } catch (error) {
    console.error('[DerivBroker] Get settings failed:', error);
    throw error;
  }
}

/**
 * Get portfolio (open positions)
 */
export async function getDerivPortfolio(ws?: DerivWS): Promise<any> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ portfolio: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.portfolio;
  } catch (error) {
    console.error('[DerivBroker] Get portfolio failed:', error);
    throw error;
  }
}

/**
 * Get profit table (trade history)
 */
export async function getDerivProfitTable(
  params: {
    date_from?: number;
    date_to?: number;
    limit?: number;
    offset?: number;
    sort?: 'ASC' | 'DESC';
  } = {},
  ws?: DerivWS
): Promise<any> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      profit_table: 1,
      description: 1,
      ...params
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.profit_table;
  } catch (error) {
    console.error('[DerivBroker] Get profit table failed:', error);
    throw error;
  }
}

/**
 * Get statement (transaction history)
 */
export async function getDerivStatement(
  params: {
    date_from?: number;
    date_to?: number;
    limit?: number;
    offset?: number;
    action_type?: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'transfer';
  } = {},
  ws?: DerivWS
): Promise<any> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      statement: 1,
      description: 1,
      ...params
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.statement;
  } catch (error) {
    console.error('[DerivBroker] Get statement failed:', error);
    throw error;
  }
}
