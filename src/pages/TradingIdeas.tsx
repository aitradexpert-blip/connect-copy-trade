import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AppLayout from "@/components/AppLayout";
import RiskCalculator from "@/components/RiskCalculator";
import { TrendingUp, TrendingDown, Play, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { executeOnAccount, TradingAccount as BrokerAccount, TradeSignal } from "@/services/brokerExecution";

interface Signal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot_size: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  comment?: string | null;
  created_at: string;
}

interface TradingAccount {
  id: string;
  name: string;
  balance: number;
  metaapi_account_id: string | null;
  provider: string;
  deriv_token: string | null;
  deriv_currency: string | null;
  is_virtual: boolean | null;
  login: string;
}

export default function TradingIdeas() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [calculatedLotSize, setCalculatedLotSize] = useState<number>(0);
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
          .select('id,symbol,direction,lot_size,stop_loss,take_profit,comment,created_at')
          .order('created_at', { ascending: false });

        if (signalsError) throw signalsError;
        setSignals((signalsData || []) as Signal[]);

        // Load user's trading accounts with provider info
        const { data: accountsData, error: accountsError } = await supabase
          .from('trading_accounts')
          .select('id,name,balance,metaapi_account_id,provider,deriv_token,deriv_currency,is_virtual,login')
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

  const executeSignal = async () => {
    if (!selectedAccount || !selectedSignal) {
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
      const lotSize = calculatedLotSize > 0 ? calculatedLotSize : selectedSignal.lot_size;
      
      // Create the trade signal
      const signal: TradeSignal = {
        symbol: selectedSignal.symbol,
        direction: selectedSignal.direction,
        volume: lotSize,
        stopLoss: selectedSignal.stop_loss,
        takeProfit: selectedSignal.take_profit,
        comment: selectedSignal.comment || undefined,
      };
      
      // Create broker account object
      const brokerAccount: BrokerAccount = {
        id: account.id,
        name: account.name,
        login: account.login,
        provider: account.provider,
        metaapi_account_id: account.metaapi_account_id,
        deriv_token: account.deriv_token,
        deriv_currency: account.deriv_currency,
        is_virtual: account.is_virtual,
      };
      
      console.log('[TradingIdeas] Executing via unified broker service:', brokerAccount.provider);
      
      // Use the unified broker execution service
      const result = await executeOnAccount(brokerAccount, signal);
      
      if (!result.success) {
        throw new Error(result.error || 'Trade execution failed');
      }
      
      // Show success message based on provider
      if (result.provider === 'deriv') {
        toast({
          title: 'Trade Executed on Deriv',
          description: `${selectedSignal.direction} contract purchased! ${result.payout ? `Payout: $${result.payout.toFixed(2)}` : `Contract #${result.tradeId}`}`,
        });
      } else {
        toast({
          title: 'Trade Executed',
          description: `${selectedSignal.direction} ${lotSize} lots of ${selectedSignal.symbol} executed successfully`,
        });
      }
      
      setSelectedSignal(null);
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

  // Get provider badge for account
  const getProviderBadge = (account: TradingAccount) => {
    if (account.provider === 'deriv') {
      return (
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
          <Zap className="w-3 h-3 mr-1" />
          Deriv
        </Badge>
      );
    }
    if (account.metaapi_account_id) {
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
          MetaAPI
        </Badge>
      );
    }
    return <Badge variant="secondary" className="text-xs">No API</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Trading Ideas</h1>
          <p className="text-muted-foreground mt-2">
            View and execute active trading ideas
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
                      <div className="flex items-center gap-2">
                        {account.name}
                        {getProviderBadge(account)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        )}

        {signals.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-16">
            No active ideas at the moment. Check back later.
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
                <Dialog open={selectedSignal?.id === signal.id} onOpenChange={(open) => {
                  if (!open) {
                    setSelectedSignal(null);
                    setCalculatedLotSize(0);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button 
                      className="w-full bg-gradient-primary" 
                      disabled={accounts.length === 0}
                      onClick={() => setSelectedSignal(signal)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Execute Trade
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Execute Trading Idea</DialogTitle>
                      <DialogDescription>
                        {signal.direction} {signal.symbol} — Calculate optimal lot size based on your risk
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
                                <div className="flex items-center gap-2">
                                  {account.name} (${account.balance?.toFixed(2) || '0.00'})
                                  {getProviderBadge(account)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedAccount && signal.stop_loss && (
                        <div className="border-t pt-4">
                          <RiskCalculator
                            accountBalance={accounts.find(a => a.id === selectedAccount)?.balance || 0}
                            stopLossPips={50} // Simplified - would calculate from signal.stop_loss
                            onCalculate={setCalculatedLotSize}
                          />
                        </div>
                      )}

                      <div className="bg-accent/50 p-3 rounded-lg">
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Symbol:</span>
                            <span className="font-medium">{signal.symbol}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Direction:</span>
                            <span className="font-medium">{signal.direction}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Lot Size:</span>
                            <span className="font-medium">
                              {calculatedLotSize > 0 ? calculatedLotSize.toFixed(2) : signal.lot_size}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Button 
                        onClick={executeSignal} 
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
