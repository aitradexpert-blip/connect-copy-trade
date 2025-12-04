import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getDerivLoginUrl } from "@/services/derivAuth";
import { ExternalLink, Wallet } from "lucide-react";

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
    server: "",
    platform: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleDerivConnect = () => {
    // Redirect to Deriv OAuth
    const loginUrl = getDerivLoginUrl();
    window.location.href = loginUrl;
  };

  const handleMetaApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    try {
      // Insert trading account with pending status (admin will add MetaAPI ID)
      const { error: insertError } = await supabase
        .from("trading_accounts")
        .insert([
          {
            user_id: user.id,
            provider: 'metaapi',
            name: formData.name,
            login: formData.login,
            server: formData.server,
            platform: formData.platform,
            connection_status: "pending_approval",
            metaapi_account_id: null,
            balance: 0,
            equity: 0,
          },
        ]);

      if (insertError) throw insertError;

      toast({
        title: "Account submitted for approval!",
        description: `${formData.name} will be connected once admin approves and adds MetaAPI credentials.`,
      });

      setFormData({ 
        name: "", 
        login: "", 
        server: "", 
        platform: "" 
      });
      setProvider('');
      setIsLoading(false);
      onOpenChange(false);
      onAccountConnected?.();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Failed to connect account", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setProvider('');
    setFormData({ name: "", login: "", server: "", platform: "" });
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
          // Deriv OAuth Flow
          <div className="space-y-4 py-4">
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
            
            <div className="text-xs text-muted-foreground">
              By connecting, you allow HuMi to view your balance, execute trades, and manage deposits/withdrawals on your behalf.
            </div>
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleDerivConnect} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                Connect with Deriv
              </Button>
            </DialogFooter>
          </div>
        ) : (
          // MetaAPI Form
          <form onSubmit={handleMetaApiSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                placeholder="My Trading Account"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="login">Login</Label>
                <Input
                  id="login"
                  placeholder="12345678"
                  value={formData.login}
                  onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="server">Server</Label>
                <Input
                  id="server"
                  placeholder="Broker-Server"
                  value={formData.server}
                  onChange={(e) => setFormData({ ...formData, server: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
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
            
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Connecting..." : "Submit for Approval"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
