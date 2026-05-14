import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, RefreshCw, AlertCircle } from 'lucide-react';
import { getSharedDerivWS, getDerivSymbol } from '@/services/derivWebSocket';

interface ChartFallbackProps {
  symbol: string;
  onRetry?: () => void;
}

export default function ChartFallback({ symbol, onRetry }: ChartFallbackProps) {
  const [price, setPrice] = useState<number | null>(null);
  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchLivePrice = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const derivSymbol = getDerivSymbol(symbol);
        if (!derivSymbol) {
          setError('Symbol not supported');
          setLoading(false);
          return;
        }

        const ws = getSharedDerivWS();
        await ws.connect();

        ws.subscribe(
          { ticks: derivSymbol, subscribe: 1 },
          (data: any) => {
            if (!mounted) return;
            if (data.tick) {
              setPrevPrice(price);
              setPrice(data.tick.quote);
              setLoading(false);
            }
          }
        );
      } catch (err: any) {
        if (mounted) {
          setError('Unable to connect to market data');
          setLoading(false);
        }
      }
    };

    fetchLivePrice();

    return () => {
      mounted = false;
    };
  }, [symbol]);

  const trend = price && prevPrice ? (price > prevPrice ? 'up' : price < prevPrice ? 'down' : 'neutral') : 'neutral';

  const formatPrice = (p: number | null) => {
    if (p === null) return '---';
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(5);
    if (p < 100) return p.toFixed(4);
    return p.toFixed(2);
  };

  return (
    <Card className="w-full h-[400px] flex items-center justify-center bg-card border-border">
      <CardContent className="text-center space-y-4">
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Connecting to market data...</p>
          </>
        ) : error ? (
          <>
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-destructive">{error}</p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry TradingView
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="text-xl font-medium text-muted-foreground">{symbol}</div>
            <div className={`text-5xl font-bold flex items-center justify-center gap-2 ${
              trend === 'up' ? 'text-profit' : trend === 'down' ? 'text-loss' : 'text-foreground'
            }`}>
              {formatPrice(price)}
              {trend === 'up' && <TrendingUp className="w-8 h-8" />}
              {trend === 'down' && <TrendingDown className="w-8 h-8" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Live price from Deriv • TradingView chart unavailable
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry TradingView
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
