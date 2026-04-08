import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Users, Link, Edit3, Copy, CheckCircle, Loader2, Crown, Bot, TrendingUp, Upload, Image, Video, Lightbulb, XCircle, ExternalLink, Palette, TrendingDown, Play, Sparkles, StopCircle, LayoutDashboard, User, Settings, Download, LogOut, Smartphone, Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { usePWAInstall } from "@/hooks/usePWAInstall";

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

interface MentorClient {
  id: string;
  client_user_id: string;
  registered_at: string;
  referral_slug_used: string;
  display_name?: string;
}

interface MentorSignal {
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

interface TradingAccount {
  id: string;
  name: string;
  login: string;
  is_master: boolean | null;
  balance: number | null;
  metaapi_account_id: string | null;
}

interface CopyRelationship {
  id: string;
  follower_user_id: string | null;
  status: string | null;
  follower_display_name?: string;
}

export default function MentorCenter() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { canInstall, install } = usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [clients, setClients] = useState<MentorClient[]>([]);
  const [signals, setSignals] = useState<MentorSignal[]>([]);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [copyRelationships, setCopyRelationships] = useState<CopyRelationship[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Setup form state
  const [brandName, setBrandName] = useState("");
  const [aiBotName, setAiBotName] = useState("AI Trading Bot");
  const [copyTradingName, setCopyTradingName] = useState("Copy Trading");
  const [tradingIdeasName, setTradingIdeasName] = useState("Trading Ideas");

  // Branding
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#8b5cf6");
  const [welcomeText, setWelcomeText] = useState("");
  const [landingSlug, setLandingSlug] = useState("");

  // New Signal form
  const [newSymbol, setNewSymbol] = useState("");
  const [newDirection, setNewDirection] = useState<string>("BUY");
  const [newLotSize, setNewLotSize] = useState("0.01");
  const [newStopLoss, setNewStopLoss] = useState("");
  const [newTakeProfit, setNewTakeProfit] = useState("");
  const [newComment, setNewComment] = useState("");
  const [publishingSignal, setPublishingSignal] = useState(false);
  const [showSignalDialog, setShowSignalDialog] = useState(false);

  // Khumo AI suggestion
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [loadingAiSuggestion, setLoadingAiSuggestion] = useState(false);

  // Copy Trading Quick Trade
  const [quickSymbol, setQuickSymbol] = useState("");
  const [quickDirection, setQuickDirection] = useState("BUY");
  const [quickLotSize, setQuickLotSize] = useState("0.01");
  const [executingQuickTrade, setExecutingQuickTrade] = useState(false);

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('mentor_profiles')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (data) {
        const renames = (data.feature_renames as any) || {};
        const uiConfig = (data.ui_config as Record<string, string>) || {};
        const p: MentorProfile = {
          ...data,
          ui_config: uiConfig,
          feature_renames: {
            ai_bot_name: renames.ai_bot_name || "AI Trading Bot",
            copy_trading_name: renames.copy_trading_name || "Copy Trading",
            trading_ideas_name: renames.trading_ideas_name || "Trading Ideas",
          }
        };
        setProfile(p);
        setBrandName(data.brand_name);
        setAiBotName(p.feature_renames.ai_bot_name);
        setCopyTradingName(p.feature_renames.copy_trading_name);
        setTradingIdeasName(p.feature_renames.trading_ideas_name);
        setPrimaryColor(uiConfig.primary_color || "#6366f1");
        setSecondaryColor(uiConfig.secondary_color || "#8b5cf6");
        setWelcomeText(uiConfig.welcome_text || "");
        setLandingSlug(data.landing_page_slug || data.referral_slug);

        // Load clients with display names
        const { data: clientData } = await supabase
          .from('mentor_clients')
          .select('*')
          .eq('mentor_id', data.id)
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
        } else {
          setClients([]);
        }

        // Load mentor signals
        const { data: sigData } = await supabase
          .from('trading_signals')
          .select('id,symbol,direction,lot_size,stop_loss,take_profit,comment,created_at,status')
          .eq('mentor_id', data.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setSignals((sigData || []) as MentorSignal[]);

        // Load trading accounts
        const { data: accData } = await supabase
          .from('trading_accounts')
          .select('id, name, login, is_master, balance, metaapi_account_id')
          .eq('user_id', user!.id);
        setAccounts((accData || []) as TradingAccount[]);

        // Load copy relationships (followers)
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
    } catch (err: any) {
      console.error("Error loading mentor profile:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).substring(2, 6);
  };

  const createProfile = async () => {
    if (!brandName.trim()) {
      toast({ title: "Brand name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const slug = generateSlug(brandName);
      const { error } = await supabase
        .from('mentor_profiles')
        .insert({
          user_id: user!.id,
          brand_name: brandName.trim(),
          referral_slug: slug,
          landing_page_slug: slug,
          feature_renames: { ai_bot_name: aiBotName, copy_trading_name: copyTradingName, trading_ideas_name: tradingIdeasName },
          ui_config: { primary_color: primaryColor, secondary_color: secondaryColor, welcome_text: welcomeText },
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: "Mentor profile created!", description: `Your brand "${brandName}" is live.` });
      loadProfile();
    } catch (err: any) {
      toast({ title: "Error creating profile", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mentor_profiles')
        .update({
          brand_name: brandName.trim(),
          landing_page_slug: landingSlug,
          feature_renames: { ai_bot_name: aiBotName, copy_trading_name: copyTradingName, trading_ideas_name: tradingIdeasName },
          ui_config: { primary_color: primaryColor, secondary_color: secondaryColor, welcome_text: welcomeText },
        })
        .eq('id', profile.id);

      if (error) throw error;
      toast({ title: "Profile updated!" });
      loadProfile();
    } catch (err: any) {
      toast({ title: "Error updating", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('mentor-assets').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from('mentor-assets').getPublicUrl(path);
      const mediaType = file.type.startsWith('video') ? 'video' : 'image';

      await supabase.from('mentor_profiles').update({
        landing_page_media_url: urlData.publicUrl,
        landing_page_media_type: mediaType,
      }).eq('id', profile.id);

      toast({ title: "Media uploaded!" });
      loadProfile();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const publishSignal = async () => {
    if (!profile || !newSymbol.trim()) {
      toast({ title: "Symbol required", variant: "destructive" });
      return;
    }
    setPublishingSignal(true);
    try {
      const { error } = await supabase.from('trading_signals').insert({
        symbol: newSymbol.toUpperCase().trim(),
        direction: newDirection,
        lot_size: parseFloat(newLotSize) || 0.01,
        stop_loss: newStopLoss ? parseFloat(newStopLoss) : null,
        take_profit: newTakeProfit ? parseFloat(newTakeProfit) : null,
        comment: newComment || null,
        mentor_id: profile.id,
        status: 'active',
      });
      if (error) throw error;
      toast({ title: "Signal published!" });
      setShowSignalDialog(false);
      setNewSymbol(""); setNewComment(""); setNewStopLoss(""); setNewTakeProfit("");
      loadProfile();
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
      await supabase
        .from('trading_accounts')
        .update({ is_master: !currentlyMaster })
        .eq('id', accountId)
        .eq('user_id', user!.id);
      toast({ title: currentlyMaster ? "Master status removed" : "Account set as master" });
      loadProfile();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const executeQuickTrade = async () => {
    if (!profile || !quickSymbol.trim()) return;
    setExecutingQuickTrade(true);
    try {
      // Publish signal
      const { data: sig, error: sigErr } = await supabase.from('trading_signals').insert({
        symbol: quickSymbol.toUpperCase().trim(),
        direction: quickDirection,
        lot_size: parseFloat(quickLotSize) || 0.01,
        mentor_id: profile.id,
        status: 'active',
        comment: 'Quick trade from Mentor Center',
      }).select('id').single();
      if (sigErr) throw sigErr;

      // Trigger copy trade listener
      const masterAcc = accounts.find(a => a.is_master);
      if (masterAcc && sig) {
        await supabase.functions.invoke('copy-trade-listener', {
          body: { signal_id: sig.id, master_user_id: user!.id }
        });
      }

      toast({ title: "Quick trade published & copied to followers!" });
      setQuickSymbol("");
      loadProfile();
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
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Setup wizard
  if (!profile) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <Crown className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Welcome to the Mentor Center</h1>
            <p className="text-muted-foreground mt-2">Set up your brand and start building your trading community</p>
          </div>

          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle>Create Your Mentor Profile</CardTitle>
              <CardDescription>Choose your brand name and customise feature names for your clients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <Input value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g., Thando's Trading Academy" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>AI Bot Name</Label>
                  <Input value={aiBotName} onChange={e => setAiBotName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Copy Trading Name</Label>
                  <Input value={copyTradingName} onChange={e => setCopyTradingName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Trading Ideas Name</Label>
                  <Input value={tradingIdeasName} onChange={e => setTradingIdeasName(e.target.value)} />
                </div>
              </div>
              <Button onClick={createProfile} disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Mentor Profile
              </Button>
            </CardContent>
          </Card>
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
              <Crown className="h-8 w-8 text-primary" />
              {profile.brand_name}
            </h1>
            <p className="text-muted-foreground mt-1">Mentor Center Dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
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
                <DropdownMenuItem onClick={async () => {
                  if (canInstall) { await install(); } else { setShowInstallGuide(true); }
                }}>
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
            <Badge variant={profile.is_active ? "default" : "destructive"}>
              {profile.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-4 text-center">
              <Users className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{clients.length}</div>
              <div className="text-sm text-muted-foreground">Total Clients</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-4 text-center">
              <Link className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-sm font-mono break-all">/ref/{profile.referral_slug}</div>
              <Button size="sm" variant="outline" className="mt-2" onClick={copyReferralLink}>
                {copied ? <CheckCircle className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                {copied ? "Copied!" : "Copy Link"}
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-4 text-center">
              <Lightbulb className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{signals.length}</div>
              <div className="text-sm text-muted-foreground">Published Ideas</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border shadow-card">
            <CardContent className="p-4 text-center">
              <Copy className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-2xl font-bold">{copyRelationships.filter(r => r.status === 'active').length}</div>
              <div className="text-sm text-muted-foreground">Active Copiers</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="clients">
          <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
            <TabsTrigger value="dashboard" className="whitespace-nowrap" onClick={() => navigate('/mentor-hub')}>
              <LayoutDashboard className="w-4 h-4 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="clients" className="whitespace-nowrap">Clients</TabsTrigger>
            <TabsTrigger value="branding" className="whitespace-nowrap">Branding</TabsTrigger>
            <TabsTrigger value="media" className="whitespace-nowrap">Media & Landing</TabsTrigger>
          </TabsList>

          {/* Clients Tab */}
          <TabsContent value="clients" className="space-y-4">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Your Clients</CardTitle>
                <CardDescription>Users who registered via your referral link</CardDescription>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No clients yet. Share your referral link to get started!</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clients.map(client => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{client.display_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(client.registered_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Ideas Tab */}
          <TabsContent value="ideas" className="space-y-4">
            {/* Khumo AI Suggestion */}
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Khumo AI Suggestion
                  </CardTitle>
                  <CardDescription>Get AI-powered signal ideas for your community</CardDescription>
                </div>
                <Button variant="outline" onClick={getAiSuggestion} disabled={loadingAiSuggestion}>
                  {loadingAiSuggestion ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Get Suggestion
                </Button>
              </CardHeader>
              {aiSuggestion && (
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">{aiSuggestion}</div>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => setShowSignalDialog(true)}>
                    <Play className="w-3 h-3 mr-1" /> Publish as Signal
                  </Button>
                </CardContent>
              )}
            </Card>

            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Trading Ideas</CardTitle>
                  <CardDescription>Publish signals for your clients to execute</CardDescription>
                </div>
                <Dialog open={showSignalDialog} onOpenChange={setShowSignalDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-primary">
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
                          <Input value={newSymbol} onChange={e => setNewSymbol(e.target.value)} placeholder="e.g., EURUSD" />
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
                      <Button onClick={publishSignal} disabled={publishingSignal} className="w-full bg-gradient-primary">
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
                    <p>No ideas published yet. Click "Publish Idea" to get started!</p>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {signals.map(sig => (
                      <div key={sig.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold">{sig.symbol}</span>
                          <Badge className={sig.direction === 'BUY' ? 'bg-profit text-white' : 'bg-loss text-white'}>
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

          {/* Copy Trading Tab */}
          <TabsContent value="copy-trading" className="space-y-4">
            {/* Master Account */}
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Master Trading Account</CardTitle>
                <CardDescription>Set which account your clients will copy trades from</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {accounts.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No trading accounts connected. <Button variant="link" onClick={() => navigate("/accounts")}>Add one →</Button></p>
                  </div>
                ) : (
                  accounts.map(acc => (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium">{acc.name}</p>
                        <p className="text-xs text-muted-foreground">Login: {acc.login} • Balance: ${(acc.balance || 0).toLocaleString()}</p>
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
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Quick Trade (Copy to Followers)</CardTitle>
                <CardDescription>Publish a signal and automatically copy it to all your followers' accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <Input value={quickSymbol} onChange={e => setQuickSymbol(e.target.value)} placeholder="EURUSD" />
                  <Select value={quickDirection} onValueChange={setQuickDirection}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUY">BUY</SelectItem>
                      <SelectItem value="SELL">SELL</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" value={quickLotSize} onChange={e => setQuickLotSize(e.target.value)} step="0.01" placeholder="0.01" />
                </div>
                <Button onClick={executeQuickTrade} disabled={executingQuickTrade || !quickSymbol.trim()} className="mt-3 w-full bg-gradient-primary">
                  {executingQuickTrade ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                  Execute & Copy to All Followers
                </Button>
              </CardContent>
            </Card>

            {/* Active Copiers */}
            <Card className="bg-gradient-card border-border shadow-card">
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

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-4">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Customise Your Brand</CardTitle>
                <CardDescription>Rename features and set brand colors</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Brand Name</Label>
                  <Input value={brandName} onChange={e => setBrandName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Bot className="h-3 w-3" /> AI Bot Name</Label>
                    <Input value={aiBotName} onChange={e => setAiBotName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Copy className="h-3 w-3" /> Copy Trading Name</Label>
                    <Input value={copyTradingName} onChange={e => setCopyTradingName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Trading Ideas Name</Label>
                    <Input value={tradingIdeasName} onChange={e => setTradingIdeasName(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Primary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1"><Palette className="h-3 w-3" /> Secondary Color</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={secondaryColor} onChange={e => setSecondaryColor(e.target.value)} className="flex-1" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Welcome Text</Label>
                  <Textarea value={welcomeText} onChange={e => setWelcomeText(e.target.value)} placeholder="Welcome message for your landing page..." />
                </div>
                <Button onClick={updateProfile} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Media & Landing Tab */}
          <TabsContent value="media" className="space-y-4">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Landing Page Media</CardTitle>
                <CardDescription>Upload an image, GIF, or short video for your branded landing page</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {profile.landing_page_media_url && (
                  <div className="relative rounded-lg overflow-hidden border border-border max-h-64">
                    {profile.landing_page_media_type === 'video' ? (
                      <video src={profile.landing_page_media_url} controls className="w-full max-h-64 object-cover" />
                    ) : (
                      <img src={profile.landing_page_media_url} alt="Landing media" className="w-full max-h-64 object-cover" />
                    )}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-muted hover:bg-muted/80 rounded-lg px-4 py-3 transition-colors">
                    <Upload className="w-5 h-5" />
                    <span className="text-sm">{uploading ? 'Uploading...' : 'Upload Media'}</span>
                    <input type="file" accept="image/*,video/mp4,image/gif" onChange={handleMediaUpload} className="hidden" disabled={uploading} />
                  </label>
                  <span className="text-xs text-muted-foreground">Max 10MB • Image, GIF, or MP4</span>
                </div>

                <div className="space-y-2">
                  <Label>Landing Page Slug</Label>
                  <div className="flex gap-2 items-center">
                    <Input value={landingSlug} onChange={e => setLandingSlug(e.target.value)} placeholder="your-brand" />
                    <Button variant="outline" size="sm" onClick={() => {
                      window.open(`${window.location.origin}/ref/${profile.referral_slug}`, '_blank');
                    }}>
                      <ExternalLink className="w-4 h-4 mr-1" /> Preview
                    </Button>
                  </div>
                </div>

                <Button onClick={updateProfile} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Landing Page Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Install Guide Dialog */}
        <Dialog open={showInstallGuide} onOpenChange={setShowInstallGuide}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Smartphone className="w-5 h-5" /> Install HuMi App</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground space-y-2">
              {/iPad|iPhone|iPod/.test(navigator.userAgent) ? (
                <p>Open in <strong>Safari</strong> → tap <strong>Share ↗</strong> → <strong>"Add to Home Screen"</strong></p>
              ) : /Android/.test(navigator.userAgent) ? (
                <p>Open in <strong>Chrome</strong> → tap <strong>⋮ Menu</strong> → <strong>"Add to Home Screen"</strong></p>
              ) : (
                <p>Open in <strong>Chrome</strong> → click the install icon in the address bar, or use <strong>⋮ → Install App</strong></p>
              )}
            </div>
            <Button onClick={() => setShowInstallGuide(false)}>Got it</Button>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
