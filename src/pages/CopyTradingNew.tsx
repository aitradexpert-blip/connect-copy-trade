import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, TrendingUp, Copy, Settings, Play, Activity, Zap, Layers, RefreshCw, Shield, AlertCircle, CheckCircle2, StopCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AppLayout from "@/components/AppLayout";
import CopyTradingActiveBanner from "@/components/CopyTradingActiveBanner";
import { useCopyTrading } from "@/hooks/useCopyTrading";
import { getSharedDerivWS } from "@/services/derivWebSocket";
import { getCopyTradingList, getCopyTradingStats, startCopying, stopCopying } from "@/services/derivCopyTrading";

interface TradingAccount {
  id: string;
  name: string;
  platform: string;
  balance: number;
  is_master: boolean;
  is_virtual: boolean;
  provider: string;
  deriv_token: string | null;
  metaapi_account_id: string | null;
  connection_type: string;
}

interface MasterTrader {
  id: string;
  name: string;
  user_email: string;
  performance: number;
  followers: number;
  account_id: string;
  source: 'local' | 'deriv';
  token?: string; // For Deriv copy trading
  isOwn?: boolean; // Flag if this is the user's own account
}

interface CopyStats {
  copiedTrades: number;
  totalPL: number;
  successRate: number;
}

interface DerivCopyTrader {
  loginid: string;
  token: string;
  assets: string[];
  min_trade_stake: number;
  max_trade_stake: number;
  trade_types: string[];
  stats?: {
    copiers: number;
    performance_probability: number;
    total_trades: number;
    trades_profitable: number;
  };
}

interface CopyFactoryStrategy {
  id: string;
  name: string;
  accountId: string;
  description?: string;
  connectionId?: string;
}

