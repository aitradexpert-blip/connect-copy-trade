import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Bell, Shield, Globe, Palette, Database, Mic, Wrench, Code, Loader2, Eye, EyeOff, Volume2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { SupportWidget } from "@/components/SupportWidget";
import DerivDiagnostic from "@/components/DerivDiagnostic";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface UserSettings {
  email_notifications: { trading_signals: boolean; trade_execution: boolean; weekly_reports: boolean; };
  push_notifications: { trading_signals: boolean; trade_updates: boolean; };
  appearance_theme: string;
  language: string;
  timezone: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserSettings>({
    email_notifications: { trading_signals: true, trade_execution: true, weekly_reports: true },
    push_notifications: { trading_signals: true, trade_updates: true },
    appearance_theme: 'system', language: 'en', timezone: 'UTC',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Voice preferences (ElevenLabs)
  const [voiceGender, setVoiceGender] = useState('female');
  const [previewingVoice, setPreviewingVoice] = useState(false);

  // Change password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const isOAuthUser = user?.identities?.some((i: { provider: string }) => i.provider === 'google') ?? false;
  const push = usePushNotifications();

  const VOICE_IDS = {
    female: { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah (Female, South African)' },
    male: { id: 'JBFqnCBsd6RMkjVDRZzb', label: 'George (Male, South African)' },
  };

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          email_notifications: data.email_notifications as UserSettings['email_notifications'],
          push_notifications: data.push_notifications as UserSettings['push_notifications'],
          appearance_theme: data.appearance_theme || 'system',
          language: data.language || 'en',
          timezone: data.timezone || 'UTC',
        });
        const vp = data.voice_preference as any;
        if (vp?.gender) setVoiceGender(vp.gender);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const voiceId = VOICE_IDS[voiceGender as keyof typeof VOICE_IDS]?.id || VOICE_IDS.female.id;
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          email_notifications: settings.email_notifications,
          push_notifications: settings.push_notifications,
          appearance_theme: settings.appearance_theme,
          language: settings.language,
          timezone: settings.timezone,
          voice_preference: { voiceId, gender: voiceGender },
        });

      if (error) throw error;

      // Also save to localStorage for immediate use
      localStorage.setItem('voice_preferences', JSON.stringify({ voiceId, gender: voiceGender }));

      toast({ title: "Settings saved", description: "Your preferences have been updated." });
    } catch (error: any) {
      toast({ title: "Error saving settings", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewVoice = async () => {
    setPreviewingVoice(true);
    try {
      const voiceId = VOICE_IDS[voiceGender as keyof typeof VOICE_IDS]?.id;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: "Sharp! I'm Khumo, your trading assistant. Let's get it!", voiceId }),
        }
      );
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('audio')) {
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play();
      } else {
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance("Sharp! I'm Khumo, your trading assistant. Let's get it!");
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      const utterance = new SpeechSynthesisUtterance("Sharp! I'm Khumo, your trading assistant. Let's get it!");
      window.speechSynthesis.speak(utterance);
    } finally {
      setPreviewingVoice(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Password updated!", description: "Your password has been changed." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const updateEmailNotification = (key: keyof UserSettings['email_notifications'], value: boolean) => {
    setSettings(prev => ({ ...prev, email_notifications: { ...prev.email_notifications, [key]: value } }));
  };

  const updatePushNotification = (key: keyof UserSettings['push_notifications'], value: boolean) => {
    setSettings(prev => ({ ...prev, push_notifications: { ...prev.push_notifications, [key]: value } }));
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your application preferences and notifications</p>
        </div>

        {/* Voice Assistant Settings - ElevenLabs */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mic className="w-5 h-5" /> Khumo Voice Assistant</CardTitle>
            <CardDescription>Choose Khumo's voice — powered by ElevenLabs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <Select value={voiceGender} onValueChange={setVoiceGender}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{VOICE_IDS.female.label}</SelectItem>
                  <SelectItem value="male">{VOICE_IDS.male.label}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={previewVoice} disabled={previewingVoice}>
              {previewingVoice ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Volume2 className="h-4 w-4 mr-2" />}
              Preview Voice
            </Button>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5" /> Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5" /> Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Email Notifications</h4>
              <div className="space-y-3">
                {(['trading_signals', 'trade_execution', 'weekly_reports'] as const).map(key => (
                  <div key={key} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
                    </div>
                    <Switch checked={settings.email_notifications[key]} onCheckedChange={v => updateEmailNotification(key, v)} />
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium">Phone Push Notifications</h4>
              {!push.supported ? (
                <p className="text-sm text-muted-foreground">This browser doesn't support push notifications. On iOS, install the app to your Home Screen first.</p>
              ) : push.subscribed ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Push is enabled — you'll be notified about new ideas, trades, and account events.</p>
                  <Button variant="outline" size="sm" onClick={push.disable} disabled={push.loading}>Disable</Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Get notified on your phone when a new idea drops or a trade fires.</p>
                  <Button size="sm" onClick={async () => { const r = await push.enable(); if (!r.ok) toast({ title: 'Push not enabled', description: r.error, variant: 'destructive' }); else toast({ title: 'Push enabled' }); }} disabled={push.loading}>Enable</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Regional */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Regional & Language</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={settings.language} onValueChange={v => setSettings(p => ({ ...p, language: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={settings.timezone} onValueChange={v => setSettings(p => ({ ...p, timezone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Africa/Johannesburg">Johannesburg</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Change Password */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5" /> Security & Privacy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Change Password</h4>
              {isOAuthUser ? (
                <div className="p-4 bg-muted/50 rounded-lg max-w-md">
                  <p className="text-sm font-medium mb-1">Password managed by Google</p>
                  <p className="text-sm text-muted-foreground">
                    Your account uses Google Sign-In.{' '}
                    <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      Manage your security settings here
                    </a>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="space-y-2">
                    <Label>New Password</Label>
                    <div className="relative">
                      <Input type={showNewPw ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 6 characters" minLength={6} />
                      <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Confirm New Password</Label>
                    <div className="relative">
                      <Input type={showConfirmPw ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
                      <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword || !confirmPassword}>
                    {changingPassword && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              )}
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add extra security</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" /> Data Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Export Trading Data</p>
                <p className="text-sm text-muted-foreground">Download your trading history</p>
              </div>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </CardContent>
        </Card>

        {/* Developer */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wrench className="w-5 h-5" /> Developer & API</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">API Documentation</p>
                <p className="text-sm text-muted-foreground">For brokers and enterprise partners</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate('/api-docs')}>
                <Code className="w-4 h-4 mr-2" /> View Docs
              </Button>
            </div>
            <DerivDiagnostic />
          </CardContent>
        </Card>

        {/* Save All */}
        <Button onClick={saveSettings} disabled={saving} className="w-full md:w-auto">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save All Settings
        </Button>

        <SupportWidget />
      </div>
    </AppLayout>
  );
}
