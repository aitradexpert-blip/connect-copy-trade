import { useEffect, useRef, useState, useCallback } from 'react';
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

// Debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export const TradingChart = ({ symbol, onTradeClick }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const initAttemptedRef = useRef(false);
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

  // Initialize chart when dimensions are valid
  const initChart = useCallback(async (width: number, height: number) => {
    const container = chartContainerRef.current;
    if (!container || initAttemptedRef.current) return;
    
    // Visibility check - don't init when tab is hidden (common mobile cause of 0×0)
    if (document.visibilityState === 'hidden') {
      console.log('[Chart] Deferred - tab hidden');
      return;
    }
    
    // Minimum dimension check
    if (width < 150 || height < 150) {
      console.log('[Chart] Container too small:', width, height);
      setError('Chart container too small. Resize or rotate your device.');
      setLoading(false);
      return;
    }
    
    initAttemptedRef.current = true;
    setError(null);
    
    // Wait for layout to be ready via requestAnimationFrame
    await new Promise(res => requestAnimationFrame(res));
    
    try {
      const isDark = theme === 'dark';

      const chart = createChart(container, {
        width,
        height: Math.max(height, 500),
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
      setChartReady(true);

      // Load data
      await loadChartData(symbol, timeframe, candlestickSeries);
      
      console.log('[Chart] Initialized successfully', width, height);
    } catch (err: any) {
      console.error('[Chart] Creation error:', err);
      setError('Chart initialization failed. Please retry.');
      setLoading(false);
    }
  }, [symbol, timeframe, theme]);

  // Check container dimensions with debounced ResizeObserver
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    // Reset init flag when symbol/timeframe changes
    initAttemptedRef.current = false;
    
    const checkDimensions = () => {
      const { clientWidth, clientHeight } = container;
      console.log('[Chart] Container dimensions:', clientWidth, clientHeight);
      if (clientWidth > 150 && clientHeight > 150) {
        initChart(clientWidth, Math.max(clientHeight, 500));
        return true;
      }
      return false;
    };

    // Immediate check
    if (checkDimensions()) return;

    // Debounced ResizeObserver (120ms) to avoid thrashing
    const debouncedHandler = debounce((entries: ResizeObserverEntry[]) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        console.log('[Chart] Resize observed:', width, height);
        
        if (!chartRef.current) {
          initChart(width, Math.max(height, 500));
        } else {
          // Just resize existing chart
          chartRef.current.applyOptions({ width });
        }
      }
    }, 120);

    const resizeObserver = new ResizeObserver(debouncedHandler);
    resizeObserver.observe(container);

    // Visibility change listener - init when tab becomes visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !chartRef.current) {
        const rect = container.getBoundingClientRect();
        if (rect.width > 150) {
          initChart(rect.width, Math.max(rect.height, 500));
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Fallback timeout (increased to 500ms for slow devices)
    const timeout = setTimeout(() => {
      if (!chartRef.current) {
        const rect = container.getBoundingClientRect();
        initChart(rect.width || 800, Math.max(rect.height, 500));
      }
    }, 500);

    return () => {
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(timeout);
    };
  }, [initChart]);

  // Cleanup on unmount or symbol/timeframe change
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch (e) {
          console.warn('[Chart] Cleanup error:', e);
        }
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [symbol, timeframe]);

  // Update theme when it changes
  useEffect(() => {
    if (chartRef.current && chartReady) {
      const isDark = theme === 'dark';
      chartRef.current.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: isDark ? '#d1d5db' : '#1f2937',
        },
        grid: {
          vertLines: { color: isDark ? '#334155' : '#e5e7eb' },
          horzLines: { color: isDark ? '#334155' : '#e5e7eb' },
        },
      });
    }
  }, [theme, chartReady]);

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
        console.log('[Chart] Data loaded:', data.length);
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
    // Reset and reinitialize
    initAttemptedRef.current = false;
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {}
      chartRef.current = null;
      seriesRef.current = null;
    }
    setChartReady(false);
    setError(null);
    setLoading(true);
    
    // Clear cache to force fresh fetch
    try {
      const cacheKey = `chart_${symbol}_${timeframe}_${new Date().toDateString()}`;
      localStorage.removeItem(cacheKey);
    } catch (e) {}
    
    // Re-trigger initialization
    const container = chartContainerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      initChart(rect.width || 800, Math.max(rect.height, 500));
    }
  };

  const handleTimeframeChange = (tf: string) => {
    setTimeframe(tf);
    if (seriesRef.current) {
      loadChartData(symbol, tf, seriesRef.current);
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
              onClick={() => handleTimeframeChange(tf)}
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