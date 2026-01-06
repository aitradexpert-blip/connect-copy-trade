import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import TradingViewChart from '@/components/TradingViewChart';
import ChartFallback from '@/components/ChartFallback';
import ChartControls from '@/components/charts/ChartControls';
import { WatchlistDropdown } from '@/components/WatchlistDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, Loader2, ArrowUp, ArrowDown } from 'lucide-react';
import { get24hStats, MarketStats } from '@/services/derivMarketData';
import { DerivQuickTrade } from '@/components/deriv/DerivQuickTrade';

type IntervalType = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "180" | "240" | "D" | "W";
type StyleType = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

export default function Charts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSymbol, setActiveSymbol] = useState(searchParams.get('symbol') || 'EUR/USD');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [widgetReady, setWidgetReady] = useState(false);
  const [interval, setChartInterval] = useState<IntervalType>("60");
  const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [chartStyle, setChartStyle] = useState<StyleType>("1");

  const handleChartRetry = useCallback(() => {
    setChartError(false);
    setWidgetReady(false);
    setChartKey(prev => prev + 1);
  }, []);

  // Chart fallback timeout - if TradingView doesn't load within 8 seconds, show fallback
  useEffect(() => {
    if (chartError) return;
    
    const timeout = setTimeout(() => {
      if (!widgetReady) {
        console.log('[Charts] TradingView timeout, switching to fallback');
        setChartError(true);
      }
    }, 8000);
    
    return () => clearTimeout(timeout);
  }, [chartKey, widgetReady, chartError]);

  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      setActiveSymbol(symbolParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const data = await get24hStats(activeSymbol);
        setStats(data);
      } catch (error) {
        console.error('Error fetching 24h stats:', error);
        setStats(null);
      } finally {
        setLoadingStats(false);
      }
    };
    
    fetchStats();
  }, [activeSymbol]);

  const handleSymbolSelect = (symbol: string) => {
    setActiveSymbol(symbol);
    setSearchParams({ symbol });
  };

  const handleTradeClick = (action: 'BUY' | 'SELL') => {
    setTradeDirection(action);
    setShowQuickTrade(true);
  };

  const handleIntervalChange = (newInterval: string) => {
    setChartInterval(newInterval as IntervalType);
    setChartKey(prev => prev + 1);
  };

  const handleChartStyleChange = (newStyle: string) => {
    setChartStyle(newStyle as StyleType);
    setChartKey(prev => prev + 1);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    // Determine decimal places based on price magnitude
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(5);
    if (price < 100) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatVolume = (volume: number | null) => {
    if (volume === null) return '-';
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Market Charts
            </h1>
            <p className="text-muted-foreground mt-1">
              View live market data for 170+ trading instruments
            </p>
          </div>
          <WatchlistDropdown 
            activeSymbol={activeSymbol}
            onSymbolSelect={handleSymbolSelect}
          />
        </div>

        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl">{activeSymbol}</CardTitle>
                <CardDescription>
                  Real-time market data powered by TradingView
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-profit hover:bg-profit/90"
                  onClick={() => handleTradeClick('BUY')}
                >
                  <ArrowUp className="w-4 h-4 mr-1" />
                  Buy
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-loss hover:bg-loss/90"
                  onClick={() => handleTradeClick('SELL')}
                >
                  <ArrowDown className="w-4 h-4 mr-1" />
                  Sell
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartControls
              interval={interval}
              chartStyle={chartStyle}
              onIntervalChange={handleIntervalChange}
              onChartStyleChange={handleChartStyleChange}
            />
            {chartError ? (
              <ChartFallback symbol={activeSymbol} onRetry={handleChartRetry} />
            ) : (
              <TradingViewChart 
                key={chartKey}
                symbol={activeSymbol}
                height={500}
                interval={interval}
                style={chartStyle}
                onReady={() => setWidgetReady(true)}
              />
            )}
            
            {/* Quick Trade Modal */}
            <DerivQuickTrade
              open={showQuickTrade}
              onOpenChange={setShowQuickTrade}
              symbol={activeSymbol}
              direction={tradeDirection}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h High</div>
              <div className="text-2xl font-bold text-profit">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatPrice(stats?.high24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Low</div>
              <div className="text-2xl font-bold text-loss">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatPrice(stats?.low24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Volume</div>
              <div className="text-2xl font-bold text-foreground">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatVolume(stats?.volume24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
