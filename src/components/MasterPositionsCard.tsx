import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, XCircle } from "lucide-react";

interface MasterPosition {
  id: string;
  master_account_id: string;
  ticket: string;
  symbol: string;
  direction: string;
  volume: number | null;
  open_price: number | null;
  current_profit: number | null;
  origin: string;
}

export default function MasterPositionsCard({ masterAccountIds }: { masterAccountIds: string[] }) {
  const { toast } = useToast();
  const [positions, setPositions] = useState<MasterPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState<string | null>(null);
  const key = masterAccountIds.join(",");

  const load = useCallback(async () => {
    if (!masterAccountIds.length) { setPositions([]); return; }
    const { data } = await supabase
      .from("master_positions")
      .select("id, master_account_id, ticket, symbol, direction, volume, open_price, current_profit, origin")
      .in("master_account_id", masterAccountIds)
      .eq("status", "open")
      .order("first_seen_at", { ascending: false });
    setPositions((data as MasterPosition[]) || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refresh = async () => {
    setLoading(true);
    try {
      for (const id of masterAccountIds) {
        await supabase.functions.invoke("master-position-sync", { body: { mode: "sync", account_id: id } });
      }
      await load();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const closeTrade = async (p: MasterPosition) => {
    if (!confirm(`Close ${p.direction} ${p.symbol} (#${p.ticket}) on your account and every follower?`)) return;
    setClosing(p.id);
    try {
      const { data, error } = await supabase.functions.invoke("master-position-sync", {
        body: { mode: "close", account_id: p.master_account_id, ticket: p.ticket },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Close failed");
      const f = data.followers || { closed: 0, failed: 0 };
      toast({
        title: "Trade closed",
        description: `Your trade is closed. Followers closed: ${f.closed}${f.failed ? `, failed: ${f.failed}` : ""}.`,
        variant: f.failed ? "destructive" : undefined,
      });
      load();
    } catch (e: any) {
      toast({ title: "Could not close trade", description: e.message, variant: "destructive" });
    } finally {
      setClosing(null);
    }
  };

  if (!masterAccountIds.length) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle>Active Master Positions</CardTitle>
          <CardDescription>Closing here, in MT5 mobile or on the terminal closes it for all followers</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="min-h-11">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {positions.length === 0 && <p className="text-sm text-muted-foreground">No open trades on your Master account.</p>}
        {positions.map((p) => {
          const pl = Number(p.current_profit ?? 0);
          return (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Badge variant={p.direction === "BUY" ? "default" : "destructive"}>{p.direction}</Badge>
                  {p.symbol} <span className="text-xs text-muted-foreground">#{p.ticket}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.volume ?? "-"} lots @ {p.open_price ?? "-"} ·{" "}
                  <span className={pl >= 0 ? "text-primary" : "text-destructive"}>{pl.toFixed(2)}</span>
                </div>
              </div>
              <Button variant="destructive" className="min-h-11" disabled={closing === p.id} onClick={() => closeTrade(p)}>
                {closing === p.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                Close Trade
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
