/**
 * Unified Broker Execution Service
 * Routes trade execution to the appropriate API based on account provider and connection_type
 * Supports: Deriv (deriv_api), MetaAPI (metaapi), and future broker integrations
 *
 * Dual-engine read path: primary self-hosted FastAPI (when VITE_API_URL is set)
 * with MetaAPI edge functions as silent fallback.
 */

import { supabase } from '@/integrations/supabase/client';
import { primaryApi, isPrimaryConfigured } from './primaryApi';
import { withFailover } from './tradingDataGateway';

// ============ Interfaces ============

export interface TradingAccount {
  id: string;
  provider: string;
  connection_type?: string; // 'deriv_api' or 'metaapi'
  broker_name?: string;
  metaapi_account_id: string | null;
  deriv_token: string | null;
  deriv_currency: string | null;
  is_virtual: boolean | null;
  name: string;
  login: string;
  platform?: string;
  balance?: number;
  equity?: number;
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

export interface AccountDataResult {
  balance: number;
  equity: number;
  positions: any[];
  history?: any[];
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
  if (DERIV_SYMBOL_MAP[symbol]) {
    return DERIV_SYMBOL_MAP[symbol];
  }
  
  if (symbol.startsWith('frx') || symbol.startsWith('cry') || symbol.startsWith('R_') || symbol.startsWith('1HZ')) {
    return symbol;
  }
  
  const upperSymbol = symbol.toUpperCase().replace('/', '');
  if (DERIV_SYMBOL_MAP[upperSymbol]) {
    return DERIV_SYMBOL_MAP[upperSymbol];
  }
  
