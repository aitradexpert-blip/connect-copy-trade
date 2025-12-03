import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Transfer {
  id: string;
  user_id: string;
  transfer_type: string;
  source_type: string;
  source_name: string | null;
  dest_type: string;
  dest_name: string | null;
  amount: number;
  fee: number | null;
  status: string | null;
  current_step: number | null;
  total_steps: number | null;
  created_at: string | null;
  error_message: string | null;
}

export function TransferMonitoringTab() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTransfers();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('admin-transfers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fund_transfers' },
        () => {
          loadTransfers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadTransfers = async () => {
    try {
      const { data, error } = await supabase
        .from('fund_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setTransfers(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading transfers",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-profit text-white"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
      case 'step1_complete':
      case 'step2_processing':
        return <Badge className="bg-amber-500 text-white"><Clock className="w-3 h-3 mr-1" />Processing</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit_to_broker':
        return 'Deposit';
      case 'withdraw_to_wallet':
        return 'Withdraw';
      case 'internal':
        return 'Internal';
      case 'cross_broker':
        return 'Cross-Broker';
      default:
        return type;
    }
  };

  const handleRetry = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('fund_transfers')
        .update({ status: 'pending', error_message: null })
        .eq('id', transferId);

      if (error) throw error;
      
      toast({
        title: "Transfer queued for retry",
        description: "The transfer will be processed again."
      });
      
      loadTransfers();
    } catch (error: any) {
      toast({
        title: "Retry failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleCancel = async (transferId: string) => {
    try {
      const { error } = await supabase
        .from('fund_transfers')
        .update({ status: 'failed', error_message: 'Cancelled by admin' })
        .eq('id', transferId);

      if (error) throw error;
      
      toast({
        title: "Transfer cancelled",
        description: "The transfer has been marked as cancelled."
      });
      
      loadTransfers();
    } catch (error: any) {
      toast({
        title: "Cancel failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const pendingCount = transfers.filter(t => t.status === 'pending' || t.status === 'processing').length;
  const failedCount = transfers.filter(t => t.status === 'failed').length;

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Transfer Monitoring
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} pending</Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="destructive">{failedCount} failed</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Monitor and manage all fund transfers
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTransfers}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transfers found
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell className="text-sm">
                    {transfer.created_at ? new Date(transfer.created_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getTypeLabel(transfer.transfer_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {transfer.source_name || transfer.source_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {transfer.dest_name || transfer.dest_type}
                  </TableCell>
                  <TableCell className="font-medium">
                    ${transfer.amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {transfer.fee ? `$${transfer.fee.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(transfer.status)}
                    {transfer.error_message && (
                      <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {transfer.error_message}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {transfer.status === 'failed' && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleRetry(transfer.id)}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                      )}
                      {(transfer.status === 'pending' || transfer.status === 'processing') && (
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleCancel(transfer.id)}
                        >
                          <XCircle className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
