import { useState, useEffect } from "react";
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

const Index = () => {
  const [accountData, setAccountData] = useState({
    balance: 10500.50,
    equity: 10723.89,
    positions: [{}, {}, {}],
    dailyPnL: 223.39
  });

  const refreshData = () => {
    setAccountData({
      balance: Math.random() * 50000 + 10000,
      equity: Math.random() * 50000 + 10000,
      positions: Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => ({})),
      dailyPnL: (Math.random() - 0.5) * 2000
    });
  };

  const dailyPnLType = accountData.dailyPnL >= 0 ? "profit" : "loss";
  const dailyPnLChange = `${accountData.dailyPnL >= 0 ? '+' : ''}${accountData.dailyPnL.toFixed(2)} USD today`;

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your trading overview.</p>
          </div>
          <Button onClick={refreshData} variant="outline" className="flex items-center gap-2">
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
              <Button className="flex items-center gap-2 bg-gradient-primary">
                <Plus className="w-4 h-4" />
                Add Brokerage Account
              </Button>
              <Button variant="secondary" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                Subscribe Now
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                View Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Balance"
            value={`$${accountData.balance.toFixed(2)}`}
            icon={DollarSign}
          />
          <MetricCard
            title="Total Equity"
            value={`$${accountData.equity.toFixed(2)}`}
            icon={TrendingUp}
          />
          <MetricCard
            title="Daily P&L"
            value={`$${accountData.dailyPnL.toFixed(2)}`}
            change={dailyPnLChange}
            changeType={dailyPnLType}
            icon={Activity}
          />
          <MetricCard
            title="Open Positions"
            value={accountData.positions.length.toString()}
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
