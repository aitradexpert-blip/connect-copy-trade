import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUp, ArrowDown, Loader2, TrendingUp, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSharedDerivWS, getDerivSymbol } from '@/services/derivWebSocket';
import { authorizeDerivAccount } from '@/services/derivBroker';
import { subscribeProposal, buyContract, ProposalParams } from '@/services/derivTrading';

interface DerivQuickTradeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symbol: string;
  direction?: 'BUY' | 'SELL';
}

interface DerivAccount {
  id: string;
  name: string;
  login: string;
  deriv_token: string;
  deriv_currency: string;
  balance: number;
  is_virtual: boolean;
}

export function DerivQuickTrade({ open, onOpenChange, symbol, direction: initialDirection }: DerivQuickTradeProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  
  const [direction, setDirection] = useState<'CALL' | 'PUT'>(initialDirection === 'SELL' ? 'PUT' : 'CALL');
  const [stake, setStake] = useState('10');
  const [duration, setDuration] = useState('5');
  const [durationUnit, setDurationUnit] = useState<'t' | 'm' | 'h'>('m');
  
  const [proposal, setProposal] = useState<{
    id: string;
    payout: number;
    askPrice: number;
    spot: number;
  } | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Load Deriv accounts
  useEffect(() => {
    if (!open || !user) return;
    
    const loadAccounts = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('trading_accounts')
          .select('id, name, login, deriv_token, deriv_currency, balance, is_virtual')
          .eq('user_id', user.id)
          .eq('provider', 'deriv')
          .not('deriv_token', 'is', null);
          
        if (error) throw error;
        setAccounts(data || []);
        if (data && data.length > 0) {
          setSelectedAccount(data[0].id);
        }
      } catch (err) {
        console.error('Error loading Deriv accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadAccounts();
  }, [open, user]);

  // Subscribe to proposal updates
  useEffect(() => {
    if (!open || !selectedAccount) return;
    
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account?.deriv_token) return;
    
    // Reset states
    setProposal(null);
    setProposalError(null);
    
    let proposalTimeoutId: NodeJS.Timeout | null = null;
    
    const setupProposal = async () => {
      try {
        // Clean up previous subscription
        if (unsubscribeRef.current) {
          await unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
        
        const ws = getSharedDerivWS();
        await ws.connect();
        await authorizeDerivAccount(account.deriv_token, ws);
        
        // Convert symbol to Deriv format (e.g., "EUR/USD" -> "frxEURUSD")
        const derivSymbol = getDerivSymbol(symbol) || symbol;
        
        const params: ProposalParams = {
          symbol: derivSymbol,
          contractType: direction,
          amount: parseFloat(stake) || 10,
          basis: 'stake',
          duration: parseInt(duration) || 5,
          durationUnit,
        };
        
        console.log('[DerivQuickTrade] Subscribing to proposal:', params, 'original symbol:', symbol);
        
        // Set a 10-second timeout for getting the proposal
        proposalTimeoutId = setTimeout(() => {
          if (!proposal && !proposalError) {
            setProposalError('Quote request timed out. Try a different duration, symbol, or check your connection.');
          }
        }, 10000);
        
        // First, try to get a single proposal to check if the parameters are valid
        const testResponse = await ws.send({
          proposal: 1,
          amount: params.amount,
          basis: params.basis,
          contract_type: params.contractType,
          currency: account.deriv_currency || 'USD',
          duration: params.duration,
          duration_unit: params.durationUnit,
          symbol: derivSymbol,
        });
        
        // Clear timeout since we got a response
        if (proposalTimeoutId) {
          clearTimeout(proposalTimeoutId);
          proposalTimeoutId = null;
        }
        
        if (testResponse.error) {
          console.error('[DerivQuickTrade] Proposal error:', testResponse.error);
          
          // Provide helpful error messages
          let errorMsg = testResponse.error.message || 'Trading not available for this configuration';
          if (errorMsg.includes('duration')) {
            errorMsg = 'This duration is not available. Try 15 minutes or longer for forex pairs.';
          } else if (errorMsg.includes('symbol')) {
            errorMsg = `Symbol "${symbol}" is not available for trading. Check market hours or try another symbol.`;
          }
          
          setProposalError(errorMsg);
          return;
        }
        
        // If test passed, subscribe for real-time updates
        const { unsubscribe } = subscribeProposal(params, (proposalData) => {
          if (proposalData) {
            setProposalError(null);
            setProposal({
              id: proposalData.id,
              payout: proposalData.payout,
              askPrice: proposalData.ask_price,
              spot: proposalData.spot,
            });
          }
        }, ws);
        
        unsubscribeRef.current = unsubscribe;
      } catch (err: any) {
        console.error('[DerivQuickTrade] Proposal subscription error:', err);
        if (proposalTimeoutId) {
          clearTimeout(proposalTimeoutId);
        }
        setProposalError(err.message || 'Failed to get quote. Try different duration or symbol.');
      }
    };
    
    // Add small delay to prevent rapid re-subscriptions
    const timeoutId = setTimeout(setupProposal, 300);
    
    return () => {
      clearTimeout(timeoutId);
      if (proposalTimeoutId) {
        clearTimeout(proposalTimeoutId);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [open, selectedAccount, direction, stake, duration, durationUnit, symbol, accounts]);

  const handleExecute = async () => {
    if (!proposal) {
      toast({ title: 'No quote available', variant: 'destructive' });
      return;
    }
    
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account?.deriv_token) {
      toast({ title: 'No account selected', variant: 'destructive' });
      return;
    }
    
    setExecuting(true);
    try {
      const ws = getSharedDerivWS();
      await authorizeDerivAccount(account.deriv_token, ws);
      
      const result = await buyContract(proposal.id, proposal.askPrice, ws);
      
      toast({
        title: 'Trade Executed!',
        description: `Contract #${result.buy.contract_id} purchased for ${result.buy.buy_price} ${account.deriv_currency}`,
      });
      
      onOpenChange(false);
    } catch (err: any) {
      console.error('Trade execution error:', err);
      toast({
        title: 'Trade Failed',
        description: err.message || 'Failed to execute trade',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  const selectedAccountData = accounts.find(a => a.id === selectedAccount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Quick Trade - {symbol}
          </DialogTitle>
          <DialogDescription>
            Execute Rise/Fall contracts on Deriv
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No Deriv accounts connected</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                onOpenChange(false);
                window.location.href = '/accounts';
              }}
            >
              Connect Deriv Account
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Account Selector */}
            <div className="space-y-2">
              <Label>Trading Account</Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.login} ({account.balance?.toFixed(2)} {account.deriv_currency})
                      {account.is_virtual && ' - Demo'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Direction Tabs */}
            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'CALL' | 'PUT')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="CALL" className="data-[state=active]:bg-profit data-[state=active]:text-white">
                  <ArrowUp className="w-4 h-4 mr-2" />
                  Rise
                </TabsTrigger>
                <TabsTrigger value="PUT" className="data-[state=active]:bg-loss data-[state=active]:text-white">
                  <ArrowDown className="w-4 h-4 mr-2" />
                  Fall
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Stake Input */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Stake ({selectedAccountData?.deriv_currency || 'USD'})
              </Label>
              <Input
                type="number"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                min="1"
                step="1"
              />
            </div>
            
            {/* Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Duration
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="1"
                  className="flex-1"
                />
                <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as 't' | 'm' | 'h')}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t">Ticks</SelectItem>
                    <SelectItem value="m">Minutes</SelectItem>
                    <SelectItem value="h">Hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Quote Display */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {proposalError ? (
                <div className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {proposalError}
                </div>
              ) : proposal ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Price:</span>
                    <span className="font-medium">{proposal.spot.toFixed(5)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost:</span>
                    <span className="font-medium">{proposal.askPrice.toFixed(2)} {selectedAccountData?.deriv_currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Potential Payout:</span>
                    <span className="font-bold text-profit">{proposal.payout.toFixed(2)} {selectedAccountData?.deriv_currency}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">Getting quote...</span>
                </div>
              )}
            </div>
            
            {/* Execute Button */}
            <Button
              className={`w-full ${direction === 'CALL' ? 'bg-profit hover:bg-profit/90' : 'bg-loss hover:bg-loss/90'}`}
              onClick={handleExecute}
              disabled={!proposal || executing}
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  {direction === 'CALL' ? <ArrowUp className="w-4 h-4 mr-2" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                  {direction === 'CALL' ? 'Buy Rise' : 'Buy Fall'}
                </>
              )}
            </Button>
            
            {selectedAccountData?.is_virtual && (
              <Badge variant="outline" className="w-full justify-center py-1">
                Demo Account - No Real Money
              </Badge>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
