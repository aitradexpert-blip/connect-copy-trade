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

interface ConnectAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountConnected?: () => void;
}

export function ConnectAccountModal({ 
  open, 
  onOpenChange, 
  onAccountConnected 
}: ConnectAccountModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    login: "",
    server: "",
    metaapiAccountId: "",
    platform: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    try {
      // 1) Insert trading account
      const { data: inserted, error: insertError } = await supabase
        .from("trading_accounts")
        .insert([
          {
            user_id: user.id,
            name: formData.name,
            login: formData.login,
            server: formData.server,
            metaapi_account_id: formData.metaapiAccountId,
            platform: formData.platform,
            connection_status: "connected",
          },
        ])
        .select("id")
        .single();

      if (insertError) throw insertError;

      // 2) Fetch live balance/equity from MetaAPI via Edge Function
      const { data: info, error: fnError } = await supabase.functions.invoke(
        "metaapi-account-info",
        {
          body: { accountId: formData.metaapiAccountId },
        }
      );

      if (fnError) {
        console.error(fnError);
      }

      const balance = Number(info?.balance || 0);
      const equity = Number(info?.equity || 0);

      // 3) Update record with live balances
      if (inserted?.id) {
        await supabase
          .from("trading_accounts")
          .update({ balance, equity })
          .eq("id", inserted.id);
      }

      toast({
        title: "Account connected successfully!",
        description: `${formData.name} has been connected to your trading dashboard.`,
      });

      setFormData({ 
        name: "", 
        login: "", 
        server: "", 
        metaapiAccountId: "", 
        platform: "" 
      });
      setIsLoading(false);
      onOpenChange(false);
      onAccountConnected?.();
    } catch (error: any) {
      console.error(error);
      toast({ title: "Failed to connect account", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Connect Trading Account</DialogTitle>
          <DialogDescription>
            Connect your MetaTrader account using MetaAPI account ID.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="metaapiAccountId">MetaAPI Account ID</Label>
            <Input
              id="metaapiAccountId"
              placeholder="e.g. 12345678:abcf-..."
              value={formData.metaapiAccountId}
              onChange={(e) => setFormData({ ...formData, metaapiAccountId: e.target.value })}
              required
            />
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
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Connecting..." : "Connect Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
