import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { LotSizeInput } from "@/components/ui/lot-size-input";
import { Home, Lightbulb, Bot, TrendingUp, TrendingDown, Play, Gauge, AlertTriangle } from "lucide-react";
import { useMentor } from "@/contexts/MentorContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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

interface Account {
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

interface MentorClientLayoutProps {
  children: React.ReactNode;
}

export default function MentorClientLayout({ children }: MentorClientLayoutProps) {
  const { mentorBrandName, mentorId, featureRenames, getFeatureName } = useMentor();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("home");
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [manualLotSize, setManualLotSize] = useState(0.01);
  const [riskPercent, setRiskPercent] = useState(2);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (user && mentorId) {
      loadMentorSignals();
      loadAccounts();
    }
  }, [user, mentorId]);

  const loadMentorSignals = async () => {
    const { data } = await supabase
      .from('trading_signals')
      .select('id,symbol,direction,lot_size,stop_loss,take_profit,comment,created_at')
      .or(`mentor_id.eq.${mentorId},mentor_id.is.null`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setSignals((data || []) as Signal[]);
  };

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('trading_accounts')
      .select('id,name,balance,metaapi_account_id,provider,deriv_token,deriv_currency,is_virtual,login')
      .eq('user_id', user.id);
    setAccounts(data || []);
  };

  const calculateLotFromRisk = (riskPct: number): number => {
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account || !account.balance) return 0.01;
    const riskAmount = account.balance * (riskPct / 100);
    return Math.max(0.01, Math.min(10, Math.round((riskAmount / 500) * 100) / 100));
  };

  const calculateRiskFromLot = (lotSize: number): number => {
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account || !account.balance) return 0;
    return Math.min(100, Math.round((lotSize * 500 / account.balance) * 100 * 10) / 10);
  };

  const executeSignal = async () => {
    if (!selectedAccount || !selectedSignal) return;
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account) return;

    setExecuting(true);
    try {
      const signal: TradeSignal = {
        symbol: selectedSignal.symbol,
        direction: selectedSignal.direction,
        volume: manualLotSize,
        stopLoss: selectedSignal.stop_loss,
        takeProfit: selectedSignal.take_profit,
        comment: selectedSignal.comment || undefined,
      };
      const brokerAccount: BrokerAccount = {
        id: account.id, name: account.name, login: account.login,
        provider: account.provider, metaapi_account_id: account.metaapi_account_id,
        deriv_token: account.deriv_token, deriv_currency: account.deriv_currency,
        is_virtual: account.is_virtual,
      };
      const result = await executeOnAccount(brokerAccount, signal);
      if (!result.success) throw new Error(result.error || 'Failed');
      toast({ title: 'Trade Executed', description: `${selectedSignal.direction} ${manualLotSize} lots of ${selectedSignal.symbol}` });
      setSelectedSignal(null);
    } catch (err: any) {
      toast({ title: 'Execution Failed', description: err.message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="secondary" className="text-xs">{mentorBrandName}</Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="home" className="flex items-center gap-1">
            <Home className="w-4 h-4" /> Home
          </TabsTrigger>
          <TabsTrigger value="ideas" className="flex items-center gap-1">
            <Lightbulb className="w-4 h-4" /> {getFeatureName('trading_ideas_name')}
          </TabsTrigger>
          <TabsTrigger value="bot" className="flex items-center gap-1">
            <Bot className="w-4 h-4" /> {getFeatureName('ai_bot_name')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="home">{children}</TabsContent>

        <TabsContent value="ideas" className="space-y-4">
          {accounts.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name} (${a.balance?.toFixed(2)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {signals.length === 0 && (
            <div className="text-center text-muted-foreground py-12">No active ideas from your mentor.</div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {signals.map(signal => (
              <Card key={signal.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">{signal.symbol}</h3>
                    <Badge className={signal.direction === 'BUY' ? 'bg-profit text-white' : 'bg-loss text-white'}>
                      {signal.direction === 'BUY' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                      {signal.direction}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground"><strong>Lots:</strong> {signal.lot_size}</div>
                  {signal.comment && <p className="text-sm">{signal.comment}</p>}
                  <div className="text-xs text-muted-foreground">{new Date(signal.created_at).toLocaleString()}</div>
                  <Dialog open={selectedSignal?.id === signal.id} onOpenChange={open => {
                    if (!open) setSelectedSignal(null);
                    else { setSelectedSignal(signal); setManualLotSize(signal.lot_size || 0.01); }
                  }}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-gradient-primary" disabled={!accounts.length} onClick={() => setSelectedSignal(signal)}>
                        <Play className="w-4 h-4 mr-2" /> Execute Trade
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Execute Trade</DialogTitle>
                        <DialogDescription>{signal.direction} {signal.symbol}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                          <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                          <SelectContent>
                            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="space-y-2">
                          <Label>Risk Level</Label>
                          <Slider value={[riskPercent]} onValueChange={v => { setRiskPercent(v[0]); setManualLotSize(calculateLotFromRisk(v[0])); }} min={1} max={100} step={0.5} />
                        </div>
                        <div className="space-y-2">
                          <Label>Lot Size</Label>
                          <LotSizeInput value={manualLotSize} onChange={v => { setManualLotSize(v); setRiskPercent(calculateRiskFromLot(v)); }} min={0.01} max={10} step={0.01} />
                        </div>
                        <Button onClick={executeSignal} disabled={!selectedAccount || executing} className="w-full bg-gradient-primary">
                          {executing ? 'Executing...' : 'Confirm Execute'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bot" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" /> {getFeatureName('ai_bot_name')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                The {getFeatureName('ai_bot_name')} automatically executes signals from your mentor's trading ideas.
                Visit the <a href="/ai-trading" className="text-primary hover:underline">AI Trading page</a> to configure and activate the bot.
              </p>
              <Button onClick={() => window.location.href = '/ai-trading'} className="bg-gradient-primary">
                <Bot className="w-4 h-4 mr-2" /> Open {getFeatureName('ai_bot_name')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
