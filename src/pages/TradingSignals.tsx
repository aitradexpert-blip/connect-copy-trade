import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import { TrendingUp, TrendingDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Signal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot_size: number;
  comment?: string | null;
  created_at: string;
}

interface TradingAccount {
  id: string;
  name: string;
  metaapi_account_id: string;
}

export default function TradingSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);

      try {
        // Load signals
        const { data: signalsData, error: signalsError } = await supabase
          .from('trading_signals')
          .select('id,symbol,direction,lot_size,comment,created_at')
          .order('created_at', { ascending: false });

        if (signalsError) throw signalsError;
        setSignals((signalsData || []) as Signal[]);

        // Load user's trading accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from('trading_accounts')
          .select('id,name,metaapi_account_id')
          .eq('user_id', user.id);

        if (accountsError) throw accountsError;
        setAccounts(accountsData || []);
      } catch (error: any) {
        console.error(error);
        toast({ title: 'Failed to load data', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, toast]);

  const executeSignal = async (signal: Signal) => {
    if (!selectedAccount) {
      toast({ title: 'Select Account', description: 'Please select a trading account first', variant: 'destructive' });
      return;
    }

    const account = accounts.find(acc => acc.id === selectedAccount);
    if (!account) {
      toast({ title: 'Account Error', description: 'Selected account not found', variant: 'destructive' });
      return;
    }

    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke('metaapi-execute-trade', {
        body: {
          accountId: account.metaapi_account_id,
          trade: {
            symbol: signal.symbol,
            direction: signal.direction,
            volume: signal.lot_size,
            comment: `Signal: ${signal.comment || signal.symbol}`
          }
        }
      });

      if (error) throw error;

      toast({
        title: 'Trade Executed',
        description: `${signal.direction} ${signal.lot_size} lots of ${signal.symbol} executed successfully`
      });
    } catch (error: any) {
      console.error('Trade execution error:', error);
      toast({
        title: 'Execution Failed',
        description: error.message || 'Failed to execute trade',
        variant: 'destructive'
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Available Trading Signals</h1>
          <p className="text-muted-foreground mt-2">
            Signals are published by the admin and visible while active
          </p>
        </div>

        {/* Account Selection */}
        {accounts.length > 0 && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <h3 className="text-lg font-semibold">Select Trading Account</h3>
            </CardHeader>
            <CardContent>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose account to execute trades" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full bg-gradient-primary" 
                      disabled={accounts.length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Execute Trade
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Execute Trade Signal</DialogTitle>
                      <DialogDescription>
                        Execute {signal.direction} {signal.lot_size} lots of {signal.symbol}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Trading Account</label>
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => executeSignal(signal)} 
                        disabled={!selectedAccount || executing}
                        className="w-full bg-gradient-primary"
                      >
                        {executing ? 'Executing...' : 'Confirm Execute'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
