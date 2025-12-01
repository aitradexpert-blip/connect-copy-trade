import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, CandlestickData } from 'lightweight-charts';
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
  const [timeframe, setTimeframe] = useState('1H');
  const [loading, setLoading] = useState(true);
  const { theme } = useTheme();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const isDark = theme === 'dark';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#d1d5db' : '#1f2937',
      },
      grid: {
        vertLines: { color: isDark ? '#334155' : '#e5e7eb' },
        horzLines: { color: isDark ? '#334155' : '#e5e7eb' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 500,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: isDark ? '#475569' : '#d1d5db',
      },
      rightPriceScale: {
        borderColor: isDark ? '#475569' : '#d1d5db',
      },
    });

    const candlestickSeries = (chart as any).addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;

    // Load data
    loadChartData(symbol, timeframe, candlestickSeries);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chart) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [symbol, timeframe, theme]);

  const loadChartData = async (symbol: string, tf: string, series: any) => {
    setLoading(true);
    try {
      const data = await chartDataService.getChartData(symbol, tf);
      series.setData(data);
      chartRef.current?.timeScale().fitContent();
    } catch (error) {
      console.error('Chart data load error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10 rounded-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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

      <div ref={chartContainerRef} className="w-full rounded-lg border border-border" />
      
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
