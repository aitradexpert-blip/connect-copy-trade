import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wallet } from "lucide-react";

interface WithdrawModalProps {
  onClose: () => void;
}

interface CryptoWallet {
  currency: string;
  balance: number;
}

export function WithdrawModal({ onClose }: WithdrawModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [amount, setAmount] = useState("");
  const [externalAddress, setExternalAddress] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWallets();
  }, [user]);

  const loadWallets = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('crypto_wallets')
      .select('currency, balance')
      .eq('user_id', user.id)
      .neq('currency', 'USD'); // Exclude USD for crypto withdrawals

    if (!error && data) {
      setWallets(data);
    }
  };

  const selectedWallet = wallets.find(w => w.currency === selectedCurrency);
  const NETWORK_FEE = 0.0001; // Example network fee for crypto

  const handleWithdraw = async () => {
    if (!selectedCurrency || !amount || !externalAddress) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(amount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid withdrawal amount.",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(amount) > (selectedWallet?.balance || 0)) {
      toast({
        title: "Insufficient funds",
        description: "Your wallet has insufficient balance.",
        variant: "destructive"
      });
      return;
    }

    // Basic address validation
    if (externalAddress.length < 20) {
      toast({
        title: "Invalid address",
        description: "Please enter a valid wallet address.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Generate mock transaction ID
      const txId = `0x${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;

      // Simulate withdrawal
      await supabase.from('crypto_transactions').insert({
        user_id: user?.id,
        transaction_type: 'withdrawal',
        from_currency: selectedCurrency,
        to_currency: selectedCurrency,
        from_amount: parseFloat(amount),
        to_amount: parseFloat(amount) - NETWORK_FEE,
        to_address: externalAddress,
        fee: NETWORK_FEE,
        status: 'pending',
        notes: `Withdrawal to external ${selectedCurrency} wallet - TxID: ${txId}`
      });

      toast({
        title: "Withdrawal initiated!",
        description: `Your ${selectedCurrency} withdrawal is being processed. Transaction ID: ${txId.substring(0, 12)}...`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Withdrawal failed",
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
            <Wallet className="w-5 h-5" />
            Withdraw to External Wallet
          </DialogTitle>
          <DialogDescription>
            Send cryptocurrency to an external wallet address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cryptocurrency</Label>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select cryptocurrency" />
              </SelectTrigger>
              <SelectContent>
                {wallets.map(wallet => (
                  <SelectItem key={wallet.currency} value={wallet.currency}>
                    {wallet.currency} (Balance: {wallet.balance.toFixed(8)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>External Wallet Address</Label>
            <Input
              placeholder={`Enter ${selectedCurrency || 'wallet'} address`}
              value={externalAddress}
              onChange={(e) => setExternalAddress(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              ⚠️ Double-check the address. Cryptocurrency transactions cannot be reversed.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.00000001"
            />
            {selectedWallet && (
              <p className="text-xs text-muted-foreground">
                Available: {selectedWallet.balance.toFixed(8)} {selectedCurrency}
              </p>
            )}
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div className="p-3 bg-slate-800 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span>{parseFloat(amount).toFixed(8)} {selectedCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Network Fee:</span>
                <span className="text-loss">-{NETWORK_FEE.toFixed(8)} {selectedCurrency}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>You'll Send:</span>
                <span className="text-profit">{(parseFloat(amount) - NETWORK_FEE).toFixed(8)} {selectedCurrency}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-900/20 border border-amber-700 rounded-lg">
            <p className="text-xs text-amber-200">
              ⚠️ Withdrawals are processed on the blockchain and may take 10-60 minutes depending on network congestion.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleWithdraw} 
              className="flex-1 bg-gradient-primary"
              disabled={loading || !selectedCurrency || !amount || !externalAddress}
            >
              {loading ? "Processing..." : "Withdraw"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
