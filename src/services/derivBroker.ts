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

/**
 * MT5 Account Types
 */
export interface MT5Account {
  account_type: string;
  balance: number;
  currency: string;
  display_balance: string;
  email: string;
  group: string;
  landing_company_short: string;
  leverage: number;
  login: string;
  market_type: string;
  name: string;
  server: string;
  server_info: {
    environment: string;
    geolocation: {
      group: string;
      location: string;
      region: string;
      sequence: number;
    };
    id: string;
  };
  sub_account_type: string;
}

export interface MT5AccountsListResponse {
  mt5_login_list: MT5Account[];
}

/**
 * Get list of MT5 accounts linked to the Deriv account
 * Must be authorized first
 */
export async function getMT5AccountList(ws?: DerivWS): Promise<MT5AccountsListResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ mt5_login_list: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return {
      mt5_login_list: response.mt5_login_list || []
    };
  } catch (error) {
    console.error('[DerivBroker] Get MT5 accounts failed:', error);
    throw error;
  }
}

/**
 * Get MT5 account details
 */
export async function getMT5AccountDetails(
  login: string,
  ws?: DerivWS
): Promise<MT5Account> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ 
      mt5_get_settings: 1,
      login 
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.mt5_get_settings;
  } catch (error) {
    console.error('[DerivBroker] Get MT5 account details failed:', error);
    throw error;
  }
}

// ============ MT5 Deposit/Withdrawal ============

export interface MT5DepositResponse {
  mt5_deposit: number; // 1 on success
  binary_transaction_id: number;
}

export interface MT5WithdrawalResponse {
  mt5_withdrawal: number; // 1 on success
  binary_transaction_id: number;
}

/**
 * Deposit funds from Binary account to MT5 account
 * Auth Required: payments scope
 * @param amount - Amount to deposit (min $1, max $20000 equivalent)
 * @param from_binary - Binary account loginid (e.g., CR1234567)
 * @param to_mt5 - MT5 account login (e.g., MTR12345678)
 */
export async function mt5Deposit(
  params: {
    amount: number;
    from_binary: string;
    to_mt5: string;
  },
  ws?: DerivWS
): Promise<MT5DepositResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      mt5_deposit: 1,
      amount: params.amount,
      from_binary: params.from_binary,
      to_mt5: params.to_mt5,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as MT5DepositResponse;
  } catch (error) {
    console.error('[DerivBroker] MT5 deposit failed:', error);
    throw error;
  }
}

/**
 * Withdraw funds from MT5 account to Binary account
 * Auth Required: payments scope
 * @param amount - Amount to withdraw (min $1, max $20000 equivalent)
 * @param from_mt5 - MT5 account login (e.g., MTR12345678)
 * @param to_binary - Binary account loginid (e.g., CR1234567)
 */
export async function mt5Withdrawal(
  params: {
    amount: number;
    from_mt5: string;
    to_binary: string;
  },
  ws?: DerivWS
): Promise<MT5WithdrawalResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      mt5_withdrawal: 1,
      amount: params.amount,
      from_mt5: params.from_mt5,
      to_binary: params.to_binary,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as MT5WithdrawalResponse;
  } catch (error) {
    console.error('[DerivBroker] MT5 withdrawal failed:', error);
    throw error;
  }
}

// ============ API Token Management ============

export interface ApiToken {
  display_name: string;
  last_used: string;
  scopes: string[];
  token: string;
  valid_for_ip: string;
}

export interface ApiTokenResponse {
  api_token: {
    delete_token?: number; // 1 on delete success
    new_token?: number; // 1 on create success
    tokens?: ApiToken[];
  };
}

export type ApiTokenScope = 
  | 'read' 
  | 'trade' 
  | 'payments' 
  | 'trading_information' 
  | 'admin';

/**
 * Get list of API tokens
 * Auth Required: admin scope
 */
export async function getApiTokens(ws?: DerivWS): Promise<ApiToken[]> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ api_token: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.api_token?.tokens || [];
  } catch (error) {
    console.error('[DerivBroker] Get API tokens failed:', error);
    throw error;
  }
}

