import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, TrendingUp, TrendingDown, Loader2, BarChart3, Target, Clock, Sparkles, Lock, Plus, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface Trade {
  id: string; symbol: string; direction: string; volume: number;
  entry_price: number | null; exit_price: number | null; profit_loss: number | null;
  status: string; executed_at: string; closed_at: string | null; comment: string | null;
}

interface TradeAnalysis {
  trade_id: string; ai_analysis: string; strategy_detected: string | null;
}

const FREE_AI_LIMIT = 3;

export default function Journal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isFree, tierName } = useSubscription();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, TradeAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [tradingPlan, setTradingPlan] = useState<string | null>(null);
  const [aiUsesThisSession, setAiUsesThisSession] = useState(0);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [savingTrade, setSavingTrade] = useState(false);

  // Manual entry form
  const [manualSymbol, setManualSymbol] = useState("");
  const [manualDirection, setManualDirection] = useState("BUY");
  const [manualVolume, setManualVolume] = useState("0.01");
  const [manualEntry, setManualEntry] = useState("");
  const [manualExit, setManualExit] = useState("");
  const [manualSL, setManualSL] = useState("");
  const [manualTP, setManualTP] = useState("");
  const [manualComment, setManualComment] = useState("");
  const [manualStatus, setManualStatus] = useState("closed");

  const [instruments, setInstruments] = useState("");
  const [riskTolerance, setRiskTolerance] = useState("medium");
  const [timeAvailability, setTimeAvailability] = useState("");
  const [goal, setGoal] = useState("");

  useEffect(() => { if (user) loadData(); }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tradeData } = await supabase.from('trade_history').select('*').eq('user_id', user!.id).order('executed_at', { ascending: false }).limit(50);
      setTrades(tradeData || []);
      const { data: analysisData } = await supabase.from('trade_analysis').select('trade_id, ai_analysis, strategy_detected').eq('user_id', user!.id);
      const analysisMap: Record<string, TradeAnalysis> = {};
      (analysisData || []).forEach(a => { analysisMap[a.trade_id] = a; });
      setAnalyses(analysisMap);
    } catch (err) { console.error("Error loading journal data:", err); }
    finally { setLoading(false); }
  };

  const canUseAI = !isFree || aiUsesThisSession < FREE_AI_LIMIT;

  const handleManualSave = async () => {
    if (!user || !manualSymbol) {
      toast({ title: "Please fill in symbol", variant: "destructive" });
      return;
    }
    setSavingTrade(true);
    try {
      // We need a trading_account_id — use a placeholder "manual" account or find existing
      let accountId: string;
      const { data: existingAccounts } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (existingAccounts && existingAccounts.length > 0) {
        accountId = existingAccounts[0].id;
      } else {
        // Create a manual journal account
        const { data: newAccount, error: accErr } = await supabase
          .from('trading_accounts')
          .insert({
            user_id: user.id,
            name: 'Manual Journal',
            login: 'manual',
            server: 'manual',
            platform: 'manual',
            provider: 'manual',
            connection_type: 'manual',
            connection_status: 'connected',
          })
          .select('id')
          .single();
        if (accErr) throw accErr;
        accountId = newAccount.id;
      }

      const entryPrice = manualEntry ? parseFloat(manualEntry) : null;
      const exitPrice = manualExit ? parseFloat(manualExit) : null;
      const volume = parseFloat(manualVolume) || 0.01;
      let profitLoss: number | null = null;

      if (entryPrice && exitPrice) {
        const pipDiff = manualDirection === 'BUY'
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;
        profitLoss = parseFloat((pipDiff * volume * 100000).toFixed(2));
        // For symbols like Gold, indices — this is an approximation
        if (manualSymbol.toUpperCase().includes('XAU') || manualSymbol.toUpperCase().includes('GOLD')) {
          profitLoss = parseFloat((pipDiff * volume * 100).toFixed(2));
        }
      }

      const { error } = await supabase.from('trade_history').insert({
        user_id: user.id,
        trading_account_id: accountId,
        symbol: manualSymbol.toUpperCase(),
        direction: manualDirection,
        volume,
        entry_price: entryPrice,
        exit_price: exitPrice,
        stop_loss: manualSL ? parseFloat(manualSL) : null,
        take_profit: manualTP ? parseFloat(manualTP) : null,
        profit_loss: profitLoss,
        status: manualStatus,
        comment: manualComment || null,
        closed_at: manualStatus === 'closed' ? new Date().toISOString() : null,
      });

      if (error) throw error;

      toast({ title: "Trade logged!", description: `${manualDirection} ${manualSymbol} added to journal.` });
      setShowManualEntry(false);
      resetManualForm();
      loadData();
    } catch (err: any) {
      toast({ title: "Failed to save trade", description: err.message, variant: "destructive" });
    } finally { setSavingTrade(false); }
  };

  const resetManualForm = () => {
    setManualSymbol(""); setManualDirection("BUY"); setManualVolume("0.01");
    setManualEntry(""); setManualExit(""); setManualSL(""); setManualTP("");
    setManualComment(""); setManualStatus("closed");
  };

  const analyseTrade = async (trade: Trade) => {
    if (!canUseAI) {
      setShowUpgradeDialog(true);
      return;
    }
    setAnalysing(trade.id);
    try {
      const { data, error } = await supabase.functions.invoke('journal-analyze-trade', { body: { trade_id: trade.id, user_id: user!.id, trade_data: trade } });
      if (data?.analysis) {
        setAnalyses(prev => ({ ...prev, [trade.id]: { trade_id: trade.id, ai_analysis: data.analysis, strategy_detected: data.strategy_detected } }));
        if (isFree) setAiUsesThisSession(prev => prev + 1);
        toast({ title: "Trade analysed!", description: "AI analysis added to your journal." });
      }
    } catch (err: any) { toast({ title: "Analysis failed", description: err.message, variant: "destructive" }); }
    finally { setAnalysing(null); }
  };

  const generateTradingPlan = async () => {
    if (!canUseAI) {
      setShowUpgradeDialog(true);
      return;
    }
    setGeneratingPlan(true);
    try {
      const { data } = await supabase.functions.invoke('khumo-chat', {
        body: { user_id: user!.id, message: `Generate a personalised trading plan for me based on my preferences:\n- Preferred instruments: ${instruments || 'Any'}\n- Risk tolerance: ${riskTolerance}\n- Time availability: ${timeAvailability || 'Flexible'}\n- Goal: ${goal || 'Consistent growth'}\n\nPlease create a structured, actionable plan with: entry rules, exit rules, risk per trade, suggested strategy, and a daily routine.`, context: 'strategy_builder' }
      });
      if (data?.text) {
        setTradingPlan(data.text);
        if (isFree) setAiUsesThisSession(prev => prev + 1);
      }
      if (data?.limitReached) {
        toast({ title: "Query Limit Reached", description: data.text, variant: "destructive" });
      }
    } catch (err: any) { toast({ title: "Plan generation failed", description: err.message, variant: "destructive" }); }
    finally { setGeneratingPlan(false); }
  };

  const closedTrades = trades.filter(t => t.status === 'closed' && t.profit_loss !== null);
  const winningTrades = closedTrades.filter(t => (t.profit_loss || 0) > 0);
  const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : '0';
  const totalPnL = closedTrades.reduce((s, t) => s + (t.profit_loss || 0), 0);
  const losingTrades = closedTrades.filter(t => (t.profit_loss || 0) < 0);
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + (t.profit_loss || 0), 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + (t.profit_loss || 0), 0) / losingTrades.length) : 0;
  const rr = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A';

  if (loading) return <AppLayout><div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-8 w-8" />Trading Journal</h1>
            <p className="text-muted-foreground mt-1">
              {isFree ? `Manual trade logging • ${FREE_AI_LIMIT - aiUsesThisSession} AI analyses remaining` : 'AI-powered trade analysis and strategy building'}
            </p>
          </div>
          <Button onClick={() => setShowManualEntry(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Log Trade
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border"><CardContent className="p-4 text-center"><BarChart3 className="h-6 w-6 mx-auto text-primary mb-1" /><div className="text-xl font-bold">{closedTrades.length}</div><div className="text-xs text-muted-foreground">Closed Trades</div></CardContent></Card>
          <Card className="bg-gradient-card border-border"><CardContent className="p-4 text-center"><Target className="h-6 w-6 mx-auto text-primary mb-1" /><div className="text-xl font-bold">{winRate}%</div><div className="text-xs text-muted-foreground">Win Rate</div></CardContent></Card>
          <Card className="bg-gradient-card border-border"><CardContent className="p-4 text-center"><div className={`text-xl font-bold ${totalPnL >= 0 ? 'text-profit' : 'text-loss'}`}>${totalPnL.toFixed(2)}</div><div className="text-xs text-muted-foreground">Total P&L</div></CardContent></Card>
          <Card className="bg-gradient-card border-border"><CardContent className="p-4 text-center"><div className="text-xl font-bold">{rr}</div><div className="text-xs text-muted-foreground">Avg R:R</div></CardContent></Card>
        </div>

        {/* Free user: connect prompt */}
        {isFree && trades.length === 0 && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <BookOpen className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium">Start logging your trades</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">
                Tap "Log Trade" above to manually record your first trade. Upgrade to auto-sync from connected broker accounts.
              </p>
              <div className="flex gap-2 justify-center">
                <Button size="sm" onClick={() => setShowManualEntry(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Log First Trade
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/subscription')}>View Plans</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="journal">
          <TabsList><TabsTrigger value="journal">Trade Journal</TabsTrigger><TabsTrigger value="strategy">Strategy Builder</TabsTrigger></TabsList>

          <TabsContent value="journal" className="space-y-4">
            {trades.length === 0 ? (
              <Card className="bg-gradient-card border-border"><CardContent className="p-8 text-center"><BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-lg font-medium">No trades yet</p><p className="text-muted-foreground">Use the "Log Trade" button to start recording your trades manually.</p></CardContent></Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="space-y-3">
                  {trades.map(trade => {
                    const analysis = analyses[trade.id];
                    const isProfitable = (trade.profit_loss || 0) > 0;
                    return (
                      <Card key={trade.id} className="bg-gradient-card border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {trade.direction === 'BUY' ? <TrendingUp className="h-4 w-4 text-profit" /> : <TrendingDown className="h-4 w-4 text-loss" />}
                              <span className="font-medium">{trade.direction} {trade.volume} {trade.symbol}</span>
                              <Badge variant={trade.status === 'open' ? 'default' : 'secondary'}>{trade.status}</Badge>
                            </div>
                            {trade.profit_loss !== null && <span className={`font-bold ${isProfitable ? 'text-profit' : 'text-loss'}`}>{isProfitable ? '+' : ''}${trade.profit_loss.toFixed(2)}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-4 mb-2">
                            <span>Entry: {trade.entry_price || 'N/A'}</span><span>Exit: {trade.exit_price || 'N/A'}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(trade.executed_at).toLocaleDateString()}</span>
                          </div>
                          {trade.comment && <p className="text-xs text-muted-foreground italic mb-2">"{trade.comment}"</p>}
                          {analysis ? (
                            <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-1 mb-1">
                                <Sparkles className="h-3 w-3 text-primary" /><span className="text-xs font-medium text-primary">Khumo Analysis</span>
                                {analysis.strategy_detected && <Badge variant="outline" className="ml-auto text-xs">{analysis.strategy_detected}</Badge>}
                              </div>
                              <p className="text-sm">{analysis.ai_analysis}</p>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => analyseTrade(trade)} disabled={analysing === trade.id || !canUseAI} className="mt-2">
                              {analysing === trade.id ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Analysing...</> : !canUseAI ? <><Lock className="h-3 w-3 mr-1" /> Upgrade for AI</> : <><Sparkles className="h-3 w-3 mr-1" /> Analyse with AI</>}
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="strategy" className="space-y-4">
            <Card className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Interactive Strategy Builder</CardTitle>
                <CardDescription>Tell Khumo about your preferences and get a personalised trading plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Preferred Instruments</Label><Input value={instruments} onChange={e => setInstruments(e.target.value)} placeholder="e.g., EUR/USD, Gold, NAS100" /></div>
                  <div className="space-y-2"><Label>Risk Tolerance</Label><Select value={riskTolerance} onValueChange={setRiskTolerance}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low (1% per trade)</SelectItem><SelectItem value="medium">Medium (2% per trade)</SelectItem><SelectItem value="high">High (3-5% per trade)</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Time Availability</Label><Input value={timeAvailability} onChange={e => setTimeAvailability(e.target.value)} placeholder="e.g., 2 hours per day" /></div>
                  <div className="space-y-2"><Label>Trading Goal</Label><Input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g., Grow account 10% monthly" /></div>
                </div>
                <Button onClick={generateTradingPlan} disabled={generatingPlan || !canUseAI} className="w-full">
                  {generatingPlan ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Crafting plan...</> : !canUseAI ? <><Lock className="mr-2 h-4 w-4" /> Upgrade for AI Strategy Builder</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Trading Plan</>}
                </Button>
                {tradingPlan && (
                  <Card className="bg-muted/50"><CardContent className="p-4"><h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Your Personalised Trading Plan</h3><div className="text-sm whitespace-pre-wrap">{tradingPlan}</div></CardContent></Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual Trade Entry Dialog */}
      <Dialog open={showManualEntry} onOpenChange={setShowManualEntry}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Log Trade</DialogTitle>
            <DialogDescription>Manually record a trade in your journal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Symbol *</Label>
                <Input value={manualSymbol} onChange={e => setManualSymbol(e.target.value)} placeholder="e.g. EUR/USD" />
              </div>
              <div className="space-y-1.5">
                <Label>Direction</Label>
                <Select value={manualDirection} onValueChange={setManualDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUY">BUY</SelectItem>
                    <SelectItem value="SELL">SELL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Lot Size</Label>
                <Input type="number" step="0.01" value={manualVolume} onChange={e => setManualVolume(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Entry Price</Label>
                <Input type="number" step="any" value={manualEntry} onChange={e => setManualEntry(e.target.value)} placeholder="1.0850" />
              </div>
              <div className="space-y-1.5">
                <Label>Exit Price</Label>
                <Input type="number" step="any" value={manualExit} onChange={e => setManualExit(e.target.value)} placeholder="1.0900" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Stop Loss</Label>
                <Input type="number" step="any" value={manualSL} onChange={e => setManualSL(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label>Take Profit</Label>
                <Input type="number" step="any" value={manualTP} onChange={e => setManualTP(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={manualComment} onChange={e => setManualComment(e.target.value)} placeholder="Why did you take this trade? What was your setup?" rows={2} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowManualEntry(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleManualSave} disabled={savingTrade || !manualSymbol} className="flex-1">
                {savingTrade ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Trade'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade Required Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> Upgrade Required</DialogTitle>
            <DialogDescription>
              You've used all {FREE_AI_LIMIT} free AI analyses for this session.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Upgrade your plan to unlock unlimited AI trade analysis, strategy building, and auto-synced journal from connected brokers.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)} className="flex-1">Maybe Later</Button>
              <Button onClick={() => { setShowUpgradeDialog(false); navigate('/subscription'); }} className="flex-1">
                <Zap className="w-4 h-4 mr-2" /> View Plans
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
