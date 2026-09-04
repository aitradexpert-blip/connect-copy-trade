import { useEffect, useState } from "react";
import { Plus, Settings, Trash2, RefreshCw, CreditCard, Wallet, ArrowDown, ArrowUp, ArrowLeftRight, Layers, WifiOff, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { OctaFxPromoCard } from "@/components/OctaFxPromoCard";
import { DerivCashierModal } from "@/components/deriv/DerivCashierModal";
import { DerivTransferModal } from "@/components/deriv/DerivTransferModal";
import { DerivMT5TransferModal } from "@/components/deriv/DerivMT5TransferModal";
import { primaryApi, isPrimaryConfigured } from '@/services/primaryApi';
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
  metaapi_health_status: string | null;
  metaapi_last_error: string | null;
  metaapi_health_checked_at: string | null;
}

const TradingAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [finalizingId, setFinalizingId] = useState<string | null>(null);
  const [credAccount, setCredAccount] = useState<TradingAccount | null>(null);
  const [credLogin, setCredLogin] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credServer, setCredServer] = useState("");
  
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
      .select("id,name,login,platform,connection_status,balance,equity,provider,provider_account_id,deriv_token,deriv_currency,is_virtual,metaapi_account_id,metaapi_health_status,metaapi_last_error,metaapi_health_checked_at")
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
        metaapi_health_status: a.metaapi_health_status,
        metaapi_last_error: a.metaapi_last_error,
        metaapi_health_checked_at: a.metaapi_health_checked_at,
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
    // Small delay to ensure DB write from ConnectAccountModal has committed
    await new Promise(resolve => setTimeout(resolve, 800));
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
      } else if (account.provider === 'vps' || (account as any).connection_type === 'vps') {
        if (!isPrimaryConfigured()) {
          toast({ title: 'VPS not configured', description: 'Check VITE_API_URL in Vercel settings.', variant: 'destructive' });
          setRefreshingId(null);
          return;
        }
        try {
          const vpsData: any = await primaryApi.getAccount(account.id);
          const balance = Number(vpsData?.balance ?? account.balance ?? 0);
          const equity = Number(vpsData?.equity ?? account.equity ?? 0);
          await supabase.from('trading_accounts').update({ balance, equity }).eq('id', account.id);
          toast({ title: 'Account refreshed', description: `Balance: $${balance.toFixed(2)}` });
          setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, balance, equity } : a));
        } catch (vpsErr: any) {
          toast({ title: 'VPS refresh failed', description: vpsErr?.message || 'Could not reach VPS', variant: 'destructive' });
        }
      } else {
        toast({ title: 'Cannot refresh', description: 'No valid connection for this account', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Refresh failed', description: err.message, variant: 'destructive' });
    } finally {
      setRefreshingId(null);
    }
  };

  // Ask the follow-up worker to finish (or diagnose) a stuck MetaAPI provisioning
  const handleFinalizeAccount = async (account: TradingAccount) => {
    setFinalizingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('metaapi-finalize-deployments', {
        body: { tradingAccountId: account.id },
      });
      if (error) throw error;
      const r = data?.results?.[0];
      const outcome = r?.outcome as string | undefined;
      if (outcome === 'healthy') {
        toast({ title: 'Account is ready', description: `${account.name} is deployed and connected.` });
      } else if (outcome === 'deploying') {
        toast({ title: 'Still finishing setup', description: r?.detail || 'The broker terminal is still starting up. We keep retrying every few minutes.' });
      } else {
        toast({
          title: 'Setup could not complete',
          description: r?.detail || r?.outcome || 'No response from the trading bridge.',
          variant: 'destructive',
        });
      }
      await loadAccounts();
    } catch (err: any) {
      toast({ title: 'Check failed', description: err.message, variant: 'destructive' });
    } finally {
      setFinalizingId(null);
    }
  };