export default function CopyTradingNew() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [masterTraders, setMasterTraders] = useState<MasterTrader[]>([]);
  const [derivCopyTraders, setDerivCopyTraders] = useState<DerivCopyTrader[]>([]);
  const [copyFactoryStrategies, setCopyFactoryStrategies] = useState<CopyFactoryStrategy[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [copyStats, setCopyStats] = useState<Record<string, CopyStats>>({});
  const [activeRelationships, setActiveRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDeriv, setLoadingDeriv] = useState(false);
  const [loadingCopyFactory, setLoadingCopyFactory] = useState(false);
  const [activeTab, setActiveTab] = useState("local");
  
  // CopyFactory Strategy Form
  const [strategyName, setStrategyName] = useState("");
  const [strategyDescription, setStrategyDescription] = useState("");
  const [creatingStrategy, setCreatingStrategy] = useState(false);

  useEffect(() => {
    loadData();
    subscribeToTrades();
  }, [user]);

  const subscribeToTrades = () => {
    if (!user) return;

    const channel = supabase
      .channel('copy-trades')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'trade_history',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        if (payload.new.copied_from) {
          toast({
            title: "Trade Copied!",
            description: `${payload.new.direction} ${payload.new.volume} lot ${payload.new.symbol} from Master account`,
          });
          loadData(); // Refresh stats
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const stopAllCopying = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('copy_trading_relationships')
      .update({ status: 'inactive' })
      .eq('follower_user_id', user.id)
      .eq('status', 'active');
    if (!error) {
      toast({ title: "Copy trading stopped", description: "All active copy relationships have been paused." });
      setActiveRelationships([]);
      loadData();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const loadData = async () => {
    if (!user) return;

    
    try {
      // Load user's trading accounts with provider info
      const { data: accountsData, error: accountsError } = await supabase
        .from("trading_accounts")
        .select("id,name,platform,balance,is_master,is_virtual,provider,deriv_token,metaapi_account_id,connection_type")
        .eq("user_id", user.id)
        .eq("connection_status", "connected");

      if (accountsError) throw accountsError;
      setAccounts(accountsData || []);

      // Load master traders from the public_master_accounts view
      // This view only exposes non-sensitive fields and excludes tokens
      const { data: mastersData, error: mastersError } = await supabase
        .from("public_master_accounts")
        .select(`
          id,
          name,
          platform,
          balance,
          user_id,
          display_id,
          is_virtual
        `);
      // Note: Removed .neq("user_id", user.id) to allow users to see and copy their own accounts

      if (mastersError) {
        console.error("Error loading masters:", mastersError);
        // Fallback to direct query if view doesn't exist
        const { data: fallbackData } = await supabase
          .from("trading_accounts")
          .select("id,name,platform,balance,user_id,is_master")
          .eq("is_master", true);
          // Removed .neq("user_id", user.id) to allow users to see their own master accounts
        
        const masters = (fallbackData || []).map((master: any) => ({
          id: master.id,
          name: master.name,
          user_email: master.user_id === user?.id ? "Your Account" : "Master Trader",
          performance: 12.5,
          followers: 0,
          account_id: master.id,
          master_user_id: master.user_id,
          source: 'local' as const,
          isOwn: master.user_id === user?.id
        }));
        setMasterTraders(masters);
      } else {
        const masters = (mastersData || []).map((master: any) => ({
          id: master.id,
          name: master.name,
          user_email: master.user_id === user?.id ? "Your Account" : (master.is_virtual ? "Demo Master" : "Master Trader"),
          performance: 12.5,
          followers: 0,
          account_id: master.id,
          master_user_id: master.user_id,
          source: 'local' as const,
          isOwn: master.user_id === user?.id
        }));
        setMasterTraders(masters);
      }

      // Load copy statistics for each relationship
      const { data: relationships } = await supabase
        .from("copy_trading_relationships")
        .select("id, master_account_id")
        .eq("follower_user_id", user.id)
        .eq("status", "active");

      setActiveRelationships(relationships || []);

      if (relationships && relationships.length > 0) {
        const stats: Record<string, CopyStats> = {};
        for (const rel of relationships) {
          const stat = await fetchCopyStats(rel.id);
          if (rel.master_account_id) {
            stats[rel.master_account_id] = stat;
          }
        }
        setCopyStats(stats);
      }
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Known Deriv master traders (including cTrader accounts)
  const KNOWN_DERIV_MASTERS: DerivCopyTrader[] = [
    {
      loginid: '1332263',
      token: '', // Token not needed for display
      assets: ['forex', 'synthetics'],
      min_trade_stake: 1,
      max_trade_stake: 1000,
      trade_types: ['CALL', 'PUT'],
      stats: {
        copiers: 0,
        performance_probability: 75,
        total_trades: 150,
        trades_profitable: 112,
      }
    }
  ];

  // Load Deriv copy trading masters (Options only)
  const loadDerivCopyTraders = async () => {
    // Get a REAL Deriv account to authorize with (not demo/virtual)
    const derivAccount = accounts.find(acc => 
      acc.provider === 'deriv' && 
      acc.deriv_token &&
      !acc.is_virtual // Only real accounts support copy trading
    );
    
    if (!derivAccount || !derivAccount.deriv_token) {
      // Check if user only has demo accounts
      const hasDerivDemo = accounts.some(acc => acc.provider === 'deriv' && acc.is_virtual);
      
      if (hasDerivDemo) {
        toast({
          title: "Real Account Required",
          description: "Copy trading requires a real Deriv CR account, not a demo account. You can still view available masters below.",
        });
      } else {
        toast({
          title: "Connect Deriv Account",
          description: "Connect a real Deriv account to view and follow Deriv copy traders",
          variant: "destructive",
        });
      }
      
      // Still show known masters even without authorization
      setDerivCopyTraders(KNOWN_DERIV_MASTERS);
      return;
    }

    setLoadingDeriv(true);
    try {
      const ws = getSharedDerivWS();
      
      // Connect first
      await ws.connect();
      
      // Authorize with the token - this is CRITICAL before copy_trading_list
      console.log('[CopyTrading] Authorizing Deriv account...');
      const authResponse = await ws.send({ authorize: derivAccount.deriv_token });
      
      if (authResponse.error) {
        throw new Error(authResponse.error.message || 'Authorization failed');
      }
      
      console.log('[CopyTrading] Authorization successful, fetching copy trading list...');
      
      // Get copy trading list - requires admin token scope
      // If the token doesn't have admin scope, this will fail with "Unrecognised request"
      try {
        const response = await getCopyTradingList(ws);
        
        console.log('[CopyTrading] Copy trading list response:', response);
        
        if (response.copy_trading_list?.traders && response.copy_trading_list.traders.length > 0) {
          // Fetch stats for each trader
          const tradersWithStats = await Promise.all(
            response.copy_trading_list.traders.map(async (trader) => {
              try {
                const stats = await getCopyTradingStats(trader.loginid, ws);
                return {
                  ...trader,
                  stats: {
                    copiers: stats.copy_trading_statistics.copiers,
                    performance_probability: stats.copy_trading_statistics.performance_probability,
                    total_trades: stats.copy_trading_statistics.total_trades,
                    trades_profitable: stats.copy_trading_statistics.trades_profitable,
                  }
                };
              } catch (err) {
                console.warn('[CopyTrading] Could not get stats for trader:', trader.loginid, err);
                return trader;
              }
            })
          );
          
          // Merge with known masters (avoid duplicates)
          const apiLoginIds = new Set(tradersWithStats.map(t => t.loginid));
          const additionalMasters = KNOWN_DERIV_MASTERS.filter(m => !apiLoginIds.has(m.loginid));
          
          setDerivCopyTraders([...tradersWithStats, ...additionalMasters]);
        } else {
          console.log('[CopyTrading] No Deriv API copy traders, showing known masters');
          // Show known masters even if API returns empty
          setDerivCopyTraders(KNOWN_DERIV_MASTERS);
        }
      } catch (listError: any) {
        // "Unrecognised request" means the token doesn't have admin scope
        // This is expected for most user tokens - they need to create an API token with admin scope
        console.warn('[CopyTrading] Could not fetch copy trading list:', listError.message);
        
        if (listError.message?.includes('Unrecognised') || listError.message?.includes('unrecognised')) {
          toast({
            title: "Copy Trading API Access",
            description: "To view all Deriv copy traders, create an API token with 'Admin' scope in your Deriv account settings. Showing known masters for now.",
          });
        }
        
        // Still show the known masters
        setDerivCopyTraders(KNOWN_DERIV_MASTERS);
      }
    } catch (error: any) {
      console.error("[CopyTrading] Error loading Deriv copy traders:", error);
      
      // Provide specific error messages
      let errorMessage = error.message;
      if (error.message?.includes('AuthorizationRequired')) {
        errorMessage = 'Please reconnect your Deriv account';
      } else if (error.message?.includes('PermissionDenied')) {
        errorMessage = 'Copy trading is not available for this account type. Please use a standard Deriv CR account.';
      } else if (error.message?.includes('InvalidToken')) {
        errorMessage = 'Your Deriv session has expired. Please reconnect your account.';
      }
      
      toast({
        title: "Error loading Deriv traders",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Still show known masters on error
      setDerivCopyTraders(KNOWN_DERIV_MASTERS);
    } finally {
      setLoadingDeriv(false);
    }
  };

  // Follow a Deriv copy trader
  // Follow a Deriv copy trader
  const followDerivTrader = async (traderToken: string, traderLoginId: string) => {
    const derivAccount = accounts.find(acc => acc.provider === 'deriv' && acc.deriv_token);
    if (!derivAccount || !derivAccount.deriv_token) {
      toast({
        title: "No Deriv Account",
        description: "Please select a Deriv account to copy trades",
        variant: "destructive",
      });
      return;
    }

    try {
      const ws = getSharedDerivWS();
      await ws.connect();
      
      // Authorize first
      const authResponse = await ws.send({ authorize: derivAccount.deriv_token });
      if (authResponse.error) {
        throw new Error(authResponse.error.message);
      }
      
      await startCopying({ copyTraderToken: traderToken }, ws);
      
      toast({
        title: "Successfully following Deriv trader",
        description: `You are now copying trades from ${traderLoginId}`,
      });
      
      loadDerivCopyTraders();
    } catch (error: any) {
      console.error('[CopyTrading] Error following Deriv trader:', error);
      toast({
        title: "Error following trader",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const fetchCopyStats = async (relationshipId: string): Promise<CopyStats> => {
    // @ts-expect-error - Supabase type inference causing deep recursion
    const response = await supabase
      .from('trade_history')
      .select('profit_loss, status')
      .eq('copied_from_relationship_id', relationshipId);
    
    const trades = response?.data as Array<{ profit_loss: number | null; status: string }> | null;
    
    const copiedTrades = trades?.length || 0;
    const totalPL = trades?.reduce((sum, t) => sum + (t.profit_loss || 0), 0) || 0;
    const closedTrades = trades?.filter(t => t.status === 'closed') || [];
    const winningTrades = closedTrades.filter(t => (t.profit_loss || 0) > 0);
    const successRate = closedTrades.length > 0 
      ? (winningTrades.length / closedTrades.length) * 100 
      : 0;
    
    return { copiedTrades, totalPL, successRate };
  };

  const toggleMasterStatus = async (accountId: string, currentStatus: boolean) => {
    try {
      // Lifecycle guard: only allow Master activation on connected accounts
      if (!currentStatus) {
        const acc: any = accounts.find((a) => a.id === accountId);
        const status = acc?.connection_status;
        if (status && status !== 'connected') {
          toast({
            title: "Cannot enable Master",
            description: `Account is "${status}". Connect / re-sync this account before activating Master role.`,
            variant: "destructive",
          });
          return;
        }
      }

      const { error } = await supabase
        .from("trading_accounts")
        .update({ is_master: !currentStatus })
        .eq("id", accountId);

      if (error) throw error;

      toast({
        title: !currentStatus ? "Account enabled as Master" : "Master status disabled",
        description: !currentStatus 
          ? "Your account is now available for others to copy" 
          : "Your account is no longer available for copying",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error updating master status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const followTrader = async (masterAccountId: string) => {
    if (!selectedAccount) {
      toast({
        title: "Select an account",
        description: "Please select an account to use for copying trades",
        variant: "destructive",
      });
      return;
    }

    const masterTrader = masterTraders.find(m => m.account_id === masterAccountId);
    const followerAcc = accounts.find(a => a.id === selectedAccount);
    const isSelfCopy = !!masterTrader?.isOwn;

    // Resolve the master's real user_id (server-side trigger also enforces this).
    let resolvedMasterUserId: string | undefined = (masterTrader as any)?.master_user_id;
    if (!resolvedMasterUserId) {
      const { data: masterRow } = await supabase
        .from("trading_accounts")
        .select("user_id")
        .eq("id", masterAccountId)
        .maybeSingle();
      resolvedMasterUserId = (masterRow as any)?.user_id;
    }

    try {
      const { error } = await supabase
        .from("copy_trading_relationships")
        .insert({
          follower_user_id: user?.id,
          follower_account_id: selectedAccount,
          master_account_id: masterAccountId,
          master_user_id: resolvedMasterUserId || user?.id,
          status: "active"
        });

      if (error) throw error;

      toast({
        title: isSelfCopy ? "Self-copy activated" : "Successfully following trader",
        description: isSelfCopy
          ? `Trades from ${masterTrader?.name || 'Master'} will mirror into ${followerAcc?.name || 'this account'}.`
          : "You will now copy trades from this master account",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error following trader",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Load CopyFactory strategies (MT4/MT5)
  const loadCopyFactoryStrategies = async () => {
    setLoadingCopyFactory(true);
    try {
      const { data, error } = await supabase.functions.invoke('copyfactory-list-strategies');
      
      if (error) throw error;
      
      if (data?.strategies) {
        setCopyFactoryStrategies(data.strategies);
      }
    } catch (error: any) {
      console.error('[CopyTrading] Error loading CopyFactory strategies:', error);
      toast({
        title: "Error loading strategies",
        description: error.message || "Could not load MT4/MT5 copy trading strategies",
        variant: "destructive",
      });
    } finally {
      setLoadingCopyFactory(false);
    }
  };

  // Create a CopyFactory strategy (become a provider)
  const createCopyFactoryStrategy = async () => {
    const metaApiAccount = accounts.find(acc => acc.metaapi_account_id);

    // VPS accounts can be masters without CopyFactory — just set is_master flag
    const vpsAccount = accounts.find(acc =>
      acc.provider === 'vps' || acc.connection_type === 'vps'
    );
    if (!metaApiAccount?.metaapi_account_id && vpsAccount) {
      const { error } = await supabase
        .from("trading_accounts")
        .update({ is_master: true })
        .eq("id", vpsAccount.id);
      if (!error) {
        toast({
          title: "Master account enabled!",
          description: "Your VPS account is now available for copy trading.",
        });
        loadData();
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      return;
    }

    if (!metaApiAccount?.metaapi_account_id) {
      toast({
        title: "No Trading Account",
        description: "Connect a trading account first to enable master copy trading.",
        variant: "destructive",
      });
      return;
    }

    if (!strategyName.trim()) {
      toast({
        title: "Strategy name required",
        description: "Please enter a name for your strategy",
        variant: "destructive",
      });
      return;
    }

    setCreatingStrategy(true);
    try {
      // Step 1: Enable CopyFactory PROVIDER role on the account
      console.log('[CopyTrading] Step 1: Enabling CopyFactory PROVIDER role...');
      toast({
        title: "Setting up provider role...",
        description: "Configuring your account for copy trading",
      });

      const { data: enableData, error: enableError } = await supabase.functions.invoke(
        'metaapi-enable-copy-factory',
        {
          body: {
            accountId: metaApiAccount.metaapi_account_id,
            copyFactoryRoles: ['PROVIDER'],
          }
        }
      );

      if (enableError) {
        console.error('[CopyTrading] Failed to enable CopyFactory role:', enableError);
        // Continue anyway - might already be enabled or we'll get a clearer error in step 2
      } else {
        console.log('[CopyTrading] CopyFactory PROVIDER role enabled:', enableData);
      }

      // Step 2: Create the strategy
      console.log('[CopyTrading] Step 2: Creating strategy...');
      const { data, error } = await supabase.functions.invoke('copyfactory-create-strategy', {
        body: {
          accountId: metaApiAccount.metaapi_account_id,
          name: strategyName.trim(),
          description: strategyDescription.trim() || undefined,
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create strategy');
      }

      toast({
        title: "Strategy created!",
        description: `Your strategy "${strategyName}" is now available for others to copy. Strategy ID: ${data.strategyId}`,
      });

      setStrategyName("");
      setStrategyDescription("");
      loadCopyFactoryStrategies();
      
      // Update account as master
      await supabase
        .from("trading_accounts")
        .update({ is_master: true })
        .eq("id", metaApiAccount.id);
      
      loadData();
    } catch (error: any) {
      console.error('[CopyTrading] Error creating strategy:', error);
      toast({
        title: "Failed to create strategy",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setCreatingStrategy(false);
    }
  };

  // Subscribe to a CopyFactory strategy
  const subscribeToCopyFactory = async (strategyId: string) => {
    const subscriberAccount = accounts.find(acc => 
      acc.metaapi_account_id && 
      acc.id === selectedAccount
    );

    if (!subscriberAccount?.metaapi_account_id) {
      toast({
        title: "Select an MT4/MT5 account",
        description: "Choose an MT4/MT5 account to copy trades to",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Enable CopyFactory SUBSCRIBER role on the account
      console.log('[CopyTrading] Enabling SUBSCRIBER role...');
      toast({
        title: "Setting up subscription...",
        description: "Configuring your account for copy trading",
      });

      const { error: enableError } = await supabase.functions.invoke(
        'metaapi-enable-copy-factory',
        {
          body: {
            accountId: subscriberAccount.metaapi_account_id,
            copyFactoryRoles: ['SUBSCRIBER'],
          }
        }
      );

      if (enableError) {
        console.error('[CopyTrading] Failed to enable SUBSCRIBER role:', enableError);
        // Continue anyway - might already be enabled
      }

      // Step 2: Subscribe to the strategy
      console.log('[CopyTrading] Subscribing to strategy:', strategyId);
      const { data, error } = await supabase.functions.invoke('copyfactory-subscribe', {
        body: {
          strategyId,
          subscriberId: subscriberAccount.metaapi_account_id,
        }
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to subscribe');
      }

      toast({
        title: "Successfully subscribed!",
        description: "You are now copying trades from this strategy",
      });

      loadCopyFactoryStrategies();
    } catch (error: any) {
      console.error('[CopyTrading] Subscription error:', error);
      toast({
        title: "Subscription failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading copy trading data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Copy Trading</h1>
          <p className="text-muted-foreground mt-2">
            Follow successful traders and copy their trades automatically with real-time statistics
          </p>
        </div>

        {/* Always-visible active copy status — shared across dashboards */}
        <CopyTradingActiveBanner />

        {/* User's Trading Accounts */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Your Trading Accounts
            </CardTitle>
            <CardDescription>
              Manage which accounts can be used for copy trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No trading accounts connected</p>
                <Button onClick={() => window.location.href = '/accounts?connect=1'}>
                  Connect Trading Account
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account Name</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Master Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{account.platform.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>${account.balance.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge className={account.is_master ? 'bg-profit text-white' : 'bg-muted'}>
                          {account.is_master ? 'Master' : 'Follower'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={account.is_master}
                            onCheckedChange={() => toggleMasterStatus(account.id, account.is_master)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {account.is_master ? 'Disable' : 'Enable'} Master
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Copy Trading Setup */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Follow Master Traders
            </CardTitle>
            <CardDescription>
              Select an account to use for copying trades, then follow successful traders
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Account for Copying</label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose account to copy trades with" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(acc => !acc.is_master).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        {account.name} (${account.balance?.toFixed(2) || '0.00'})
                        {account.provider === 'deriv' && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                            <Zap className="w-3 h-3 mr-1" />
                            Deriv
                          </Badge>
                        )}
                        {(account.provider === 'vps' || account.connection_type === 'vps') && (
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            VPS Direct
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabs for Local Masters, Deriv Copy Trading, and CopyFactory */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="local">Local Masters</TabsTrigger>
                <TabsTrigger value="deriv" onClick={() => derivCopyTraders.length === 0 && loadDerivCopyTraders()}>
                  <Zap className="w-4 h-4 mr-1" />
                  Deriv Options
                </TabsTrigger>
                <TabsTrigger value="copyfactory" onClick={() => copyFactoryStrategies.length === 0 && loadCopyFactoryStrategies()}>
                  <Layers className="w-4 h-4 mr-1" />
                  MT4/MT5
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="local" className="space-y-4 mt-4">
                <h3 className="text-lg font-semibold">Available Master Traders</h3>
                {masterTraders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No master traders available</p>
                    <p className="text-sm">Master traders will appear here when they enable their accounts</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {masterTraders.map((trader) => {
                      const stats = copyStats[trader.account_id];
                      return (
                        <Card key={trader.id} className="border border-border">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-4">
                              <div className="space-y-1">
                                <h4 className="font-medium">{trader.name}</h4>
                                <p className="text-sm text-muted-foreground">Trader: {trader.user_email}</p>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="flex items-center gap-1">
                                    <TrendingUp className="w-4 h-4 text-profit" />
                                    +{trader.performance}% return
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="w-4 h-4" />
                                    {trader.followers} followers
                                  </span>
                                </div>
                              </div>
                              {(() => {
                                const followerAcc = accounts.find(a => a.id === selectedAccount);
                                const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                                const ready = !!followerAcc && (
                                  (followerAcc.provider === 'deriv' && !!followerAcc.deriv_token) ||
                                  (followerAcc.provider === 'metaapi' && !!followerAcc.metaapi_account_id
                                    && UUID_RE.test(followerAcc.metaapi_account_id)) ||
                                  (followerAcc.provider === 'vps' || followerAcc.connection_type === 'vps')
                                );
                                return (
                                  <Button
                                    onClick={() => followTrader(trader.account_id)}
                                    disabled={!ready}
                                    title={ready ? '' : 'Account must be fully connected to start copying.'}
                                    className="bg-gradient-primary"
                                  >
                                    <Play className="w-4 h-4 mr-2" />
                                    {trader.isOwn ? 'Self-Copy' : 'Follow'}
                                  </Button>
                                );
                              })()}
                            </div>
                            
                            {/* Real-time Stats */}
                            {stats && (
                              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Copied Trades</div>
                                  <div className="text-lg font-semibold flex items-center justify-center gap-1">
                                    <Activity className="w-4 h-4" />
                                    {stats.copiedTrades}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Total P/L</div>
                                  <div className={`text-lg font-semibold ${stats.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                                    ${stats.totalPL.toFixed(2)}
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-muted-foreground mb-1">Success Rate</div>
                                  <div className="text-lg font-semibold">
                                    {stats.successRate.toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="deriv" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Deriv Copy Trading (Options)</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadDerivCopyTraders}
                    disabled={loadingDeriv}
                  >
                    {loadingDeriv ? "Loading..." : "Refresh"}
                  </Button>
                </div>
                
                <div className="bg-accent/50 p-3 rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    <strong>Note:</strong> Deriv copy trading is available only for Options trading. 
                    For MT5 copy trading, use MetaQuotes Signals directly in the MT5 app.
                  </p>
                </div>
                
                {loadingDeriv ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : derivCopyTraders.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No Deriv copy traders found</p>
                    <p className="text-sm">Connect a Deriv account and click "Refresh" to load available traders</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {derivCopyTraders.map((trader) => (
                      <Card key={trader.loginid} className="border border-border">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{trader.loginid}</h4>
                                <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                                  <Zap className="w-3 h-3 mr-1" />
                                  Options
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Stake: ${trader.min_trade_stake} - ${trader.max_trade_stake}
                              </p>
                              <div className="flex items-center gap-4 text-sm">
                                {trader.stats && (
                                  <>
                                    <span className="flex items-center gap-1">
                                      <TrendingUp className="w-4 h-4 text-profit" />
                                      {trader.stats.performance_probability}% win rate
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="w-4 h-4" />
                                      {trader.stats.copiers} copiers
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Activity className="w-4 h-4" />
                                      {trader.stats.total_trades} trades
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {trader.assets.slice(0, 5).map((asset) => (
                                  <Badge key={asset} variant="secondary" className="text-xs">
                                    {asset}
                                  </Badge>
                                ))}
                                {trader.assets.length > 5 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{trader.assets.length - 5} more
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <Button
                              onClick={() => followDerivTrader(trader.token, trader.loginid)}
                              disabled={!accounts.some(acc => acc.provider === 'deriv' && acc.deriv_token)}
                              className="bg-gradient-primary"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Copy
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
              
              {/* CopyFactory Tab - MT4/MT5 Copy Trading */}
              <TabsContent value="copyfactory" className="space-y-6 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">MT4/MT5 Copy Trading</h3>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={loadCopyFactoryStrategies}
                    disabled={loadingCopyFactory}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingCopyFactory ? 'animate-spin' : ''}`} />
                    {loadingCopyFactory ? "Loading..." : "Refresh"}
                  </Button>
                </div>
                
                {/* Become a Provider Section */}
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Become a Master Trader
                    </CardTitle>
                    <CardDescription>
                      Share your trades and let others copy your strategies
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="strategyName">Strategy Name</Label>
                        <Input
                          id="strategyName"
                          placeholder="e.g., Gold Scalping Pro"
                          value={strategyName}
                          onChange={(e) => setStrategyName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="strategyDesc">Description (Optional)</Label>
                        <Input
                          id="strategyDesc"
                          placeholder="Brief description of your strategy"
                          value={strategyDescription}
                          onChange={(e) => setStrategyDescription(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Button
                        onClick={createCopyFactoryStrategy}
                        disabled={creatingStrategy || !accounts.some(a => a.metaapi_account_id)}
                        className="bg-gradient-primary"
                      >
                        {creatingStrategy ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Create Strategy
                          </>
                        )}
                      </Button>
                      {!accounts.some(a => a.metaapi_account_id) && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          {accounts.some(a => a.provider === 'vps' || a.connection_type === 'vps')
                            ? 'Your VPS account will be activated as master directly'
                            : 'Connect a trading account first'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Available Strategies to Copy */}
                <div className="space-y-4">
                  <h4 className="font-medium">Available Strategies</h4>
                  
                  {loadingCopyFactory ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : copyFactoryStrategies.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Layers className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No MT4/MT5 strategies available yet</p>
                      <p className="text-sm">Be the first to create a strategy or check back later</p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {copyFactoryStrategies.map((strategy) => (
                        <Card key={strategy.id} className="border border-border hover:border-primary/30 transition-colors">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{strategy.name}</h4>
                                  <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/30">
                                    <Layers className="w-3 h-3 mr-1" />
                                    MT4/MT5
                                  </Badge>
                                </div>
                                {strategy.description && (
                                  <p className="text-sm text-muted-foreground">{strategy.description}</p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                  Account: {strategy.accountId?.slice(0, 8)}...
                                </p>
                              </div>
                              <Button
                                onClick={() => subscribeToCopyFactory(strategy.id)}
                                disabled={!accounts.some(a => a.metaapi_account_id && a.id === selectedAccount)}
                                className="bg-gradient-primary"
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium mb-1">How MT4/MT5 Copy Trading Works</p>
                      <ul className="text-muted-foreground space-y-1">
                        <li>• Providers share their trades automatically</li>
                        <li>• Subscribers copy trades to their own accounts</li>
                        <li>• Trades are mirrored in real-time with customizable lot sizing</li>
                        <li>• Works with any MT4/MT5 broker connected to HuMi</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
