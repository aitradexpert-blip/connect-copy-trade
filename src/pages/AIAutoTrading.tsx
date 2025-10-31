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
import { Bot, TrendingUp, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface TradingAccount {
  id: string;
  name: string;
  platform: string;
  metaapi_account_id: string;
}

interface AIBot {
  id: string;
  bot_name: string;
  description: string;
  strategy_type: string;
  risk_level: string;
  status: string;
}

const riskLevels = ["Low", "Medium", "High"];

export default function AIAutoTrading() {
  const [bot, setBot] = useState<AIBot | null>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [riskLevel, setRiskLevel] = useState([1]);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        // Load the Forex Signal Bot (Swing Trader)
        const { data: botData, error: botError } = await supabase
          .from("ai_bots")
          .select("*")
          .eq("status", "active")
          .eq("bot_name", "Swing Trader")
          .single();

        if (botError) throw botError;
        if (botData) {
          setBot({
            id: botData.id,
            bot_name: botData.bot_name,
            description: "AI-powered signal execution bot for automated trading",
            strategy_type: "swing",
            risk_level: "medium",
            status: botData.status
          });
        }

        // Load user's trading accounts
        const { data: accountsData, error: accountsError } = await supabase
          .from("trading_accounts")
          .select("id,name,platform,metaapi_account_id")
          .eq("user_id", user.id);

        if (accountsError) throw accountsError;
        setAccounts(accountsData || []);
      } catch (error: any) {
        console.error("Error loading data:", error);
        toast({
          title: "Error loading bot",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleActivateBot = () => {
    setIsModalOpen(true);
  };

  const handleConfirmActivation = async () => {
    const account = accounts.find(acc => acc.id === selectedAccount);
    if (!account || !agreeTerms || !bot) return;

    try {
      const { error } = await supabase
        .from('ai_bot_assignments')
        .insert([{
          bot_id: bot.id,
          signal_id: bot.id,
          user_id: user?.id || '',
          trading_account_id: selectedAccount,
          auto_execute: true,
          status: 'active'
        }]);

      if (error) throw error;

      toast({
        title: "Forex Signal Bot Activated!",
        description: `Bot will automatically execute admin signals on ${account.name}`,
      });
      setIsModalOpen(false);
      setSelectedAccount("");
      setAgreeTerms(false);
      setRiskLevel([1]);
    } catch (error: any) {
      toast({
        title: "Activation failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getRiskLevelText = (level: number) => {
    return riskLevels[level] || "Medium";
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading AI bot...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!bot) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h1 className="text-2xl font-bold mb-4">No AI Bot Available</h1>
          <p className="text-muted-foreground">The Forex Signal Bot is currently unavailable.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">AI Trading Bot</h1>
          <p className="text-muted-foreground mt-2">
            Activate the Forex Signal Bot to automatically execute admin signals
          </p>
        </div>

        {/* Info Banner */}
        <Card className="bg-accent/50 border-border">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-1" />
              <div>
                <p className="font-medium">How it works</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This bot automatically executes signals published by admin when the auto-execute toggle is enabled. 
                  You maintain full control while benefiting from expert trading signals.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bot Card */}
        <Card className="shadow-card hover:shadow-elevated transition-smooth">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{bot.bot_name}</CardTitle>
                <div className="text-sm text-muted-foreground">
                  {bot.strategy_type} • {bot.risk_level} Risk
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{bot.description}</p>
            
            {/* Performance visualization */}
            <div className="h-24 bg-secondary/30 rounded-lg flex items-center justify-center">
              <svg width="160" height="60" viewBox="0 0 160 60" className="text-profit">
                <polyline
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  points="0,50 20,45 40,38 60,35 80,28 100,25 120,18 140,15 160,10"
                />
              </svg>
            </div>

            <div className="flex gap-2">
              <Button 
                onClick={handleActivateBot}
                className="flex-1 bg-gradient-primary hover:opacity-90 transition-smooth"
              >
                Activate Bot
              </Button>
              <Button 
                variant="outline"
                onClick={() => navigate('/signals')}
                className="flex items-center gap-2"
              >
                View Active Signals
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Activate Forex Signal Bot</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <div className="bg-secondary/50 p-4 rounded-lg">
                <h3 className="font-medium text-lg">{bot.bot_name}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {bot.description}
                </p>
                <div className="text-sm font-medium mt-2 text-primary">
                  Auto-executes admin signals with {bot.risk_level.toLowerCase()} risk management
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
                  I understand trades will be executed automatically when admin publishes signals with auto-execute enabled
                </label>
              </div>

              <Button 
                onClick={handleConfirmActivation}
                disabled={!selectedAccount || !agreeTerms}
                className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
              >
                Activate Bot
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
