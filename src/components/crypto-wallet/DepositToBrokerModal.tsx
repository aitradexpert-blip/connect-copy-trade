import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, CheckCircle, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { transferOrchestrator, TRANSFER_LIMITS } from '@/services/transferOrchestrator';

interface DepositToBrokerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TradingAccount {
  id: string;
  name: string;
  metaapi_account_id: string;
  balance: number;
}

export function DepositToBrokerModal({ open, onOpenChange }: DepositToBrokerModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [userTier, setUserTier] = useState('basic');
  const [step, setStep] = useState<'form' | 'address'>('form');

  useEffect(() => {
    if (open && user) {
      loadAccounts();
      loadUserTier();
    }
  }, [open, user]);

  const loadAccounts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('trading_accounts')
      .select('id, name, metaapi_account_id, balance')
      .eq('user_id', user.id)
      .eq('connection_status', 'connected');
    setAccounts(data || []);
  };

  const loadUserTier = async () => {
    if (!user) return;
    const tier = await transferOrchestrator.getUserTier(user.id);
    setUserTier(tier);
  };

  const calculateFee = () => {
    const amt = parseFloat(amount) || 0;
    return transferOrchestrator.calculateFee(amt, 'deposit_to_broker', userTier);
  };

  const getNetAmount = () => {
    const amt = parseFloat(amount) || 0;
    return amt - calculateFee();
  };

  const handleInitiateDeposit = async () => {
    if (!user || !selectedAccount || !amount) {
      toast({
        title: 'Missing information',
        description: 'Please select an account and enter an amount',
        variant: 'destructive'
      });
      return;
    }

    const amt = parseFloat(amount);
    if (amt <= 0) {
      toast({
        title: 'Invalid amount',
        description: 'Please enter a valid amount',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const account = accounts.find(a => a.id === selectedAccount);
      if (!account) throw new Error('Account not found');

      const transfer = await transferOrchestrator.depositToBroker(
        user.id,
        account.metaapi_account_id,
        account.name,
        amt
      );

      if (transfer?.deposit_address) {
        setDepositAddress(transfer.deposit_address);
        setStep('address');
        toast({
          title: 'Deposit initiated',
          description: 'Send USDT to the address below'
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (depositAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Address copied to clipboard' });
    }
  };

  const handleClose = () => {
    setStep('form');
    setSelectedAccount('');
    setAmount('');
    setDepositAddress(null);
    onOpenChange(false);
  };

  const tierLimits = TRANSFER_LIMITS[userTier as keyof typeof TRANSFER_LIMITS] || TRANSFER_LIMITS.basic;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gradient-card border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deposit to Broker</DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Transfer USDT from your Bankii wallet to a broker account'
              : 'Send USDT to the address below'}
          </DialogDescription>
        </DialogHeader>

        {step === 'form' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination Broker Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} (${account.balance?.toFixed(2) || '0.00'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (USDT)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Daily limit: ${tierLimits.dailyAmount.toLocaleString()} ({userTier} plan)
              </p>
            </div>

            {parseFloat(amount) > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span>${parseFloat(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fee ({tierLimits.feeDeposit}%)</span>
                    <span className="text-amber-500">-${calculateFee().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-medium border-t border-border pt-2">
                    <span>Net Amount</span>
                    <span className="text-profit">${getNetAmount().toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={handleInitiateDeposit} 
                className="flex-1 bg-gradient-primary"
                disabled={loading || !selectedAccount || !amount}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Get Deposit Address
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-900/20 border border-amber-700 rounded-lg flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-200">Send USDT (ERC-20/TRC-20)</p>
                <p className="text-amber-200/80">Only send USDT to this address. Other tokens will be lost.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Deposit Address</Label>
              <div className="flex gap-2">
                <Input 
                  value={depositAddress || ''} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={copyAddress}>
                  {copied ? <CheckCircle className="w-4 h-4 text-profit" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount to Send</span>
                  <span className="font-medium">${parseFloat(amount).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Destination</span>
                  <span>{accounts.find(a => a.id === selectedAccount)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary">Awaiting Deposit</Badge>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center">
              Deposits typically take 5-15 minutes to process after network confirmation.
            </p>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
