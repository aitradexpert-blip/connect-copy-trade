/**
 * Unified Broker Execution Service
 * Routes trade execution to the appropriate API based on account provider
 * Supports: Deriv, MetaAPI, and future broker integrations
 */

import { supabase } from '@/integrations/supabase/client';

// ============ Interfaces ============

export interface TradingAccount {
  id: string;
  provider: string;
  metaapi_account_id: string | null;
  deriv_token: string | null;
  deriv_currency: string | null;
  is_virtual: boolean | null;
  name: string;
  login: string;
}

export interface TradeSignal {
  symbol: string;
  direction: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  comment?: string;
}

export interface ExecuteTradeResult {
  success: boolean;
  tradeId?: string | number;
  buyPrice?: number;
  payout?: number;
  error?: string;
  provider: string;
}

// ============ Symbol Mapping ============

const DERIV_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'frxEURUSD',
  'GBP/USD': 'frxGBPUSD',
  'USD/JPY': 'frxUSDJPY',
  'AUD/USD': 'frxAUDUSD',
  'USD/CHF': 'frxUSDCHF',
  'NZD/USD': 'frxNZDUSD',
  'USD/CAD': 'frxUSDCAD',
  'GBP/JPY': 'frxGBPJPY',
  'EUR/GBP': 'frxEURGBP',
  'EUR/JPY': 'frxEURJPY',
  'XAU/USD': 'frxXAUUSD',
  'BTC/USD': 'cryBTCUSD',
  'ETH/USD': 'cryETHUSD',
  'EURUSD': 'frxEURUSD',
  'GBPUSD': 'frxGBPUSD',
  'USDJPY': 'frxUSDJPY',
  'AUDUSD': 'frxAUDUSD',
  'USDCHF': 'frxUSDCHF',
  'NZDUSD': 'frxNZDUSD',
  'USDCAD': 'frxUSDCAD',
  'GBPJPY': 'frxGBPJPY',
  'EURGBP': 'frxEURGBP',
  'EURJPY': 'frxEURJPY',
  'XAUUSD': 'frxXAUUSD',
  'BTCUSD': 'cryBTCUSD',
  'ETHUSD': 'cryETHUSD',
};

function getDerivSymbol(symbol: string): string {
  // Check direct mapping first
  if (DERIV_SYMBOL_MAP[symbol]) {
    return DERIV_SYMBOL_MAP[symbol];
  }
  
  // Check if already in Deriv format
  if (symbol.startsWith('frx') || symbol.startsWith('cry') || symbol.startsWith('R_') || symbol.startsWith('1HZ')) {
    return symbol;
  }
  
  // Try uppercase version
  const upperSymbol = symbol.toUpperCase().replace('/', '');
  if (DERIV_SYMBOL_MAP[upperSymbol]) {
    return DERIV_SYMBOL_MAP[upperSymbol];
  }
  
  return symbol;
}

// ============ Main Execution Function ============

/**
 * Execute a trade on the specified account
 * Automatically routes to the correct broker API
 */
export async function executeOnAccount(
  account: TradingAccount,
  signal: TradeSignal
): Promise<ExecuteTradeResult> {
  console.log(`[BrokerExecution] Executing trade on ${account.provider} account:`, account.name);
  console.log(`[BrokerExecution] Signal:`, signal);
  
  // Route based on provider
  switch (account.provider) {
    case 'deriv':
      return executeDerivTrade(account, signal);
    
    case 'metaapi':
    case 'mt4':
    case 'mt5':
      return executeMetaApiTrade(account, signal);
    
    default:
      // Future brokers (FxPro, Exness, etc.) - log and return error
      console.warn(`[BrokerExecution] Unsupported broker: ${account.provider}`);
      return { 
        success: false, 
        error: `Broker "${account.provider}" is not yet supported for trade execution. Please use Deriv or MetaAPI-connected accounts.`,
        provider: account.provider
      };
  }
}

// ============ Deriv Execution ============

