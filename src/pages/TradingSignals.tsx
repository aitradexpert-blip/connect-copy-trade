import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AppLayout from "@/components/AppLayout";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Signal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot_size: number;
  comment?: string | null;
  created_at: string;
}

export default function TradingSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('trading_signals')
        .select('id,symbol,direction,lot_size,comment,created_at')
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        toast({ title: 'Failed to load signals', description: error.message, variant: 'destructive' });
      } else {
        setSignals((data || []) as Signal[]);
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Available Trading Signals</h1>
          <p className="text-muted-foreground mt-2">
            Signals are published by the admin and visible while active
          </p>
        </div>

        {signals.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-16">
            No active signals at the moment. Check back later.
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {signals.map((signal) => (
            <Card key={signal.id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{signal.symbol}</h3>
                  <Badge 
                    variant={signal.direction === 'BUY' ? 'default' : 'destructive'}
                    className={`${signal.direction === 'BUY' ? 'bg-profit text-white' : 'bg-loss text-white'}`}
                  >
                    <div className="flex items-center gap-1">
                      {signal.direction === 'BUY' ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {signal.direction}
                    </div>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <strong>Lots:</strong> {signal.lot_size}
                </div>
                {signal.comment && <p className="text-sm">{signal.comment}</p>}
                <div className="text-xs text-muted-foreground">
                  {new Date(signal.created_at).toLocaleString()}
                </div>
                <Button disabled className="w-full" variant="outline">
                  Execution managed by admin
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
