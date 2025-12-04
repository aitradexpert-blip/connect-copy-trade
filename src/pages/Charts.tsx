import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { TradingChart } from '@/components/TradingChart';
import { WatchlistDropdown } from '@/components/WatchlistDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Loader2 } from 'lucide-react';
import { get24hStats, MarketStats } from '@/services/derivMarketData';

export default function Charts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSymbol, setActiveSymbol] = useState(searchParams.get('symbol') || 'EUR/USD');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

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
    console.log(`Trade action: ${action} ${activeSymbol}`);
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
          <CardHeader>
            <CardTitle className="text-2xl">{activeSymbol}</CardTitle>
            <CardDescription>
              Real-time market data powered by Deriv
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TradingChart 
              symbol={activeSymbol}
              onTradeClick={handleTradeClick}
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
