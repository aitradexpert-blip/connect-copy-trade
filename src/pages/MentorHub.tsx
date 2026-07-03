import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, TrendingUp, TrendingDown, Home, Lightbulb, Copy, Bot, ExternalLink, Plus, Play, StopCircle, User, Settings, Download, LogOut, Smartphone, Menu, Sparkles, Crown, Users, Link, CheckCircle, Wallet } from "lucide-react";
import { ConnectAccountModal } from "@/components/ConnectAccountModal";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import WelcomeModal from "@/components/WelcomeModal";
import KhumoForexSessions from "@/components/KhumoForexSessions";
import { getProviderLabel } from "@/lib/providerLabel";
import { broadcastSignal } from "@/services/signalBroadcast";
import { Checkbox } from "@/components/ui/checkbox";
import { SymbolCombobox } from "@/components/SymbolCombobox";
import NoticeBoard from "@/components/NoticeBoard";
import CopyTradingActiveBanner from "@/components/CopyTradingActiveBanner";

interface MentorProfile {
  id: string;
  brand_name: string;
  referral_slug: string;
  landing_page_slug: string | null;
  landing_page_media_url: string | null;
  landing_page_media_type: string | null;
  ui_config: Record<string, string>;
  feature_renames: {
    ai_bot_name: string;
    copy_trading_name: string;
    trading_ideas_name: string;
  };
  is_active: boolean;
}

interface Signal {
  id: string;
  symbol: string;
  direction: string;
  lot_size: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  comment?: string | null;
  created_at: string;
  status: string;
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
  is_master: boolean | null;
}

interface CopyRelationship {
  id: string;
  follower_user_id: string | null;
  status: string | null;
  follower_display_name?: string;
}

interface MentorClient {
  id: string;
  client_user_id: string;
  registered_at: string;
  display_name?: string;
}

