import { supabase } from '@/integrations/supabase/client';
import { getHistoricalCandles } from './derivMarketData';
import { DERIV_SYMBOL_MAP } from './derivWebSocket';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

class ChartDataService {
  private memoryCache = new Map<string, { data: CandleData[]; timestamp: number }>();
  private memoryCacheDuration = 30000; // 30 seconds in-memory
  private localStorageCacheDuration = 86400000; // 24 hours localStorage

  async getChartData(symbol: string, timeframe: string = '1H'): Promise<CandleData[]> {
    const cacheKey = `${symbol}-${timeframe}`;
    
    // 1. Check in-memory cache first (fastest)
    const memCached = this.memoryCache.get(cacheKey);
    if (memCached && Date.now() - memCached.timestamp < this.memoryCacheDuration) {
      console.log(`[Chart] Memory cache hit for ${symbol}`);
      return memCached.data;
    }

    // 2. Check localStorage cache (persists across sessions)
    const localCached = this.getFromLocalStorage(cacheKey);
    if (localCached) {
      console.log(`[Chart] LocalStorage cache hit for ${symbol}`);
      this.memoryCache.set(cacheKey, { data: localCached, timestamp: Date.now() });
      return localCached;
    }

    // 3. Try Deriv API first (free real-time data)
    try {
      console.log(`[Chart] Fetching from Deriv for ${symbol}`);
      const data = await this.fetchFromDeriv(symbol, timeframe);
      
      if (data.length > 0) {
        this.memoryCache.set(cacheKey, { data, timestamp: Date.now() });
        this.saveToLocalStorage(cacheKey, data);
        return data;
      }
    } catch (error) {
      console.warn(`[Chart] Deriv failed for ${symbol}:`, error);
    }

    // 4. Try MetaAPI fallback
    try {
      console.log(`[Chart] Trying MetaAPI fallback for ${symbol}`);
      const fallbackData = await this.fetchFromMetaAPI(symbol, timeframe);
      if (fallbackData.length > 0) {
        this.memoryCache.set(cacheKey, { data: fallbackData, timestamp: Date.now() });
        this.saveToLocalStorage(cacheKey, fallbackData);
        return fallbackData;
      }
    } catch (metaError) {
      console.warn(`[Chart] MetaAPI also failed:`, metaError);
    }

    // 5. Generate mock data as last resort
    console.log(`[Chart] Using generated data for ${symbol}`);
    const generatedData = this.generateMockData(symbol);
    this.memoryCache.set(cacheKey, { data: generatedData, timestamp: Date.now() });
    return generatedData;
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      const data = await this.getChartData(symbol);
      if (data && data.length > 0) {
        return data[data.length - 1].close;
      }
      return 0;
    } catch (error) {
      console.error('[Chart] Error getting current price:', error);
      return 0;
    }
  }

  private mapSymbolToDeriv(symbol: string): string | null {
    const normalized = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Check direct mapping first
    if (DERIV_SYMBOL_MAP[normalized]) {
      return DERIV_SYMBOL_MAP[normalized];
    }
    
    // Try common variations
    const variations = [
      symbol.toUpperCase(),
      symbol.replace('/', ''),
      symbol.replace(/\s+/g, ''),
    ];
    
    for (const variant of variations) {
      if (DERIV_SYMBOL_MAP[variant]) {
        return DERIV_SYMBOL_MAP[variant];
      }
    }
    
    return null;
  }

  private async fetchFromDeriv(symbol: string, timeframe: string): Promise<CandleData[]> {
    const derivSymbol = this.mapSymbolToDeriv(symbol);
    
    if (!derivSymbol) {
      console.log(`[Chart] No Deriv mapping for ${symbol}`);
      throw new Error(`No Deriv symbol mapping for ${symbol}`);
    }

    const granularityMap: Record<string, number> = {
      '1m': 60,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1H': 3600,
      '4H': 14400,
      '1D': 86400,
      '1W': 604800,
    };

    const granularity = granularityMap[timeframe] || 3600;
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - (500 * granularity); // 500 candles back

    const candles = await getHistoricalCandles(derivSymbol, startTime, endTime, granularity);
    
    return candles.map(c => ({
      time: c.epoch,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
  }

  private getFromLocalStorage(cacheKey: string): CandleData[] | null {
    try {
      const stored = localStorage.getItem(`chart_cache_${cacheKey}`);
      if (!stored) return null;
      
      const { data, timestamp } = JSON.parse(stored);
      
      // Check if cache is still valid (24 hours)
      if (Date.now() - timestamp > this.localStorageCacheDuration) {
        localStorage.removeItem(`chart_cache_${cacheKey}`);
        return null;
      }
      
      return data;
    } catch (e) {
      return null;
    }
  }

  private saveToLocalStorage(cacheKey: string, data: CandleData[]) {
    try {
      const toStore = { data, timestamp: Date.now() };
      localStorage.setItem(`chart_cache_${cacheKey}`, JSON.stringify(toStore));
    } catch (e) {
      // Storage might be full - clear old entries
      this.clearOldCacheEntries();
    }
  }

  private clearOldCacheEntries() {
    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith('chart_cache_'));
      // Remove oldest half
      keys.slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[Chart] Failed to clear old cache entries');
    }
  }

  private async fetchFromMetaAPI(symbol: string, timeframe: string): Promise<CandleData[]> {
    console.log('[Chart] Using MetaAPI (costs credits)');
    
    try {
      const { data, error } = await supabase.functions.invoke('metaapi-get-candles', {
        body: { symbol, timeframe }
      });

      if (error) throw error;
      
      return this.formatToLightweightCharts(data || []);
    } catch (error) {
      console.error('[Chart] MetaAPI fallback failed:', error);
      throw error;
    }
  }

  private formatToLightweightCharts(data: any[]): CandleData[] {
    return data.map((candle: any) => ({
      time: Math.floor(new Date(candle.time).getTime() / 1000),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }));
  }

  private generateMockData(symbol: string): CandleData[] {
    const data: CandleData[] = [];
    let time = Math.floor(Date.now() / 1000) - 86400 * 30; // 30 days ago
    let price = this.getBasePrice(symbol);
    
    // Add some realistic volatility
    const volatility = price * 0.0015;
    
    for (let i = 0; i < 500; i++) {
      const trend = Math.sin(i / 50) * volatility * 0.5; // Slight trending
      const change = (Math.random() - 0.5) * volatility * 2 + trend;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * volatility;
      const low = Math.min(open, close) - Math.random() * volatility;
      
      data.push({ 
        time, 
        open: Number(open.toFixed(5)), 
        high: Number(high.toFixed(5)), 
        low: Number(low.toFixed(5)), 
        close: Number(close.toFixed(5)) 
      });
      time += 3600; // 1 hour
      price = close;
    }
    
    return data;
  }

  private getBasePrice(symbol: string): number {
    const upperSymbol = symbol.toUpperCase();
    if (upperSymbol.includes('BTC')) return 43000 + Math.random() * 2000;
    if (upperSymbol.includes('ETH')) return 2300 + Math.random() * 200;
    if (upperSymbol.includes('XAU') || upperSymbol.includes('GOLD')) return 2000 + Math.random() * 50;
    if (upperSymbol.includes('XAG') || upperSymbol.includes('SILVER')) return 25 + Math.random() * 2;
    if (upperSymbol.includes('JPY')) return 150 + Math.random() * 3;
    if (upperSymbol.includes('EUR')) return 1.08 + Math.random() * 0.02;
    if (upperSymbol.includes('GBP')) return 1.26 + Math.random() * 0.02;
    if (upperSymbol.includes('US30') || upperSymbol.includes('DOW')) return 38000 + Math.random() * 500;
    if (upperSymbol.includes('NAS') || upperSymbol.includes('NDX')) return 16000 + Math.random() * 300;
    if (upperSymbol.includes('SPX') || upperSymbol.includes('SP500')) return 4800 + Math.random() * 100;
    return 1.0 + Math.random() * 0.1;
  }

  clearCache() {
    this.memoryCache.clear();
    // Clear localStorage chart caches
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('chart_cache_'))
        .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }
}

export const chartDataService = new ChartDataService();