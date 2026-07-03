import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import AppLayout from "@/components/AppLayout";
import { LotSizeInput } from "@/components/ui/lot-size-input";
import { TrendingUp, TrendingDown, Play, Zap, AlertTriangle, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { executeOnAccount, TradingAccount as BrokerAccount, TradeSignal } from "@/services/brokerExecution";
import { useFreeTierGuard, FreeTierBanner } from "@/components/FreeTierGuard";
import { useSubscription } from "@/hooks/useSubscription";
import { Lock } from "lucide-react";

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
  connection_type?: string | null;
}

export default function TradingIdeas() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [manualLotSize, setManualLotSize] = useState<number>(0.01);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isFree } = useSubscription();

  // Calculate lot size from risk percentage
  const calculateLotFromRisk = (riskPct: number): number => {
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account || !account.balance || account.balance === 0) return 0.01;
    // Risk amount in account currency
    const riskAmount = account.balance * (riskPct / 100);
    // Estimate: $10 per pip per standard lot, ~50 pip average stop
    const estimatedRiskPerLot = 500; // $500 risk per 1.0 lot (50 pips * $10/pip)
    const calculatedLot = riskAmount / estimatedRiskPerLot;
    return Math.max(0.01, Math.min(10, Math.round(calculatedLot * 100) / 100));
  };

  // Calculate risk percentage from lot size
  const calculateRiskFromLot = (lotSize: number): number => {
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account || !account.balance || account.balance === 0) return 0;
    const estimatedRiskPerLot = 500;
    return Math.min(100, Math.round((lotSize * estimatedRiskPerLot / account.balance) * 100 * 10) / 10);
  };

  // Handle risk slider change → update lot size
  const handleRiskChange = (value: number[]) => {
    const newRisk = value[0];
    setRiskPercent(newRisk);
    const newLot = calculateLotFromRisk(newRisk);
    setManualLotSize(newLot);
  };

  // Handle lot size manual change → update risk gauge
  const handleLotSizeChange = (newLot: number) => {
    setManualLotSize(newLot);
    setRiskPercent(calculateRiskFromLot(newLot));
  };

  // Get risk color based on percentage
  const getRiskColor = (pct: number): string => {
    if (pct <= 2) return 'text-profit';
    if (pct <= 5) return 'text-amber-500';
    return 'text-loss';
  };

  const getRiskLabel = (pct: number): string => {
    if (pct <= 1) return 'Very Low';
    if (pct <= 2) return 'Low';
    if (pct <= 5) return 'Moderate';
    if (pct <= 10) return 'High';
    return 'Very High';
  };

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
          .select('id,name,balance,metaapi_account_id,provider,deriv_token,deriv_currency,is_virtual,login,connection_type')
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

    // Realtime: show new signals the moment a mentor publishes
    const channel = supabase
      .channel('trading-signals-live')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trading_signals',
      }, () => { load(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, toast]);

  const requirePaid = useFreeTierGuard();

  const executeSignal = async () => {
    if (!requirePaid("Executing trade ideas")) return;
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
      const lotSize = manualLotSize > 0 ? manualLotSize : selectedSignal.lot_size;
      
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
    if (account.provider === 'vps' || account.connection_type === 'vps') {
      return (
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
          VPS Direct
        </Badge>
      );
    }
    if (account.provider === 'deriv') {
      return (
        <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
          <Zap className="w-3 h-3 mr-1" />Deriv
        </Badge>
      );
    }
    if (account.metaapi_account_id || ['metaapi','mt4','mt5'].includes((account.provider || '').toLowerCase())) {
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
          MT4/MT5
        </Badge>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <FreeTierBanner feature="trade ideas" />
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
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-muted-foreground">Entry</div>
                    <div className="font-mono font-semibold">Market</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-muted-foreground">Stop Loss</div>
                    <div className="font-mono font-semibold text-loss">{signal.stop_loss ?? '—'}</div>
                  </div>
                  <div className="bg-muted/40 rounded p-2">
                    <div className="text-muted-foreground">Take Profit</div>
                    <div className="font-mono font-semibold text-profit">{signal.take_profit ?? '—'}</div>
                  </div>
                </div>
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
                    setManualLotSize(signal.lot_size || 0.01);
                    setRiskPercent(2);
                  } else {
                    const lot = signal.lot_size || 0.01;
                    setManualLotSize(lot);
                    setRiskPercent(calculateRiskFromLot(lot));
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full bg-gradient-primary"
                      disabled={accounts.length === 0 || isFree}
                      onClick={() => !isFree && setSelectedSignal(signal)}
                      title={isFree ? 'Upgrade to execute trades' : undefined}
                    >
                      {isFree ? (
                        <><Lock className="w-4 h-4 mr-2" /> Upgrade to Execute</>
                      ) : (
                        <><Play className="w-4 h-4 mr-2" /> Execute Trade</>
                      )}
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

                      {/* Risk Percentage Gauge */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="flex items-center gap-2">
                            <Gauge className="w-4 h-4" />
                            Risk Level
                          </Label>
                          <span className={`text-sm font-semibold ${getRiskColor(riskPercent)}`}>
                            {riskPercent.toFixed(1)}% — {getRiskLabel(riskPercent)}
                          </span>
                        </div>
                        <Slider
                          value={[riskPercent]}
                          onValueChange={handleRiskChange}
                          min={1}
                          max={100}
                          step={0.5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>1% (Safe)</span>
                          <span>50%</span>
                          <span>100% (Max)</span>
                        </div>
                      </div>

                      {/* Editable Lot Size */}
                      <div className="space-y-2">
                        <Label>Lot Size (editable)</Label>
                        <LotSizeInput
                          value={manualLotSize}
                          onChange={handleLotSizeChange}
                          min={0.01}
                          max={10}
                          step={0.01}
                        />
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Risking ~${((accounts.find(a => a.id === selectedAccount)?.balance || 0) * riskPercent / 100).toFixed(2)} of account balance
                        </p>
                      </div>

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
                            <span className="font-medium">{manualLotSize.toFixed(2)}</span>
                          </div>
                          {signal.stop_loss && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Stop Loss:</span>
                              <span className="font-medium">{signal.stop_loss}</span>
                            </div>
                          )}
                          {signal.take_profit && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Take Profit:</span>
                              <span className="font-medium">{signal.take_profit}</span>
                            </div>
                          )}
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
