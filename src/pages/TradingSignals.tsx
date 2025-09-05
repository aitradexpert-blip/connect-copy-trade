import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AppLayout from "@/components/AppLayout";
import { TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const mockSignals = [
  {
    id: 1,
    pair: "EUR/USD",
    direction: "BUY",
    lotSize: 0.1,
    comment: "Breaking key resistance level",
    timestamp: "2 minutes ago",
  },
  {
    id: 2,
    pair: "GBP/USD",
    direction: "SELL",
    lotSize: 0.2,
    comment: "Bearish divergence on RSI",
    timestamp: "5 minutes ago",
  },
  {
    id: 3,
    pair: "USD/JPY",
    direction: "BUY",
    lotSize: 0.15,
    comment: "Strong support bounce",
    timestamp: "8 minutes ago",
  },
];

const mockAccounts = [
  { id: "1", name: "Live Account 1", platform: "MT5" },
  { id: "2", name: "Demo Account", platform: "MT4" },
];

export default function TradingSignals() {
  const [selectedSignal, setSelectedSignal] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExecuteSignal = (signal: any) => {
    setSelectedSignal(signal);
    setIsModalOpen(true);
  };

  const handleConfirmTrade = () => {
    const account = mockAccounts.find(acc => acc.id === selectedAccount);
    if (account) {
      toast({
        title: "Trade executed successfully!",
        description: `Trade executed on ${account.name}`,
      });
      setIsModalOpen(false);
      setSelectedAccount("");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Available Trading Signals</h1>
          <p className="text-muted-foreground mt-2">
            Execute professional trading signals on your connected accounts
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {mockSignals.map((signal) => (
            <Card key={signal.id} className="shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">{signal.pair}</h3>
                  <Badge 
                    variant={signal.direction === "BUY" ? "default" : "destructive"}
                    className={`${
                      signal.direction === "BUY" 
                        ? "bg-profit text-white" 
                        : "bg-loss text-white"
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {signal.direction === "BUY" ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      {signal.direction}
                    </div>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <strong>Lots:</strong> {signal.lotSize}
                </div>
                <p className="text-sm">{signal.comment}</p>
                <div className="text-xs text-muted-foreground">
                  {signal.timestamp}
                </div>
                <Button 
                  onClick={() => handleExecuteSignal(signal)}
                  className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                >
                  Execute This Signal
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Execute Trade</DialogTitle>
            </DialogHeader>
            {selectedSignal && (
              <div className="space-y-4">
                <div className="bg-secondary/50 p-4 rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{selectedSignal.pair}</span>
                    <Badge 
                      variant={selectedSignal.direction === "BUY" ? "default" : "destructive"}
                      className={`${
                        selectedSignal.direction === "BUY" 
                          ? "bg-profit text-white" 
                          : "bg-loss text-white"
                      }`}
                    >
                      {selectedSignal.direction}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lot Size: {selectedSignal.lotSize}
                  </div>
                  <div className="text-sm">{selectedSignal.comment}</div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Your Trading Account</label>
                  <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account to execute trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.platform})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleConfirmTrade}
                  disabled={!selectedAccount}
                  className="w-full bg-gradient-primary hover:opacity-90 transition-smooth"
                >
                  Confirm & Execute Trade
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}