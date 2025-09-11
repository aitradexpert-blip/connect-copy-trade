import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import AppLayout from "@/components/AppLayout";
import { Bot, TrendingUp, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const mockBots = [
  {
    id: 1,
    name: "Scalper Pro",
    description: "High-frequency trading bot for quick profits in volatile markets",
    performance: "+24.5%",
    icon: Zap,
  },
  {
    id: 2,
    name: "Trend Follower",
    description: "Identifies and follows major market trends for consistent gains",
    performance: "+18.2%",
    icon: TrendingUp,
  },
  {
    id: 3,
    name: "Volatility Rider",
    description: "Capitalizes on market volatility using advanced algorithms",
    performance: "+31.7%",
    icon: Bot,
  },
];

interface TradingAccount {
  id: string;
  name: string;
  platform: string;
  metaapi_account_id: string;
}

const riskLevels = ["Low", "Medium", "High"];

export default function AIAutoTrading() {
  const [selectedBot, setSelectedBot] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [riskLevel, setRiskLevel] = useState([1]);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const loadAccounts = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from("trading_accounts")
          .select("id,name,platform,metaapi_account_id")
          .eq("user_id", user.id);

        if (error) throw error;
        setAccounts(data || []);
      } catch (error: any) {
        console.error("Error loading trading accounts:", error);
      }
    };
    loadAccounts();
  }, [user]);

  const handleActivateBot = (bot: any) => {
    setSelectedBot(bot);
    setIsModalOpen(true);
  };

  const handleConfirmActivation = () => {
    const account = accounts.find(acc => acc.id === selectedAccount);
    if (account && agreeTerms) {
      toast({
        title: `${selectedBot.name} activated!`,
        description: `Bot activated on ${account.name}`,
      });
      setIsModalOpen(false);
      setSelectedAccount("");
      setAgreeTerms(false);
      setRiskLevel([1]);
    }
  };

  const getRiskLevelText = (level: number) => {
    return riskLevels[level] || "Medium";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Trading Bots</h1>
          <p className="text-muted-foreground mt-2">
            Select a pre-configured bot to trade on your connected accounts
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockBots.map((bot) => {
            const IconComponent = bot.icon;
            return (
              <Card key={bot.id} className="shadow-card hover:shadow-elevated transition-smooth">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{bot.name}</CardTitle>
                      <div className="text-sm text-profit font-medium">
                        {bot.performance} last month
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">{bot.description}</p>
                  
                  {/* Performance chart placeholder */}
                  <div className="h-24 bg-secondary/30 rounded-lg flex items-center justify-center">
                    <svg width="120" height="60" viewBox="0 0 120 60" className="text-profit">
                      <polyline
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        points="0,40 20,35 40,25 60,20 80,15 100,10 120,5"
                      />
                    </svg>
                  </div>

                  <Button 
                    onClick={() => handleActivateBot(bot)}
                    className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                  >
                    Activate Bot
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Activate Trading Bot</DialogTitle>
            </DialogHeader>
            {selectedBot && (
              <div className="space-y-6">
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <h3 className="font-medium text-lg">{selectedBot.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedBot.description}
                  </p>
                  <div className="text-sm text-profit font-medium mt-2">
                    Performance: {selectedBot.performance} last month
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Trading Account</label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account for bot trading" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.platform.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">
                    Risk Level: {getRiskLevelText(riskLevel[0])}
                  </label>
                  <Slider
                    value={riskLevel}
                    onValueChange={setRiskLevel}
                    max={2}
                    min={0}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="terms"
                    checked={agreeTerms}
                    onCheckedChange={setAgreeTerms}
                  />
                  <label htmlFor="terms" className="text-sm">
                    I agree to the terms and conditions
                  </label>
                </div>

                <Button 
                  onClick={handleConfirmActivation}
                  disabled={!selectedAccount || !agreeTerms}
                  className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                >
                  Activate
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}