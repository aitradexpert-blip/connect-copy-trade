import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, ArrowRight } from "lucide-react";

interface CrossBrokerTransferModalProps {
  onClose: () => void;
}

interface TradingAccount {
  id: string;
  name: string;
  login: string;
  server: string;
  balance: number;
}

export function CrossBrokerTransferModal({ onClose }: CrossBrokerTransferModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destAccountId, setDestAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, [user]);

  const loadAccounts = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('trading_accounts')
      .select('id, name, login, server, balance')
      .eq('user_id', user.id)
      .eq('connection_status', 'connected');

    if (!error && data) {
      setAccounts(data);
    }
  };

  const sourceAccount = accounts.find(a => a.id === sourceAccountId);
  const destAccount = accounts.find(a => a.id === destAccountId);
  const differentBrokers = sourceAccount && destAccount && 
    sourceAccount.server !== destAccount.server;

  const XRP_FEE_PERCENT = 0.5; // 0.5% fee
  const estimatedFee = parseFloat(amount || "0") * (XRP_FEE_PERCENT / 100);
  const estimatedReceive = parseFloat(amount || "0") - estimatedFee;

  const handleTransfer = async () => {
    if (!differentBrokers) {
      toast({
        title: "Invalid transfer",
        description: "Cross-broker transfers must be between different brokers. Use internal transfer for same broker.",
        variant: "destructive"
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid transfer amount.",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(amount) > (sourceAccount?.balance || 0)) {
      toast({
        title: "Insufficient funds",
        description: "Source account has insufficient balance.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Simulate cross-broker transfer via XRP (2-4 hours processing time)
      await supabase.from('crypto_transactions').insert({
        user_id: user?.id,
        transaction_type: 'cross_broker',
        from_currency: 'USD',
        to_currency: 'USD',
        from_amount: parseFloat(amount),
        to_amount: estimatedReceive,
        fee: estimatedFee,
        status: 'pending',
        notes: `Cross-broker transfer via XRP from ${sourceAccount?.name} to ${destAccount?.name}`,
        broker_name: `${sourceAccount?.server} → ${destAccount?.server}`
      });

      toast({
        title: "Transfer initiated!",
        description: `Your cross-broker transfer is processing via XRP. Expected completion: 2-4 hours.`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Transfer failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-gradient-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Cross-Broker Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer funds between different brokers using XRP as intermediary (2-4 hours)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>From Broker Account</Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - {account.server} (${account.balance?.toFixed(2) || '0.00'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transfer Flow Visualization */}
          {sourceAccountId && destAccountId && (
            <div className="flex items-center justify-center gap-2 p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="text-center">
                <div className="text-sm font-medium">{sourceAccount?.server}</div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="text-center">
                <div className="text-xs text-muted-foreground">via</div>
                <div className="text-sm font-medium text-blue-400">XRP</div>
              </div>
              <ArrowRight className="w-4 h-4 text-primary" />
              <div className="text-center">
                <div className="text-sm font-medium">{destAccount?.server}</div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>To Broker Account</Label>
            <Select value={destAccountId} onValueChange={setDestAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.id !== sourceAccountId).map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - {account.server}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceAccountId && destAccountId && !differentBrokers && (
            <div className="p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
              <p className="text-sm text-amber-200">
                ⚠️ Both accounts are on the same broker. Use "Internal Transfer" for instant, fee-free transfers.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Amount (USD)</Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            {sourceAccount && (
              <p className="text-xs text-muted-foreground">
                Available: ${sourceAccount.balance?.toFixed(2) || '0.00'}
              </p>
            )}
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 bg-slate-800 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transfer Amount:</span>
                <span>${parseFloat(amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">XRP Fee ({XRP_FEE_PERCENT}%):</span>
                <span className="text-loss">-${estimatedFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>Recipient Receives:</span>
                <span className="text-profit">${estimatedReceive.toFixed(2)}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-xs text-blue-200">
              ℹ️ Processing time: 2-4 hours. XRP is used as an intermediary for fast, low-cost transfers between brokers.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              className="flex-1 bg-gradient-primary"
              disabled={loading || !differentBrokers || !amount}
            >
              {loading ? "Processing..." : "Initiate Transfer"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
