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
import { BookOpen, TrendingUp, TrendingDown, Loader2, BarChart3, Target, Clock, Sparkles, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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
  const { isFree, tierName } = useSubscription();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, TradeAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [analysing, setAnalysing] = useState<string | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [tradingPlan, setTradingPlan] = useState<string | null>(null);
  const [aiUsesThisSession, setAiUsesThisSession] = useState(0);

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

  const analyseTrade = async (trade: Trade) => {
    if (!canUseAI) {
      toast({ title: "Upgrade Required", description: `Free users get ${FREE_AI_LIMIT} AI analyses per session. Upgrade for unlimited access.`, variant: "destructive" });
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
      toast({ title: "Upgrade Required", description: `Free users get ${FREE_AI_LIMIT} AI uses per session. Upgrade for unlimited access.`, variant: "destructive" });
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
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><BookOpen className="h-8 w-8" />Trading Journal</h1>
          <p className="text-muted-foreground mt-1">
            {isFree ? `Manual trade logging • ${FREE_AI_LIMIT - aiUsesThisSession} AI analyses remaining` : 'AI-powered trade analysis and strategy building'}
          </p>
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
              <Lock className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="font-medium">Connect a broker to auto-log trades</p>
              <p className="text-sm text-muted-foreground mt-1 mb-3">Free users can manually log trades here. Upgrade to auto-sync from your connected accounts.</p>
              <Button variant="outline" size="sm" onClick={() => window.open('/subscription', '_self')}>View Plans</Button>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="journal">
          <TabsList><TabsTrigger value="journal">Trade Journal</TabsTrigger><TabsTrigger value="strategy">Strategy Builder</TabsTrigger></TabsList>

          <TabsContent value="journal" className="space-y-4">
            {trades.length === 0 ? (
              <Card className="bg-gradient-card border-border"><CardContent className="p-8 text-center"><BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" /><p className="text-lg font-medium">No trades yet</p><p className="text-muted-foreground">Connect your trading account to see your journal here.</p></CardContent></Card>
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
    </AppLayout>
  );
}
