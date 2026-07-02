import { useEffect, useState } from "react";
import {
  DollarSign, TrendingUp, Activity, Users, Plus, RefreshCw,
  ExternalLink, ArrowDown, ArrowUp, Clock, CreditCard,
  MessageCircle, Sparkles, Crown, Lightbulb, Copy, Bot, Building
} from "lucide-react";
import EnhancedVoiceAssistant from "@/components/EnhancedVoiceAssistant";
import EconomicCalendar from "@/components/EconomicCalendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import AppLayout from "@/components/AppLayout";
import { BrokerActionModal } from "@/components/BrokerActionModal";
import WhatsAppButton from "@/components/WhatsAppButton";
import NoticeBoard from "@/components/NoticeBoard";
import WelcomeModal from "@/components/WelcomeModal";
import KhumoForexSessions from "@/components/KhumoForexSessions";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { authorizeDerivAccount, getDerivBalance } from "@/services/derivBroker";
import { getSharedDerivWS } from "@/services/derivWebSocket";
import { primaryApi, isPrimaryConfigured } from "@/services/primaryApi";

interface TradeHistoryItem {
  id: string;
  symbol: string;
  direction: string;
  profit_loss: number | null;
  executed_at: string;
  source: 'deriv' | 'broker' | 'local' | 'vps';
}

interface LatestSignal {
  id: string;
  symbol: string;
  direction: string;
  open_price: number | null;
  take_profit: number | null;
  stop_loss: number | null;
  created_at: string;
}

