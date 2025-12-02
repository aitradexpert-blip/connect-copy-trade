import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, ArrowRight, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react';
import { transferOrchestrator, Transfer, TransferStatus } from '@/services/transferOrchestrator';
import { useAuth } from '@/hooks/useAuth';

const statusConfig: Record<TransferStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Pending', variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
  processing: { label: 'Processing', variant: 'outline', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  step1_complete: { label: 'Step 1 Done', variant: 'outline', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  step2_processing: { label: 'Step 2', variant: 'outline', icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { label: 'Completed', variant: 'default', icon: <CheckCircle className="w-3 h-3" /> },
  failed: { label: 'Failed', variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
  cancelled: { label: 'Cancelled', variant: 'secondary', icon: <XCircle className="w-3 h-3" /> }
};

const transferTypeLabels: Record<string, string> = {
  deposit_to_broker: 'Deposit',
  withdraw_to_wallet: 'Withdraw',
  internal: 'Internal',
  cross_broker: 'Cross-Broker'
};

export function TransferHistory() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTransfers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await transferOrchestrator.getUserTransfers(user.id, 20);
      setTransfers(data);
    } catch (error) {
      console.error('Error loading transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransfers();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount: number, currency: string = 'USDT') => {
    return `${amount.toFixed(2)} ${currency}`;
  };

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Transfer History</CardTitle>
          <CardDescription>Your recent fund transfers</CardDescription>
        </div>
        <Button onClick={loadTransfers} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transfers yet</p>
            <p className="text-sm">Your transfer history will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From / To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => {
                  const status = statusConfig[transfer.status] || statusConfig.pending;
                  return (
                    <TableRow key={transfer.id}>
                      <TableCell className="text-sm">
                        {formatDate(transfer.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {transferTypeLabels[transfer.transfer_type] || transfer.transfer_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="truncate max-w-[100px]" title={transfer.source_name}>
                            {transfer.source_name || transfer.source_type}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[100px]" title={transfer.dest_name}>
                            {transfer.dest_name || transfer.dest_type}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatAmount(transfer.amount, transfer.currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatAmount(transfer.fee, transfer.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="flex items-center gap-1 w-fit">
                          {status.icon}
                          {status.label}
                        </Badge>
                        {transfer.transfer_type === 'cross_broker' && transfer.status !== 'completed' && transfer.status !== 'failed' && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Step {transfer.current_step}/{transfer.total_steps}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
