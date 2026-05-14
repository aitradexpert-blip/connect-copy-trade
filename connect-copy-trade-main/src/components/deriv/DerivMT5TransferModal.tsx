import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from "lucide-react";
import { 
  authorizeDerivAccount, 
  getMT5AccountList, 
  mt5Deposit, 
  mt5Withdrawal,
  getDerivBalance,
  MT5Account 
} from "@/services/derivBroker";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DerivMT5TransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    name: string;
    login: string; // Binary account loginid (e.g., CR1234567)
    deriv_token: string | null;
    deriv_currency: string | null;
    balance: number;
  };
  onComplete?: () => void;
}

export function DerivMT5TransferModal({ 
  open, 
  onOpenChange, 
  account, 
  onComplete 
}: DerivMT5TransferModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [mt5Accounts, setMt5Accounts] = useState<MT5Account[]>([]);
  const [selectedMT5, setSelectedMT5] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [transferType, setTransferType] = useState<'deposit' | 'withdraw'>('deposit');
  const [binaryBalance, setBinaryBalance] = useState<number>(account.balance);
  const [success, setSuccess] = useState<{ txId: number } | null>(null);

  useEffect(() => {
    if (open && account.deriv_token) {
      loadMT5Accounts();
      setSuccess(null);
    } else {
      setMt5Accounts([]);
      setSelectedMT5('');
      setAmount('');
      setError(null);
      setSuccess(null);
    }
  }, [open, account.deriv_token]);

  const loadMT5Accounts = async () => {
    if (!account.deriv_token) return;

    setLoading(true);
    setError(null);

    try {
      await authorizeDerivAccount(account.deriv_token);
      
      // Get current balance
      const balanceResponse = await getDerivBalance();
      setBinaryBalance(balanceResponse.balance.balance);
      
      // Get MT5 accounts
      const response = await getMT5AccountList();
      
      if (response.mt5_login_list.length === 0) {
        setError("No MT5 accounts linked to this Deriv account. Create an MT5 account on Deriv first.");
      } else {
        setMt5Accounts(response.mt5_login_list);
        setSelectedMT5(response.mt5_login_list[0].login);
      }
    } catch (err: any) {
      console.error('Failed to load MT5 accounts:', err);
      setError(err.message || 'Failed to load MT5 accounts');
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedMT5 || !amount || !account.deriv_token) return;

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast({ title: 'Invalid amount', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }

    // Validate amount limits ($1 - $20000)
    if (transferAmount < 1) {
      toast({ title: 'Amount too low', description: 'Minimum transfer is $1', variant: 'destructive' });
      return;
    }
    if (transferAmount > 20000) {
      toast({ title: 'Amount too high', description: 'Maximum transfer is $20,000', variant: 'destructive' });
      return;
    }

    const selectedMT5Account = mt5Accounts.find(m => m.login === selectedMT5);
    
    if (transferType === 'deposit' && transferAmount > binaryBalance) {
      toast({ title: 'Insufficient balance', description: 'Not enough funds in Binary account', variant: 'destructive' });
      return;
    }
    
    if (transferType === 'withdraw' && selectedMT5Account && transferAmount > selectedMT5Account.balance) {
      toast({ title: 'Insufficient balance', description: 'Not enough funds in MT5 account', variant: 'destructive' });
      return;
    }

    setTransferring(true);
    setError(null);

    try {
      await authorizeDerivAccount(account.deriv_token);
      
      let result;
      
      if (transferType === 'deposit') {
        // Binary → MT5
        result = await mt5Deposit({
          amount: transferAmount,
          from_binary: account.login,
          to_mt5: selectedMT5,
        });
        
        toast({
          title: 'Deposit successful',
          description: `Transferred ${transferAmount} ${account.deriv_currency || 'USD'} to MT5 account ${selectedMT5}`,
        });
      } else {
        // MT5 → Binary
        result = await mt5Withdrawal({
          amount: transferAmount,
          from_mt5: selectedMT5,
          to_binary: account.login,
        });
        
        toast({
          title: 'Withdrawal successful',
          description: `Transferred ${transferAmount} ${account.deriv_currency || 'USD'} from MT5 account ${selectedMT5}`,
        });
      }

      setSuccess({ txId: result.binary_transaction_id });
      setAmount('');
      
      // Refresh balances
      await loadMT5Accounts();
      onComplete?.();
      
    } catch (err: any) {
      console.error('MT5 transfer failed:', err);
      setError(err.message || 'Transfer failed');
      toast({
        title: 'Transfer failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setTransferring(false);
    }
  };

  const selectedMT5Account = mt5Accounts.find(m => m.login === selectedMT5);
  const sourceBalance = transferType === 'deposit' ? binaryBalance : (selectedMT5Account?.balance || 0);
  const sourceName = transferType === 'deposit' ? account.login : selectedMT5;
  const destName = transferType === 'deposit' ? selectedMT5 : account.login;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>MT5 Fund Transfer</DialogTitle>
          <DialogDescription>
            Transfer funds between {account.name} and MT5 accounts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Loading MT5 accounts...</p>
            </div>
          ) : error && mt5Accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="w-8 h-8 text-yellow-500 mb-4" />
              <p className="text-muted-foreground text-center">{error}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.open('https://app.deriv.com/mt5', '_blank')}
              >
                Create MT5 Account on Deriv
              </Button>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-4" />
              <p className="text-lg font-medium mb-2">Transfer Complete!</p>
              <p className="text-sm text-muted-foreground mb-4">
                Transaction ID: {success.txId}
              </p>
              <Button onClick={() => setSuccess(null)}>
                Make Another Transfer
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Transfer Direction Tabs */}
              <Tabs value={transferType} onValueChange={(v) => setTransferType(v as 'deposit' | 'withdraw')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="deposit" className="flex items-center gap-2">
                    <ArrowRight className="w-4 h-4" />
                    To MT5
                  </TabsTrigger>
                  <TabsTrigger value="withdraw" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    From MT5
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* MT5 Account Selection */}
              <div className="space-y-2">
                <Label>MT5 Account</Label>
                <Select value={selectedMT5} onValueChange={setSelectedMT5}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select MT5 account" />
                  </SelectTrigger>
                  <SelectContent>
                    {mt5Accounts.map((acc) => (
                      <SelectItem key={acc.login} value={acc.login}>
                        <div className="flex flex-col">
                          <span>{acc.login} - {acc.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {acc.balance.toFixed(2)} {acc.currency} | {acc.market_type}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transfer Visual */}
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="text-center flex-1">
                  <div className="text-xs text-muted-foreground">From</div>
                  <div className="font-medium">{sourceName}</div>
                  <div className="text-sm text-muted-foreground">
                    {sourceBalance.toFixed(2)} {account.deriv_currency || 'USD'}
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 text-muted-foreground mx-4" />
                <div className="text-center flex-1">
                  <div className="text-xs text-muted-foreground">To</div>
                  <div className="font-medium">{destName}</div>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label>Amount ({account.deriv_currency || 'USD'})</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                  max="20000"
                  step="0.01"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Min: $1 | Max: $20,000</span>
                  <button 
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => setAmount(Math.min(sourceBalance, 20000).toString())}
                  >
                    Max
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button 
                onClick={handleTransfer} 
                disabled={!selectedMT5 || !amount || transferring}
                className="w-full"
              >
                {transferring ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `${transferType === 'deposit' ? 'Deposit to' : 'Withdraw from'} MT5`
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}