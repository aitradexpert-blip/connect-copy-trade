import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { chartDataService } from '@/services/chartDataService';
import { useTheme } from 'next-themes';
import { RefreshCw } from 'lucide-react';

interface TradingChartProps {
  symbol: string;
  onTradeClick?: (action: 'BUY' | 'SELL') => void;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Generate fallback sample data when API fails
const generateFallbackData = (symbol: string): CandleData[] => {
  const data: CandleData[] = [];
  let time = Math.floor(Date.now() / 1000) - 86400 * 30;
  
  // Base prices for different instruments
  let price = 1.0;
  if (symbol.includes('BTC')) price = 43000;
  else if (symbol.includes('ETH')) price = 2300;
  else if (symbol.includes('XAU') || symbol.includes('GOLD')) price = 2000;
  else if (symbol.includes('EUR')) price = 1.08;
  else if (symbol.includes('GBP')) price = 1.26;
  else if (symbol.includes('US30')) price = 38000;
  else if (symbol.includes('NAS')) price = 16000;
  
  for (let i = 0; i < 200; i++) {
    const change = (Math.random() - 0.5) * 0.002 * price;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 0.001 * price;
    const low = Math.min(open, close) - Math.random() * 0.001 * price;
    
    data.push({ time, open, high, low, close });
    time += 3600;
    price = close;
  }
  
  return data;
};

export const TradingChart = ({ symbol, onTradeClick }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const [timeframe, setTimeframe] = useState('1H');
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const { theme } = useTheme();

  // Check localStorage cache first
  const getCachedData = (sym: string, tf: string): CandleData[] | null => {
    try {
      const cacheKey = `chart_${sym}_${tf}_${new Date().toDateString()}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        console.log('[Chart] Using cached data for', sym);
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('[Chart] Cache read error:', e);
    }
    return null;
  };

  const setCachedData = (sym: string, tf: string, data: CandleData[]) => {
    try {
      const cacheKey = `chart_${sym}_${tf}_${new Date().toDateString()}`;
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (e) {
      console.warn('[Chart] Cache write error:', e);
    }
  };

  // Check container dimensions
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const checkDimensions = () => {
      const { clientWidth } = container;
      if (clientWidth > 0) {
        setChartReady(true);
        return true;
      }
      return false;
    };

    if (checkDimensions()) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        setChartReady(true);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(container);

    const timeout = setTimeout(() => {
      setChartReady(true);
    }, 300);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  // Create chart when ready
  useEffect(() => {
    if (!chartReady || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = 500;

    // Cleanup existing chart
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.warn('[Chart] Cleanup error:', e);
      }
      chartRef.current = null;
      seriesRef.current = null;
    }

    try {
      const isDark = theme === 'dark';

      const chart = createChart(container, {
        width,
        height,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDark ? '#d1d5db' : '#1f2937',
        },
        grid: {
          vertLines: { color: isDark ? '#334155' : '#e5e7eb' },
          horzLines: { color: isDark ? '#334155' : '#e5e7eb' },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: isDark ? '#475569' : '#d1d5db',
        },
        rightPriceScale: {
          borderColor: isDark ? '#475569' : '#d1d5db',
        },
      });

      // Try to add candlestick series with fallback for different API versions
      let candlestickSeries;
      try {
        candlestickSeries = (chart as any).addCandlestickSeries({
          upColor: '#22c55e',
          downColor: '#ef4444',
          borderVisible: false,
          wickUpColor: '#22c55e',
          wickDownColor: '#ef4444',
        });
      } catch (seriesError) {
        console.warn('[Chart] addCandlestickSeries failed, trying alternative:', seriesError);
        candlestickSeries = (chart as any).addSeries?.({ 
          type: 'Candlestick',
          upColor: '#22c55e',
          downColor: '#ef4444',
        });
      }

      if (!candlestickSeries) {
        throw new Error('Failed to create candlestick series');
      }

      chartRef.current = chart;
      seriesRef.current = candlestickSeries;
      setError(null);

      // Load data
      loadChartData(symbol, timeframe, candlestickSeries);

      const handleResize = () => {
        if (chartContainerRef.current && chart) {
          const newWidth = chartContainerRef.current.clientWidth;
          if (newWidth > 0) {
            chart.applyOptions({ width: newWidth });
          }
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        try {
          chart.remove();
        } catch (e) {
          console.warn('[Chart] Final cleanup error:', e);
        }
      };
    } catch (err: any) {
      console.error('[Chart] Creation error:', err);
      setError('Chart initialization failed');
      setLoading(false);
    }
  }, [chartReady, symbol, timeframe, theme]);

  const loadChartData = async (sym: string, tf: string, series: any) => {
    setLoading(true);
    setUsingFallback(false);
    
    try {
      // 1. Check localStorage cache first (saves API credits)
      const cachedData = getCachedData(sym, tf);
      if (cachedData && cachedData.length > 0) {
        series.setData(cachedData);
        chartRef.current?.timeScale().fitContent();
        setLoading(false);
        return;
      }

      // 2. Try to fetch from service
      console.log('[Chart] Fetching data for:', sym, tf);
      const data = await chartDataService.getChartData(sym, tf);
      
      if (data && data.length > 0) {
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
        setCachedData(sym, tf, data);
        setError(null);
      } else {
        throw new Error('No data returned');
      }
    } catch (err) {
      console.warn('[Chart] API failed, using fallback data:', err);
      
      // 3. Use hardcoded fallback data (zero API credits)
      const fallbackData = generateFallbackData(sym);
      series.setData(fallbackData);
      chartRef.current?.timeScale().fitContent();
      setUsingFallback(true);
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    if (seriesRef.current) {
      // Clear cache to force fresh fetch
      try {
        const cacheKey = `chart_${symbol}_${timeframe}_${new Date().toDateString()}`;
        localStorage.removeItem(cacheKey);
      } catch (e) {}
      loadChartData(symbol, timeframe, seriesRef.current);
    }
  };

  return (
    <div className="relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading chart...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-lg">
          <div className="text-center p-4">
            <p className="text-destructive mb-2">{error}</p>
            <Button onClick={handleRetry} size="sm" variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Timeframe Selector */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          {['1m', '5m', '15m', '1H', '4H', '1D', '1W'].map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                timeframe === tf 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
        
        {/* Quick Trade Buttons */}
        {onTradeClick && (
          <div className="flex gap-2">
            <Button
              onClick={() => onTradeClick('BUY')}
              className="bg-profit hover:bg-profit/80 text-white"
              size="sm"
            >
              Quick Buy
            </Button>
            <Button
              onClick={() => onTradeClick('SELL')}
              className="bg-loss hover:bg-loss/80 text-white"
              size="sm"
            >
              Quick Sell
            </Button>
          </div>
        )}
      </div>

      {/* Chart container */}
      <div 
        ref={chartContainerRef} 
        className="w-full rounded-lg border border-border bg-card"
        style={{ minHeight: '500px', minWidth: '300px' }}
      />
      
      {/* Attribution & Status */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>
          Charts powered by{' '}
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            TradingView
          </a>
        </span>
        {usingFallback && (
          <span className="text-amber-500">Sample data - API unavailable</span>
        )}
      </div>
    </div>
  );
};
