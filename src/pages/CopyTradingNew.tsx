import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, Copy, Settings, Play, Activity, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AppLayout from "@/components/AppLayout";
import { getSharedDerivWS } from "@/services/derivWebSocket";
import { getCopyTradingList, getCopyTradingStats, startCopying, stopCopying } from "@/services/derivCopyTrading";

interface TradingAccount {
  id: string;
  name: string;
  platform: string;
  balance: number;
  is_master: boolean;
  provider: string;
  deriv_token: string | null;
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

export default function CopyTradingNew() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [masterTraders, setMasterTraders] = useState<MasterTrader[]>([]);
  const [derivCopyTraders, setDerivCopyTraders] = useState<DerivCopyTrader[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [copyStats, setCopyStats] = useState<Record<string, CopyStats>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDeriv, setLoadingDeriv] = useState(false);
  const [activeTab, setActiveTab] = useState("local");

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

  const loadData = async () => {
    if (!user) return;
    
    try {
      // Load user's trading accounts with provider info
      const { data: accountsData, error: accountsError } = await supabase
        .from("trading_accounts")
        .select("id,name,platform,balance,is_master,provider,deriv_token")
        .eq("user_id", user.id);

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
        `)
        .neq("user_id", user.id);

      if (mastersError) {
        console.error("Error loading masters:", mastersError);
        // Fallback to direct query if view doesn't exist
        const { data: fallbackData } = await supabase
          .from("trading_accounts")
          .select("id,name,platform,balance,user_id")
          .eq("is_master", true)
          .neq("user_id", user.id);
        
        const masters = (fallbackData || []).map((master: any) => ({
          id: master.id,
          name: master.name,
          user_email: "Master Trader",
          performance: 12.5,
          followers: 0,
          account_id: master.id,
          source: 'local' as const
        }));
        setMasterTraders(masters);
      } else {
        const masters = (mastersData || []).map((master: any) => ({
          id: master.id,
          name: master.name,
          user_email: master.is_virtual ? "Demo Master" : "Master Trader",
          performance: 12.5,
          followers: 0,
          account_id: master.id,
          source: 'local' as const
        }));
        setMasterTraders(masters);
      }

      // Load copy statistics for each relationship
      const { data: relationships } = await supabase
        .from("copy_trading_relationships")
        .select("id, master_account_id")
        .eq("follower_user_id", user.id)
        .eq("status", "active");

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

  // Load Deriv copy trading masters (Options only)
  const loadDerivCopyTraders = async () => {
    // Get a Deriv account to authorize with
    const derivAccount = accounts.find(acc => acc.provider === 'deriv' && acc.deriv_token);
    if (!derivAccount || !derivAccount.deriv_token) {
      toast({
        title: "Connect Deriv Account",
        description: "Connect a Deriv account to view Deriv copy traders",
        variant: "destructive",
      });
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
      
      // Get copy trading list
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
        setDerivCopyTraders(tradersWithStats);
      } else {
        console.log('[CopyTrading] No Deriv copy traders available');
        toast({
          title: "No Deriv Copy Traders",
          description: "No copy traders are currently available on the Deriv platform",
        });
        setDerivCopyTraders([]);
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

    try {
      const { error } = await supabase
        .from("copy_trading_relationships")
        .insert({
          follower_user_id: user?.id,
          follower_account_id: selectedAccount,
          master_account_id: masterAccountId,
          status: "active"
        });

      if (error) throw error;

      toast({
        title: "Successfully following trader",
        description: "You will now copy trades from this master account",
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
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabs for Local Masters and Deriv Copy Trading */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="local">Local Masters</TabsTrigger>
                <TabsTrigger value="deriv" onClick={() => derivCopyTraders.length === 0 && loadDerivCopyTraders()}>
                  <Zap className="w-4 h-4 mr-1" />
                  Deriv Options
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
                              <Button
                                onClick={() => followTrader(trader.account_id)}
                                disabled={!selectedAccount}
                                className="bg-gradient-primary"
                              >
                                <Play className="w-4 h-4 mr-2" />
                                Follow
                              </Button>
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
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
