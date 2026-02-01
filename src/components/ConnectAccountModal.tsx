import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDerivLoginUrl, validateDerivToken } from "@/services/derivAuth";
import { ExternalLink, Wallet, Key, Loader2, Copy, Check, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected?: () => void;
}

type ProviderType = 'deriv' | 'metaapi';

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

  const handleManualConnect = async () => {
    if (!user || !manualToken || !manualLoginId) {
      toast({ title: "Please enter both Login ID and API Token", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Validate token first
      const result = await validateDerivToken(manualToken);
      
      if (!result.valid) {
        toast({ title: "Invalid token", description: result.error, variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Save account to database - store token as plain text (consistent with OAuth flow)
      const { error } = await supabase.from("trading_accounts").upsert({
        user_id: user.id,
        provider: 'deriv',
        provider_account_id: result.accountInfo!.loginid,
        name: `Deriv ${result.accountInfo!.is_virtual ? 'Demo' : 'Real'} (${result.accountInfo!.currency})`,
        login: result.accountInfo!.loginid,
        platform: 'deriv',
        server: 'deriv.com',
        deriv_token: manualToken, // Plain text, consistent with OAuth callback
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
      setManualToken('');
      setManualLoginId('');
      setShowManualEntry(false);
      setProvider('');
      onOpenChange(false);
      onAccountConnected?.();
      navigate('/accounts');
    } catch (error: any) {
      toast({ title: "Failed to save account", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDerivConnect = () => {
    // Redirect to Deriv OAuth
    const loginUrl = getDerivLoginUrl();
    window.location.href = loginUrl;
  };

  const handleMetaApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    // Validate all required fields
    if (!formData.login || !formData.password || !formData.server || !formData.platform) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all fields including password",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);

    try {
      // Call MetaAPI provisioning edge function
      const { data, error } = await supabase.functions.invoke('metaapi-provision-account', {
        body: {
          login: formData.login,
          password: formData.password,
          server: formData.server,
          platform: formData.platform,
          name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        // Show user-friendly error from MetaAPI
        toast({
          title: "Connection Failed",
          description: data?.error || "Failed to connect account. Please check your credentials.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      // Success - save to database with MetaAPI account ID
      const { error: insertError } = await supabase
        .from("trading_accounts")
        .insert([
          {
            user_id: user.id,
            provider: 'metaapi',
            metaapi_account_id: data.metaapi_account_id,
            name: formData.name || `${formData.platform.toUpperCase()}-${formData.login}`,
            login: formData.login,
            server: formData.server,
            platform: formData.platform,
            connection_type: 'metaapi',
            connection_status: data.state === 'DEPLOYED' ? 'connected' : 'provisioning',
            balance: 0,
            equity: 0,
          },
        ]);

      if (insertError) throw insertError;

      toast({
        title: "Account connected!",
        description: `${formData.name || formData.login} has been connected successfully via MetaAPI.`,
      });

      setFormData({ 
        name: "", 
        login: "", 
        password: "",
        server: "", 
        platform: "" 
      });
      setShowPassword(false);
      setProvider('');
      setIsLoading(false);
      onOpenChange(false);
      onAccountConnected?.();
      navigate('/accounts');
    } catch (error: any) {
      console.error('MetaAPI connection error:', error);
      toast({ 
        title: "Failed to connect account", 
        description: error.message, 
        variant: "destructive" 
      });
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setProvider('');
    setFormData({ name: "", login: "", password: "", server: "", platform: "" });
    setShowPassword(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Connect Trading Account</DialogTitle>
          <DialogDescription>
            {!provider 
              ? "Choose your broker type to get started"
              : provider === 'deriv' 
                ? "Connect your Deriv account via secure OAuth"
                : "Submit your MT4/MT5 account details for admin approval"
            }
          </DialogDescription>
        </DialogHeader>
        
        {!provider ? (
          // Provider Selection
          <div className="space-y-4 py-4">
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
                  <div className="font-semibold">MT4 / MT5 (via MetaAPI)</div>
                  <div className="text-sm text-muted-foreground">
                    Any MT4/MT5 broker • Requires admin approval
                  </div>
                </div>
              </div>
            </button>
          </div>
        ) : provider === 'deriv' ? (
          // Deriv Connection - Tabs for OAuth and Manual Entry
          <div className="space-y-4 py-4">
            <Tabs defaultValue="oauth" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="oauth">OAuth (Recommended)</TabsTrigger>
                <TabsTrigger value="manual">Manual Token</TabsTrigger>
              </TabsList>
              
              <TabsContent value="oauth" className="space-y-4 pt-4">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium">How it works:</h4>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">1.</span>
                      Click "Connect with Deriv" below
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">2.</span>
                      Log in to your Deriv account
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">3.</span>
                      Authorize HuMi to access your account
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">4.</span>
                      Select which account to connect
                    </li>
                  </ol>
                </div>

                {/* Callback URL Info */}
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
                
                <div className="text-xs text-muted-foreground">
                  By connecting, you allow HuMi to view your balance, execute trades, and manage deposits/withdrawals on your behalf.
                </div>
                
                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    Back
                  </Button>
                  <Button onClick={handleDerivConnect} className="flex-1 gap-2">
                    <ExternalLink className="w-4 h-4" />
                    Connect with Deriv
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="manual" className="space-y-4 pt-4">(
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Manual API Token Entry
                  </h4>
                  <ol className="text-sm text-muted-foreground space-y-2">
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">1.</span>
                      Go to{' '}
                      <a 
                        href="https://app.deriv.com/account/api-token" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Deriv API Token page <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">2.</span>
                      Create a token with "Read", "Trade", "Admin" permissions
                    </li>
                    <li className="flex gap-2">
                      <span className="font-medium text-foreground">3.</span>
                      Use your CR account (not CRW wallet) for trading
                    </li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="loginId">Login ID (e.g., CR1234567)</Label>
                    <Input
                      id="loginId"
                      placeholder="CR1234567"
                      value={manualLoginId}
                      onChange={(e) => setManualLoginId(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiToken">API Token</Label>
                    <Input
                      id="apiToken"
                      type="password"
                      placeholder="Paste your API token"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex gap-2 w-full">
                  <Button variant="outline" onClick={handleBack} className="flex-1">
                    Back
                  </Button>
                  <Button 
                    onClick={handleManualConnect} 
                    disabled={isLoading || !manualToken || !manualLoginId}
                    className="flex-1 gap-2"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Connect
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          // MetaAPI Form - Now with automatic provisioning
          <form onSubmit={handleMetaApiSubmit} className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Connect any MT4/MT5 broker</p>
              <p className="text-muted-foreground text-xs">
                Your credentials are used once to connect via MetaAPI and are never stored.
              </p>
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
              <div className="space-y-2">
                <Label htmlFor="server">Server *</Label>
                <div className="relative">
                  <Input
                    id="server"
                    placeholder="ICMarketsSC-Demo"
                    value={formData.server}
                    onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                    list="server-suggestions"
                    required
                  />
                  <datalist id="server-suggestions">
                    <option value="Headway-Real" />
                    <option value="Headway-Demo" />
                    <option value="Deriv-Server" />
                    <option value="Deriv-Demo" />
                    <option value="ICMarketsSC-Live" />
                    <option value="ICMarketsSC-Demo" />
                    <option value="ICMarkets-Live01" />
                    <option value="ICMarkets-Demo01" />
                    <option value="XMGlobal-Real 3" />
                    <option value="XMGlobal-MT5-Demo" />
                    <option value="Exness-Real" />
                    <option value="Exness-MT5Real" />
                    <option value="Exness-Demo" />
                    <option value="FBS-Real" />
                    <option value="FBS-Demo" />
                    <option value="FTMO-Demo" />
                    <option value="FTMO-Server" />
                    <option value="OctaFX-Real" />
                    <option value="OctaFX-Demo" />
                  </datalist>
                </div>
                <p className="text-xs text-muted-foreground">Type to search or select from suggestions</p>
              </div>
              <div className="space-y-2">
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
            
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || !formData.login || !formData.password || !formData.server || !formData.platform}
                className="flex-1 gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {isLoading ? "Connecting..." : "Connect Account"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
