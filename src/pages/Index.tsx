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
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("balance,equity")
        .eq("user_id", user.id);
      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }
      const balance = (data || []).reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
      const equity = (data || []).reduce((sum: number, a: any) => sum + Number(a.equity || 0), 0);
      setMetrics({ balance, equity, positions: 0, dailyPnL: 0 });
      setLoading(false);
    };
    load();
  }, [user]);

  const refreshData = async () => {
    // Re-run the loader to fetch live metrics
    if (!user) return;
    const { data, error } = await supabase
      .from("trading_accounts")
      .select("balance,equity")
      .eq("user_id", user.id);
    if (error) {
      console.error(error);
      return;
    }
    const balance = (data || []).reduce((sum: number, a: any) => sum + Number(a.balance || 0), 0);
    const equity = (data || []).reduce((sum: number, a: any) => sum + Number(a.equity || 0), 0);
    setMetrics((m) => ({ ...m, balance, equity }));
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