import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  login: string;
  platform: string;
  provider: string;
  metaapi_account_id: string | null;
  connection_status: string | null;
  metaapi_health_status: string | null;
  metaapi_last_error: string | null;
  metaapi_health_checked_at: string | null;
  updated_at: string;
}

const statusVariant = (s?: string | null) => {
  switch ((s || "").toLowerCase()) {
    case "connected":
    case "healthy":
      return "default" as const;
    case "provisioning":
    case "deploying":
      return "secondary" as const;
    case "failed":
    case "error":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
};

export function MetaApiHealthTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [finalizingAll, setFinalizingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trading_accounts")
        .select("id,user_id,name,login,platform,provider,metaapi_account_id,connection_status,metaapi_health_status,metaapi_last_error,metaapi_health_checked_at,updated_at")
        .eq("provider", "metaapi")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as AccountRow[]);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const ping = async (row: AccountRow) => {
    if (!row.metaapi_account_id) return;
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("metaapi-account-info", {
        body: { accountId: row.metaapi_account_id },
      });
      if (error) throw error;
      const ok = data?.success !== false;
      await supabase.from("trading_accounts").update({
        metaapi_health_status: ok ? "healthy" : "error",
        metaapi_last_error: ok ? null : (data?.error || "unknown"),
        metaapi_health_checked_at: new Date().toISOString(),
      }).eq("id", row.id);
      toast({ title: ok ? "Healthy" : "Error", description: ok ? row.name : (data?.error || "Unhealthy"), variant: ok ? "default" : "destructive" });
      load();
    } catch (e: any) {
      toast({ title: "Ping failed", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const repair = async (row: AccountRow) => {
    if (!row.metaapi_account_id) return;
    setBusyId(row.id);
    try {
      const { data, error } = await supabase.functions.invoke("metaapi-redeploy-account", {
        body: { accountId: row.metaapi_account_id },
      });
      if (error) throw error;
      toast({ title: "Redeploy triggered", description: row.name });
      await supabase.from("trading_accounts").update({
        connection_status: "provisioning",
        metaapi_health_status: "deploying",
        metaapi_health_checked_at: new Date().toISOString(),
      }).eq("id", row.id);
      load();
    } catch (e: any) {
      toast({ title: "Repair failed", description: e.message, variant: "destructive" });
    } finally { setBusyId(null); }
  };

  const finalizeAll = async () => {
    setFinalizingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("metaapi-finalize-deployments", { body: {} });
      if (error) throw error;
      toast({ title: "Finalize complete", description: `${data?.processed || 0} pending account(s) checked.` });
      await load();
    } catch (e: any) {
      toast({ title: "Finalize failed", description: e.message, variant: "destructive" });
    } finally {
      setFinalizingAll(false);
    }
  };

  const healthy = rows.filter(r => r.metaapi_health_status === "healthy").length;
  const failed = rows.filter(r => ["failed", "error"].includes((r.metaapi_health_status || r.connection_status || "").toLowerCase())).length;

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2"><Activity className="w-5 h-5" /> MetaAPI Health & Repair</CardTitle>
          <CardDescription>Monitor MT4/MT5 connections and trigger redeploys for failed accounts.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">{healthy} healthy</Badge>
          {failed > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{failed} failed</Badge>}
          <Button size="sm" variant="outline" onClick={finalizeAll} disabled={finalizingAll || loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${finalizingAll ? "animate-spin" : ""}`} />
            {finalizingAll ? "Finalizing..." : "Finalize all pending"}
          </Button>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Login / Platform</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last Check</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div>{r.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">{r.metaapi_account_id || "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.login} <span className="text-muted-foreground">/ {r.platform}</span></TableCell>
                  <TableCell><Badge variant={statusVariant(r.connection_status)}>{r.connection_status || "unknown"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.metaapi_health_status)}>{r.metaapi_health_status || "unknown"}</Badge>
                    {r.metaapi_last_error && (
                      <div className="text-xs text-destructive mt-1 truncate max-w-[220px]" title={r.metaapi_last_error}>{r.metaapi_last_error}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.metaapi_health_checked_at ? new Date(r.metaapi_health_checked_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={!r.metaapi_account_id || busyId === r.id} onClick={() => ping(r)}>Ping</Button>
                      <Button size="sm" disabled={!r.metaapi_account_id || busyId === r.id} onClick={() => repair(r)}>Repair</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && !loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No MetaAPI accounts found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
