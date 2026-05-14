import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Wallet, Send, ArrowDownUp, TrendingUp, Bitcoin, Building2, Download } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { InternalTransferModal } from "@/components/crypto-wallet/InternalTransferModal";
import { CrossBrokerTransferModal } from "@/components/crypto-wallet/CrossBrokerTransferModal";
import { WithdrawModal } from "@/components/crypto-wallet/WithdrawModal";
import { ExchangeModal } from "@/components/crypto-wallet/ExchangeModal";
import { DepositToBrokerModal } from "@/components/crypto-wallet/DepositToBrokerModal";
import { TransferHistory } from "@/components/crypto-wallet/TransferHistory";

interface CryptoWallet {
  currency: string;
  balance: number;
  address: string;
}

const MOCK_RATES: Record<string, number> = {
  BTC: 43000,
  ETH: 2300,
  USDT: 1,
  USDC: 1,
  LTC: 73,
  XRP: 0.52,
  USD: 1
};

const CryptoIcon = ({ currency }: { currency: string }) => {
  const colors: Record<string, string> = {
    BTC: "text-orange-500",
    ETH: "text-blue-500",
    USDT: "text-green-500",
    USDC: "text-blue-400",
    LTC: "text-gray-400",
    XRP: "text-blue-600",
    USD: "text-green-600"
  };
  
  return <Bitcoin className={`w-5 h-5 ${colors[currency] || 'text-primary'}`} />;
};

export default function CryptoWallet() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<CryptoWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);
  const [activeModal, setActiveModal] = useState<'internal' | 'cross' | 'withdraw' | 'exchange' | null>(null);

  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      const { data, error } = await supabase
        .from('crypto_wallets')
        .select('*')
        .eq('user_id', user?.id);

      if (error) throw error;

      setWallets(data || []);
      
      // Calculate total value
      const total = (data || []).reduce((sum, wallet) => {
        const rate = MOCK_RATES[wallet.currency] || 0;
        return sum + (wallet.balance * rate);
      }, 0);
      setTotalValue(total);
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCryptoAmount = (amount: number, currency: string) => {
    if (currency === 'USD' || currency === 'USDT' || currency === 'USDC') {
      return `$${amount.toFixed(2)}`;
    }
    return `${amount.toFixed(8)} ${currency}`;
  };

  const calculateUSDValue = (amount: number, currency: string) => {
    const rate = MOCK_RATES[currency] || 0;
    return (amount * rate).toFixed(2);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="w-8 h-8" />
              Crypto Wallet
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage your crypto holdings and transfers
            </p>
          </div>
          <Card className="bg-gradient-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Total Value</div>
              <div className="text-2xl font-bold text-primary">
                ${totalValue.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {wallets.map(wallet => (
            <Card key={wallet.currency} className="bg-gradient-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CryptoIcon currency={wallet.currency} />
                  {wallet.currency}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCryptoAmount(wallet.balance, wallet.currency)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  ≈ ${calculateUSDValue(wallet.balance, wallet.currency)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Transfer funds between wallets and brokers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button className="bg-gradient-primary" onClick={() => setActiveModal('internal')}>
                <Send className="w-4 h-4 mr-2" />
                Internal Transfer
              </Button>
              <Button variant="outline" onClick={() => setActiveModal('cross')}>
                <Building2 className="w-4 h-4 mr-2" />
                Cross-Broker Transfer
              </Button>
              <Button variant="outline" onClick={() => setActiveModal('exchange')}>
                <ArrowDownUp className="w-4 h-4 mr-2" />
                Exchange Currency
              </Button>
              <Button variant="outline" onClick={() => setActiveModal('withdraw')}>
                <Wallet className="w-4 h-4 mr-2" />
                Withdraw to External Wallet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>Your recent wallet activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No transactions yet. Start by transferring funds to your wallet.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Modals */}
        {activeModal === 'internal' && <InternalTransferModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'cross' && <CrossBrokerTransferModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'withdraw' && <WithdrawModal onClose={() => setActiveModal(null)} />}
        {activeModal === 'exchange' && <ExchangeModal onClose={() => setActiveModal(null)} />}
      </div>
    </AppLayout>
  );
}
