import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit, Trash2, Calendar, Send, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";

interface TradingSignal {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  lot_size: number;
  stop_loss?: number;
  take_profit?: number;
  comment?: string;
  status: string;
  created_at: string;
  scheduled_at?: string;
  expires_at?: string;
}

const forexPairs = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'XAU/USD', 'XAG/USD'
];

const Admin = () => {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    direction: 'BUY' as 'BUY' | 'SELL',
    lot_size: 0.1,
    stop_loss: '',
    take_profit: '',
    comment: '',
    scheduled: false,
    scheduled_at: '',
    auto_execute_for_bots: false
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchSignals();
  }, []);

  const fetchSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('trading_signals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSignals((data || []) as TradingSignal[]);
    } catch (error: any) {
      toast({
        title: "Error fetching signals",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const signalData = {
        symbol: formData.symbol,
        direction: formData.direction,
        lot_size: formData.lot_size,
        stop_loss: formData.stop_loss ? parseFloat(formData.stop_loss) : null,
        take_profit: formData.take_profit ? parseFloat(formData.take_profit) : null,
        comment: formData.comment || null,
        scheduled_at: formData.scheduled && formData.scheduled_at ? formData.scheduled_at : null,
      };

      const { data: newSignal, error } = await supabase
        .from('trading_signals')
        .insert([signalData])
        .select()
        .single();

      if (error) throw error;

      // Auto-execute for AI bots if enabled
      if (formData.auto_execute_for_bots && newSignal) {
        const { data: autoExecResult, error: autoExecError } = await supabase.functions.invoke('auto-execute-signal', {
          body: { signal_id: newSignal.id }
        });

        if (!autoExecError && autoExecResult?.executed_count > 0) {
          toast({
            title: "Idea published and auto-executed!",
            description: `Idea executed on ${autoExecResult.executed_count} AI bot accounts`,
          });
        } else {
          toast({
            title: "Signal published successfully!",
            description: "Signal has been shared to connected social channels.",
          });
        }
      } else {
      toast({
        title: "Idea published successfully!",
        description: "Trading idea has been published.",
      });
      }

      // Reset form
      setFormData({
        symbol: '',
        direction: 'BUY',
        lot_size: 0.1,
        stop_loss: '',
        take_profit: '',
        comment: '',
        scheduled: false,
        scheduled_at: '',
        auto_execute_for_bots: false
      });

      fetchSignals();
    } catch (error: any) {
      toast({
        title: "Error publishing idea",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('trading_signals')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Idea deleted",
        description: "The trading idea has been removed.",
      });

      fetchSignals();
    } catch (error: any) {
      toast({
        title: "Error deleting idea",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Publish Trading Ideas</h1>
            <p className="text-muted-foreground">Create and manage trading ideas for users</p>
          </div>
          <Button onClick={() => navigate('/admin-panel')} variant="outline" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Admin Panel
          </Button>
        </div>

        {/* Create Signal Form */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Publish Trading Idea
            </CardTitle>
            <CardDescription>
              Create a new trading idea for all users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency Pair</Label>
                  <Select value={formData.symbol} onValueChange={(value) => setFormData({...formData, symbol: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency pair" />
                    </SelectTrigger>
                    <SelectContent>
                      {forexPairs.map((pair) => (
                        <SelectItem key={pair} value={pair}>
                          {pair}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Direction</Label>
                  <RadioGroup 
                    value={formData.direction} 
                    onValueChange={(value: 'BUY' | 'SELL') => setFormData({...formData, direction: value})}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="BUY" id="buy" />
                      <Label htmlFor="buy" className="text-profit">BUY</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="SELL" id="sell" />
                      <Label htmlFor="sell" className="text-destructive">SELL</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lot-size">Lot Size</Label>
                  <Input
                    id="lot-size"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.lot_size}
                    onChange={(e) => setFormData({...formData, lot_size: parseFloat(e.target.value)})}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stop-loss">Stop Loss (Optional)</Label>
                  <Input
                    id="stop-loss"
                    type="number"
                    step="0.00001"
                    value={formData.stop_loss}
                    onChange={(e) => setFormData({...formData, stop_loss: e.target.value})}
                    placeholder="1.2345"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="take-profit">Take Profit (Optional)</Label>
                  <Input
                    id="take-profit"
                    type="number"
                    step="0.00001"
                    value={formData.take_profit}
                    onChange={(e) => setFormData({...formData, take_profit: e.target.value})}
                    placeholder="1.2345"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Analysis Comment</Label>
                <Textarea
                  id="comment"
                  placeholder="Breaking key resistance level..."
                  value={formData.comment}
                  onChange={(e) => setFormData({...formData, comment: e.target.value})}
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.scheduled}
                  onCheckedChange={(checked) => setFormData({...formData, scheduled: checked})}
                />
                <Label>Schedule Signal</Label>
              </div>

              {formData.scheduled && (
                <div className="space-y-2">
                  <Label htmlFor="scheduled-at">Schedule Date & Time</Label>
                  <Input
                    id="scheduled-at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={(e) => setFormData({...formData, scheduled_at: e.target.value})}
                  />
                </div>
              )}

              <div className="flex items-center space-x-2 p-4 bg-accent/50 rounded-lg border border-border">
                <Switch
                  id="auto-execute"
                  checked={formData.auto_execute_for_bots}
                  onCheckedChange={(checked) => setFormData({...formData, auto_execute_for_bots: checked})}
                />
                <div className="flex-1">
                  <Label htmlFor="auto-execute" className="font-semibold">Auto-Execute for AI Trading Bots</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    When enabled, this signal will automatically execute on all accounts with active AI bots
                  </p>
                </div>
              </div>

              <Button 
                type="submit" 
                className="bg-gradient-primary flex items-center gap-2"
                disabled={isCreating || !formData.symbol}
              >
                <Send className="w-4 h-4" />
                {isCreating ? "Publishing..." : "Publish Idea"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Signals */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle>Recently Published Ideas</CardTitle>
            <CardDescription>
              Manage and edit your published trading ideas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Lot Size</TableHead>
                  <TableHead>SL/TP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="font-medium">{signal.symbol}</TableCell>
                    <TableCell>
                      <Badge className={signal.direction === 'BUY' ? 'bg-profit text-white' : 'bg-destructive text-white'}>
                        {signal.direction}
                      </Badge>
                    </TableCell>
                    <TableCell>{signal.lot_size}</TableCell>
                    <TableCell>
                      {signal.stop_loss && signal.take_profit ? (
                        <span className="text-sm">
                          SL: {signal.stop_loss} / TP: {signal.take_profit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not set</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{signal.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(signal.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDelete(signal.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Admin;