import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { authorizeDerivAccount, getTransferableAccounts, transferBetweenDerivAccounts } from "@/services/derivBroker";
import { useToast } from "@/hooks/use-toast";

interface TransferableAccount {
  loginid: string;
  balance: number;
  currency: string;
  account_type: string;
}

interface DerivTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    name: string;
    login: string;
    deriv_token: string | null;
    deriv_currency: string | null;
    balance: number;
  };
  onComplete?: () => void;
}

export function DerivTransferModal({ open, onOpenChange, account, onComplete }: DerivTransferModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [accounts, setAccounts] = useState<TransferableAccount[]>([]);
  const [selectedTo, setSelectedTo] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && account.deriv_token) {
      loadTransferableAccounts();
    } else {
      setAccounts([]);
      setSelectedTo('');
      setAmount('');
      setError(null);
    }
  }, [open, account.deriv_token]);

  const loadTransferableAccounts = async () => {
    if (!account.deriv_token) return;

    setLoading(true);
    setError(null);

    try {
      await authorizeDerivAccount(account.deriv_token);
      const response: any = await getTransferableAccounts();
      
      if (response.error) {
        throw new Error(response.error.message);
      }

      // Filter out the current account and format the list
      const accountsList = response.transfer_between_accounts?.accounts || response.accounts || [];
      const transferable = accountsList
        .filter((acc: any) => acc.loginid !== account.login)
        .map((acc: any) => ({
          loginid: acc.loginid,
          balance: acc.balance || 0,
          currency: acc.currency || 'USD',
          account_type: acc.account_type || 'trading',
        }));

      setAccounts(transferable);
      
      if (transferable.length === 0) {
        setError("No other accounts available for transfer");
      }
    } catch (err: any) {
      console.error('Failed to load accounts:', err);
      setError(err.message || 'Failed to load transferable accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTo || !amount || !account.deriv_token) return;

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    if (transferAmount > account.balance) {
      toast({ title: 'Insufficient balance', variant: 'destructive' });
      return;
    }

    setTransferring(true);

    try {
      await authorizeDerivAccount(account.deriv_token);
      
      const result: any = await transferBetweenDerivAccounts({
        account_from: account.login,
        account_to: selectedTo,
        amount: transferAmount,
        currency: account.deriv_currency || 'USD',
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: 'Transfer successful',
        description: `Transferred ${transferAmount} ${account.deriv_currency || 'USD'} to ${selectedTo}`,
      });

      onOpenChange(false);
      onComplete?.();
    } catch (err: any) {
      console.error('Transfer failed:', err);
      toast({
        title: 'Transfer failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTransferring(false);
    }
  };

  const selectedAccount = accounts.find(a => a.loginid === selectedTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Between Accounts</DialogTitle>
          <DialogDescription>
            Transfer funds from {account.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading accounts...</p>
            </div>
          ) : error && accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-8 h-8 text-yellow-500 mb-4" />
              <p className="text-muted-foreground text-center">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* From Account */}
              <div className="space-y-2">
                <Label>From</Label>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium">{account.login}</div>
                  <div className="text-sm text-muted-foreground">
                    Balance: {account.balance.toFixed(2)} {account.deriv_currency || 'USD'}
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>

              {/* To Account */}
              <div className="space-y-2">
                <Label>To</Label>
                <Select value={selectedTo} onValueChange={setSelectedTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.loginid} value={acc.loginid}>
                        <span>{acc.loginid}</span>
                        <span className="text-muted-foreground ml-2">
                          ({acc.balance.toFixed(2)} {acc.currency})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Amount ({account.deriv_currency || 'USD'})</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  max={account.balance}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Available: {account.balance.toFixed(2)}</span>
                  <button 
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setAmount(account.balance.toString())}
                  >
                    Max
                  </button>
                </div>
              </div>

              <Button 
                onClick={handleTransfer} 
                disabled={!selectedTo || !amount || transferring}
                className="w-full"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  'Transfer Funds'
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}