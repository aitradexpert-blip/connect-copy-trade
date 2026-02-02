import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUp, ArrowDown, Loader2, TrendingUp, Clock, DollarSign, AlertCircle, Layers, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getSharedDerivWS, getDerivSymbol } from '@/services/derivWebSocket';
import { authorizeDerivAccount } from '@/services/derivBroker';
import { subscribeProposal, buyContract, ProposalParams } from '@/services/derivTrading';
import { LotSizeInput } from '@/components/ui/lot-size-input';
import { useIsMobile } from '@/hooks/use-mobile';

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
  deriv_token: string | null;
  deriv_currency: string | null;
  balance: number;
  is_virtual: boolean;
  provider?: string;
  connection_type?: string;
  metaapi_account_id?: string | null;
  broker_name?: string | null;
  platform?: string | null;
}

// Helper to detect synthetic symbols
const isSyntheticSymbol = (symbol: string): boolean => {
  const syntheticPatterns = ['Volatility', 'Boom', 'Crash', 'Step', 'Jump', 'Range Break', 'R_', '1HZ', 'BOOM', 'CRASH'];
  return syntheticPatterns.some(p => symbol.includes(p) || symbol.startsWith(p));
};

export function DerivQuickTrade({ open, onOpenChange, symbol, direction: initialDirection }: DerivQuickTradeProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const unsubscribeRef = useRef<(() => Promise<void>) | null>(null);
  
  const [accounts, setAccounts] = useState<DerivAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  
  const [direction, setDirection] = useState<'CALL' | 'PUT'>(initialDirection === 'SELL' ? 'PUT' : 'CALL');
  const [stake, setStake] = useState('10');
  const [lotSize, setLotSize] = useState(0.01); // For MetaAPI accounts
  const [duration, setDuration] = useState('5');
  const [durationUnit, setDurationUnit] = useState<'t' | 'm' | 'h'>('m');
  
  const [proposal, setProposal] = useState<{
    id: string;
    payout: number;
    askPrice: number;
    spot: number;
  } | null>(null);
  const [proposalError, setProposalError] = useState<string | null>(null);

  // Load trading accounts (both Deriv and MetaAPI)
  useEffect(() => {
    if (!open || !user) return;
    
    const loadAccounts = async () => {
      setLoading(true);
      try {
        // Fetch all connected accounts, not just Deriv
        const { data, error } = await supabase
          .from('trading_accounts')
          .select('id, name, login, deriv_token, deriv_currency, balance, is_virtual, provider, connection_type, metaapi_account_id, broker_name, platform')
          .eq('user_id', user.id)
          .eq('connection_status', 'connected');
          
        if (error) throw error;
        
        // Filter to accounts that can actually trade
        const tradableAccounts = (data || []).filter(acc => {
          // Deriv API accounts (Rise/Fall)
          if (acc.connection_type === 'deriv_api' && acc.deriv_token) return true;
          // MT4/MT5 via MetaAPI
          if (acc.connection_type === 'metaapi' && acc.metaapi_account_id) return true;
          // Legacy Deriv accounts
          if (acc.provider === 'deriv' && acc.deriv_token && !acc.platform?.includes('mt5')) return true;
          return false;
        });
        
        setAccounts(tradableAccounts);
        if (tradableAccounts.length > 0) {
          setSelectedAccount(tradableAccounts[0].id);
        }
      } catch (err) {
        console.error('Error loading trading accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadAccounts();
  }, [open, user]);

  // Subscribe to proposal updates (Deriv API only)
  // For MetaAPI accounts, we show a simple trade form without live quotes
  useEffect(() => {
    if (!open || !selectedAccount) return;
    
    const account = accounts.find(a => a.id === selectedAccount);
    
    // For MetaAPI accounts, don't try to get Deriv proposals
    if (account?.connection_type === 'metaapi' || !account?.deriv_token) {
      // Set a placeholder "proposal" for MetaAPI accounts
      setProposal({
        id: 'metaapi',
        payout: 0,
        askPrice: parseFloat(stake) || 10,
        spot: 0,
      });
      setProposalError(null);
      return;
    }
    
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
        await authorizeDerivAccount(account.deriv_token!, ws);
        
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
    const account = accounts.find(a => a.id === selectedAccount);
    if (!account) {
      toast({ title: 'No account selected', variant: 'destructive' });
      return;
    }
    
    // Validate: MT4/MT5 accounts cannot trade Deriv synthetics
    if (isMetaApiAccount && isSyntheticSymbol(symbol)) {
      toast({
        title: 'Unsupported Instrument',
        description: 'Synthetic indices can only be traded on Deriv accounts, not MT4/MT5.',
        variant: 'destructive'
      });
      return;
    }
    
    setExecuting(true);
    try {
      // Route based on connection_type
      if (account.connection_type === 'metaapi' && account.metaapi_account_id) {
        // Execute via MetaAPI using lot size directly
        const { data, error } = await supabase.functions.invoke('metaapi-execute-trade', {
          body: {
            accountId: account.metaapi_account_id,
            trade: {
              symbol: symbol.replace('/', ''),
              direction: direction === 'CALL' ? 'BUY' : 'SELL',
              volume: lotSize, // Use the lotSize state directly
              comment: `HuMi Quick Trade - ${symbol}`
            }
          }
        });
        
        if (error || data?.error) {
          throw new Error(data?.error || error?.message || 'Trade execution failed');
        }
        
        toast({
          title: 'Trade Executed!',
          description: `${direction === 'CALL' ? 'BUY' : 'SELL'} ${lotSize} lots ${symbol} on ${account.broker_name || 'MT5'}`,
        });
      } else if (account.deriv_token) {
        // Execute via Deriv API (Rise/Fall)
        if (!proposal || proposal.id === 'metaapi') {
          toast({ title: 'No quote available', variant: 'destructive' });
          setExecuting(false);
          return;
        }
        
        const ws = getSharedDerivWS();
        await authorizeDerivAccount(account.deriv_token, ws);
        
        const result = await buyContract(proposal.id, proposal.askPrice, ws);
        
        toast({
          title: 'Trade Executed!',
          description: `Contract #${result.buy.contract_id} purchased for ${result.buy.buy_price} ${account.deriv_currency}`,
        });
      } else {
        throw new Error('No valid trading credentials for this account');
      }
      
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
  const isMetaApiAccount = selectedAccountData?.connection_type === 'metaapi';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Quick Trade - {symbol}
          </DialogTitle>
          <DialogDescription>
            {isMetaApiAccount 
              ? `Execute CFD trades on ${selectedAccountData?.broker_name || 'MT5'}`
              : 'Execute Rise/Fall contracts on Deriv'}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No trading accounts connected</p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => {
                onOpenChange(false);
                window.location.href = '/accounts';
              }}
            >
              Connect Trading Account
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
                  {isMetaApiAccount ? 'Buy' : 'Rise'}
                </TabsTrigger>
                <TabsTrigger value="PUT" className="data-[state=active]:bg-loss data-[state=active]:text-white">
                  <ArrowDown className="w-4 h-4 mr-2" />
                  {isMetaApiAccount ? 'Sell' : 'Fall'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Synthetic Index Warning */}
            {isSyntheticSymbol(symbol) && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Synthetic Index</p>
                    <p className="text-muted-foreground text-xs">
                      24/7 simulated market. High volatility. Not tied to real-world assets.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Stake/Lot Size Input - Changes based on account type */}
            {isMetaApiAccount ? (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Lot Size
                </Label>
                <LotSizeInput
                  value={lotSize}
                  onChange={setLotSize}
                  min={0.01}
                  max={100}
                  step={0.01}
                />
                <p className="text-xs text-muted-foreground">Standard lot = 1.0, Mini = 0.1, Micro = 0.01</p>
              </div>
            ) : (
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
            )}
            
            {/* Duration - Only for Deriv contracts, not MetaAPI CFD */}
            {!isMetaApiAccount && (
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
            )}
            
            {/* Quote Display - Different for MetaAPI vs Deriv */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {isMetaApiAccount ? (
                // MetaAPI account summary
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Symbol:</span>
                    <span className="font-medium">{symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Direction:</span>
                    <span className={`font-medium ${direction === 'CALL' ? 'text-profit' : 'text-loss'}`}>
                      {direction === 'CALL' ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Volume:</span>
                    <span className="font-bold">{lotSize.toFixed(2)} lots</span>
                  </div>
                </>
              ) : proposalError ? (
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
              disabled={(!isMetaApiAccount && !proposal) || executing}
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  {direction === 'CALL' ? <ArrowUp className="w-4 h-4 mr-2" /> : <ArrowDown className="w-4 h-4 mr-2" />}
                  {isMetaApiAccount 
                    ? (direction === 'CALL' ? 'Place Buy Order' : 'Place Sell Order')
                    : (direction === 'CALL' ? 'Buy Rise' : 'Buy Fall')}
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
