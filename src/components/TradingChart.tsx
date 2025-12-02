import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Button } from '@/components/ui/button';
import { chartDataService } from '@/services/chartDataService';
import { useTheme } from 'next-themes';

interface TradingChartProps {
  symbol: string;
  onTradeClick?: (action: 'BUY' | 'SELL') => void;
}

export const TradingChart = ({ symbol, onTradeClick }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [timeframe, setTimeframe] = useState('1H');
  const [loading, setLoading] = useState(true);
  const [chartReady, setChartReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme();

  // Check if container has valid dimensions before creating chart
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const checkDimensions = () => {
      const { clientWidth, clientHeight } = container;
      console.log('[Chart] Container dimensions:', clientWidth, clientHeight);
      if (clientWidth > 0) {
        setChartReady(true);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkDimensions()) return;

    // Use ResizeObserver for reliable dimension detection
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0) {
        console.log('[Chart] ResizeObserver detected valid dimensions:', entry.contentRect.width);
        setChartReady(true);
        resizeObserver.disconnect();
      }
    });

    resizeObserver.observe(container);

    // Fallback timeout - force chart ready after 500ms
    const timeout = setTimeout(() => {
      console.log('[Chart] Timeout - forcing chart ready');
      setChartReady(true);
    }, 500);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  // Create chart only when container is ready
  useEffect(() => {
    if (!chartReady || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800; // Fallback width
    const height = 500;

    console.log('[Chart] Creating chart with dimensions:', width, height);

    // Clean up existing chart first
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch (e) {
        console.warn('[Chart] Error removing old chart:', e);
      }
      chartRef.current = null;
      seriesRef.current = null;
    }

    try {
      const isDark = theme === 'dark';

      // Create chart with validated dimensions
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

      // Add candlestick series
      const candlestickSeries = (chart as any).addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });

      chartRef.current = chart;
      seriesRef.current = candlestickSeries;
      setError(null);

      // Load data
      loadChartData(symbol, timeframe, candlestickSeries);

      // Handle resize
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
          console.warn('[Chart] Cleanup error:', e);
        }
      };
    } catch (err: any) {
      console.error('[Chart] Error creating chart:', err);
      setError('Failed to initialize chart. Please refresh the page.');
    }
  }, [chartReady, symbol, timeframe, theme]);

  const loadChartData = async (sym: string, tf: string, series: any) => {
    setLoading(true);
    try {
      console.log('[Chart] Loading data for:', sym, tf);
      const data = await chartDataService.getChartData(sym, tf);
      console.log('[Chart] Loaded', data.length, 'candles');
      
      if (series && data.length > 0) {
        series.setData(data);
        chartRef.current?.timeScale().fitContent();
      }
    } catch (err) {
      console.error('[Chart] Data load error:', err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10 rounded-lg">
          <div className="text-center p-4">
            <p className="text-destructive mb-2">{error}</p>
            <Button onClick={() => window.location.reload()} size="sm">
              Refresh Page
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

      {/* Chart container with minimum height to ensure valid dimensions */}
      <div 
        ref={chartContainerRef} 
        className="w-full rounded-lg border border-border"
        style={{ minHeight: '500px', minWidth: '300px' }}
      />
      
      {/* TradingView Attribution */}
      <div className="text-center text-muted-foreground text-xs mt-2">
        Charts powered by{' '}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
          TradingView
        </a>
        {' '}— Data delayed for display purposes
      </div>
    </div>
  );
};
