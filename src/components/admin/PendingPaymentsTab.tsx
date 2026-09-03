import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, CreditCard, Landmark, Loader2 } from "lucide-react";

interface PendingSubscription {
  id: string;
  email: string;
  plan_name: string;
  amount_cents: number;
  payment_id: string | null;
  yoco_checkout_id: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  activated_user_id: string | null;
}

export function PendingPaymentsTab() {
  const { toast } = useToast();
  const [rows, setRows] = useState<PendingSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailToUserId, setEmailToUserId] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_subscriptions")
        .select("*")
        .in("status", ["pending", "awaiting_bank_transfer"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows((data || []) as PendingSubscription[]);

      const { data: authData } = await supabase.functions.invoke("admin-list-users");
      if (authData?.users) {
        const map: Record<string, string> = {};
        for (const u of authData.users) map[u.email.toLowerCase()] = u.id;
        setEmailToUserId(map);
      }
    } catch (error: any) {
      toast({ title: "Error loading pending payments", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const approve = async (row: PendingSubscription) => {
    const matchedUserId = row.activated_user_id || emailToUserId[row.email.toLowerCase()];
    if (!matchedUserId) {
      toast({
        title: "No matching account found",
        description: `No signed-up user with email ${row.email}. They need to register with this email first.`,
        variant: "destructive",
      });
      return;
    }
    setProcessing(row.id);
    try {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      const { error: subError } = await supabase.from("user_subscriptions").upsert({
        user_id: matchedUserId,
        plan_name: row.plan_name,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "user_id" });
      if (subError) throw subError;

      const { error: updateError } = await supabase
        .from("pending_subscriptions")
        .update({ status: "activated", activated_at: new Date().toISOString(), activated_user_id: matchedUserId })
        .eq("id", row.id);
      if (updateError) throw updateError;

      toast({ title: "Subscription activated", description: `${row.email} is now on the ${row.plan_name} plan` });
      loadData();
    } catch (error: any) {
      toast({ title: "Error activating subscription", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const reject = async (row: PendingSubscription) => {
    if (!confirm(`Reject this ${row.plan_name} payment from ${row.email}?`)) return;
    setProcessing(row.id);
    try {
      const { error } = await supabase.from("pending_subscriptions").update({ status: "rejected" }).eq("id", row.id);
      if (error) throw error;
      toast({ title: "Payment rejected" });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setProcessing(null);
    }
  };

  const totalPending = useMemo(() => rows.reduce((sum, r) => sum + r.amount_cents, 0) / 100, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Pending Payments ({rows.length})</h2>
          <p className="text-muted-foreground mt-1">
            ${totalPending.toFixed(2)} awaiting approval across PayPal and bank transfer
          </p>
        </div>
        <Button onClick={loadData} variant="outline">Refresh</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Matched Account</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const matched = emailToUserId[row.email.toLowerCase()];
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell><Badge>{row.plan_name}</Badge></TableCell>
                <TableCell>${(row.amount_cents / 100).toFixed(2)}</TableCell>
                <TableCell>
                  {row.payment_id ? (
                    <Badge variant="outline" className="gap-1"><CreditCard className="w-3 h-3" /> PayPal</Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><Landmark className="w-3 h-3" /> Bank Transfer</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {(row.activated_user_id || matched) ? <Badge className="bg-green-600">Found</Badge> : <Badge variant="destructive">No account yet</Badge>}
                </TableCell>
                <TableCell className="text-sm">{new Date(row.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => approve(row)} disabled={processing === row.id || !(row.activated_user_id || matched)} className="bg-profit text-white hover:bg-profit/80">
                      {processing === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => reject(row)} disabled={processing === row.id}>
                      <XCircle className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending payments right now.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
