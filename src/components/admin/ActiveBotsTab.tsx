import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Bot, Zap } from "lucide-react";

interface BotAssignment {
  id: string;
  status: string;
  auto_execute: boolean | null;
  executed_at: string | null;
  created_at: string;
  user_id: string;
  trading_account: {
    name: string | null;
    login: string | null;
    balance: number | null;
    platform: string | null;
    connection_status: string | null;
  } | null;
  bot: { bot_name: string | null } | null;
}

export function ActiveBotsTab() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<BotAssignment[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_bot_assignments")
      .select(
        "id, status, auto_execute, executed_at, created_at, user_id, trading_account:trading_accounts(name, login, balance, platform, connection_status), bot:ai_bots(bot_name)"
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows = (data as unknown as BotAssignment[]) || [];
    setAssignments(rows);

    // Fetch display names for the involved users (no FK join available)
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        if (p.display_name) map[p.user_id] = p.display_name;
      });
      setProfileNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const activeCount = assignments.filter((a) => a.status === "active").length;
  const autoExecCount = assignments.filter((a) => a.status === "active" && a.auto_execute).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Bot className="w-4 h-4" /> Active Bots
            </CardDescription>
            <CardTitle className="text-3xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Zap className="w-4 h-4" /> Auto-Execute On
            </CardDescription>
            <CardTitle className="text-3xl">{autoExecCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2">
            <CardDescription>Total Assignments</CardDescription>
            <CardTitle className="text-3xl">{assignments.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>AI Bot Activations</CardTitle>
            <CardDescription>Users who currently have the AI trading bot assigned to an account</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : assignments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No AI bot activations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Bot</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Auto-Execute</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Last Executed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">
                        {profileNames[a.user_id] || `${a.user_id.slice(0, 8)}...`}
                      </TableCell>
                      <TableCell>
                        {a.trading_account?.name || "-"}
                        {a.trading_account?.login ? (
                          <span className="text-xs text-muted-foreground block">
                            #{a.trading_account.login} · {a.trading_account.platform?.toUpperCase() || ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{a.bot?.bot_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === "active" ? "default" : "secondary"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {a.auto_execute ? (
                          <Badge className="bg-profit/15 text-profit border-profit/30">On</Badge>
                        ) : (
                          <Badge variant="secondary">Off</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {typeof a.trading_account?.balance === "number"
                          ? a.trading_account.balance.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.executed_at ? new Date(a.executed_at).toLocaleString() : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
