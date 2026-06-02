import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Send, RefreshCw, MessageCircle } from "lucide-react";

interface Lead {
  id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  octafx_account_id: string | null;
  plan_choice: string | null;
  conversation_state: string;
  verified: boolean;
  verified_at: string | null;
  last_interaction_at: string;
  created_at: string;
}

export function TelegramLeadsTab() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcast, setBroadcast] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_leads")
      .select("*")
      .order("last_interaction_at", { ascending: false })
      .limit(500);
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    else setLeads((data as Lead[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleVerify = async (lead: Lead, verified: boolean) => {
    const { error } = await supabase
      .from("telegram_leads")
      .update({
        verified,
        verified_at: verified ? new Date().toISOString() : null,
        conversation_state: verified ? "verified" : lead.conversation_state,
      })
      .eq("id", lead.id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    if (verified) {
      // Notify the lead via Telegram
      await supabase.functions.invoke("telegram-broadcast", {
        body: { chat_ids: [lead.telegram_chat_id], text: "🎉 *Verification Successful!* Your signals are now LIVE. Use /signals to see today's setups.", parse_mode: "Markdown" },
      });
    }
    load();
  };

  const sendBroadcast = async () => {
    if (!broadcast.trim() || leads.length === 0) return;
    setSending(true);
    try {
      const verifiedIds = leads.filter(l => l.verified).map(l => l.telegram_chat_id);
      if (verifiedIds.length === 0) {
        toast({ title: "No verified leads", description: "Verify at least one lead first." });
        return;
      }
      const { error } = await supabase.functions.invoke("telegram-broadcast", {
        body: { chat_ids: verifiedIds, text: broadcast, parse_mode: "Markdown" },
      });
      if (error) throw error;
      toast({ title: `Broadcast sent to ${verifiedIds.length} verified leads` });
      setBroadcast("");
    } catch (e: any) {
      toast({ title: "Broadcast failed", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  const verifiedCount = leads.filter(l => l.verified).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" /> Telegram Leads</CardTitle>
              <CardDescription>{leads.length} total · {verifiedCount} verified</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>OctaFX ID</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead className="text-right">Verified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.telegram_first_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">@{l.telegram_username || l.telegram_chat_id}</div>
                    </TableCell>
                    <TableCell className="font-mono">{l.octafx_account_id || "—"}</TableCell>
                    <TableCell><Badge variant="outline">{l.plan_choice || "—"}</Badge></TableCell>
                    <TableCell><Badge variant="secondary">{l.conversation_state}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(l.last_interaction_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Switch checked={l.verified} onCheckedChange={(c) => toggleVerify(l, c)} />
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && leads.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No leads yet. Share your bot to start receiving messages.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" /> Broadcast to Verified Leads</CardTitle>
          <CardDescription>Sends a Telegram message to all {verifiedCount} verified leads. Markdown supported.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={4} value={broadcast} onChange={e => setBroadcast(e.target.value)} placeholder="📊 Today's NY Open setup: XAUUSD BUY @ 2340 | SL 2330 | TP 2360 — lock in the bag!" />
          <Button onClick={sendBroadcast} disabled={sending || !broadcast.trim() || verifiedCount === 0} className="w-full sm:w-auto">
            <Send className="w-4 h-4 mr-2" /> {sending ? "Sending…" : `Broadcast to ${verifiedCount}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
