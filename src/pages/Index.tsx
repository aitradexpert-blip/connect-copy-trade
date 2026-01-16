import { useEffect, useState } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Activity, 
  Users,
  Plus,
  Eye,
  Play,
  RefreshCw,
  Building,
  ExternalLink,
  Wallet,
  Send,
  ArrowDownUp,
  LineChart,
  ArrowDown,
  ArrowUp,
  Clock
} from "lucide-react";
import EnhancedVoiceAssistant from "@/components/EnhancedVoiceAssistant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/MetricCard";
import { SupportWidget } from "@/components/SupportWidget";
import AppLayout from "@/components/AppLayout";
import { BrokerActionModal } from "@/components/BrokerActionModal";

import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { authorizeDerivAccount, getDerivBalance } from "@/services/derivBroker";
import { getSharedDerivWS } from "@/services/derivWebSocket";

interface TradeHistoryItem {
  id: string;
  symbol: string;
  direction: string;
  profit_loss: number | null;
  executed_at: string;
  source: 'deriv' | 'metaapi' | 'local';
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    balance: 0,
    equity: 0,
    positions: 0,
    dailyPnL: 0,
  });
  const [loading, setLoading] = useState(true);
  const [hasDerivAccounts, setHasDerivAccounts] = useState(false);
  const [brokerAction, setBrokerAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        // Get all trading accounts for the user
        const { data: accounts, error } = await supabase
          .from("trading_accounts")
          .select("id,metaapi_account_id,balance,equity,provider,deriv_token")
          .eq("user_id", user.id);

        if (error) throw error;

        let totalBalance = 0;
        let totalEquity = 0;
        let totalPositions = 0;
        let hasDeriv = false;
        const allTrades: TradeHistoryItem[] = [];

        // Refresh each account's data
        for (const account of accounts || []) {
          try {
            if (account.provider === 'deriv' && account.deriv_token) {
              hasDeriv = true;
              // Refresh Deriv account
              const ws = getSharedDerivWS();
              await ws.connect();
              await authorizeDerivAccount(account.deriv_token, ws);
              const balanceResponse = await getDerivBalance(ws);
              const balance = Number(balanceResponse.balance?.balance || 0);
              
              totalBalance += balance;
              totalEquity += balance;
              
              // Update in database
              await supabase
                .from("trading_accounts")
                .update({ balance, equity: balance })
                .eq("id", account.id);

              // Fetch Deriv trade history (profit_table)
              try {
                const profitResponse = await ws.send({
                  profit_table: 1,
                  limit: 10,
                  description: 1,
                  sort: 'DESC'
                });
                
                if (profitResponse.profit_table?.transactions) {
                  const derivTrades = profitResponse.profit_table.transactions.map((tx: any) => ({
                    id: `deriv-${tx.transaction_id}`,
                    symbol: tx.shortcode?.split('_')[0] || tx.longcode?.substring(0, 10) || 'Options',
                    direction: tx.buy_price > 0 ? 'BUY' : 'SELL',
                    profit_loss: tx.sell_price - tx.buy_price,
                    executed_at: new Date(tx.purchase_time * 1000).toISOString(),
                    source: 'deriv' as const
                  }));
                  allTrades.push(...derivTrades);
                }
              } catch (err) {
                console.error('Error fetching Deriv profit table:', err);
              }
            } else if (account.metaapi_account_id) {
              // Refresh MetaAPI account
              const { data: info, error: fnError } = await supabase.functions.invoke(
                "metaapi-account-info",
                { body: { accountId: account.metaapi_account_id } }
              );

              if (!fnError && info) {
                const balance = Number(info.balance || 0);
                const equity = Number(info.equity || 0);
                
                const { data: positionsData } = await supabase.functions.invoke(
                  "metaapi-get-positions",
                  { body: { accountId: account.metaapi_account_id } }
                );
                const positions = Array.isArray(positionsData?.positions) ? positionsData.positions.length : 0;

                totalBalance += balance;
                totalEquity += equity;
                totalPositions += positions;

                await supabase
                  .from("trading_accounts")
                  .update({ balance, equity })
                  .eq("id", account.id);
              } else {
                totalBalance += Number(account.balance || 0);
                totalEquity += Number(account.equity || 0);
              }
            } else {
              totalBalance += Number(account.balance || 0);
              totalEquity += Number(account.equity || 0);
            }
          } catch (err) {
            totalBalance += Number(account.balance || 0);
            totalEquity += Number(account.equity || 0);
          }
        }

        // Also fetch local trade history from database
        const { data: localTrades } = await supabase
          .from('trade_history')
          .select('id, symbol, direction, profit_loss, executed_at')
          .eq('user_id', user.id)
          .order('executed_at', { ascending: false })
          .limit(10);

        if (localTrades) {
          const mappedLocalTrades = localTrades.map(t => ({
            ...t,
            source: 'local' as const
          }));
          allTrades.push(...mappedLocalTrades);
        }

        // Sort all trades by date and take top 10
        allTrades.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime());
        setTradeHistory(allTrades.slice(0, 10));

        setHasDerivAccounts(hasDeriv);
        const dailyPnL = totalEquity - totalBalance;

        setMetrics({
          balance: totalBalance,
          equity: totalEquity,
          positions: totalPositions,
          dailyPnL: dailyPnL,
        });
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const refreshData = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      const { data: accounts, error } = await supabase
        .from("trading_accounts")
        .select("id,metaapi_account_id,balance,equity,provider,deriv_token")
        .eq("user_id", user.id);

      if (error) throw error;

      let totalBalance = 0;
      let totalEquity = 0;
      let totalPositions = 0;

      for (const account of accounts || []) {
        try {
          if (account.provider === 'deriv' && account.deriv_token) {
            const ws = getSharedDerivWS();
            await ws.connect();
            await authorizeDerivAccount(account.deriv_token, ws);
            const balanceResponse = await getDerivBalance(ws);
            const balance = Number(balanceResponse.balance?.balance || 0);
            
            totalBalance += balance;
            totalEquity += balance;
            
            await supabase
              .from("trading_accounts")
              .update({ balance, equity: balance })
              .eq("id", account.id);
          } else if (account.metaapi_account_id) {
            const { data: info, error: fnError } = await supabase.functions.invoke(
              "metaapi-account-info",
              { body: { accountId: account.metaapi_account_id } }
            );

            if (!fnError && info) {
              const balance = Number(info.balance || 0);
              const equity = Number(info.equity || 0);
              
              const { data: positionsData } = await supabase.functions.invoke(
                "metaapi-get-positions",
                { body: { accountId: account.metaapi_account_id } }
              );
              const positions = Array.isArray(positionsData?.positions) ? positionsData.positions.length : 0;

              totalBalance += balance;
              totalEquity += equity;
              totalPositions += positions;

              await supabase
                .from("trading_accounts")
                .update({ balance, equity })
                .eq("id", account.id);
            } else {
              totalBalance += Number(account.balance || 0);
              totalEquity += Number(account.equity || 0);
            }
          } else {
            totalBalance += Number(account.balance || 0);
            totalEquity += Number(account.equity || 0);
          }
        } catch (err) {
          totalBalance += Number(account.balance || 0);
          totalEquity += Number(account.equity || 0);
        }
      }

      const dailyPnL = totalEquity - totalBalance;

      setMetrics({
        balance: totalBalance,
        equity: totalEquity,
        positions: totalPositions,
        dailyPnL: dailyPnL,
      });
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setLoading(false);
    }
  };

  const dailyPnLType = metrics.dailyPnL >= 0 ? "profit" : "loss";
  const dailyPnLChange = `${metrics.dailyPnL >= 0 ? '+' : ''}${metrics.dailyPnL.toFixed(2)} USD today`;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your trading overview.</p>
          </div>
          <Button onClick={refreshData} variant="outline" className="flex items-center gap-2" disabled={loading}>
            <RefreshCw className="w-4 h-4" />
            Refresh Data
          </Button>
        </div>

        {/* Broker Operations */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Broker Operations
            </CardTitle>
            <CardDescription>
              Open accounts with our affiliated brokers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button variant="outline" onClick={() => window.open('https://track.deriv.com/_8yTvQnk19iB0QQMXeD9If2Nd7ZgqdRLk/1/', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Deriv
              </Button>
              <Button variant="outline" onClick={() => window.open('https://octa.click/b3gtWBN3fii?ib=44960573', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                OctaFx
              </Button>
              <Button variant="outline" onClick={() => window.open('https://my.trade245.com/live_signup/?sidc=7A86688F-3777-49CD-8E69-ADBEA58A6220', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Trade245
              </Button>
              <Button variant="outline" onClick={() => window.open('https://one.exnesstrack.com/a/8gbs5isoe8', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Exness
              </Button>
              <Button variant="outline" onClick={() => window.open('https://secure.cwg-vu.com/#/signup/90105/F0/B0', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                CWG Markets
              </Button>
              <Button variant="outline" onClick={() => window.open('https://www.hfm.com/za/?refid=10377190', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                HFM
              </Button>
              <Button variant="outline" onClick={() => window.open('https://direct-fxpro.com/en/partner/NUN98hUc', '_blank')} className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                FXPro
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Market Charts Quick Access */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="w-5 h-5" />
              Market Charts
            </CardTitle>
            <CardDescription>
              View live market data for 170+ instruments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => navigate('/charts?symbol=EUR/USD')} variant="outline" size="sm">
                EUR/USD
              </Button>
              <Button onClick={() => navigate('/charts?symbol=XAU/USD')} variant="outline" size="sm">
                Gold
              </Button>
              <Button onClick={() => navigate('/charts?symbol=BTC/USD')} variant="outline" size="sm">
                Bitcoin
              </Button>
              <Button onClick={() => navigate('/charts?symbol=US30')} variant="outline" size="sm">
                US30
              </Button>
              <Button onClick={() => navigate('/charts')} className="bg-gradient-primary">
                <LineChart className="w-4 h-4 mr-2" />
                Open Charts
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Get started with your trading journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => navigate('/accounts?connect=1')} className="flex items-center gap-2 bg-gradient-primary">
                <Plus className="w-4 h-4" />
                Add Account
              </Button>
              <Button 
                onClick={() => setBrokerAction('deposit')} 
                variant="secondary" 
                className="flex items-center gap-2"
                title="Deposit to trading account"
              >
                <ArrowDown className="w-4 h-4" />
                Deposit
              </Button>
              <Button 
                onClick={() => setBrokerAction('withdraw')} 
                variant="secondary" 
                className="flex items-center gap-2"
                title="Withdraw from trading account"
              >
                <ArrowUp className="w-4 h-4" />
                Withdraw
              </Button>
              <Button onClick={() => navigate('/subscription')} variant="outline" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Subscribe
              </Button>
              <Button onClick={() => navigate('/ideas')} variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Ideas
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Broker Action Modal */}
        <BrokerActionModal
          open={!!brokerAction}
          onOpenChange={(open) => !open && setBrokerAction(null)}
          action={brokerAction || 'deposit'}
        />

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Balance"
            value={`$${metrics.balance.toFixed(2)}`}
            icon={DollarSign}
          />
          <MetricCard
            title="Total Equity"
            value={`$${metrics.equity.toFixed(2)}`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Daily P&L"
            value={`$${metrics.dailyPnL.toFixed(2)}`}
            change={dailyPnLChange}
            changeType={dailyPnLType}
            icon={Activity}
          />
          <MetricCard
            title="Open Positions"
            value={metrics.positions.toString()}
            icon={Users}
          />
        </div>

        {/* Crypto Wallet Actions */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Crypto Wallet
            </CardTitle>
            <CardDescription>Manage your crypto holdings and transfers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => navigate('/wallet')} variant="outline" className="flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                View Wallet
              </Button>
              <Button onClick={() => navigate('/wallet?action=transfer')} variant="outline" className="flex items-center gap-2">
                <Send className="w-4 h-4" />
                Transfer Funds
              </Button>
              <Button onClick={() => navigate('/wallet?action=exchange')} variant="outline" className="flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4" />
                Exchange Crypto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* HuMi Voice Assistant */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle>HuMi Voice Assistant</CardTitle>
            <CardDescription>
              Ask about your balance, ideas, positions, and prepare trades (no advice).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedVoiceAssistant />
          </CardContent>
        </Card>

        {/* Recent Trading Activity */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Trading Activity
            </CardTitle>
            <CardDescription>
              Your latest trades from connected accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tradeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent trades to display</p>
                <p className="text-sm">Connect a trading account and execute trades to see your history</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tradeHistory.map((trade) => (
                  <div 
                    key={trade.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${trade.direction === 'BUY' ? 'bg-profit' : 'bg-loss'}`} />
                      <div>
                        <p className="font-medium text-sm">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(trade.executed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={trade.direction === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {trade.direction}
                      </Badge>
                      {trade.profit_loss !== null && (
                        <span className={`text-sm font-medium ${trade.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {trade.profit_loss >= 0 ? '+' : ''}{trade.profit_loss.toFixed(2)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {trade.source}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support Widget */}
        <SupportWidget />
      </div>

    </AppLayout>
  );
};

export default Index;