async function executeDerivTrade(
  account: TradingAccount,
  signal: TradeSignal
): Promise<ExecuteTradeResult> {
  if (!account.deriv_token) {
    return { 
      success: false, 
      error: 'No Deriv API token available for this account', 
      provider: 'deriv' 
    };
  }
  
  try {
    // Use the edge function for server-side execution
    const { data, error } = await supabase.functions.invoke('deriv-execute-signal', {
      body: {
        deriv_token: account.deriv_token,
        deriv_currency: account.deriv_currency || 'USD',
        is_virtual: account.is_virtual || false,
        signal: {
          symbol: signal.symbol,
          direction: signal.direction,
          lot_size: signal.volume,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          comment: signal.comment,
        }
      }
    });
    
    if (error) {
      console.error('[BrokerExecution] Deriv edge function error:', error);
      throw new Error(error.message || 'Deriv trade execution failed');
    }
    
    if (!data?.success) {
      throw new Error(data?.error || 'Deriv trade execution failed');
    }
    
    console.log('[BrokerExecution] Deriv trade successful:', data);
    
    return {
      success: true,
      tradeId: data.contract_id,
      buyPrice: data.buy_price,
      payout: data.payout,
      provider: 'deriv',
    };
  } catch (err: any) {
    console.error('[BrokerExecution] Deriv execution error:', err);
    return {
      success: false,
      error: err.message || 'Failed to execute Deriv trade',
      provider: 'deriv',
    };
  }
}

// ============ MetaAPI Execution ============

async function executeMetaApiTrade(
  account: TradingAccount,
  signal: TradeSignal
): Promise<ExecuteTradeResult> {
  if (!account.metaapi_account_id) {
    return { 
      success: false, 
      error: 'No MetaAPI account ID available for this account', 
      provider: 'metaapi' 
    };
  }
  
  try {
    const { data, error } = await supabase.functions.invoke('metaapi-execute-trade', {
      body: {
        accountId: account.metaapi_account_id,
        trade: {
          symbol: signal.symbol,
          direction: signal.direction,
          volume: signal.volume,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          comment: signal.comment || 'HuMi Trade'
        }
      }
    });
    
    if (error) {
      console.error('[BrokerExecution] MetaAPI edge function error:', error);
      throw new Error(error.message || 'MetaAPI trade execution failed');
    }
    
    if (data?.error) {
      throw new Error(data.error);
    }
    
    console.log('[BrokerExecution] MetaAPI trade successful:', data);
    
    return {
      success: true,
      tradeId: data?.tradeId || data?.positionId,
      provider: 'metaapi',
    };
  } catch (err: any) {
    console.error('[BrokerExecution] MetaAPI execution error:', err);
    return {
      success: false,
      error: err.message || 'Failed to execute MetaAPI trade',
      provider: 'metaapi',
    };
  }
}

// ============ Utility Functions ============

/**
 * Check if an account supports trade execution
 */
export function canExecuteTrades(account: TradingAccount): boolean {
  if (account.provider === 'deriv') {
    return !!account.deriv_token;
  }
  if (account.provider === 'metaapi' || account.provider === 'mt4' || account.provider === 'mt5') {
    return !!account.metaapi_account_id;
  }
  return false;
}

/**
 * Get a user-friendly description of why an account can't trade
 */
export function getTradeDisabledReason(account: TradingAccount): string | null {
  if (canExecuteTrades(account)) {
    return null;
  }
  
  if (account.provider === 'deriv') {
    return 'Deriv API token not configured';
  }
  if (account.provider === 'metaapi' || account.provider === 'mt4' || account.provider === 'mt5') {
    return 'MetaAPI connection not configured';
  }
  return `${account.provider} broker not yet supported for trade execution`;
}

/**
 * Get provider-specific trade execution details
 */
export function getProviderInfo(provider: string): {
  name: string;
  supportsOptions: boolean;
  supportsForex: boolean;
  supportsSynthetics: boolean;
} {
  switch (provider) {
    case 'deriv':
      return {
        name: 'Deriv',
        supportsOptions: true,
        supportsForex: true,
        supportsSynthetics: true,
      };
    case 'metaapi':
    case 'mt4':
    case 'mt5':
      return {
        name: 'MetaAPI (MT4/MT5)',
        supportsOptions: false,
        supportsForex: true,
        supportsSynthetics: false,
      };
    default:
      return {
        name: provider,
        supportsOptions: false,
        supportsForex: false,
        supportsSynthetics: false,
      };
  }
}