export default function MentorHub() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { canInstall, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [copyRelationships, setCopyRelationships] = useState<CopyRelationship[]>([]);
  const [clients, setClients] = useState<MentorClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Signal form state
  const [showSignalDialog, setShowSignalDialog] = useState(false);
  const [newSymbol, setNewSymbol] = useState("");
  const [newDirection, setNewDirection] = useState<string>("BUY");
  const [newLotSize, setNewLotSize] = useState("0.01");
  const [newStopLoss, setNewStopLoss] = useState("");
  const [newTakeProfit, setNewTakeProfit] = useState("");
  const [newComment, setNewComment] = useState("");
  const [publishingSignal, setPublishingSignal] = useState(false);

  // AI Suggestion
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false);

  // Quick Trade
  const [quickSymbol, setQuickSymbol] = useState("");
  const [quickDirection, setQuickDirection] = useState("BUY");
  const [quickLotSize, setQuickLotSize] = useState("0.01");
  const [executingQuickTrade, setExecutingQuickTrade] = useState(false);
  const [broadcastToBot, setBroadcastToBot] = useState(true);
  const [broadcastToCopy, setBroadcastToCopy] = useState(true);

  const primaryColor = profile?.ui_config?.primary_color || "#6366f1";
  const secondaryColor = profile?.ui_config?.secondary_color || "#8b5cf6";
  const welcomeText = profile?.ui_config?.welcome_text || "AI Powered Money Magnet";

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  const getFeatureName = (key: keyof MentorProfile['feature_renames']) => {
    return profile?.feature_renames?.[key] || {
      ai_bot_name: "AI Trading Bot",
      copy_trading_name: "Copy Trading",
      trading_ideas_name: "Trading Ideas",
    }[key];
  };

  const handleInstallApp = async () => {
    if (canInstall) {
      await install();
    } else {
      setShowInstallGuide(true);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load mentor profile
      const { data: profileData } = await supabase
        .from('mentor_profiles')
        .select('id,user_id,brand_name,referral_slug,landing_page_slug,landing_page_media_url,landing_page_media_type,ui_config,feature_renames,is_active,logo_url,created_at,updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (profileData) {
        const renames = (profileData.feature_renames as any) || {};
        const uiConfig = (profileData.ui_config as Record<string, string>) || {};
        const p: MentorProfile = {
          ...profileData,
          ui_config: uiConfig,
          feature_renames: {
            ai_bot_name: renames.ai_bot_name || "AI Trading Bot",
            copy_trading_name: renames.copy_trading_name || "Copy Trading",
            trading_ideas_name: renames.trading_ideas_name || "Trading Ideas",
          }
        };
        setProfile(p);

        // Load clients
        const { data: clientData } = await supabase
          .from('mentor_clients')
          .select('*')
          .eq('mentor_id', profileData.id)
          .order('registered_at', { ascending: false });

        if (clientData && clientData.length > 0) {
          const clientIds = clientData.map(c => c.client_user_id);
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', clientIds);

          const nameMap: Record<string, string> = {};
          (profilesData || []).forEach(p => { nameMap[p.user_id] = p.display_name || 'User'; });

          setClients(clientData.map(c => ({
            ...c,
            display_name: nameMap[c.client_user_id] || c.client_user_id.slice(0, 8) + '...',
          })));
        }

        // Load signals
        const { data: sigData } = await supabase
          .from('trading_signals')
          .select('id,symbol,direction,lot_size,stop_loss,take_profit,comment,created_at,status')
          .eq('mentor_id', profileData.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setSignals((sigData || []) as Signal[]);

        // Load copy relationships
        const { data: copyData } = await supabase
          .from('copy_trading_relationships')
          .select('id, follower_user_id, status')
          .eq('master_user_id', user!.id);
        
        if (copyData && copyData.length > 0) {
          const followerIds = copyData.map(c => c.follower_user_id).filter(Boolean) as string[];
          const { data: followerProfiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', followerIds);
          const nameMap2: Record<string, string> = {};
          (followerProfiles || []).forEach(p => { nameMap2[p.user_id] = p.display_name || 'User'; });
          
          setCopyRelationships(copyData.map(c => ({
            ...c,
            follower_display_name: c.follower_user_id ? nameMap2[c.follower_user_id] || c.follower_user_id.slice(0, 8) : 'Unknown',
          })));
        }
      }

      // Load trading accounts
      const { data: accs } = await supabase
        .from('trading_accounts')
        .select('id, name, login, balance, metaapi_account_id, provider, deriv_token, deriv_currency, is_virtual, is_master')
        .eq('user_id', user!.id);
      setAccounts((accs || []) as Account[]);

    } catch (err) {
      console.error("Error loading mentor hub data:", err);
    } finally {
      setLoading(false);
    }
  };

  const publishSignal = async () => {
    if (!profile || !newSymbol.trim()) {
      toast({ title: "Symbol required", variant: "destructive" });
      return;
    }
    setPublishingSignal(true);
    try {
      const lot = parseFloat(newLotSize) || 0.01;
      const sl = newStopLoss ? parseFloat(newStopLoss) : null;
      const tp = newTakeProfit ? parseFloat(newTakeProfit) : null;
      const { data: sig, error } = await supabase.from('trading_signals').insert({
        symbol: newSymbol.toUpperCase().trim(),
        direction: newDirection,
        lot_size: lot,
        stop_loss: sl,
        take_profit: tp,
        comment: newComment || null,
        mentor_id: profile.id,
        status: 'active',
        auto_to_ai_bot: broadcastToBot,
        auto_to_copyfactory: broadcastToCopy,
      }).select('id').single();
      if (error) throw error;
      if (sig) {
        await broadcastSignal(
          { id: sig.id, symbol: newSymbol.toUpperCase().trim(), direction: newDirection as any, lot_size: lot, stop_loss: sl, take_profit: tp, comment: newComment || null, mentor_id: profile.id },
          { toAiBot: broadcastToBot, toCopyFactory: broadcastToCopy },
        );
      }
      // Also trigger copy-trade-listener so active copy relationships execute the trade
      if (sig && user) {
        await supabase.functions.invoke('copy-trade-listener', {
          body: { signal_id: sig.id, master_user_id: user.id }
        }).catch(e => console.warn('copy-trade-listener error:', e));
      }
      toast({ title: "Idea published & broadcast!" });
      setShowSignalDialog(false);
      setNewSymbol(""); setNewComment(""); setNewStopLoss(""); setNewTakeProfit("");
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPublishingSignal(false);
    }
  };

  const getAiSuggestion = async () => {
    setLoadingAiSuggestion(true);
    setAiSuggestion("");
    try {
      const { data, error } = await supabase.functions.invoke('khumo-chat', {
        body: {
          message: "Suggest one trading signal for a popular forex pair (like EURUSD, GBPUSD, USDJPY, XAUUSD). Include: symbol, direction (BUY or SELL), entry price, stop loss, take profit, and a brief 2-sentence analysis. Format it clearly.",
          user_id: user!.id,
          context: "mentor_signal_suggestion",
        }
      });
      if (error) throw error;
      setAiSuggestion(data?.text || "No suggestion available.");
    } catch (err: any) {
      toast({ title: "AI suggestion failed", description: err.message, variant: "destructive" });
    } finally {
      setLoadingAiSuggestion(false);
    }
  };

  const toggleMasterAccount = async (accountId: string, currentlyMaster: boolean) => {
    try {
      const acc = accounts.find(a => a.id === accountId);
      // If enabling master & MetaAPI account & no strategy yet -> create CopyFactory strategy
      if (!currentlyMaster && acc?.metaapi_account_id) {
        toast({ title: "Setting up CopyFactory strategy..." });
        const { data, error } = await supabase.functions.invoke('copyfactory-create-strategy', {
          body: {
            accountId: acc.metaapi_account_id,
            name: profile?.brand_name ? `${profile.brand_name} Master` : (acc.name || 'Master Strategy'),
            description: 'Auto-mirror MT4/MT5 terminal trades to followers',
            existingStrategyId: (acc as any).copyfactory_strategy_id || undefined,
          },
        });
        if (error) throw error;
        if (data?.strategyId) {
          await supabase
            .from('trading_accounts')
            .update({ is_master: true, copyfactory_strategy_id: data.strategyId })
            .eq('id', accountId)
            .eq('user_id', user!.id);
          toast({ title: "Master enabled — terminal trades will auto-mirror to followers" });
          loadData();
          return;
        }
      }
      await supabase
        .from('trading_accounts')
        .update({ is_master: !currentlyMaster })
        .eq('id', accountId)
        .eq('user_id', user!.id);
      toast({ title: currentlyMaster ? "Master status removed" : "Account set as master" });
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const executeQuickTrade = async () => {
    if (!profile || !quickSymbol.trim()) return;
    setExecutingQuickTrade(true);
    try {
      const lot = parseFloat(quickLotSize) || 0.01;
      const { data: sig, error: sigErr } = await supabase.from('trading_signals').insert({
        symbol: quickSymbol.toUpperCase().trim(),
        direction: quickDirection,
        lot_size: lot,
        mentor_id: profile.id,
        status: 'active',
        comment: 'Quick trade from Mentor Hub',
      }).select('id').single();
      if (sigErr) throw sigErr;

      const masterAcc = accounts.find(a => a.is_master);
      if (masterAcc && sig) {
        await supabase.functions.invoke('copy-trade-listener', {
          body: { signal_id: sig.id, master_user_id: user!.id }
        });
      }
      if (sig) {
        await broadcastSignal(
          { id: sig.id, symbol: quickSymbol.toUpperCase().trim(), direction: quickDirection as any, lot_size: lot, mentor_id: profile.id, comment: 'Quick trade from Mentor Hub' },
          { toAiBot: true, toCopyFactory: true },
        );
      }

      toast({ title: "Quick trade published — AI Bot + Copy broadcast!" });
      setQuickSymbol("");
      loadData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setExecutingQuickTrade(false);
    }
  };

  const copyReferralLink = () => {
    if (!profile) return;
    const link = `${window.location.origin}/ref/${profile.referral_slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Link copied!" });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)` }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: primaryColor }} />
      </div>
    );
  }

  // If no mentor profile, redirect to setup
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Crown className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h2 className="text-xl font-bold mb-2">Set Up Your Mentor Profile</h2>
            <p className="text-muted-foreground mb-4">You need to create a mentor profile first to access the Mentor Hub.</p>
            <Button onClick={() => navigate('/mentor-center')}>
              Go to Mentor Center
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative h-56 md:h-64 overflow-hidden">
        {profile.landing_page_media_url ? (
          profile.landing_page_media_type === 'video' ? (
            <video src={profile.landing_page_media_url} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <img src={profile.landing_page_media_url} alt={profile.brand_name} className="absolute inset-0 w-full h-full object-cover" />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 h-full flex items-end p-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-4xl font-black text-white uppercase tracking-wide">
                {profile.brand_name}
              </h1>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/mentor-center')}
                className="text-xs text-white/80 hover:text-white hover:bg-white/10"
              >
                <Settings className="w-3 h-3 mr-1" />
                Brand Settings
              </Button>
            </div>
            <p className="text-white/70 mt-1 text-sm md:text-base">{welcomeText}</p>
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
              <DropdownMenuItem onClick={() => navigate("/mentor-center")}>
                <Crown className="w-4 h-4 mr-2" /> Mentor Settings
              </DropdownMenuItem>
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
      <div className="max-w-6xl mx-auto px-4 py-6 overflow-x-hidden">
        <CopyTradingActiveBanner className="mb-6" />
        <NoticeBoard audience="mentor_hub" className="mb-6" />
        <Tabs defaultValue="home" className="space-y-6">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start md:grid md:grid-cols-4 md:max-w-lg bg-muted/50 p-1 rounded-full">
            <TabsTrigger value="home" className="flex items-center gap-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Home className="w-4 h-4" /> Home
            </TabsTrigger>
            <TabsTrigger value="ideas" className="flex items-center gap-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Lightbulb className="w-4 h-4" /> IDEAS
            </TabsTrigger>
            <TabsTrigger value="copy" className="flex items-center gap-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Copy className="w-4 h-4" /> APEX
            </TabsTrigger>
            <TabsTrigger value="bot" className="flex items-center gap-1 rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Bot className="w-4 h-4" /> Bot
            </TabsTrigger>
          </TabsList>

          {/* HOME TAB */}
          <TabsContent value="home" className="space-y-6">
            {/* Trading Accounts Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {accounts.map(acc => (
                <Card key={acc.id} className="border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-sm truncate flex-1 mr-2">{acc.name}</span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {getProviderLabel(acc.provider)}
                      </Badge>
                    </div>
                    <p className="text-2xl font-bold">${(acc.balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-muted-foreground mt-1">Login: {acc.login}</p>
                    {acc.is_master && (
                      <Badge className="mt-2 bg-primary text-primary-foreground text-xs">Master Account</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
              
              {/* Add Account Card */}
              <Card 
                className="border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors" 
                onClick={() => setShowConnectModal(true)}
              >
                <CardContent className="p-4 flex items-center justify-center h-full min-h-[120px]">
                  <div className="text-center text-muted-foreground">
                    <Plus className="w-6 h-6 mx-auto mb-1" />
                    <span className="text-sm">Add Account</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-6 w-6 mx-auto text-primary mb-2" />
                  <div className="text-xl font-bold">{clients.length}</div>
                  <div className="text-xs text-muted-foreground">Clients</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Lightbulb className="h-6 w-6 mx-auto text-primary mb-2" />
                  <div className="text-xl font-bold">{signals.length}</div>
                  <div className="text-xs text-muted-foreground">Ideas Published</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Copy className="h-6 w-6 mx-auto text-primary mb-2" />
                  <div className="text-xl font-bold">{copyRelationships.filter(r => r.status === 'active').length}</div>
                  <div className="text-xs text-muted-foreground">Active Copiers</div>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-muted/50" onClick={copyReferralLink}>
                <CardContent className="p-4 text-center">
                  <Link className="h-6 w-6 mx-auto text-primary mb-2" />
                  <div className="text-xs font-mono truncate">/ref/{profile.referral_slug}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {copied ? <span className="text-green-600">Copied!</span> : "Copy Link"}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Latest Ideas Trade */}
            {signals.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Latest {getFeatureName('trading_ideas_name').toUpperCase()} TRADE</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {signals.slice(0, 3).map(sig => (
                    <div key={sig.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge className={`${sig.direction === 'BUY' ? 'bg-green-500' : 'bg-red-500'} text-white text-xs px-2 py-1`}>
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
            {/* Khumo AI Forex Session Intelligence */}
            <KhumoForexSessions
              mentorId={profile?.id}
              onPublishIdea={async (suggestion) => {
                if (!profile) return;
                try {
                  const sl = parseFloat(suggestion.stopLoss) || null;
                  const tp = parseFloat(suggestion.takeProfit) || null;
                  const { data: sig, error } = await supabase.from('trading_signals').insert({
                    symbol: suggestion.symbol,
                    direction: suggestion.direction,
                    lot_size: 0.01,
                    stop_loss: sl,
                    take_profit: tp,
                    comment: suggestion.analysis,
                    mentor_id: profile.id,
                    status: 'active',
                    auto_to_ai_bot: true,
                    auto_to_copyfactory: true,
                  }).select('id').single();
                  if (error) throw error;
                  if (sig) {
                    await broadcastSignal(
                      { id: sig.id, symbol: suggestion.symbol, direction: suggestion.direction, lot_size: 0.01, stop_loss: sl, take_profit: tp, comment: suggestion.analysis, mentor_id: profile.id },
                      { toAiBot: true, toCopyFactory: true },
                    );
                  }
                  toast({ title: "Idea Published — AI Bot + Copy broadcast!" });
                  loadData();
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
              }}
              onCopyTrade={async (suggestion) => {
                if (!profile) return;
                try {
                  const sl = parseFloat(suggestion.stopLoss) || null;
                  const tp = parseFloat(suggestion.takeProfit) || null;
                  const { data: sig } = await supabase.from('trading_signals').insert({
                    symbol: suggestion.symbol,
                    direction: suggestion.direction,
                    lot_size: 0.01,
                    stop_loss: sl,
                    take_profit: tp,
                    comment: `Copy Trade: ${suggestion.analysis}`,
                    mentor_id: profile.id,
                    status: 'active',
                    auto_to_ai_bot: true,
                    auto_to_copyfactory: true,
                  }).select('id').single();
                  
                  if (sig) {
                    await supabase.functions.invoke('copy-trade-listener', {
                      body: { signal_id: sig.id, master_user_id: user!.id }
                    });
                    await broadcastSignal(
                      { id: sig.id, symbol: suggestion.symbol, direction: suggestion.direction, lot_size: 0.01, stop_loss: sl, take_profit: tp, comment: `Copy Trade: ${suggestion.analysis}`, mentor_id: profile.id },
                      { toAiBot: true, toCopyFactory: true },
                    );
                  }
                  toast({ title: "Signal broadcast to AI Bot + Copy followers!" });
                  loadData();
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
              }}
              onAddToBot={async (suggestion) => {
                if (!profile) return;
                try {
                  const sl = parseFloat(suggestion.stopLoss) || null;
                  const tp = parseFloat(suggestion.takeProfit) || null;
                  const { data: sig, error } = await supabase.from('trading_signals').insert({
                    symbol: suggestion.symbol,
                    direction: suggestion.direction,
                    lot_size: 0.01,
                    stop_loss: sl,
                    take_profit: tp,
                    comment: `AI Bot: ${suggestion.analysis}`,
                    mentor_id: profile.id,
                    status: 'active',
                    auto_to_ai_bot: true,
                    auto_to_copyfactory: true,
                  }).select('id').single();
                  if (error) throw error;
                  if (sig) {
                    await broadcastSignal(
                      { id: sig.id, symbol: suggestion.symbol, direction: suggestion.direction, lot_size: 0.01, stop_loss: sl, take_profit: tp, comment: `AI Bot: ${suggestion.analysis}`, mentor_id: profile.id },
                      { toAiBot: true, toCopyFactory: true },
                    );
                  }
                  toast({ title: "Sent to AI Bot + Copy", description: `${suggestion.direction} ${suggestion.symbol}` });
                  loadData();
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
              }}
            />

            {/* Publish Signal */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Trading Ideas</CardTitle>
                  <CardDescription>Publish signals for your clients</CardDescription>
                </div>
                <Dialog open={showSignalDialog} onOpenChange={setShowSignalDialog}>
                  <DialogTrigger asChild>
                    <Button style={{ backgroundColor: primaryColor }}>
                      <Play className="w-4 h-4 mr-2" /> Publish Idea
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Publish Trading Idea</DialogTitle>
                      <DialogDescription>Your clients will see this on their Ideas page</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Symbol *</Label>
                          <SymbolCombobox value={newSymbol} onChange={setNewSymbol} placeholder="Search symbol (e.g. EURUSD, USDZAR, NAS100)..." />
                        </div>
                        <div className="space-y-2">
                          <Label>Direction</Label>
                          <Select value={newDirection} onValueChange={setNewDirection}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BUY">BUY</SelectItem>
                              <SelectItem value="SELL">SELL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Lot Size</Label>
                          <Input type="number" value={newLotSize} onChange={e => setNewLotSize(e.target.value)} step="0.01" />
                        </div>
                        <div className="space-y-2">
                          <Label>Stop Loss</Label>
                          <Input type="number" value={newStopLoss} onChange={e => setNewStopLoss(e.target.value)} placeholder="Optional" />
                        </div>
                        <div className="space-y-2">
                          <Label>Take Profit</Label>
                          <Input type="number" value={newTakeProfit} onChange={e => setNewTakeProfit(e.target.value)} placeholder="Optional" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Comment</Label>
                        <Textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Analysis notes..." />
                      </div>
                      <div className="space-y-2 p-3 rounded-lg bg-muted/40 border border-border">
                        <p className="text-sm font-medium">Broadcast channels</p>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={broadcastToBot} onCheckedChange={(v) => setBroadcastToBot(v === true)} />
                          Broadcast to AI Bot subscribers
                        </label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox checked={broadcastToCopy} onCheckedChange={(v) => setBroadcastToCopy(v === true)} />
                          Broadcast to Copy Trading subscribers
                        </label>
                      </div>
                      <Button onClick={publishSignal} disabled={publishingSignal} className="w-full" style={{ backgroundColor: primaryColor }}>
                        {publishingSignal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                        Publish Signal
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {signals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No ideas published yet. Click &quot;Publish Idea&quot; to get started!</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {signals.map(sig => (
                      <div key={sig.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{sig.symbol}</span>
                          <Badge className={sig.direction === 'BUY' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}>
                            {sig.direction === 'BUY' ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                            {sig.direction}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>Lots: {sig.lot_size}</p>
                          {sig.stop_loss && <p>SL: {sig.stop_loss}</p>}
                          {sig.take_profit && <p>TP: {sig.take_profit}</p>}
                          {sig.comment && <p className="italic">{sig.comment}</p>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">{new Date(sig.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COPY TRADING (APEX) TAB */}
          <TabsContent value="copy" className="space-y-4">
            {/* Master Account */}
            <Card>
              <CardHeader>
                <CardTitle>Master Trading Account</CardTitle>
                <CardDescription>Set which account your clients will copy trades from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accounts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No trading accounts connected.</p>
                    <Button variant="outline" className="mt-2" onClick={() => setShowConnectModal(true)}>
                      <Plus className="w-4 h-4 mr-2" /> Add Account
                    </Button>
                  </div>
                ) : (
                  accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">Login: {acc.login} | Balance: ${(acc.balance || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {acc.is_master && <Badge className="bg-primary text-primary-foreground">Master</Badge>}
                        <Switch
                          checked={!!acc.is_master}
                          onCheckedChange={() => toggleMasterAccount(acc.id, !!acc.is_master)}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick Trade */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Trade (Copy to Followers)</CardTitle>
                <CardDescription>Publish a signal and automatically copy it to all followers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <SymbolCombobox value={quickSymbol} onChange={setQuickSymbol} placeholder="Search symbol..." />
                  <Select value={quickDirection} onValueChange={setQuickDirection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={quickLotSize} onChange={e => setQuickLotSize(e.target.value)} step="0.01" placeholder="0.01" />
                </div>
                <Button 
                  onClick={executeQuickTrade} 
                  disabled={executingQuickTrade || !quickSymbol.trim()} 
                  className="mt-3 w-full"
                  style={{ backgroundColor: primaryColor }}
                >
                  {executingQuickTrade ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Execute & Copy to All Followers
                </Button>
              </CardContent>
            </Card>

            {/* Active Copiers */}
            <Card>
              <CardHeader>
                <CardTitle>Active Followers</CardTitle>
                <CardDescription>Clients currently copying your trades</CardDescription>
              </CardHeader>
              <CardContent>
                {copyRelationships.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No followers yet.</p>
                ) : (
                  <div className="space-y-2">
                    {copyRelationships.map(rel => (
                      <div key={rel.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm font-medium">{rel.follower_display_name}</span>
                        <Badge variant={rel.status === 'active' ? 'default' : 'secondary'}>
                          {rel.status === 'active' ? 'Copying' : 'Paused'}
                        </Badge>
                      </div>
                    ))}
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
              <p>Open in <strong>Safari</strong> then tap <strong>Share</strong> then <strong>&quot;Add to Home Screen&quot;</strong></p>
            ) : isAndroid ? (
              <p>Open in <strong>Chrome</strong> then tap <strong>Menu</strong> then <strong>&quot;Add to Home Screen&quot;</strong></p>
            ) : (
              <p>Open in <strong>Chrome</strong> then click the install icon in the address bar, or use <strong>Menu - Install App</strong></p>
            )}
          </div>
          <Button onClick={() => setShowInstallGuide(false)}>Got it</Button>
        </DialogContent>
      </Dialog>

      <WelcomeModal />
    </div>
  );
}
