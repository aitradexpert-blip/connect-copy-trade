import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Loader2, ExternalLink, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { authorizeDerivAccount, getDerivCashierInfo } from '@/services/derivBroker';
import { getSharedDerivWS } from '@/services/derivWebSocket';

interface TradingAccount {
  id: string;
  name: string;
  login: string;
  platform: string;
  provider: string;
  provider_account_id: string | null;
  deriv_token: string | null;
  deriv_currency: string | null;
  balance: number | null;
  is_virtual: boolean | null;
}

interface BrokerActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: 'deposit' | 'withdraw';
}

export function BrokerActionModal({ open, onOpenChange, action }: BrokerActionModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingAccount, setProcessingAccount] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      loadAccounts();
    }
  }, [open, user]);

  const loadAccounts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, login, platform, provider, provider_account_id, deriv_token, deriv_currency, balance, is_virtual')
        .eq('user_id', user.id);

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: "Error",
        description: "Failed to load trading accounts",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDerivAction = async (account: TradingAccount) => {
    if (!account.deriv_token) {
      toast({
        title: "Error",
        description: "Missing Deriv authorization token",
        variant: "destructive"
      });
      return;
    }

    setProcessingAccount(account.id);
    try {
      const ws = getSharedDerivWS();
      
      // Authorize the account first
      await authorizeDerivAccount(account.deriv_token, ws);
      
      // Get cashier info
      const cashierInfo = await getDerivCashierInfo(action, ws);
      
      if (cashierInfo.cashier) {
        // Open cashier URL in new tab
        window.open(cashierInfo.cashier, '_blank');
        toast({
          title: `${action === 'deposit' ? 'Deposit' : 'Withdrawal'} Page Opened`,
          description: `Complete your ${action} on Deriv's secure page`
        });
        onOpenChange(false);
      } else {
        throw new Error('No cashier URL returned');
      }
    } catch (error: any) {
      console.error(`Deriv ${action} error:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to open ${action} page`,
        variant: "destructive"
      });
    } finally {
      setProcessingAccount(null);
    }
  };

  const handleMetaApiAction = (account: TradingAccount) => {
    toast({
      title: `${action === 'deposit' ? 'Deposit' : 'Withdraw'} via Broker`,
      description: `Please ${action} directly through your broker's platform (${account.platform}). Log in to your broker's website or MT4/MT5 terminal.`,
    });
    onOpenChange(false);
  };

  const handleAccountAction = (account: TradingAccount) => {
    if (account.provider === 'deriv') {
      handleDerivAction(account);
    } else {
      handleMetaApiAction(account);
    }
  };

   const getProviderBadge = (provider: string) => {
    switch (provider) {
      case 'deriv':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Deriv</Badge>;
      case 'metaapi':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">MT4/MT5</Badge>;
      default:
        return <Badge variant="outline">{provider}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action === 'deposit' ? (
              <ArrowDown className="w-5 h-5 text-profit" />
            ) : (
              <ArrowUp className="w-5 h-5 text-loss" />
            )}
            {action === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
          </DialogTitle>
          <DialogDescription>
            Select a trading account to {action} funds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No trading accounts connected</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => {
                  onOpenChange(false);
                  window.location.href = '/accounts';
                }}
              >
                Connect Account
              </Button>
            </div>
          ) : (
            accounts.map((account) => (
              <Card 
                key={account.id} 
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleAccountAction(account)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.name}</span>
                      {getProviderBadge(account.provider)}
                      {account.is_virtual && (
                        <Badge variant="outline" className="text-xs">Demo</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {account.login} • {account.platform}
                    </div>
                    {account.balance !== null && (
                      <div className="text-sm font-medium mt-1">
                        Balance: {account.deriv_currency || 'USD'} {account.balance?.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {processingAccount === account.id ? (
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    ) : (
                      <Button size="sm" variant="ghost">
                        {account.provider === 'deriv' ? (
                          <ExternalLink className="w-4 h-4" />
                        ) : (
                          action === 'deposit' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
