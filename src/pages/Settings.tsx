import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Bell, Shield, Globe, Palette, Database, Mic } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { SupportWidget } from "@/components/SupportWidget";

interface UserSettings {
  email_notifications: {
    trading_signals: boolean;
    trade_execution: boolean;
    weekly_reports: boolean;
  };
  push_notifications: {
    trading_signals: boolean;
    trade_updates: boolean;
  };
  appearance_theme: string;
  language: string;
  timezone: string;
}

export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<UserSettings>({
    email_notifications: {
      trading_signals: true,
      trade_execution: true,
      weekly_reports: true,
    },
    push_notifications: {
      trading_signals: true,
      trade_updates: true,
    },
    appearance_theme: 'system',
    language: 'en',
    timezone: 'UTC',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voicePrefs, setVoicePrefs] = useState({
    type: 'female',
    name: '',
    rate: 1.1,
    pitch: 1.3,
    volume: 0.8
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    loadSettings();
    loadVoicePreferences();
    loadAvailableVoices();
  }, [user]);

  const loadAvailableVoices = () => {
    const voices = window.speechSynthesis.getVoices();
    setAvailableVoices(voices);
  };

  useEffect(() => {
    loadAvailableVoices();
    window.speechSynthesis.onvoiceschanged = loadAvailableVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const loadVoicePreferences = () => {
    const saved = localStorage.getItem('voice_preferences');
    if (saved) {
      try {
        setVoicePrefs(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load voice preferences');
      }
    }
  };

  const saveVoicePreferences = () => {
    localStorage.setItem('voice_preferences', JSON.stringify(voicePrefs));
    toast({
      title: "Voice settings saved",
      description: "Your voice assistant preferences have been updated.",
    });
  };

  const loadSettings = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          email_notifications: data.email_notifications as UserSettings['email_notifications'],
          push_notifications: data.push_notifications as UserSettings['push_notifications'],
          appearance_theme: data.appearance_theme,
          language: data.language,
          timezone: data.timezone,
        });
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
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          email_notifications: settings.email_notifications,
          push_notifications: settings.push_notifications,
          appearance_theme: settings.appearance_theme,
          language: settings.language,
          timezone: settings.timezone,
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your preferences have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateEmailNotification = (key: keyof UserSettings['email_notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      email_notifications: {
        ...prev.email_notifications,
        [key]: value,
      },
    }));
  };

  const updatePushNotification = (key: keyof UserSettings['push_notifications'], value: boolean) => {
    setSettings(prev => ({
      ...prev,
      push_notifications: {
        ...prev.push_notifications,
        [key]: value,
      },
    }));
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

        {/* Voice Assistant Settings */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice Assistant
            </CardTitle>
            <CardDescription>Customize HuMi's voice and speech settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Voice Type</Label>
              <Select
                value={voicePrefs.type}
                onValueChange={(value) => setVoicePrefs(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female (Default)</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="custom">Custom Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {voicePrefs.type === 'custom' && (
              <div className="space-y-2">
                <Label>Select Voice</Label>
                <Select
                  value={voicePrefs.name}
                  onValueChange={(value) => setVoicePrefs(prev => ({ ...prev, name: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a voice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableVoices.map((voice) => (
                      <SelectItem key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableVoices.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Refresh the page if voices don't appear
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Speech Rate</Label>
                  <span className="text-sm text-muted-foreground">{voicePrefs.rate.toFixed(1)}</span>
                </div>
                <Slider
                  value={[voicePrefs.rate]}
                  onValueChange={([value]) => setVoicePrefs(prev => ({ ...prev, rate: value }))}
                  min={0.8}
                  max={1.3}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Pitch</Label>
                  <span className="text-sm text-muted-foreground">{voicePrefs.pitch.toFixed(1)}</span>
                </div>
                <Slider
                  value={[voicePrefs.pitch]}
                  onValueChange={([value]) => setVoicePrefs(prev => ({ ...prev, pitch: value }))}
                  min={0.9}
                  max={1.5}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Volume</Label>
                  <span className="text-sm text-muted-foreground">{voicePrefs.volume.toFixed(1)}</span>
                </div>
                <Slider
                  value={[voicePrefs.volume]}
                  onValueChange={([value]) => setVoicePrefs(prev => ({ ...prev, volume: value }))}
                  min={0.6}
                  max={1.0}
                  step={0.1}
                  className="w-full"
                />
              </div>
            </div>

            <Button onClick={saveVoicePreferences} variant="outline" className="w-full">
              Save Voice Settings
            </Button>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Appearance
            </CardTitle>
            <CardDescription>Customize how the application looks and feels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Theme</Label>
              <Select
                value={theme}
                onValueChange={setTheme}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose how HuMi looks to you. Select a single theme, or sync with your system and automatically switch between day and night themes.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>Control how you receive notifications and alerts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-medium">Email Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trading Signals</p>
                    <p className="text-sm text-muted-foreground">Get notified about new trading signals</p>
                  </div>
                  <Switch
                    checked={settings.email_notifications.trading_signals}
                    onCheckedChange={(checked) => updateEmailNotification('trading_signals', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trade Execution</p>
                    <p className="text-sm text-muted-foreground">Receive confirmations for executed trades</p>
                  </div>
                  <Switch
                    checked={settings.email_notifications.trade_execution}
                    onCheckedChange={(checked) => updateEmailNotification('trade_execution', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Weekly Reports</p>
                    <p className="text-sm text-muted-foreground">Weekly summary of your trading activity</p>
                  </div>
                  <Switch
                    checked={settings.email_notifications.weekly_reports}
                    onCheckedChange={(checked) => updateEmailNotification('weekly_reports', checked)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Push Notifications</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trading Signals</p>
                    <p className="text-sm text-muted-foreground">Real-time push notifications for signals</p>
                  </div>
                  <Switch
                    checked={settings.push_notifications.trading_signals}
                    onCheckedChange={(checked) => updatePushNotification('trading_signals', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Trade Updates</p>
                    <p className="text-sm text-muted-foreground">Important updates about your trades</p>
                  </div>
                  <Switch
                    checked={settings.push_notifications.trade_updates}
                    onCheckedChange={(checked) => updatePushNotification('trade_updates', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Regional & Language Settings */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Regional & Language
            </CardTitle>
            <CardDescription>Set your location and language preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, language: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings(prev => ({ ...prev, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    <SelectItem value="Africa/Johannesburg">Johannesburg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Security & Privacy */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security & Privacy
            </CardTitle>
            <CardDescription>Manage your account security and privacy settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Login History</p>
                  <p className="text-sm text-muted-foreground">View recent login activity</p>
                </div>
                <Button variant="outline" size="sm">View</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </CardTitle>
            <CardDescription>Manage your trading data and account information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Export Trading Data</p>
                  <p className="text-sm text-muted-foreground">Download your trading history and statistics</p>
                </div>
                <Button variant="outline" size="sm">Export</Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account and all data</p>
                </div>
                <Button variant="outline" size="sm" className="text-destructive border-destructive">Delete</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Channels */}
        <SupportWidget />
      </div>
    </AppLayout>
  );
}
