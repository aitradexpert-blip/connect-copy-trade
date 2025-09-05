import { useState } from "react";
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

interface TradingAccount {
  id: number;
  name: string;
  accountId: string;
  platform: string;
  status: string;
  balance: number;
  equity: number;
}

const TradingAccounts = () => {
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAccountConnected = (newAccount: TradingAccount) => {
    setAccounts([...accounts, newAccount]);
  };

  const handleDeleteAccount = (id: number) => {
    setAccounts(accounts.filter(account => account.id !== id));
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
          <Button 
            onClick={() => setIsModalOpen(true)} 
            className="bg-gradient-primary flex items-center gap-2"
          >
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
              <CardDescription>
                Monitor and manage your trading accounts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Account ID</TableHead>
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
                      <TableCell>{account.accountId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {account.platform === 'mt4' ? 'MetaTrader 4' : 'MetaTrader 5'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-profit text-white">
                          Connected
                        </Badge>
                      </TableCell>
                      <TableCell>${account.balance.toFixed(2)}</TableCell>
                      <TableCell>${account.equity.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm">
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
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
        <ConnectAccountModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onAccountConnected={handleAccountConnected}
        />
      </div>
    </AppLayout>
  );
};

export default TradingAccounts;