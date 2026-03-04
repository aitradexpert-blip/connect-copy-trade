import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Link, Edit3, Copy, CheckCircle, Loader2, Crown, Bot, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MentorProfile {
  id: string;
  brand_name: string;
  referral_slug: string;
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
}

export default function MentorCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<MentorProfile | null>(null);
  const [clients, setClients] = useState<MentorClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Setup form state
  const [brandName, setBrandName] = useState("");
  const [aiBotName, setAiBotName] = useState("AI Trading Bot");
  const [copyTradingName, setCopyTradingName] = useState("Copy Trading");
  const [tradingIdeasName, setTradingIdeasName] = useState("Trading Ideas");

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
        setProfile({
          ...data,
          feature_renames: {
            ai_bot_name: renames.ai_bot_name || "AI Trading Bot",
            copy_trading_name: renames.copy_trading_name || "Copy Trading",
            trading_ideas_name: renames.trading_ideas_name || "Trading Ideas",
          }
        });
        setBrandName(data.brand_name);
        setAiBotName(renames.ai_bot_name || "AI Trading Bot");
        setCopyTradingName(renames.copy_trading_name || "Copy Trading");
        setTradingIdeasName(renames.trading_ideas_name || "Trading Ideas");

        // Load clients
        const { data: clientData } = await supabase
          .from('mentor_clients')
          .select('*')
          .eq('mentor_id', data.id)
          .order('registered_at', { ascending: false });

        setClients(clientData || []);
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
      const { data, error } = await supabase
        .from('mentor_profiles')
        .insert({
          user_id: user!.id,
          brand_name: brandName.trim(),
          referral_slug: slug,
          feature_renames: {
            ai_bot_name: aiBotName,
            copy_trading_name: copyTradingName,
            trading_ideas_name: tradingIdeasName,
          }
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

  const updateRenames = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('mentor_profiles')
        .update({
          brand_name: brandName.trim(),
          feature_renames: {
            ai_bot_name: aiBotName,
            copy_trading_name: copyTradingName,
            trading_ideas_name: tradingIdeasName,
          }
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

  // Setup wizard if no profile
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
              <div className="space-y-2">
                <Label>Rename: AI Trading Bot</Label>
                <Input value={aiBotName} onChange={e => setAiBotName(e.target.value)} placeholder="AI Trading Bot" />
              </div>
              <div className="space-y-2">
                <Label>Rename: Copy Trading</Label>
                <Input value={copyTradingName} onChange={e => setCopyTradingName(e.target.value)} placeholder="Copy Trading" />
              </div>
              <div className="space-y-2">
                <Label>Rename: Trading Ideas</Label>
                <Input value={tradingIdeasName} onChange={e => setTradingIdeasName(e.target.value)} placeholder="Trading Ideas" />
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

  // Mentor Dashboard
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
          <Badge variant={profile.is_active ? "default" : "destructive"}>
            {profile.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Edit3 className="h-8 w-8 mx-auto text-primary mb-2" />
              <div className="text-sm text-muted-foreground">Custom Branding</div>
              <div className="text-xs mt-1">{aiBotName} • {copyTradingName}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="clients">
          <TabsList>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="branding">Branding</TabsTrigger>
          </TabsList>

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
                          <p className="text-sm font-medium">{client.client_user_id.slice(0, 8)}...</p>
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

          <TabsContent value="branding" className="space-y-4">
            <Card className="bg-gradient-card border-border shadow-card">
              <CardHeader>
                <CardTitle>Customise Your Brand</CardTitle>
                <CardDescription>Rename features that your clients will see</CardDescription>
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
                <Button onClick={updateRenames} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
