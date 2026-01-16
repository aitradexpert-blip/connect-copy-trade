import { useEffect, useState } from "react";
import { Plus, Settings, Trash2, RefreshCw, CreditCard, Wallet, ArrowDown, ArrowUp, ArrowLeftRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectAccountModal } from "@/components/ConnectAccountModal";
import { DerivCashierModal } from "@/components/deriv/DerivCashierModal";
import { DerivTransferModal } from "@/components/deriv/DerivTransferModal";
import { DerivMT5TransferModal } from "@/components/deriv/DerivMT5TransferModal";
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { authorizeDerivAccount, getDerivBalance } from "@/services/derivBroker";

interface TradingAccount {
  id: string;
  name: string;
  login: string;
  platform: string;
  connection_status: string;
  balance: number;
  equity: number;
  provider: string;
  provider_account_id: string | null;
  deriv_token: string | null;
  deriv_currency: string | null;
  is_virtual: boolean;
  metaapi_account_id: string | null;
}

const TradingAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  
  // Deriv modal states
  const [derivCashierOpen, setDerivCashierOpen] = useState(false);
  const [derivCashierType, setDerivCashierType] = useState<'deposit' | 'withdraw'>('deposit');
  const [derivTransferOpen, setDerivTransferOpen] = useState(false);
  const [derivMT5TransferOpen, setDerivMT5TransferOpen] = useState(false);
  const [selectedDerivAccount, setSelectedDerivAccount] = useState<TradingAccount | null>(null);

  const loadAccounts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("trading_accounts")
      .select("id,name,login,platform,connection_status,balance,equity,provider,provider_account_id,deriv_token,deriv_currency,is_virtual,metaapi_account_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load accounts:", error);
      toast({ title: "Failed to load accounts", description: error.message });
      return;
    }
    
    console.log("Loaded accounts:", data);
    
    setAccounts(
      (data || []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        login: a.login as string,
        platform: a.platform as string,
        connection_status: (a.connection_status as string) || "connected",
        balance: Number(a.balance || 0),
        equity: Number(a.equity || 0),
        provider: a.provider || 'metaapi',
        provider_account_id: a.provider_account_id,
        deriv_token: a.deriv_token,
        deriv_currency: a.deriv_currency,
        is_virtual: a.is_virtual || false,
        metaapi_account_id: a.metaapi_account_id,
      }))
    );
  };

  useEffect(() => {
    loadAccounts();
    if (searchParams.get("connect") === "1") {
      setIsModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAccountConnected = async () => {
    await loadAccounts();
    setIsModalOpen(false);
  };

  const handleDeleteAccount = async (id: string) => {
    const { error } = await supabase.from("trading_accounts").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message });
    } else {
      toast({ title: "Account removed" });
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleRename = async (id: string, currentName: string) => {
    const name = window.prompt("Rename account", currentName) || currentName;
    if (name === currentName) return;
    const { error } = await supabase.from("trading_accounts").update({ name }).eq("id", id);
    if (error) {
      toast({ title: "Update failed", description: error.message });
    } else {
      toast({ title: "Account updated" });
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, name } : a)));
    }
  };

  const handleRefresh = async (account: TradingAccount) => {
    setRefreshingId(account.id);
    
    try {
      if (account.provider === 'deriv' && account.deriv_token) {
        // Refresh Deriv account using Deriv API
        await authorizeDerivAccount(account.deriv_token);
        const balanceResponse = await getDerivBalance();
        
        const balance = Number(balanceResponse.balance?.balance || 0);
        const { error } = await supabase
          .from('trading_accounts')
          .update({ balance, equity: balance })
          .eq('id', account.id);
          
        if (error) throw error;
        
        toast({ title: 'Account refreshed' });
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, balance, equity: balance } : a));
      } else if (account.metaapi_account_id) {
        // Refresh MetaAPI account
        const { data: info, error: fnError } = await supabase.functions.invoke('metaapi-account-info', {
          body: { accountId: account.metaapi_account_id },
        });
        
        if (fnError) throw fnError;
        
        const balance = Number(info?.balance || 0);
        const equity = Number(info?.equity || 0);
        const { error } = await supabase
          .from('trading_accounts')
          .update({ balance, equity })
          .eq('id', account.id);
          
        if (error) throw error;
        
        toast({ title: 'Account refreshed' });
        setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, balance, equity } : a));
      } else {
        toast({ title: 'Cannot refresh', description: 'No valid connection for this account', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Refresh failed', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  const openDerivCashier = (account: TradingAccount, type: 'deposit' | 'withdraw') => {
    setSelectedDerivAccount(account);
    setDerivCashierType(type);
    setDerivCashierOpen(true);
  };

  const openDerivTransfer = (account: TradingAccount) => {
    setSelectedDerivAccount(account);
    setDerivTransferOpen(true);
  };

  const openDerivMT5Transfer = (account: TradingAccount) => {
    setSelectedDerivAccount(account);
    setDerivMT5TransferOpen(true);
  };

  const getProviderBadge = (account: TradingAccount) => {
    if (account.provider === 'deriv') {
      return (
        <Badge variant={account.is_virtual ? "secondary" : "default"} className="text-xs">
          {account.is_virtual ? 'Deriv Demo' : 'Deriv'}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {account.platform?.toUpperCase() || 'MT4/MT5'}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      connected: 'bg-profit text-white',
      pending_approval: 'bg-yellow-500 text-white',
      disconnected: 'bg-destructive text-white',
    };
    return (
      <Badge className={statusColors[status] || 'bg-muted'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const EmptyState = () => (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="text-center py-12">
        <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No accounts connected</h3>
        <p className="text-muted-foreground mb-6">
          Connect your trading accounts (Deriv, MetaTrader, etc.) to start trading
        </p>
        <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          Connect New Account
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Trading Accounts</h1>
            <p className="text-muted-foreground">Manage your connected trading accounts</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Connect New Account
          </Button>
        </div>

        {/* Accounts Table or Empty State */}
        {accounts.length === 0 ? (
          <EmptyState />
        ) : (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle>Connected Accounts</CardTitle>
              <CardDescription>Monitor and manage your trading accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Equity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-muted-foreground">{account.login}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getProviderBadge(account)}</TableCell>
                      <TableCell>{getStatusBadge(account.connection_status)}</TableCell>
                      <TableCell>
                        {account.deriv_currency || '$'}{account.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {account.deriv_currency || '$'}{account.equity.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {/* Deriv-specific actions */}
                          {account.provider === 'deriv' && account.deriv_token && (
                            <>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openDerivCashier(account, 'deposit')}
                                title="Deposit"
                              >
                                <ArrowDown className="w-4 h-4 text-profit" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openDerivCashier(account, 'withdraw')}
                                title="Withdraw"
                              >
                                <ArrowUp className="w-4 h-4 text-loss" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openDerivTransfer(account)}
                                title="Transfer Between Accounts"
                              >
                                <ArrowLeftRight className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => openDerivMT5Transfer(account)}
                                title="MT5 Deposit/Withdraw"
                              >
                                <Layers className="w-4 h-4 text-primary" />
                              </Button>
                            </>
                          )}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleRefresh(account)}
                            disabled={refreshingId === account.id}
                          >
                            <RefreshCw className={`w-4 h-4 ${refreshingId === account.id ? 'animate-spin' : ''}`} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleRename(account.id, account.name)}>
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteAccount(account.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Connect Account Modal */}
        <ConnectAccountModal open={isModalOpen} onOpenChange={setIsModalOpen} onAccountConnected={handleAccountConnected} />
        
        {/* Deriv Cashier Modal */}
        {selectedDerivAccount && (
          <>
            <DerivCashierModal
              open={derivCashierOpen}
              onOpenChange={setDerivCashierOpen}
              type={derivCashierType}
              account={selectedDerivAccount}
              onComplete={() => {
                setDerivCashierOpen(false);
                handleRefresh(selectedDerivAccount);
              }}
            />
            <DerivTransferModal
              open={derivTransferOpen}
              onOpenChange={setDerivTransferOpen}
              account={selectedDerivAccount}
              onComplete={() => {
                setDerivTransferOpen(false);
                handleRefresh(selectedDerivAccount);
              }}
            />
            <DerivMT5TransferModal
              open={derivMT5TransferOpen}
              onOpenChange={setDerivMT5TransferOpen}
              account={selectedDerivAccount}
              onComplete={() => {
                setDerivMT5TransferOpen(false);
                handleRefresh(selectedDerivAccount);
              }}
            />
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default TradingAccounts;