/**
 * Create a new API token
 * Auth Required: admin scope
 * @param name - Display name for the token
 * @param scopes - Permission scopes (read, trade, payments, trading_information, admin)
 * @param validForCurrentIpOnly - If true, token only works for current IP
 */
export async function createApiToken(
  params: {
    name: string;
    scopes: ApiTokenScope[];
    validForCurrentIpOnly?: boolean;
  },
  ws?: DerivWS
): Promise<ApiTokenResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      api_token: 1,
      new_token: params.name,
      new_token_scopes: params.scopes,
      valid_for_current_ip_only: params.validForCurrentIpOnly ? 1 : 0,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as ApiTokenResponse;
  } catch (error) {
    console.error('[DerivBroker] Create API token failed:', error);
    throw error;
  }
}

/**
 * Delete an API token
 * Auth Required: admin scope
 * @param token - The token string to delete
 */
export async function deleteApiToken(
  token: string,
  ws?: DerivWS
): Promise<ApiTokenResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      api_token: 1,
      delete_token: token,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as ApiTokenResponse;
  } catch (error) {
    console.error('[DerivBroker] Delete API token failed:', error);
    throw error;
  }
}

// ============ Account Settings ============

export interface AccountSettingsParams {
  allow_copiers?: 0 | 1;
  email_consent?: 0 | 1;
  preferred_language?: string;
  request_professional_status?: 1;
  // Add more as needed from API docs
}

/**
 * Update account settings
 * Auth Required: admin scope
 * Use this to enable copy trading by setting allow_copiers: 1
 */
export async function setAccountSettings(
  params: AccountSettingsParams,
  ws?: DerivWS
): Promise<any> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      set_settings: 1,
      ...params,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.set_settings;
  } catch (error) {
    console.error('[DerivBroker] Set account settings failed:', error);
    throw error;
  }
}

// ============ Copy Trading ============

/**
 * Start copying a trader
 * Auth Required: trade scope
 * @param traderToken - API token of the trader to copy (15-32 chars)
 * @param assets - Optional: specific assets to copy (e.g., ["frxUSDJPY", "R_50"])
 * @param maxTradeStake - Optional: maximum stake per copied trade
 * @param minTradeStake - Optional: minimum stake per copied trade
 * @param tradeTypes - Optional: specific trade types (e.g., ["CALL", "PUT"])
 */
export async function startCopyTrading(
  params: {
    traderToken: string;
    assets?: string[];
    maxTradeStake?: number;
    minTradeStake?: number;
    tradeTypes?: string[];
  },
  ws?: DerivWS
): Promise<{ copy_start: number }> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      copy_start: params.traderToken,
      ...(params.assets && { assets: params.assets }),
      ...(params.maxTradeStake && { max_trade_stake: params.maxTradeStake }),
      ...(params.minTradeStake && { min_trade_stake: params.minTradeStake }),
      ...(params.tradeTypes && { trade_types: params.tradeTypes }),
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return { copy_start: response.copy_start };
  } catch (error) {
    console.error('[DerivBroker] Start copy trading failed:', error);
    throw error;
  }
}

/**
 * Stop copying a trader
 * Auth Required: trade scope
 * @param traderToken - API token of the trader to stop copying
 */
export async function stopCopyTrading(
  traderToken: string,
  ws?: DerivWS
): Promise<{ copy_stop: number }> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      copy_stop: traderToken,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return { copy_stop: response.copy_stop };
  } catch (error) {
    console.error('[DerivBroker] Stop copy trading failed:', error);
    throw error;
  }
}

/**
 * Get copy trading list (copiers and traders)
 * Auth Required: admin scope
 */
export async function getCopyTradingList(ws?: DerivWS): Promise<{
  copiers?: Array<{ loginid: string }>;
  traders?: Array<{ 
    assets: string[];
    loginid: string;
    max_trade_stake: number | null;
    min_trade_stake: number | null;
    token: string;
    trade_types: string[];
  }>;
}> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({ copytrading_list: 1 });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response.copytrading_list || { copiers: [], traders: [] };
  } catch (error) {
    console.error('[DerivBroker] Get copy trading list failed:', error);
    throw error;
  }
}
