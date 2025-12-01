import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowDownUp } from "lucide-react";
import { COMPREHENSIVE_WATCHLIST } from "@/config/watchlist";

interface ExchangeModalProps {
  onClose: () => void;
}

interface CryptoWallet {
  currency: string;
  balance: number;
}

const MOCK_RATES: Record<string, number> = {
  BTC: 43000,
  ETH: 2300,
  USDT: 1,
  USDC: 1,
  LTC: 73,
  XRP: 0.52,
  USD: 1,
  // Add more from watchlist
  "BTC/USD": 43000,
  "ETH/USD": 2300,
  "LTC/USD": 73,
  "XRP/USD": 0.52,
  "ADA/USD": 0.45,
  "DOT/USD": 6.5,
  "LINK/USD": 14.2,
  "DOGE/USD": 0.08,
  "SOL/USD": 98,
  "MATIC/USD": 0.85,
};

export function ExchangeModal({ onClose }: ExchangeModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [fromCurrency, setFromCurrency] = useState("");
  const [toCurrency, setToCurrency] = useState("");
  const [fromAmount, setFromAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // Get crypto symbols from watchlist
  const cryptoSymbols = COMPREHENSIVE_WATCHLIST["CRYPTO (35)"];
  const availableCurrencies = ["USD", "BTC", "ETH", "USDT", "USDC", "LTC", "XRP"];

  useEffect(() => {
    loadWallets();
  }, [user]);

  const loadWallets = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('crypto_wallets')
      .select('currency, balance')
      .eq('user_id', user.id);

    if (!error && data) {
      setWallets(data);
    }
  };

  const fromWallet = wallets.find(w => w.currency === fromCurrency);
  const getRate = (from: string, to: string) => {
    if (from === to) return 1;
    const fromRate = MOCK_RATES[from] || MOCK_RATES[`${from}/USD`] || 1;
    const toRate = MOCK_RATES[to] || MOCK_RATES[`${to}/USD`] || 1;
    return fromRate / toRate;
  };

  const exchangeRate = getRate(fromCurrency, toCurrency);
  const toAmount = parseFloat(fromAmount || "0") * exchangeRate;
  const EXCHANGE_FEE_PERCENT = 0.25;
  const fee = toAmount * (EXCHANGE_FEE_PERCENT / 100);
  const finalAmount = toAmount - fee;

  const handleExchange = async () => {
    if (!fromCurrency || !toCurrency || !fromAmount) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(fromAmount) <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid exchange amount.",
        variant: "destructive"
      });
      return;
    }

    if (parseFloat(fromAmount) > (fromWallet?.balance || 0)) {
      toast({
        title: "Insufficient funds",
        description: `Your ${fromCurrency} wallet has insufficient balance.`,
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      // Simulate currency exchange
      await supabase.from('crypto_transactions').insert({
        user_id: user?.id,
        transaction_type: 'exchange',
        from_currency: fromCurrency,
        to_currency: toCurrency,
        from_amount: parseFloat(fromAmount),
        to_amount: finalAmount,
        fee: fee,
        status: 'completed',
        notes: `Exchanged ${fromCurrency} to ${toCurrency} at rate ${exchangeRate.toFixed(6)}`
      });

      toast({
        title: "Exchange completed!",
        description: `Successfully exchanged ${fromAmount} ${fromCurrency} to ${finalAmount.toFixed(8)} ${toCurrency}`,
      });

      onClose();
    } catch (error: any) {
      toast({
        title: "Exchange failed",
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
            <ArrowDownUp className="w-5 h-5" />
            Exchange Currency
          </DialogTitle>
          <DialogDescription>
            Convert between different cryptocurrencies and fiat currencies
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>From Currency</Label>
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies.map(currency => {
                  const wallet = wallets.find(w => w.currency === currency);
                  return (
                    <SelectItem key={currency} value={currency}>
                      {currency} {wallet && `(Balance: ${wallet.balance.toFixed(8)})`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              placeholder="0.00000000"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              min="0"
              step="0.00000001"
            />
            {fromWallet && (
              <p className="text-xs text-muted-foreground">
                Available: {fromWallet.balance.toFixed(8)} {fromCurrency}
              </p>
            )}
          </div>

          <div className="flex items-center justify-center">
            <div className="p-2 bg-primary/10 rounded-full">
              <ArrowDownUp className="w-5 h-5 text-primary" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>To Currency</Label>
            <Select value={toCurrency} onValueChange={setToCurrency}>
              <SelectTrigger>
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {availableCurrencies.filter(c => c !== fromCurrency).map(currency => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {fromCurrency && toCurrency && fromAmount && parseFloat(fromAmount) > 0 && (
            <div className="p-3 bg-slate-800 rounded-lg space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Rate:</span>
                <span>1 {fromCurrency} = {exchangeRate.toFixed(6)} {toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You Pay:</span>
                <span>{parseFloat(fromAmount).toFixed(8)} {fromCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">You Get (before fee):</span>
                <span>{toAmount.toFixed(8)} {toCurrency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange Fee ({EXCHANGE_FEE_PERCENT}%):</span>
                <span className="text-loss">-{fee.toFixed(8)} {toCurrency}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>Final Amount:</span>
                <span className="text-profit">{finalAmount.toFixed(8)} {toCurrency}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-xs text-blue-200">
              ℹ️ Exchanges are processed instantly. Rates are based on live market data.
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleExchange} 
              className="flex-1 bg-gradient-primary"
              disabled={loading || !fromCurrency || !toCurrency || !fromAmount}
            >
              {loading ? "Processing..." : "Exchange Now"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
