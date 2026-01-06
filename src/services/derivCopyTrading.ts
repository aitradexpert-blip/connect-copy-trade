// Deriv Copy Trading Service
// Handles copy trading operations: copy_start, copy_stop, statistics

import { getSharedDerivWS, DerivWS } from './derivWebSocket';

export interface CopyStartParams {
  copyTraderToken: string; // The master trader's token
  minTradeStake?: number;
  maxTradeStake?: number;
  tradeTypes?: string[];
  assets?: string[];
}

export interface CopyStartResponse {
  copy_start: number; // 1 if successful
}

export interface CopyStopResponse {
  copy_stop: number; // 1 if successful
}

export interface CopyTradingListResponse {
  copy_trading_list: {
    copiers: Array<{
      loginid: string;
    }>;
    traders: Array<{
      assets: string[];
      loginid: string;
      max_trade_stake: number;
      min_trade_stake: number;
      token: string;
      trade_types: string[];
    }>;
  };
}

export interface CopyTradingStatsResponse {
  copy_trading_statistics: {
    active_since: number;
    avg_duration: number;
    avg_loss: number;
    avg_profit: number;
    copiers: number;
    last_12months_profitable_trades: number;
    monthly_profitable_trades: Record<string, number>;
    performance_probability: number;
    total_trades: number;
    trades_breakdown: Record<string, {
      buy: number;
      sell: number;
    }>;
    trades_profitable: number;
    yearly_profitable_trades: number;
  };
}

/**
 * Start copying a master trader
 * Must be authorized before calling
 */
export async function startCopying(
  params: CopyStartParams,
  ws?: DerivWS
): Promise<CopyStartResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const payload: Record<string, any> = {
      copy_start: params.copyTraderToken,
    };
    
    if (params.minTradeStake) payload.min_trade_stake = params.minTradeStake;
    if (params.maxTradeStake) payload.max_trade_stake = params.maxTradeStake;
    if (params.tradeTypes) payload.trade_types = params.tradeTypes;
    if (params.assets) payload.assets = params.assets;
    
    const response = await client.send(payload);
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as CopyStartResponse;
  } catch (error) {
    console.error('[DerivCopyTrading] Start copying failed:', error);
    throw error;
  }
}

/**
 * Stop copying a master trader
 */
export async function stopCopying(
  copyTraderToken: string,
  ws?: DerivWS
): Promise<CopyStopResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      copy_stop: copyTraderToken,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as CopyStopResponse;
  } catch (error) {
    console.error('[DerivCopyTrading] Stop copying failed:', error);
    throw error;
  }
}

/**
 * Get list of traders being copied and copiers
 */
export async function getCopyTradingList(
  ws?: DerivWS
): Promise<CopyTradingListResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      copy_trading_list: 1,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as CopyTradingListResponse;
  } catch (error) {
    console.error('[DerivCopyTrading] Get copy trading list failed:', error);
    throw error;
  }
}

/**
 * Get copy trading statistics for a master trader
 */
export async function getCopyTradingStats(
  traderId: string,
  ws?: DerivWS
): Promise<CopyTradingStatsResponse> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      copy_trading_statistics: 1,
      trader_id: traderId,
    });
    
    if (response.error) {
      throw new Error(response.error.message);
    }
    
    return response as CopyTradingStatsResponse;
  } catch (error) {
    console.error('[DerivCopyTrading] Get copy trading stats failed:', error);
    throw error;
  }
}

/**
 * Subscribe to transaction updates (for mirror trading to other brokers)
 */
export function subscribeTransactions(
  onTransaction: (transaction: {
    action: 'buy' | 'sell';
    amount: number;
    balance: number;
    contract_id?: number;
    symbol?: string;
    transaction_id: number;
    transaction_time: number;
  }) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  
  const subscription = client.subscribe(
    {
      transaction: 1,
      subscribe: 1,
    },
    (message) => {
      if (message.msg_type === 'transaction' && message.transaction) {
        onTransaction(message.transaction);
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}