const handleVerifyConnection = async (account: TradingAccount) => {
    setVerifyingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('verify-vps-connection', {
        body: { account_id: account.id },
      });
      if (error) throw error;
      if (data?.needsCredentials) {
        setCredAccount(account);
        setCredLogin(account.login || "");
        setCredServer("");
        setCredPassword("");
        toast({ title: "Reconnection needed", description: "No password on file — please re-enter your login details." });
      } else if (data?.success) {
        toast({ title: "Connection verified", description: `Balance: $${(data.data?.balance ?? 0).toFixed(2)}` });
        await loadAccounts();
      } else {
        toast({ title: "Verification failed", description: data?.error || "Could not verify connection", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Verify failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  const handleSubmitCredentials = async () => {
    if (!credAccount || !credLogin || !credPassword || !credServer) return;
    setVerifyingId(credAccount.id);
    try {
      const result: any = await primaryApi.connect({
        login: parseInt(credLogin, 10),
        password: credPassword,
        server: credServer,
        account_id: credAccount.id,
      });
      if (result?.success) {
        await supabase.from('trading_accounts').update({
          connection_status: 'connected',
          server: credServer,
          balance: result.data?.balance ?? 0,
          equity: result.data?.equity ?? 0,
        }).eq('id', credAccount.id);
        toast({ title: "Reconnected", description: `Balance: $${(result.data?.balance ?? 0).toFixed(2)}` });
        setCredAccount(null);
        await loadAccounts();
      } else {
        toast({ title: "Reconnect failed", description: result?.error || "Check your credentials", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Reconnect failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingId(null);
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

  const handleFinalizeAccount = async (account: TradingAccount) => {
    if (!account.metaapi_account_id) return;
    setRefreshingId(account.id);
    try {
      const { data, error } = await supabase.functions.invoke('metaapi-finalize-deployments', { body: { tradingAccountId: account.id } });
      if (error) throw error;
      const result = data?.results?.[0];
      toast({ title: result?.status === 'healthy' ? 'Account ready' : 'Setup status updated', description: result?.error || result?.status || 'Check complete' });
      await loadAccounts();
    } catch (err: any) {
      toast({ title: 'Check failed', description: err.message, variant: 'destructive' });
    } finally { setRefreshingId(null); }
  };

  const getProviderBadge = (account: TradingAccount) => {
    if (account.provider === 'vps' || (account as any).connection_type === 'vps') {
      return (
        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
          VPS Direct
        </Badge>
      );
    }
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

  const getStatusBadge = (status: string, account?: TradingAccount) => {
    const statusColors: Record<string, string> = {
      connected: 'bg-profit text-white',
      pending_approval: 'bg-yellow-500 text-white',
      provisioning: 'bg-yellow-500 text-white',
      needs_reconnect: 'bg-destructive text-white',
      disconnected: 'bg-destructive text-white',
      needs_reconnect: 'bg-destructive text-white',
      invalid_credentials: 'bg-destructive text-white',
      provisioning: 'bg-yellow-500 text-white',
    };
    const label = status === 'provisioning' ? 'finishing setup' : status.replace(/_/g, ' ');
    return (
      <div className="space-y-1">
        <Badge className={statusColors[status] || 'bg-muted'}>{label}</Badge>
        {(status === 'provisioning' || account.metaapi_health_status === 'error') && account.metaapi_last_error && (
          <div className="text-xs text-muted-foreground max-w-[220px]" title={account.metaapi_last_error}>
            {account.metaapi_last_error}
            {account.metaapi_health_checked_at && (
              <> · checked {new Date(account.metaapi_health_checked_at).toLocaleTimeString()}</>
            )}
          </div>
        )}
      </div>
    );
  };

  const EmptyState = () => (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="text-center py-12">
        <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No accounts connected</h3>
        <p className="text-muted-foreground mb-6">
          Connect your broker accounts (Deriv, MT4, MT5) to start trading
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
      <div className="space-y-6 max-w-full overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Trading Accounts</h1>
            <p className="text-muted-foreground text-sm md:text-base">Manage your connected trading accounts</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="bg-gradient-primary flex items-center gap-2 w-full md:w-auto">
            <Plus className="w-4 h-4" />
            Connect New Account
          </Button>
        </div>

        <OctaFxPromoCard />

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
                      <TableCell>
                            {getStatusBadge(account.connection_status, account)}
                            {account.provider === 'metaapi' && account.connection_status === 'provisioning' && (
                              <div className="mt-1 space-y-1">
                                <div className="text-xs text-muted-foreground">Finishing setup{account.metaapi_health_checked_at ? ` · checked ${new Date(account.metaapi_health_checked_at).toLocaleString()}` : ''}</div>
                                <Button size="sm" variant="outline" onClick={() => handleFinalizeAccount(account)} disabled={refreshingId === account.id}>Check setup status now</Button>
                              </div>
                            )}
                            {account.metaapi_last_error && account.connection_status === 'needs_reconnect' && <div className="mt-1 max-w-[220px] text-xs text-destructive">{account.metaapi_last_error}</div>}
                          </TableCell>
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
                          {/* Reconnect button for disconnected MetaAPI accounts */}
                          {account.provider !== 'deriv' && account.metaapi_account_id && 
                           (account.connection_status === 'disconnected' || account.connection_status === 'provisioning') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                setRefreshingId(account.id);
                                try {
                                  const { data, error } = await supabase.functions.invoke('metaapi-redeploy-account', {
                                    body: { accountId: account.metaapi_account_id }
                                  });
                                  if (error) throw error;
                                  if (data && !data.success) {
                                    toast({ title: 'Reconnect Issue', description: data.error || 'Could not reconnect. Please contact support.', variant: 'destructive' });
                                  } else {
                                    toast({ title: 'Reconnecting...', description: data?.message || 'Account reconnection initiated. Please wait 30-60 seconds.' });
                                    await supabase.from('trading_accounts').update({ connection_status: 'provisioning' }).eq('id', account.id);
                                    setAccounts(prev => prev.map(a => a.id === account.id ? { ...a, connection_status: 'provisioning' } : a));
                                  }
                                } catch (err: any) {
                                  toast({ title: 'Reconnect failed', description: err.message, variant: 'destructive' });
                                } finally {
                                  setRefreshingId(null);
                                }
                              }}
                              disabled={refreshingId === account.id}
                              title="Reconnect Account"
                              className="text-amber-500 hover:text-amber-600"
                            >
                              <WifiOff className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Check now: finish a stuck MetaAPI provisioning */}
                          {account.provider !== 'deriv' && account.metaapi_account_id &&
                           (account.connection_status === 'provisioning' ||
                            account.metaapi_health_status === 'deploying' ||
                            account.metaapi_health_status === 'error') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleFinalizeAccount(account)}
                              disabled={finalizingId === account.id}
                              title="Check setup status now"
                              className="text-primary hover:text-primary/80"
                            >
                              <RefreshCw className={`w-4 h-4 ${finalizingId === account.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                          {(account.provider === 'vps' || (account as any).connection_type === 'vps') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerifyConnection(account)}
                              disabled={verifyingId === account.id}
                              title="Verify / Reconnect"
                              className="text-primary hover:text-primary/80"
                            >
                              <ShieldCheck className={`w-4 h-4 ${verifyingId === account.id ? 'animate-pulse' : ''}`} />
                            </Button>
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

        {/* Reconnect credentials dialog — shown when a VPS account has no stored password */}
        <Dialog open={!!credAccount} onOpenChange={(open) => !open && setCredAccount(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reconnect {credAccount?.name}</DialogTitle>
              <DialogDescription>Re-enter your broker login details to restore this connection.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="cred-login">Login</Label>
                <Input id="cred-login" value={credLogin} onChange={(e) => setCredLogin(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-server">Server</Label>
                <Input id="cred-server" value={credServer} onChange={(e) => setCredServer(e.target.value)} placeholder="e.g. Weltrade-Real" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-password">Password</Label>
                <Input id="cred-password" type="password" value={credPassword} onChange={(e) => setCredPassword(e.target.value)} />
              </div>
              <Button onClick={handleSubmitCredentials} disabled={verifyingId === credAccount?.id} className="w-full">
                {verifyingId === credAccount?.id ? "Connecting..." : "Reconnect"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
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
