import { useEffect, useState } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  Activity, 
  Users,
  Plus,
  Eye,
  Play,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/MetricCard";
import AppLayout from "@/components/AppLayout";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        // Get all trading accounts for the user
        const { data: accounts, error } = await supabase
          .from("trading_accounts")
          .select("id,metaapi_account_id,balance,equity")
          .eq("user_id", user.id);

        if (error) throw error;

        let totalBalance = 0;
        let totalEquity = 0;
        let totalPositions = 0;

        // Refresh each account's data from MetaAPI
        for (const account of accounts || []) {
          try {
            const { data: info, error: fnError } = await supabase.functions.invoke(
              "metaapi-account-info",
              { body: { accountId: account.metaapi_account_id } }
            );

            if (!fnError && info) {
              const balance = Number(info.balance || 0);
              const equity = Number(info.equity || 0);
              
              // Get positions count from MetaAPI positions endpoint
              const { data: positionsData } = await supabase.functions.invoke(
                "metaapi-get-positions",
                { body: { accountId: account.metaapi_account_id } }
              );
              const positions = Array.isArray(positionsData?.positions) ? positionsData.positions.length : 0;

              totalBalance += balance;
              totalEquity += equity;
              totalPositions += positions;

              // Update the account in the database
              await supabase
                .from("trading_accounts")
                .update({ balance, equity })
                .eq("id", account.id);
            } else {
              // Use cached values if API fails
              totalBalance += Number(account.balance || 0);
              totalEquity += Number(account.equity || 0);
            }
          } catch (err) {
            // Use cached values if API fails
            totalBalance += Number(account.balance || 0);
            totalEquity += Number(account.equity || 0);
          }
        }

        // Calculate daily P&L (simplified - difference between equity and balance)
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
      // Get all trading accounts for the user
      const { data: accounts, error } = await supabase
        .from("trading_accounts")
        .select("id,metaapi_account_id,balance,equity")
        .eq("user_id", user.id);

      if (error) throw error;

      let totalBalance = 0;
      let totalEquity = 0;
      let totalPositions = 0;

      // Refresh each account's data from MetaAPI
      for (const account of accounts || []) {
        try {
          const { data: info, error: fnError } = await supabase.functions.invoke(
            "metaapi-account-info",
            { body: { accountId: account.metaapi_account_id } }
          );

          if (!fnError && info) {
            const balance = Number(info.balance || 0);
            const equity = Number(info.equity || 0);
            
            // Get positions count from MetaAPI positions endpoint
            const { data: positionsData } = await supabase.functions.invoke(
              "metaapi-get-positions",
              { body: { accountId: account.metaapi_account_id } }
            );
            const positions = Array.isArray(positionsData?.positions) ? positionsData.positions.length : 0;

            totalBalance += balance;
            totalEquity += equity;
            totalPositions += positions;

            // Update the account in the database
            await supabase
              .from("trading_accounts")
              .update({ balance, equity })
              .eq("id", account.id);
          } else {
            // Use cached values if API fails
            totalBalance += Number(account.balance || 0);
            totalEquity += Number(account.equity || 0);
          }
        } catch (err) {
          // Use cached values if API fails
          totalBalance += Number(account.balance || 0);
          totalEquity += Number(account.equity || 0);
        }
      }

      // Calculate daily P&L (simplified - difference between equity and balance)
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
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={() => navigate('/accounts?connect=1')} className="flex items-center gap-2 bg-gradient-primary">
                <Plus className="w-4 h-4" />
                Add Brokerage Account
              </Button>
              <Button onClick={() => navigate('/subscription')} variant="secondary" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Subscribe Now
              </Button>
              <Button onClick={() => navigate('/signals')} variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Signals
              </Button>
            </div>
          </CardContent>
        </Card>

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

        {/* Recent Activity */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>
              Your latest trading activities and notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent activity to display</p>
              <p className="text-sm">Connect a trading account to see your activity here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Index;