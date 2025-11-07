import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { TradingChart } from '@/components/TradingChart';
import { WatchlistDropdown } from '@/components/WatchlistDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function Charts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSymbol, setActiveSymbol] = useState(searchParams.get('symbol') || 'EUR/USD');

  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      setActiveSymbol(symbolParam);
    }
  }, [searchParams]);

  const handleSymbolSelect = (symbol: string) => {
    setActiveSymbol(symbol);
    setSearchParams({ symbol });
  };

  const handleTradeClick = (action: 'BUY' | 'SELL') => {
    // TODO: Open trade execution modal
    console.log(`Trade action: ${action} ${activeSymbol}`);
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
              Real-time market data powered by TradingView
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
              <div className="text-2xl font-bold text-profit">-</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Low</div>
              <div className="text-2xl font-bold text-loss">-</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Volume</div>
              <div className="text-2xl font-bold text-foreground">-</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
