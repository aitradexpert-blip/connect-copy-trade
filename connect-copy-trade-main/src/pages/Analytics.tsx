import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function Analytics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [balanceData, setBalanceData] = useState<any[]>([]);
  const [pairPerformance, setPairPerformance] = useState<any[]>([]);
  const [winLossData, setWinLossData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalTrades: 0,
    winRate: 0,
    totalProfitLoss: 0,
    averageTrade: 0
  });

  useEffect(() => {
    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Fetch all trade history
      const { data: trades, error } = await supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', user?.id)
        .order('executed_at', { ascending: true });

      if (error) throw error;

      if (!trades || trades.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate stats
      const totalTrades = trades.length;
      const winningTrades = trades.filter(t => t.profit_loss && t.profit_loss > 0).length;
      const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
      const totalProfitLoss = trades.reduce((sum, t) => sum + Number(t.profit_loss || 0), 0);
      const averageTrade = totalTrades > 0 ? totalProfitLoss / totalTrades : 0;

      setStats({
        totalTrades,
        winRate: Number(winRate.toFixed(2)),
        totalProfitLoss: Number(totalProfitLoss.toFixed(2)),
        averageTrade: Number(averageTrade.toFixed(2))
      });

      // Balance over time (cumulative P&L)
      let cumulativePL = 10000; // Starting balance
      const balanceHistory = trades.map((trade, index) => {
        cumulativePL += Number(trade.profit_loss || 0);
        return {
          date: new Date(trade.executed_at).toLocaleDateString(),
          balance: Number(cumulativePL.toFixed(2))
        };
      });
      setBalanceData(balanceHistory);

      // Performance by currency pair
      const pairMap = new Map();
      trades.forEach(trade => {
        const symbol = trade.symbol;
        if (!pairMap.has(symbol)) {
          pairMap.set(symbol, { symbol, profitLoss: 0, count: 0 });
        }
        const pair = pairMap.get(symbol);
        pair.profitLoss += Number(trade.profit_loss || 0);
        pair.count += 1;
      });
      const pairArray = Array.from(pairMap.values()).map(p => ({
        symbol: p.symbol,
        profitLoss: Number(p.profitLoss.toFixed(2)),
        trades: p.count
      }));
      setPairPerformance(pairArray);

      // Win/Loss distribution
      const closedTrades = trades.filter(t => t.status === 'closed' && t.profit_loss !== null);
      const wins = closedTrades.filter(t => t.profit_loss && t.profit_loss > 0).length;
      const losses = closedTrades.filter(t => t.profit_loss && t.profit_loss <= 0).length;
      setWinLossData([
        { name: 'Wins', value: wins, color: '#22c55e' },
        { name: 'Losses', value: losses, color: '#ef4444' }
      ]);

    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-muted-foreground">Track your trading performance and statistics</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Trades</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.totalTrades}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Win Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">{stats.winRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total P&L</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stats.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.totalProfitLoss}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Trade</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={`text-3xl font-bold ${stats.averageTrade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${stats.averageTrade}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Balance Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Account Balance Over Time</CardTitle>
            <CardDescription>Cumulative profit/loss progression</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="balance" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Win/Loss Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Win/Loss Distribution</CardTitle>
              <CardDescription>Closed trades only</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={winLossData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {winLossData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* P&L by Currency Pair */}
          <Card>
            <CardHeader>
              <CardTitle>P&L by Currency Pair</CardTitle>
              <CardDescription>Performance breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pairPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="symbol" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="profitLoss" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
