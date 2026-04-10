import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMentor } from "@/contexts/MentorContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Loader2, TrendingUp, TrendingDown, Home, Lightbulb, Copy, Bot, ExternalLink, Plus, Play, StopCircle, Wallet, User, Settings, Download, LogOut, Smartphone, Menu } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { LotSizeInput } from "@/components/ui/lot-size-input";
import { useSubscription } from "@/hooks/useSubscription";
import { ConnectAccountModal } from "@/components/ConnectAccountModal";
import { executeOnAccount, type TradeSignal, type TradingAccount } from "@/services/brokerExecution";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import WelcomeModal from "@/components/WelcomeModal";

interface Signal {
  id: string;
  symbol: string;
  direction: string;
  lot_size: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  comment?: string | null;
  created_at: string;
}

interface Account {
  id: string;
  name: string;
  login: string;
  balance: number | null;
  metaapi_account_id: string | null;
  provider: string;
  deriv_token: string | null;
  deriv_currency: string | null;
  is_virtual: boolean | null;
}

interface CopyRelationship {
  id: string;
  status: string | null;
  master_account_id: string | null;
  master_user_id: string | null;
}

export default function MentorClientDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canInstall, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const {
    mentorBrandName, mentorId, mentorUserId, mentorMediaUrl, mentorMediaType,
    mentorUiConfig, featureRenames, getFeatureName
  } = useMentor();

  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [copyRelationship, setCopyRelationship] = useState<CopyRelationship | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [executingSignal, setExecutingSignal] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showExecuteDialog, setShowExecuteDialog] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<Signal | null>(null);
  const [activatingCopy, setActivatingCopy] = useState(false);
  const [manualLotSize, setManualLotSize] = useState(0.01);
  const [riskPercent, setRiskPercent] = useState(1);
  const [showSubscribePrompt, setShowSubscribePrompt] = useState(false);
  const { subscription, isFree } = useSubscription();

  const primaryColor = mentorUiConfig?.primary_color || "#6366f1";
  const secondaryColor = mentorUiConfig?.secondary_color || "#8b5cf6";

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleInstallApp = async () => {
    if (canInstall) {
      await install();
    } else {
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user, mentorId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load trading accounts
      const { data: accs } = await supabase
        .from('trading_accounts')
        .select('id, name, login, balance, metaapi_account_id, provider, deriv_token, deriv_currency, is_virtual')
        .eq('user_id', user!.id);
      setAccounts((accs || []) as Account[]);
      if (accs && accs.length > 0 && !selectedAccountId) {
        setSelectedAccountId(accs[0].id);
      }

      // Load signals (mentor's + HuMi official)
      if (mentorId) {
        const { data: sigs } = await supabase
          .from('trading_signals')
          .select('id, symbol, direction, lot_size, stop_loss, take_profit, comment, created_at')
          .eq('status', 'active')
          .or(`mentor_id.eq.${mentorId},mentor_id.is.null`)
          .order('created_at', { ascending: false })
          .limit(20);
        setSignals((sigs || []) as Signal[]);
      }

      // Load copy trading relationship
      const { data: copyData } = await supabase
        .from('copy_trading_relationships')
        .select('id, status, master_account_id, master_user_id')
        .eq('follower_user_id', user!.id)
        .eq('master_user_id', mentorUserId || '')
        .maybeSingle();
      setCopyRelationship(copyData as CopyRelationship | null);
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateLotFromRisk = (riskPct: number) => {
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account?.balance) return 0.01;
    const riskAmount = (account.balance * riskPct) / 100;
    return Math.max(0.01, Math.round((riskAmount / 100) * 100) / 100);
  };

  const calculateRiskFromLot = (lots: number) => {
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account?.balance) return 1;
    return Math.min(100, Math.round(((lots * 100) / account.balance) * 100));
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 2) return 'text-green-500';
    if (risk <= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskLabel = (risk: number) => {
    if (risk <= 1) return 'Conservative';
    if (risk <= 2) return 'Moderate';
    if (risk <= 5) return 'Aggressive';
    return 'Very High Risk';
  };

  const handleConnectAccount = () => {
    if (isFree) {
      setShowSubscribePrompt(true);
    } else {
      setShowConnectModal(true);
    }
  };

  const executeSignal = async () => {
    if (!selectedSignal || !selectedAccountId) return;
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) return;

    setExecutingSignal(selectedSignal.id);
    try {
      const brokerAccount: TradingAccount = {
        id: account.id,
        name: account.name,
        metaapi_account_id: account.metaapi_account_id,
        provider: account.provider,
        deriv_token: account.deriv_token,
        deriv_currency: account.deriv_currency,
        is_virtual: account.is_virtual,
        login: account.login,
      };
      const signal: TradeSignal = {
        symbol: selectedSignal.symbol,
        direction: selectedSignal.direction as 'BUY' | 'SELL',
        volume: manualLotSize,
        stopLoss: selectedSignal.stop_loss,
        takeProfit: selectedSignal.take_profit,
        comment: selectedSignal.comment || `Signal ${selectedSignal.id.slice(0, 8)}`,
      };
      await executeOnAccount(brokerAccount, signal);
      toast({ title: "Trade executed!", description: `${signal.direction} ${signal.symbol} @ ${manualLotSize} lots` });
      setShowExecuteDialog(false);
    } catch (err: any) {
      toast({ title: "Execution failed", description: err.message, variant: "destructive" });
    } finally {
      setExecutingSignal(null);
    }
  };

  const activateCopyTrading = async () => {
    if (accounts.length === 0) {
      setShowConnectModal(true);
      return;
    }
    setActivatingCopy(true);
    try {
      // Find mentor's master account
      const { data: masterAcc } = await supabase
        .from('trading_accounts')
        .select('id, user_id')
        .eq('user_id', mentorUserId || '')
        .eq('is_master', true)
        .maybeSingle();

      if (!masterAcc) {
        toast({ title: "Copy trading unavailable", description: "Your mentor hasn't set up a master trading account yet.", variant: "destructive" });
        return;
      }

      const followerAccount = accounts.find(a => a.id === selectedAccountId) || accounts[0];

      const { error } = await supabase.from('copy_trading_relationships').insert({
        follower_user_id: user!.id,
        follower_account_id: followerAccount.id,
        master_account_id: masterAcc.id,
        master_user_id: masterAcc.user_id,
        status: 'active',
      });

      if (error) throw error;
      toast({ title: "Copy trading activated!", description: "You'll now automatically copy your mentor's trades." });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setActivatingCopy(false);
    }
  };

  const stopCopyTrading = async () => {
    if (!copyRelationship) return;
    try {
      await supabase
        .from('copy_trading_relationships')
        .update({ status: 'inactive' })
        .eq('id', copyRelationship.id);
      toast({ title: "Copy trading stopped" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)` }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        {mentorMediaUrl ? (
          mentorMediaType === 'video' ? (
            <video src={mentorMediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <img src={mentorMediaUrl} alt={mentorBrandName || ''} className="absolute inset-0 w-full h-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }} />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 h-full flex items-end p-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-white">{mentorBrandName || 'Mentor Center'}</h1>
            <p className="text-white/70 mt-1">{mentorUiConfig?.welcome_text || 'Your trading dashboard'}</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                <Menu className="w-4 h-4 mr-1" /> Menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <User className="w-4 h-4 mr-2" /> Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}>
                <Settings className="w-4 h-4 mr-2" /> Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleInstallApp}>
                <Download className="w-4 h-4 mr-2" /> Install App
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/?dashboard=main")}>
                <ExternalLink className="w-4 h-4 mr-2" /> HuMi Dashboard
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" /> Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="home" className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="home" className="flex items-center gap-1">
              <Home className="w-4 h-4" /> Home
            </TabsTrigger>
            <TabsTrigger value="ideas" className="flex items-center gap-1">
              <Lightbulb className="w-4 h-4" /> {getFeatureName('trading_ideas_name').split(' ')[0]}
            </TabsTrigger>
            <TabsTrigger value="copy" className="flex items-center gap-1">
              <Copy className="w-4 h-4" /> {getFeatureName('copy_trading_name').split(' ')[0]}
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex items-center gap-1">
              <Bot className="w-4 h-4" /> Bot
            </TabsTrigger>
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="home" className="space-y-6">
            {accounts.length === 0 ? (
              <Card className="border-dashed border-2">
                <CardContent className="p-8 text-center">
                  <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Connect Your Trading Account</h3>
                  <p className="text-muted-foreground mb-4">Link your MT4/MT5 or Deriv account to start trading.</p>
                  <Button onClick={handleConnectAccount} style={{ backgroundColor: primaryColor }}>
                    <Plus className="w-4 h-4 mr-2" /> Connect Account
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(acc => (
                  <Card key={acc.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{acc.name}</span>
                        <Badge variant="outline">{acc.provider}</Badge>
                      </div>
                      <p className="text-2xl font-bold">${(acc.balance || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">Login: {acc.login}</p>
                    </CardContent>
                  </Card>
                ))}
                <Card className="border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors" onClick={handleConnectAccount}>
                  <CardContent className="p-4 flex items-center justify-center h-full min-h-[100px]">
                    <div className="text-center text-muted-foreground">
                      <Plus className="w-6 h-6 mx-auto mb-1" />
                      <span className="text-sm">Add Account</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Recent signals preview */}
            {signals.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Latest {getFeatureName('trading_ideas_name')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {signals.slice(0, 3).map(sig => (
                    <div key={sig.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={sig.direction === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                          {sig.direction === 'BUY' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {sig.direction}
                        </Badge>
                        <span className="font-semibold">{sig.symbol}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{sig.lot_size} lots</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* IDEAS TAB */}
          <TabsContent value="ideas" className="space-y-4">
            {accounts.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Execute on:</span>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name} (${acc.balance?.toLocaleString()})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {signals.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No trading ideas available yet. Check back soon!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {signals.map(sig => (
                  <Card key={sig.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold">{sig.symbol}</span>
                        <Badge className={sig.direction === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                          {sig.direction === 'BUY' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                          {sig.direction}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Volume: {sig.lot_size} lots</p>
                        {sig.stop_loss && <p>SL: {sig.stop_loss}</p>}
                        {sig.take_profit && <p>TP: {sig.take_profit}</p>}
                        {sig.comment && <p className="italic">{sig.comment}</p>}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className="text-xs text-muted-foreground">{new Date(sig.created_at).toLocaleString()}</span>
                        {accounts.length > 0 && (
                          <Button
                            size="sm"
                            onClick={() => { setSelectedSignal(sig); setShowExecuteDialog(true); }}
                            style={{ backgroundColor: primaryColor }}
                          >
                            <Play className="w-3 h-3 mr-1" /> Execute
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* COPY TRADING TAB */}
          <TabsContent value="copy" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{getFeatureName('copy_trading_name')}</CardTitle>
                <CardDescription>Automatically copy your mentor's trades to your account</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {copyRelationship && copyRelationship.status === 'active' ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                      <div>
                        <p className="font-semibold text-green-700 dark:text-green-400">Copy Trading Active</p>
                        <p className="text-sm text-muted-foreground">Your mentor's trades are being copied to your account</p>
                      </div>
                    </div>
                    <Button variant="destructive" onClick={stopCopyTrading}>
                      <StopCircle className="w-4 h-4 mr-2" /> Stop Copy Trading
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-4">
                    <Copy className="w-12 h-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Copy your mentor's trades automatically</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        When your mentor places trades on their MetaTrader account, the same trades will be placed on your linked account.
                      </p>
                    </div>
                    {accounts.length > 0 && (
                      <div className="flex items-center justify-center gap-3">
                        <span className="text-sm text-muted-foreground">Copy to:</span>
                        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                          <SelectTrigger className="w-64">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map(acc => (
                              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button
                      onClick={activateCopyTrading}
                      disabled={activatingCopy}
                      size="lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {activatingCopy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                      {accounts.length === 0 ? 'Connect Account to Start' : 'Activate Copy Trading'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI BOT TAB */}
          <TabsContent value="bot" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{getFeatureName('ai_bot_name')}</CardTitle>
                <CardDescription>AI-powered automated trading</CardDescription>
              </CardHeader>
              <CardContent className="text-center py-8">
                <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: primaryColor }} />
                <p className="text-muted-foreground mb-4">Access the full {getFeatureName('ai_bot_name')} on the HuMi dashboard</p>
                <Button onClick={() => navigate("/ai-trading")} style={{ backgroundColor: primaryColor }}>
                  Open {getFeatureName('ai_bot_name')}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Execute Trade Dialog */}
      <Dialog open={showExecuteDialog} onOpenChange={setShowExecuteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Trade</DialogTitle>
            <DialogDescription>
              {selectedSignal?.direction} {selectedSignal?.symbol} @ {selectedSignal?.lot_size} lots
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map(acc => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name} (${acc.balance?.toLocaleString()})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSignal?.stop_loss && <p className="text-sm">Stop Loss: {selectedSignal.stop_loss}</p>}
            {selectedSignal?.take_profit && <p className="text-sm">Take Profit: {selectedSignal.take_profit}</p>}
            <Button
              onClick={executeSignal}
              disabled={!!executingSignal}
              className="w-full"
              style={{ backgroundColor: primaryColor }}
            >
              {executingSignal ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Confirm Trade
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connect Account Modal */}
      <ConnectAccountModal open={showConnectModal} onOpenChange={setShowConnectModal} />

      {/* Install Guide Dialog */}
      <Dialog open={showInstallGuide} onOpenChange={setShowInstallGuide}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Install HuMi App</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            {isIOS ? (
              <p>Open in <strong>Safari</strong> → tap <strong>Share ↗</strong> → <strong>"Add to Home Screen"</strong></p>
            ) : isAndroid ? (
              <p>Open in <strong>Chrome</strong> → tap <strong>⋮ Menu</strong> → <strong>"Add to Home Screen"</strong></p>
            ) : (
              <p>Open in <strong>Chrome</strong> → click the install icon in the address bar, or use <strong>⋮ → Install App</strong></p>
            )}
          </div>
          <Button onClick={() => setShowInstallGuide(false)}>Got it</Button>
        </DialogContent>
      </Dialog>

      <WelcomeModal />
    </div>
  );
}