  return symbol;
}

/**
 * Determine the connection type for routing
 * Uses connection_type column if available, falls back to provider detection
 */
function getConnectionType(account: TradingAccount): 'deriv_api' | 'metaapi' {
  // Use explicit connection_type if set
  if (account.connection_type === 'metaapi') return 'metaapi';
  if (account.connection_type === 'deriv_api') return 'deriv_api';
  if (account.connection_type === 'vps' || account.provider === 'vps') return 'metaapi';

  // Fall back to platform detection
  const platform = account.platform?.toLowerCase() || '';
  if (platform.includes('mt4') || platform.includes('mt5') || platform.includes('metatrader')) {
    return 'metaapi';
  }
  
  // Fall back to provider detection
  if (account.provider === 'metaapi' || account.provider === 'mt4' || account.provider === 'mt5') {
    return 'metaapi';
  }
  
  // Default to deriv_api for Deriv accounts with tokens
  if (account.deriv_token) return 'deriv_api';
  if (account.metaapi_account_id) return 'metaapi';
  
  return 'deriv_api';
}

// ============ Main Execution Function ============

/**
 * Execute a trade on the specified account
 * Automatically routes to the correct broker API based on connection_type
 */
export async function executeOnAccount(
  account: TradingAccount,
  signal: TradeSignal
): Promise<ExecuteTradeResult> {
  console.log(`[BrokerExecution] Executing trade on ${account.provider} account:`, account.name);
  console.log(`[BrokerExecution] Signal:`, signal);

  // VPS-first middleware — routes directly to self-hosted FastAPI when the
  // account was connected via the VPS bridge. Only falls through on unavailable.
  if (
    (account.provider === 'vps' || account.connection_type === 'vps') &&
    isPrimaryConfigured()
  ) {
    try {
      const result: any = await primaryApi.sendOrder({
        accountId: account.id,
        symbol: signal.symbol,
        order_type: signal.direction.toLowerCase(),
        volume: signal.volume,
        sl: signal.stopLoss ?? null,
        tp: signal.takeProfit ?? null,
      });
      if (result?.success || result?.ticket || result?.order) {
        return {
          success: true,
          tradeId: result?.ticket || result?.order || 'vps-order',
          provider: 'vps',
        };
      }
      console.warn('[BrokerExecution] VPS order rejected, trying MetaAPI:', result?.error);
    } catch (vpsErr) {
      console.warn('[BrokerExecution] VPS unreachable, trying MetaAPI:', vpsErr);
    }
  }

  const connectionType = getConnectionType(account);
  console.log(`[BrokerExecution] Connection type:`, connectionType);

  if (connectionType === 'deriv_api') {
    return executeDerivTrade(account, signal);
  } else {
    return executeMetaApiTrade(account, signal);
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

  const payload = {
    accountId: account.metaapi_account_id,
    symbol: signal.symbol,
    direction: signal.direction,
    volume: signal.volume,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
    comment: signal.comment || 'HuMi Trade',
  };

  // Primary-first execution via self-hosted FastAPI; silent fallback to MetaAPI edge fn.
  try {
    const primary = await primaryApi.sendOrder({
      accountId: account.metaapi_account_id,
      symbol: signal.symbol,
      order_type: signal.direction.toLowerCase(),
      volume: signal.volume,
      sl: signal.stopLoss ?? null,
      tp: signal.takeProfit ?? null,
    });
    return {
      success: true,
      tradeId: (primary as any)?.tradeId || (primary as any)?.positionId || (primary as any)?.order,
      provider: 'metaapi',
    };
  } catch (primaryErr: any) {
    // Only fall back on primary-unavailable; rethrow real broker rejections
    const isPrimaryDown = primaryErr?.name === 'PrimaryUnavailableError';
    if (!isPrimaryDown) {
      console.error('[BrokerExecution] Primary order rejected:', primaryErr);
      return { success: false, error: primaryErr?.message || 'Primary engine rejected order', provider: 'metaapi' };
    }
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
  const connectionType = getConnectionType(account);
  
  if (connectionType === 'deriv_api') {
    return !!account.deriv_token;
  }
  if (connectionType === 'metaapi') {
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
  
  const connectionType = getConnectionType(account);
  
  if (connectionType === 'deriv_api') {
    return 'Deriv API token not configured';
  }
  if (connectionType === 'metaapi') {
    return 'MetaAPI connection not configured';
  }
  return `${account.provider} broker not yet supported for trade execution`;
}

/**
 * Get provider-specific trade execution details
 */
export function getProviderInfo(account: TradingAccount): {
  name: string;
  supportsOptions: boolean;
  supportsForex: boolean;
  supportsSynthetics: boolean;
  connectionType: 'deriv_api' | 'metaapi';
} {
  const connectionType = getConnectionType(account);
  
  if (connectionType === 'deriv_api') {
    return {
      name: account.broker_name || 'Deriv',
      supportsOptions: true,
      supportsForex: true,
      supportsSynthetics: true,
      connectionType: 'deriv_api',
    };
  }
  
  return {
    name: account.broker_name || 'MetaAPI (MT4/MT5)',
    supportsOptions: false,
    supportsForex: true,
    supportsSynthetics: false,
    connectionType: 'metaapi',
  };
}

// ============ Account Data Fetching ============

/**
 * Fetch live account data (balance, equity, positions) from the appropriate API
 */
export async function fetchAccountData(account: TradingAccount): Promise<AccountDataResult> {
  const connectionType = getConnectionType(account);
  
  if (connectionType === 'metaapi' && account.metaapi_account_id) {
    return fetchMetaApiData(account.metaapi_account_id);
  }
  
  // Default to empty for Deriv (handled via WebSocket in UI)
  return {
    balance: account.balance || 0,
    equity: account.equity || 0,
    positions: [],
  };
}

async function fetchMetaApiData(accountId: string): Promise<AccountDataResult> {
  return withFailover(
    async () => {
      const [info, positions] = await Promise.all([
        primaryApi.getAccount(accountId),
        primaryApi.getPositions(accountId),
      ]);
      const i: any = info || {};
      const p: any = positions || {};
      return {
        balance: Number(i.balance ?? 0),
        equity: Number(i.equity ?? 0),
        positions: Array.isArray(p) ? p : (p.positions ?? []),
      };
    },
    async () => {
      try {
        const [infoResp, positionsResp] = await Promise.all([
          supabase.functions.invoke('metaapi-account-info', { body: { accountId } }),
          supabase.functions.invoke('metaapi-get-positions', { body: { accountId } }),
        ]);
        const info = infoResp.data || {};
        const positions = positionsResp.data?.positions || [];
        return {
          balance: info.balance || 0,
          equity: info.equity || 0,
          positions,
        };
      } catch (error) {
        console.error('[BrokerExecution] MetaAPI data fetch error:', error);
        return { balance: 0, equity: 0, positions: [] };
      }
    },
  );
}

/**
 * Fetch trading history from the appropriate API
 */
export async function fetchTradingHistory(account: TradingAccount, days: number = 7): Promise<any[]> {
  const connectionType = getConnectionType(account);
  
  if (connectionType === 'metaapi' && account.metaapi_account_id) {
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    return withFailover(
      async () => {
        const h: any = await primaryApi.getHistory(account.metaapi_account_id!, startTime);
        return Array.isArray(h) ? h : (h?.history ?? []);
      },
      async () => {
        try {
          const { data, error } = await supabase.functions.invoke('metaapi-get-history', {
            body: { accountId: account.metaapi_account_id, startTime },
          });
          if (error) throw error;
          return data?.history || [];
        } catch (error) {
          console.error('[BrokerExecution] History fetch error:', error);
          return [];
        }
      },
    );
  }
  
  return [];
}
