// Deriv Market Data Service - Fetch market data from Deriv WebSocket API
import { DerivWS, getDerivSymbol, getSharedDerivWS } from './derivWebSocket';

export interface ActiveSymbol {
  symbol: string;
  display_name: string;
  symbol_type: string;
  market: string;
  submarket: string;
  pip: number;
  is_trading_suspended: boolean;
  exchange_is_open: boolean;
}

export interface Tick {
  symbol: string;
  quote: number;
  epoch: number;
  ask?: number;
  bid?: number;
}

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketStats {
  symbol: string;
  currentPrice: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  change24h: number | null;
  changePercent24h: number | null;
}

// Get all active symbols from Deriv
export async function getActiveSymbols(
  ws?: DerivWS,
  mode: 'brief' | 'full' = 'brief'
): Promise<ActiveSymbol[]> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      active_symbols: mode,
      product_type: 'basic'
    });
    
    return response.active_symbols || [];
  } catch (error) {
    console.error('[DerivMarketData] Error fetching active symbols:', error);
    return [];
  }
}

// Get contracts available for a symbol
export async function getContractsFor(
  symbol: string,
  ws?: DerivWS
): Promise<any> {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  try {
    const response = await client.send({
      contracts_for: derivSymbol,
      currency: 'USD',
      product_type: 'basic'
    });
    
    return response.contracts_for || {};
  } catch (error) {
    console.error('[DerivMarketData] Error fetching contracts:', error);
    return {};
  }
}

// Get 24h statistics using historical candles
export async function get24hStats(
  symbol: string,
  ws?: DerivWS
): Promise<MarketStats> {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  const defaultStats: MarketStats = {
    symbol,
    currentPrice: null,
    high24h: null,
    low24h: null,
    volume24h: null,
    change24h: null,
    changePercent24h: null
  };
  
  try {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 86400; // 24 hours ago
    
    const response = await client.send({
      ticks_history: derivSymbol,
      start,
      end: 'latest',
      style: 'candles',
      granularity: 3600 // 1 hour candles
    });
    
    const candles: Candle[] = response.candles || [];
    
    if (candles.length === 0) {
      return defaultStats;
    }
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume).filter((v): v is number => Number.isFinite(v));
    
    const currentPrice = candles[candles.length - 1].close;
    const openPrice = candles[0].open;
    const change24h = currentPrice - openPrice;
    const changePercent24h = openPrice > 0 ? (change24h / openPrice) * 100 : 0;
    
    return {
      symbol,
      currentPrice,
      high24h: highs.length > 0 ? Math.max(...highs) : null,
      low24h: lows.length > 0 ? Math.min(...lows) : null,
      volume24h: volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) : null,
      change24h,
      changePercent24h
    };
  } catch (error) {
    console.error('[DerivMarketData] Error fetching 24h stats:', error);
    return defaultStats;
  }
}

// Get historical candles for charting
export async function getHistoricalCandles(
  symbol: string,
  startTime: number,
  endTime: number,
  granularity: number = 60, // Default 1 minute
  ws?: DerivWS
): Promise<Candle[]> {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  try {
    // startTime and endTime should be in seconds for Deriv API
    // If they're in milliseconds (>1e10), convert them
    const startSeconds = startTime > 1e10 ? Math.floor(startTime / 1000) : startTime;
    const endSeconds = endTime > 1e10 ? Math.floor(endTime / 1000) : endTime;
    
    const response = await client.send({
      ticks_history: derivSymbol,
      start: startSeconds,
      end: endSeconds,
      style: 'candles',
      granularity
    });
    
    return (response.candles || []).map((c: any) => ({
      epoch: c.epoch,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume
    }));
  } catch (error) {
    console.error('[DerivMarketData] Error fetching historical candles:', error);
    return [];
  }
}

// Subscribe to live tick updates
export function subscribeTicks(
  symbol: string,
  onTick: (tick: Tick) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  const subscription = client.subscribe(
    { ticks: derivSymbol, subscribe: 1 },
    (message) => {
      if (message.msg_type === 'tick' && message.tick) {
        onTick({
          symbol: message.tick.symbol,
          quote: message.tick.quote,
          epoch: message.tick.epoch,
          ask: message.tick.ask,
          bid: message.tick.bid
        });
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}

// Subscribe to candle updates (OHLC)
export function subscribeCandles(
  symbol: string,
  granularity: number,
  onCandle: (candle: Candle) => void,
  ws?: DerivWS
): { unsubscribe: () => Promise<void> } {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  const subscription = client.subscribe(
    { ticks_history: derivSymbol, style: 'candles', granularity, subscribe: 1 },
    (message) => {
      if (message.msg_type === 'ohlc' && message.ohlc) {
        onCandle({
          epoch: message.ohlc.epoch,
          open: parseFloat(message.ohlc.open),
          high: parseFloat(message.ohlc.high),
          low: parseFloat(message.ohlc.low),
          close: parseFloat(message.ohlc.close),
          volume: message.ohlc.volume
        });
      }
    }
  );
  
  return {
    unsubscribe: subscription.forget
  };
}

// Get current price (single tick)
export async function getCurrentPrice(
  symbol: string,
  ws?: DerivWS
): Promise<number | null> {
  const client = ws || getSharedDerivWS();
  const derivSymbol = getDerivSymbol(symbol) || symbol;
  
  try {
    const response = await client.send({
      ticks: derivSymbol
    });
    
    return response.tick?.quote || null;
  } catch (error) {
    console.error('[DerivMarketData] Error fetching current price:', error);
    return null;
  }
}

// Get exchange rates
export async function getExchangeRates(
  baseCurrency: string = 'USD',
  ws?: DerivWS
): Promise<Record<string, number>> {
  const client = ws || getSharedDerivWS();
  
  try {
    const response = await client.send({
      exchange_rates: 1,
      base_currency: baseCurrency
    });
    
    return response.exchange_rates?.rates || {};
  } catch (error) {
    console.error('[DerivMarketData] Error fetching exchange rates:', error);
    return {};
  }
}

// Convert candles to TradingView format
export function candlesToTVFormat(candles: Candle[]): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}> {
  return candles.map(c => ({
    time: c.epoch * 1000, // Convert to milliseconds
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume
  }));
}

// Granularity mapping (resolution to seconds)
export const GRANULARITY_MAP: Record<string, number> = {
  '1': 60,       // 1 minute
  '5': 300,      // 5 minutes
  '15': 900,     // 15 minutes
  '30': 1800,    // 30 minutes
  '60': 3600,    // 1 hour
  '120': 7200,   // 2 hours
  '240': 14400,  // 4 hours
  '1D': 86400,   // 1 day
  'D': 86400,    // 1 day (alternative)
  '1W': 604800,  // 1 week
  'W': 604800,   // 1 week (alternative)
};

export function resolutionToGranularity(resolution: string): number {
  return GRANULARITY_MAP[resolution] || 60;
}