const LatestSignalCard = () => {
  const [signal, setSignal] = useState<LatestSignal | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase
      .from('trading_signals')
      .select('id, symbol, direction, open_price, take_profit, stop_loss, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (data) setSignal(data as unknown as LatestSignal); });


    // Realtime: refresh when a new signal drops
    const channel = supabase
      .channel('dashboard-latest-signal')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trading_signals' },
        (payload) => setSignal(payload.new as LatestSignal)
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!signal) return null;
  const dir = (signal.direction || '').toUpperCase();

  return (
    <Card
      className="bg-gradient-card border-border shadow-card cursor-pointer hover:shadow-elevated transition-shadow"
      onClick={() => navigate('/ideas')}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="w-5 h-5 text-primary" />
            Latest Idea
          </CardTitle>
          <span className="text-xs text-muted-foreground">
            {new Date(signal.created_at).toLocaleDateString()}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-lg font-semibold">{signal.symbol}</span>
          <Badge variant={dir === 'BUY' ? 'default' : 'destructive'}>{dir}</Badge>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {signal.open_price != null && <span>Entry: <b className="text-foreground">{signal.open_price}</b></span>}
          {signal.take_profit != null && <span>TP: <b className="text-profit">{signal.take_profit}</b></span>}
          {signal.stop_loss != null && <span>SL: <b className="text-loss">{signal.stop_loss}</b></span>}
        </div>
        <p className="text-xs text-primary">View all ideas →</p>
      </CardContent>
    </Card>
  );
};

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFree, tierName, khumoQueriesRemaining, khumoQueryLimit } = useSubscription();
  const [referredBy, setReferredBy] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({ balance: 0, equity: 0, positions: 0, dailyPnL: 0 });
  const [loading, setLoading] = useState(true);
  const [brokerAction, setBrokerAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [displayName, setDisplayName] = useState('Trader');

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, referred_by').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.display_name) setDisplayName(data.display_name);
        if (data?.referred_by) setReferredBy(data.referred_by);
      });
  }, [user]);

  const loadAccountsAndMetrics = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: accounts, error } = await supabase
        .from("trading_accounts")
        .select("id,metaapi_account_id,balance,equity,provider,connection_type,deriv_token")
        .eq("user_id", user.id);
      if (error) throw error;

      let totalBalance = 0, totalEquity = 0, totalPositions = 0;
      const allTrades: TradeHistoryItem[] = [];

      for (const account of accounts || []) {
        try {
          // ── VPS first ────────────────────────────────────────────────
          if ((account.provider === 'vps' || account.connection_type === 'vps') && isPrimaryConfigured()) {
            try {
              const vpsAccount: any = await primaryApi.getAccount(account.id);
              const balance = Number(vpsAccount?.balance ?? account.balance ?? 0);
              const equity = Number(vpsAccount?.equity ?? account.equity ?? 0);
              let positions = 0;
              try {
                const vpsPositions: any = await primaryApi.getPositions(account.id);
                positions = Array.isArray(vpsPositions) ? vpsPositions.length
                  : Array.isArray(vpsPositions?.positions) ? vpsPositions.positions.length : 0;
              } catch { /* ignore */ }
              totalBalance += balance; totalEquity += equity; totalPositions += positions;
              await supabase.from('trading_accounts').update({ balance, equity }).eq('id', account.id);

              // VPS history
              try {
                const vpsHistory: any = await primaryApi.getHistory(account.id);
                const historyArr: any[] = Array.isArray(vpsHistory) ? vpsHistory
                  : Array.isArray(vpsHistory?.history) ? vpsHistory.history : [];
                allTrades.push(...historyArr.slice(0, 10).map((tx: any) => ({
                  id: `vps-${tx.ticket || tx.id || Math.random()}`,
                  symbol: tx.symbol || 'Unknown',
                  direction: (tx.type || tx.action || 'BUY').toString().toUpperCase().includes('BUY') ? 'BUY' : 'SELL',
                  profit_loss: Number(tx.profit ?? tx.profit_loss ?? 0),
                  executed_at: tx.open_time || tx.executed_at || new Date().toISOString(),
                  source: 'vps' as const,
                })));
              } catch { /* fall back to local */ }
              continue;
            } catch (vpsErr) {
              console.warn('VPS unavailable, using stored balance', vpsErr);
              totalBalance += Number(account.balance || 0);
              totalEquity += Number(account.equity || 0);
              continue;
            }
          }

          // ── Deriv ────────────────────────────────────────────────────
          if (account.provider === 'deriv' && account.deriv_token) {
            const ws = getSharedDerivWS();
            await ws.connect();
            await authorizeDerivAccount(account.deriv_token, ws);
            const balanceResponse = await getDerivBalance(ws);
            const balance = Number(balanceResponse.balance?.balance || 0);
            totalBalance += balance; totalEquity += balance;
            await supabase.from("trading_accounts").update({ balance, equity: balance }).eq("id", account.id);
            try {
              const profitResponse = await ws.send({ profit_table: 1, limit: 10, description: 1, sort: 'DESC' });
              if (profitResponse.profit_table?.transactions) {
                allTrades.push(...profitResponse.profit_table.transactions.map((tx: any) => ({
                  id: `deriv-${tx.transaction_id}`,
                  symbol: tx.shortcode?.split('_')[0] || 'Options',
                  direction: tx.buy_price > 0 ? 'BUY' : 'SELL',
                  profit_loss: tx.sell_price - tx.buy_price,
                  executed_at: new Date(tx.purchase_time * 1000).toISOString(),
                  source: 'deriv' as const,
                })));
              }
            } catch (err) { console.error('Deriv profit table:', err); }
            continue;
          }

          // ── MetaAPI account info (history removed — 502s from edge fn) ─
          if (account.metaapi_account_id) {
            const { data: info, error: fnError } = await supabase.functions.invoke(
              "metaapi-account-info", { body: { accountId: account.metaapi_account_id } }
            );
            if (!fnError && info) {
              const balance = Number(info.balance || 0), equity = Number(info.equity || 0);
              const { data: positionsData } = await supabase.functions.invoke(
                "metaapi-get-positions", { body: { accountId: account.metaapi_account_id } }
              );
              totalBalance += balance; totalEquity += equity;
              totalPositions += Array.isArray(positionsData?.positions) ? positionsData.positions.length : 0;
              await supabase.from("trading_accounts").update({ balance, equity }).eq("id", account.id);
            } else {
              totalBalance += Number(account.balance || 0);
              totalEquity += Number(account.equity || 0);
            }
            continue;
          }

          totalBalance += Number(account.balance || 0);
          totalEquity += Number(account.equity || 0);
        } catch (err) {
          console.warn('account load failed', err);
          totalBalance += Number(account.balance || 0);
          totalEquity += Number(account.equity || 0);
        }
      }

      const { data: localTrades } = await supabase
        .from('trade_history')
        .select('id, symbol, direction, profit_loss, executed_at')
        .eq('user_id', user.id).order('executed_at', { ascending: false }).limit(10);
      if (localTrades) allTrades.push(...localTrades.map(t => ({ ...t, source: 'local' as const })));

      allTrades.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
      setTradeHistory(allTrades.slice(0, 10));
      setMetrics({
        balance: totalBalance, equity: totalEquity,
        positions: totalPositions, dailyPnL: totalEquity - totalBalance,
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAccountsAndMetrics(); /* eslint-disable-next-line */ }, [user]);

  const dailyPnLType = metrics.dailyPnL >= 0 ? "profit" : "loss";
  const dailyPnLChange = `${metrics.dailyPnL >= 0 ? '+' : ''}${metrics.dailyPnL.toFixed(2)} USD today`;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-full overflow-x-hidden pb-20 md:pb-0">
        <NoticeBoard audience="all" />

        {/* Section A — Welcome */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Welcome back, {displayName}! 👋</h1>
            <p className="text-muted-foreground">
              {isFree
                ? "You're on the Free plan — explore your trading tools below."
                : `${tierName.charAt(0).toUpperCase() + tierName.slice(1)} plan active`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={loadAccountsAndMetrics} variant="outline" className="flex items-center gap-2" disabled={loading}>
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Section B — Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/accounts?connect=1')}
          >
            <Plus className="w-5 h-5" />
            <span className="text-xs">Add Account</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/copy-trading')}
          >
            <Copy className="w-5 h-5" />
            <span className="text-xs">Copy Trade</span>
          </Button>
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4"
            onClick={() => navigate('/ai-trading')}
          >
            <Bot className="w-5 h-5" />
            <span className="text-xs">Khumo AI</span>
          </Button>
        </div>

        {/* Section C — Latest Idea */}
        <LatestSignalCard />

        {/* Mentor shortcut */}
        {(referredBy || tierName === 'mentor') && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Crown className="w-6 h-6 text-primary" />
                <div>
                  <p className="font-semibold text-sm">
                    {tierName === 'mentor' ? 'Your Mentor Hub' : 'Your Mentor Center'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tierName === 'mentor' ? 'Manage clients, publish ideas' : "Access your mentor's dashboard"}
                  </p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(tierName === 'mentor' ? '/mentor-hub' : '/mentor-dashboard')}>
                Open
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section D — Community & Support */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-profit" />
              Community & Support
            </CardTitle>
            <CardDescription>Connect with our trading community</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <WhatsAppButton keyword="COMMUNITY" label="Join Support Community" description="500+ traders, daily discussion & mentorship" />
              <WhatsAppButton keyword="SIGNALS" label="Get Daily Signals" description="2–3 high-probability setups posted daily" />
              <WhatsAppButton keyword="EA" label="Claim Free Expert Advisor" description="R6,000 EA free with broker account + deposit" />
              <WhatsAppButton keyword="MENTOR" label="Join Free Mentorship" description="Weekly market previews, trade reviews & Q&A" />
            </div>
          </CardContent>
        </Card>

        {/* Section E — Metrics + Voice + History (paid) or Khumo demo (free) */}
        {!isFree ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              <MetricCard title="Total Balance" value={`$${metrics.balance.toFixed(2)}`} icon={DollarSign} />
              <MetricCard title="Total Equity" value={`$${metrics.equity.toFixed(2)}`} icon={TrendingUp} />
              <MetricCard title="Daily P&L" value={`$${metrics.dailyPnL.toFixed(2)}`} change={dailyPnLChange} changeType={dailyPnLType} icon={Activity} />
              <MetricCard title="Open Positions" value={metrics.positions.toString()} icon={Users} />
            </div>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Khumo AI Voice Assistant</CardTitle>
                <CardDescription>Ask about your balance, ideas, positions, and prepare trades.</CardDescription>
              </CardHeader>
              <CardContent><EnhancedVoiceAssistant /></CardContent>
            </Card>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Recent Trading Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {tradeHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No recent trades to display</p>
                    <p className="text-sm">Connect a trading account to see your history</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tradeHistory.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${trade.direction === 'BUY' ? 'bg-profit' : 'bg-loss'}`} />
                          <div>
                            <p className="font-medium text-sm">{trade.symbol}</p>
                            <p className="text-xs text-muted-foreground">{new Date(trade.executed_at).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={trade.direction === 'BUY' ? 'default' : 'destructive'} className="text-xs">{trade.direction}</Badge>
                          {trade.profit_loss !== null && (
                            <span className={`text-sm font-medium ${trade.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                              {trade.profit_loss >= 0 ? '+' : ''}{trade.profit_loss.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <>
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  Khumo AI Assistant
                  <Badge variant="secondary" className="ml-auto text-xs">{khumoQueriesRemaining}/{khumoQueryLimit} questions left</Badge>
                </CardTitle>
                <CardDescription>Ask Khumo about trading concepts, strategies, and market education.</CardDescription>
              </CardHeader>
              <CardContent><EnhancedVoiceAssistant /></CardContent>
            </Card>

            <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5">
              <CardContent className="p-6 text-center">
                <h3 className="text-lg font-bold text-foreground mb-2">Unlock the Full HuMi Experience</h3>
                <p className="text-sm text-muted-foreground mb-4">Multi-broker dashboard, one-click signal execution, AI auto-trading, copy trading, and more.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => navigate('/subscription')}><CreditCard className="w-4 h-4 mr-2" /> Upgrade from R178/mo</Button>
                  <Button variant="outline" onClick={() => navigate('/pricing')}>Compare Plans</Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Section F — Khumo Forex Sessions */}
        {!isFree && (
          <KhumoForexSessions
            compact
            onPublishIdea={(suggestion) => navigate('/ideas', { state: { prefill: suggestion } })}
          />
        )}

        {/* Section G — Deposit / Withdraw quick access (paid) */}
        {!isFree && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="w-5 h-5" /> Broker Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setBrokerAction('deposit')} variant="secondary" className="flex items-center gap-2"><ArrowDown className="w-4 h-4" />Deposit</Button>
                <Button onClick={() => setBrokerAction('withdraw')} variant="secondary" className="flex items-center gap-2"><ArrowUp className="w-4 h-4" />Withdraw</Button>
              </div>
              <BrokerActionModal open={!!brokerAction} onOpenChange={(open) => !open && setBrokerAction(null)} action={brokerAction || 'deposit'} />
            </CardContent>
          </Card>
        )}

        {/* Section H — Open a Broker Account */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="w-5 h-5" /> Open a Broker Account
            </CardTitle>
            <CardDescription>Start with as little as $25 (about R500)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Button variant="outline" onClick={() => window.open('https://go.primexbt.direct/visit/?bta=52274&brand=primexbt', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> PrimeXBT ★
              </Button>
              <Button variant="outline" onClick={() => window.open('https://octa.click/b3gtWBN3fii?ib=44960573', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> OctaFX
              </Button>
              <Button variant="outline" onClick={() => window.open('https://track.gowt.me/visit/?bta=70148&brand=weltrade', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> WelTrade
              </Button>
              <Button variant="outline" onClick={() => window.open('https://track.deriv.com/_8yTvQnk19iB0QQMXeD9If2Nd7ZgqdRLk/1/', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> Deriv
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Section I — Economic Calendar */}
        <EconomicCalendar compact={false} className="bg-gradient-card border-border shadow-card" />
      </div>
      <WelcomeModal />
    </AppLayout>
  );
};

export default Index;
