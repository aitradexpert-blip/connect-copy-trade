import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDerivLoginUrl, validateDerivToken } from "@/services/derivAuth";
import { invokeEdgeFunctionJson } from "@/lib/supabaseInvoke";
import { primaryApi, isPrimaryConfigured } from "@/services/primaryApi";
import { ExternalLink, Wallet, Key, Loader2, Copy, Check, AlertCircle, Eye, EyeOff, Camera, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected?: () => void;
}

type ProviderType = 'deriv' | 'metaapi' | 'screenshot';

export function ConnectAccountModal({ 
  open, 
  onOpenChange, 
  onAccountConnected 
}: ConnectAccountModalProps) {
  const [provider, setProvider] = useState<ProviderType | ''>('');
  const [formData, setFormData] = useState({
    name: "",
    login: "",
    password: "",
    server: "",
    platform: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualLoginId, setManualLoginId] = useState('');
  const [copied, setCopied] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const callbackUrl = `${window.location.origin}/deriv-callback`;

  const copyCallbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    setScreenshotUrl(url);
  };

  const handleManualConnect = async () => {
    if (!user || !manualToken || !manualLoginId) {
      toast({ title: "Please enter both Login ID and API Token", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const result = await validateDerivToken(manualToken);
      
      if (!result.valid) {
        toast({ title: "Invalid token", description: result.error, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.from("trading_accounts").upsert({
        user_id: user.id,
        provider: 'deriv',
        provider_account_id: result.accountInfo!.loginid,
        name: `Deriv ${result.accountInfo!.is_virtual ? 'Demo' : 'Real'} (${result.accountInfo!.currency})`,
        login: result.accountInfo!.loginid,
        platform: 'deriv',
        server: 'deriv.com',
        deriv_token: manualToken,
        deriv_currency: result.accountInfo!.currency,
        is_virtual: result.accountInfo!.is_virtual,
        balance: result.accountInfo!.balance,
        equity: result.accountInfo!.balance,
        connection_status: 'connected',
      }, {
        onConflict: 'user_id,provider,provider_account_id',
      });

      if (error) throw error;

      toast({ title: "Account connected!", description: `${result.accountInfo!.loginid} added successfully` });
      resetAndClose();
    } catch (error: any) {
      toast({ title: "Failed to save account", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDerivConnect = () => {
    const loginUrl = getDerivLoginUrl();
    window.location.href = loginUrl;
  };

  const testVpsConnection = async () => {
    const base = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
    if (!base) {
      toast({ title: "VPS not configured", description: "VITE_API_URL is empty.", variant: "destructive" });
      return;
    }
    const started = performance.now();
    try {
      const res = await fetch(`${base}/health`, {
        headers: { Accept: "application/json", "ngrok-skip-browser-warning": "true" },
      });
      const ms = Math.round(performance.now() - started);
      if (res.ok) {
        toast({ title: "VPS online", description: `/health responded in ${ms}ms` });
      } else {
        toast({
          title: `VPS returned ${res.status}`,
          description: "Check the FastAPI server and VPS_API_SECRET.",
          variant: "destructive",
        });
      }
    } catch (e: any) {
      toast({
        title: "VPS unreachable",
        description: e?.message || "Could not connect to the VPS bridge.",
        variant: "destructive",
      });
    }
  };

  const handleMetaApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.login || !formData.password || !formData.server || !formData.platform) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all fields including password",
        variant: "destructive"
      });
      return;
    }
    if (provider === 'screenshot' && !agreedToTerms) {
      toast({ title: "Please agree to the terms", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);

    // ---------------------------------------------------------
    // STEP 1: Try our own VPS backend first (primary engine)
    // Routed through primaryApi/tradingDataGateway so there is a
    // single source of truth for the VPS base URL (VITE_API_URL),
    // instead of a second hardcoded ngrok URL living in this file.
    // ---------------------------------------------------------
    if (isPrimaryConfigured()) {
      try {
        const accountName = formData.name || `${formData.platform.toUpperCase()}-${formData.login}`;

        // Create a placeholder row first so we have an account_id (UUID) to use
        const { data: newAccount, error: insertErr } = await supabase
          .from("trading_accounts")
          .insert([{
            user_id: user.id,
            provider: 'vps',
            name: accountName,
            login: formData.login.replace(/\D/g, '') || formData.login,
            server: formData.server,
            platform: formData.platform,
            connection_type: 'vps',
            connection_status: 'connecting',
            balance: 0,
            equity: 0,
          }])
          .select()
          .single();

        if (insertErr) throw insertErr;

        const vpsJson: any = await primaryApi.connect({
          login: parseInt(formData.login.replace(/\D/g, ''), 10),
          password: formData.password,
          server: formData.server,
          account_id: newAccount.id,
        });

        const vpsSuccess = vpsJson?.success === true || vpsJson?.status === 'connected';
        const vpsData = vpsJson?.data ?? vpsJson;

        if (vpsSuccess) {
          const { error: updateErr } = await supabase
            .from("trading_accounts")
            .update({
              mt5_password: formData.password,
              connection_status: 'connected',
              balance: vpsData?.balance ?? 0,
              equity: vpsData?.equity ?? 0,
              broker_name: vpsData?.company ?? null,
            })
            .eq("id", newAccount.id);

          if (updateErr) throw updateErr;

          toast({
            title: "Account connected!",
            description: `${accountName} connected via our direct trading engine.`,
          });
          resetAndClose();
          setIsLoading(false);
          return;
        }

        // VPS responded but login failed — clean up placeholder and
        // fall through to MetaAPI below
        await supabase.from("trading_accounts").delete().eq("id", newAccount.id);
        console.warn("VPS connect failed, falling back to MetaAPI:", vpsJson?.error);

      } catch (vpsNetworkError: any) {
        console.error('[VPS] Network error, falling through to MetaAPI:', vpsNetworkError?.message);
        // Clean up any ghost placeholder row from the failed VPS attempt so it
        // does not consume the user's account quota on retry.
        try {
          const { data: ghost } = await supabase
            .from('trading_accounts')
            .select('id')
            .eq('user_id', user.id)
            .eq('login', formData.login.replace(/\D/g, '') || formData.login)
            .eq('connection_status', 'connecting')
            .maybeSingle();
          if (ghost?.id) {
            await supabase.from('trading_accounts').delete().eq('id', ghost.id);
          }
        } catch { /* ignore cleanup error */ }
      }
    } else {
      console.warn("VITE_API_URL not configured — skipping VPS, using MetaAPI directly.");
    }

    // ---------------------------------------------------------
    // STEP 2: Fallback to MetaAPI (existing logic, unchanged)
    // ---------------------------------------------------------
    try {
      type ProvisionResult = {
        success?: boolean;
        metaapi_account_id?: string;
        state?: string;
        error?: string;
        pending?: boolean;
        code?: string;
      };
      const res = await invokeEdgeFunctionJson<ProvisionResult>("metaapi-provision-account", {
        login: formData.login,
        password: formData.password,
        server: formData.server,
        platform: formData.platform,
        name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`,
        email: user.email,
      });
      if (!res.ok) {
        const rawMsg = res.errorMessage || "";
        const isQuotaError =
          /quota|limit|exceeded/i.test(rawMsg);
        toast({
          title: isQuotaError ? "Account Limit Reached" : "Connection Failed",
          description: isQuotaError
            ? "Your current plan allows 1 trading account. Please upgrade your subscription or remove an existing account before adding a new one."
            : rawMsg || "Could not connect your account. Check your credentials and try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      const parsed = res.data;
      if (parsed?.pending || parsed?.code === "PENDING") {
        toast({
          title: "MetaAPI is still processing",
          description: parsed?.error || "Wait about one minute, then try again with the same credentials.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      if (!parsed?.success) {
        toast({
          title: "Connection Failed",
          description: parsed?.error || "Failed to connect account. Please check your credentials.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      const data2 = parsed;
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!data2.metaapi_account_id || !UUID_RE.test(data2.metaapi_account_id)) {
        toast({
          title: "Connection incomplete",
          description: "Trading Bridge could not auto-provision this account. Please retry, verify your credentials, or contact support.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      // Guard against duplicate insert — a ghost row from a previous VPS
      // attempt (or from a partial MetaAPI retry) would otherwise trip the
      // per-user account quota trigger.
      const normalizedLogin = formData.login.replace(/\D/g, '') || formData.login;
      const { data: existingAcc } = await supabase
        .from('trading_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('login', normalizedLogin)
        .maybeSingle();

      if (existingAcc?.id) {
        await supabase.from('trading_accounts').update({
          provider: 'metaapi',
          connection_type: 'metaapi',
          metaapi_account_id: data2.metaapi_account_id,
          name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`,
          server: formData.server,
          platform: formData.platform,
          connection_status: data2.state === 'DEPLOYED' ? 'connected' : 'provisioning',
        }).eq('id', existingAcc.id);
        toast({
          title: "Account connected!",
          description: `${formData.name || formData.login} has been connected successfully.`,
        });
        resetAndClose();
        setIsLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("trading_accounts")
        .insert([{
          user_id: user.id,
          provider: 'metaapi',
          metaapi_account_id: data2.metaapi_account_id,
          name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`,
          login: normalizedLogin,
          server: formData.server,
          platform: formData.platform,
          connection_type: 'metaapi',
          connection_status: data2.state === 'DEPLOYED' ? 'connected' : 'provisioning',
          balance: 0,
          equity: 0,
        }]);
      if (insertError) throw insertError;
      toast({
        title: "Account connected!",
        description: `${formData.name || formData.login} has been connected successfully.`,
      });
      resetAndClose();
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({ title: "Failed to connect account", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const resetAndClose = () => {
    setFormData({ name: "", login: "", password: "", server: "", platform: "" });
    setShowPassword(false);
    setProvider('');
    setManualToken('');
    setManualLoginId('');
    setScreenshotUrl(null);
    setAgreedToTerms(false);
    onOpenChange(false);
    onAccountConnected?.();
    // Force accounts page to reload even if already on /accounts
    // by navigating away first then back (avoids stale cache from useEffect [user])
    navigate('/');
    setTimeout(() => navigate('/accounts'), 100);
  };

  const handleBack = () => {
    setProvider('');
    setFormData({ name: "", login: "", password: "", server: "", platform: "" });
    setShowPassword(false);
    setScreenshotUrl(null);
    setAgreedToTerms(false);
  };

  const renderMetaApiForm = () => (
    <form onSubmit={handleMetaApiSubmit} className="space-y-4">
      {provider === 'screenshot' && screenshotUrl && (
        <div className="space-y-2">
          <Label>Your Screenshot (Reference)</Label>
          <div className="border border-border rounded-lg overflow-hidden max-h-48">
            <img src={screenshotUrl} alt="Login details" className="w-full h-full object-contain" />
          </div>
          <p className="text-xs text-muted-foreground">
            Use the details from your screenshot to fill in the form below.
          </p>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-medium mb-1">Connect any MT4/MT5 broker</p>
            <p className="text-muted-foreground text-xs">
              We connect directly to your broker for the fastest execution, with a secure cloud backup if needed.
            </p>
          </div>
          {isPrimaryConfigured() && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={testVpsConnection}
              className="shrink-0 text-xs"
            >
              Test VPS
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Account Name (optional)</Label>
        <Input
          id="name"
          placeholder="My Trading Account"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="login">Login ID *</Label>
          <Input
            id="login"
            placeholder="12345678"
            value={formData.login}
            onChange={(e) => setFormData({ ...formData, login: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Your MT password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 relative z-20">
          <Label htmlFor="server">Server *</Label>
          <div className="relative z-20">
            <Input
              id="server"
              placeholder="ICMarketsSC-Demo"
              value={formData.server}
              onChange={(e) => setFormData({ ...formData, server: e.target.value })}
              list="server-suggestions"
              autoComplete="off"
              required
              className="relative z-20 bg-background"
            />
            <datalist id="server-suggestions">
              <option value="Headway-Real" />
              <option value="Headway-Demo" />
              <option value="Deriv-Server" />
              <option value="Deriv-Demo" />
              <option value="ICMarketsSC-Live" />
              <option value="ICMarketsSC-Demo" />
              <option value="XMGlobal-Real 3" />
              <option value="Exness-Real" />
              <option value="Exness-MT5Real" />
              <option value="FBS-Real" />
              <option value="FTMO-Demo" />
              <option value="OctaFX-Real" />
              <option value="Weltrade-Live" />
              <option value="Weltrade-Demo" />
              <option value="Weltrade-ECN" />
            </datalist>
          </div>
          <p className="text-xs text-muted-foreground">Type freely if your server isn't listed.</p>
        </div>
        <div className="space-y-2 relative z-0">
          <Label htmlFor="platform">Platform *</Label>
          <Select 
            value={formData.platform} 
            onValueChange={(value) => setFormData({ ...formData, platform: value })}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mt4">MetaTrader 4</SelectItem>
              <SelectItem value="mt5">MetaTrader 5</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {provider === 'screenshot' && (
        <div className="flex items-start space-x-2 p-3 bg-muted/50 rounded-lg">
          <Checkbox
            id="terms"
            checked={agreedToTerms}
            onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
          />
          <label htmlFor="terms" className="text-xs text-muted-foreground leading-tight cursor-pointer">
            I confirm the details above are correct and I authorise HuMi to connect this trading account on my behalf. I understand my password is used once for secure connection and is not stored.
          </label>
        </div>
      )}
      
      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={handleBack}>
          Back
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || !formData.login || !formData.password || !formData.server || !formData.platform || (provider === 'screenshot' && !agreedToTerms)}
          className="flex-1 gap-2"
        >
          {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
          {isLoading ? "Connecting..." : "Connect Account"}
        </Button>
      </div>
    </form>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Connect Trading Account</DialogTitle>
          <DialogDescription>
            {!provider 
              ? "Choose your connection method to get started"
              : provider === 'deriv' 
                ? "Connect your Deriv account via secure OAuth"
                : provider === 'screenshot'
                  ? "Upload a screenshot and fill in your details"
                  : "Connect your MT4/MT5 account via Trading Bridge"
            }
          </DialogDescription>
        </DialogHeader>
        
        {!provider ? (
          <div className="space-y-3 py-4">
            <button
              onClick={() => setProvider('deriv')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 text-left transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Deriv</div>
                  <div className="text-sm text-muted-foreground">
                    Connect instantly via OAuth • Forex, Crypto, Synthetic Indices
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 text-muted-foreground" />
              </div>
            </button>
            
            <button
              onClick={() => setProvider('metaapi')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 text-left transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">MT4 / MT5 Broker</div>
                  <div className="text-sm text-muted-foreground">
                    Any MT4/MT5 broker • Connect via Trading Bridge
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setProvider('screenshot')}
              className="w-full p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 text-left transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Camera className="w-6 h-6 text-emerald-500" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">Upload Screenshot</div>
                  <div className="text-sm text-muted-foreground">
                    Take a photo of your login details • We'll help you fill the form
                  </div>
                </div>
              </div>
            </button>
          </div>
        ) : provider === 'screenshot' && !screenshotUrl ? (
          <div className="space-y-4 py-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Camera className="w-4 h-4" />
                Upload Your Login Details
              </h4>
              <p className="text-sm text-muted-foreground">
                Take a screenshot or photo of your broker's login details (login ID, server, password), then upload it here. The image will be shown alongside a form for easy reference.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleScreenshotUpload}
              className="hidden"
            />

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full h-32 border-dashed border-2 flex flex-col gap-2"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-muted-foreground">Tap to upload or take a photo</span>
              </Button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Your screenshot is only displayed locally for your reference. It is <strong>never uploaded or stored</strong> on our servers.
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
            </div>
          </div>
        ) : provider === 'deriv' ? (
          <div className="space-y-4 py-4">
            <Tabs defaultValue="oauth" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
                <TabsTrigger value="manual">Manual Token</TabsTrigger>
              </TabsList>
              
              <TabsContent value="oauth" className="space-y-4 pt-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-foreground">
                      If your Deriv account was recently disabled or deactivated, the connection will fail. Please check your account status at{' '}
                      <a
                        href="https://app.deriv.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-medium"
                      >
                        app.deriv.com
                      </a>{' '}
                      first.
                    </p>
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">How it works:</h4>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex gap-2"><span className="font-medium text-foreground">1.</span>Click "Connect with Deriv" below</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">2.</span>Log in to your Deriv account</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">3.</span>Authorize HuMi to access your account</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">4.</span>Select which account to connect</li>
                  </ol>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-medium">If OAuth keeps redirecting to login, register this URL in your Deriv app:</span>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="bg-background px-1 py-0.5 rounded text-[10px] flex-1 overflow-x-auto">
                          {callbackUrl}
                        </code>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={copyCallbackUrl}>
                          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </Button>
                      </div>
                      <a 
                        href="https://api.deriv.com/dashboard" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        Open Deriv Dashboard <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
                  <Button onClick={handleDerivConnect} className="flex-1 gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Connect with Deriv
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-4 pt-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Manual API Token Entry
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">1.</span>
                      Go to{' '}
                      <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        Deriv API Token page <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">2.</span>Create a token with "Read", "Trade", "Admin" permissions</li>
                    <li className="flex gap-2"><span className="font-medium text-foreground">3.</span>Use your CR account (not CRW wallet) for trading</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="loginId">Login ID (e.g., CR1234567)</Label>
                    <Input id="loginId" placeholder="CR1234567" value={manualLoginId} onChange={(e) => setManualLoginId(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiToken">API Token</Label>
                    <Input id="apiToken" type="password" placeholder="Paste your API token" value={manualToken} onChange={(e) => setManualToken(e.target.value)} />
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleBack} className="flex-1">Back</Button>
                  <Button onClick={handleManualConnect} disabled={isLoading || !manualToken || !manualLoginId} className="flex-1 gap-2">
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Connect
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          renderMetaApiForm()
        )}
      </DialogContent>
    </Dialog>
  );
}
