import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send } from "lucide-react";

interface InternalTransferModalProps {
  onClose: () => void;
}

interface TradingAccount {
  id: string;
  name: string;
  login: string;
  server: string;
  balance: number;
}

export function InternalTransferModal({ onClose }: InternalTransferModalProps) {
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
  const sameBroker = sourceAccount && destAccount && 
    sourceAccount.server === destAccount.server;

  const handleTransfer = async () => {
    if (!sameBroker) {
      toast({
        title: "Invalid transfer",
        description: "Internal transfers must be between accounts on the same broker.",
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
      // Simulate internal transfer (instant)
      await supabase.from('crypto_transactions').insert({
        user_id: user?.id,
        transaction_type: 'internal_transfer',
        from_currency: 'USD',
        to_currency: 'USD',
        from_amount: parseFloat(amount),
        to_amount: parseFloat(amount),
        fee: 0,
        status: 'completed',
        notes: `Internal transfer from ${sourceAccount?.name} to ${destAccount?.name}`
      });

      toast({
        title: "Transfer completed!",
        description: `Successfully transferred $${amount} between accounts.`
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
      <DialogContent className="bg-gradient-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Internal Transfer
          </DialogTitle>
          <DialogDescription>
            Transfer funds between your accounts on the same broker (instant, no fees)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>From Account</Label>
            <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} - {account.server} (Balance: ${account.balance?.toFixed(2) || '0.00'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>To Account</Label>
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

          {sourceAccountId && destAccountId && !sameBroker && (
            <div className="p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
              <p className="text-sm text-amber-200">
                ⚠️ Accounts are on different brokers. Use "Cross-Broker Transfer" instead.
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

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleTransfer} 
              className="flex-1 bg-gradient-primary"
              disabled={loading || !sameBroker || !amount}
            >
              {loading ? "Processing..." : "Transfer Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
