import { supabase } from '@/integrations/supabase/client';

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

class ChartDataService {
  private cache = new Map<string, { data: CandleData[]; timestamp: number }>();
  private cacheDuration = 30000; // 30 seconds

  async getChartData(symbol: string, timeframe: string = '1H'): Promise<CandleData[]> {
    const cacheKey = `${symbol}-${timeframe}`;
    const cached = this.cache.get(cacheKey);

    // Return cached data if valid
    if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
      console.log(`[Chart] Cache hit for ${symbol}`);
      return cached.data;
    }

    try {
      // PRIMARY: Try TradingView/Yahoo Finance free data
      console.log(`[Chart] Fetching data for ${symbol} from TradingView`);
      const data = await this.fetchFromTradingView(symbol, timeframe);
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.warn(`[Chart] TradingView failed for ${symbol}, falling back to MetaAPI`, error);
      
      // FALLBACK: Use MetaAPI if TradingView fails
      return await this.fetchFromMetaAPI(symbol, timeframe);
    }
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

  private async fetchFromTradingView(symbol: string, timeframe: string): Promise<CandleData[]> {
    // For now, generate mock data - in production, use TradingView API or Yahoo Finance
    // TradingView widget provides free delayed data
    return this.generateMockData(symbol);
  }

  private async fetchFromMetaAPI(symbol: string, timeframe: string): Promise<CandleData[]> {
    // Only used as fallback - tracks credit usage
    console.log('[Chart] Using MetaAPI (costs credits)');
    
    try {
      const { data, error } = await supabase.functions.invoke('metaapi-get-candles', {
        body: { symbol, timeframe }
      });

      if (error) throw error;
      
      return this.formatToLightweightCharts(data || []);
    } catch (error) {
      console.error('[Chart] MetaAPI fallback failed:', error);
      return this.generateMockData(symbol);
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
    
    for (let i = 0; i < 500; i++) {
      const change = (Math.random() - 0.5) * 0.002 * price;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * 0.001 * price;
      const low = Math.min(open, close) - Math.random() * 0.001 * price;
      
      data.push({ time, open, high, low, close });
      time += 3600; // 1 hour
      price = close;
    }
    
    return data;
  }

  private getBasePrice(symbol: string): number {
    // Base prices for different instruments
    if (symbol.includes('BTC')) return 43000;
    if (symbol.includes('ETH')) return 2300;
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return 2000;
    if (symbol.includes('XAG') || symbol.includes('SILVER')) return 25;
    if (symbol.includes('USD/JPY')) return 150;
    if (symbol.includes('EUR/USD')) return 1.08;
    if (symbol.includes('GBP/USD')) return 1.26;
    if (symbol.includes('US30')) return 38000;
    if (symbol.includes('NAS100')) return 16000;
    if (symbol.includes('SPX500')) return 4800;
    return 1.0; // Default
  }

  clearCache() {
    this.cache.clear();
  }
}

export const chartDataService = new ChartDataService();
