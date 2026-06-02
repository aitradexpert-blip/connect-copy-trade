import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, TrendingUp, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface CreditUsageRecord {
  id: string;
  service: string;
  credits_used: number;
  description: string;
  created_at: string;
}

export default function CreditUsage() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [usage, setUsage] = useState<CreditUsageRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCreditUsage();
    }
  }, [user]);

  const fetchCreditUsage = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('credit_usage')
        .select('*')
        .eq('user_id', user?.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setUsage(data || []);
    } catch (error) {
      console.error('Error fetching credit usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCreditsUsed = usage.reduce((sum, u) => sum + u.credits_used, 0);
  const estimatedCost = totalCreditsUsed * 0.001; // $0.001 per credit

  const usageByService = usage.reduce((acc, record) => {
    if (!acc[record.service]) {
      acc[record.service] = { total: 0, count: 0 };
    }
    acc[record.service].total += record.credits_used;
    acc[record.service].count += 1;
    return acc;
  }, {} as Record<string, { total: number; count: number }>);

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Credit Usage
          </h1>
          <p className="text-muted-foreground mt-2">
            Monitor your API and service usage over the last 30 days
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Credits Used (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCreditsUsed}</div>
              <div className="text-sm text-muted-foreground mt-1">
                ≈ ${estimatedCost.toFixed(2)} estimated cost
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Auto-Trades Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {subscription?.auto_trades_used || 0}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                of {subscription?.subscription_plans?.auto_trades_limit === -1 
                  ? '∞' 
                  : subscription?.subscription_plans?.auto_trades_limit || 0
                } this month
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={totalCreditsUsed > 800 ? 'destructive' : 'default'} className="text-base">
                {totalCreditsUsed > 800 ? (
                  <><AlertTriangle className="w-4 h-4 mr-1" /> High Usage</>
                ) : (
                  <><TrendingUp className="w-4 h-4 mr-1" /> Normal</>
                )}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Usage by Service */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Usage by Service</CardTitle>
            <CardDescription>Breakdown of your credit consumption</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Total Credits</TableHead>
                  <TableHead>API Calls</TableHead>
                  <TableHead>Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(usageByService).map(([service, data]) => (
                  <TableRow key={service}>
                    <TableCell className="font-medium capitalize">{service.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{data.total}</TableCell>
                    <TableCell>{data.count}</TableCell>
                    <TableCell>${(data.total * 0.001).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {Object.keys(usageByService).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No usage data available for the last 30 days
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Your latest API calls and service usage</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.slice(0, 20).map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium capitalize">
                      {record.service.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {record.description || 'API call'}
                    </TableCell>
                    <TableCell>{record.credits_used}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(record.created_at), 'MMM d, h:mm a')}
                    </TableCell>
                  </TableRow>
                ))}
                {usage.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No recent activity
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
