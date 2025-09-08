import { useEffect, useState } from "react";
import { Plus, Settings, Trash2, RefreshCw, CreditCard } from "lucide-react";
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
import AppLayout from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface TradingAccount {
  id: string;
  name: string;
  metaapi_account_id: string;
  login: string;
  platform: string;
  connection_status: string;
  balance: number;
  equity: number;
}

const TradingAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchParams] = useSearchParams();

  const loadAccounts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("trading_accounts")
      .select("id,name,metaapi_account_id,login,platform,connection_status,balance,equity")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      toast({ title: "Failed to load accounts", description: error.message });
      return;
    }
    setAccounts(
      (data || []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        metaapi_account_id: a.metaapi_account_id as string,
        login: a.login as string,
        platform: a.platform as string,
        connection_status: (a.connection_status as string) || "connected",
        balance: Number(a.balance || 0),
        equity: Number(a.equity || 0),
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
    const { data: info, error: fnError } = await supabase.functions.invoke('metaapi-account-info', {
      body: { accountId: account.metaapi_account_id },
    });
    if (fnError) {
      toast({ title: 'Refresh failed', description: fnError.message, variant: 'destructive' });
      return;
    }
    const balance = Number(info?.balance || 0);
    const equity = Number(info?.equity || 0);
    const { error } = await supabase
      .from('trading_accounts')
      .update({ balance, equity })
      .eq('id', account.id);
    if (error) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Account refreshed' });
      setAccounts((prev) => prev.map((a) => a.id === account.id ? { ...a, balance, equity } : a));
    }
  };

  const EmptyState = () => (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardContent className="text-center py-12">
        <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No accounts connected</h3>
        <p className="text-muted-foreground mb-6">
          Connect your MetaTrader accounts to start copy trading
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
            <p className="text-muted-foreground">Manage your connected MetaTrader accounts</p>
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
                    <TableHead>Account Name</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Equity</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>{account.login}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.platform?.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-profit text-white">
                          {account.connection_status || "connected"}
                        </Badge>
                      </TableCell>
                      <TableCell>${account.balance.toFixed(2)}</TableCell>
                      <TableCell>${account.equity.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleRefresh(account)}>
                            <RefreshCw className="w-4 h-4" />
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
      </div>
    </AppLayout>
  );
};

export default TradingAccounts;
