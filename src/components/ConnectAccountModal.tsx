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
      // Insert trading account with pending status (admin will add MetaAPI ID)
      const { error: insertError } = await supabase
        .from("trading_accounts")
        .insert([
          {
            user_id: user.id,
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
            Submit your account details. Admin will connect it to MetaAPI after approval.
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
