import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import TradingViewChart from '@/components/TradingViewChart';
import ChartFallback from '@/components/ChartFallback';
import ChartControls from '@/components/charts/ChartControls';
import { WatchlistDropdown } from '@/components/WatchlistDropdown';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  Loader2, 
  ArrowUp, 
  ArrowDown, 
  Wallet, 
  Activity,
  Clock,
  RefreshCw
} from 'lucide-react';
import { get24hStats, MarketStats } from '@/services/derivMarketData';
import { DerivQuickTrade } from '@/components/deriv/DerivQuickTrade';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSharedDerivWS } from '@/services/derivWebSocket';
import { authorizeDerivAccount, getDerivBalance } from '@/services/derivBroker';

type IntervalType = "1" | "3" | "5" | "15" | "30" | "60" | "120" | "180" | "240" | "D" | "W";
type StyleType = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

interface TradingAccount {
  id: string;
  name: string;
  balance: number;
  provider: string;
  deriv_token: string | null;
  is_virtual: boolean;
}

interface OpenPosition {
  id: string;
  symbol: string;
  direction: string;
  profit_loss: number;
  entry_price: number;
  current_price?: number;
  source: 'deriv' | 'metaapi';
}

interface TradeHistoryItem {
  id: string;
  symbol: string;
  direction: string;
  profit_loss: number | null;
  executed_at: string;
  source: 'deriv' | 'metaapi' | 'local';
}

export default function Charts() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSymbol, setActiveSymbol] = useState(searchParams.get('symbol') || 'EUR/USD');
  const [stats, setStats] = useState<MarketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [chartError, setChartError] = useState(false);
  const [chartKey, setChartKey] = useState(0);
  const [widgetReady, setWidgetReady] = useState(false);
  const [interval, setChartInterval] = useState<IntervalType>("60");
  const [tradeDirection, setTradeDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [showQuickTrade, setShowQuickTrade] = useState(false);
  const [chartStyle, setChartStyle] = useState<StyleType>("1");
  
  // Trading data state
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const handleChartRetry = useCallback(() => {
    setChartError(false);
    setWidgetReady(false);
    setChartKey(prev => prev + 1);
  }, []);

  // Chart fallback timeout - if TradingView doesn't load within 8 seconds, show fallback
  useEffect(() => {
    if (chartError) return;
    
    const timeout = setTimeout(() => {
      if (!widgetReady) {
        console.log('[Charts] TradingView timeout, switching to fallback');
        setChartError(true);
      }
    }, 8000);
    
    return () => clearTimeout(timeout);
  }, [chartKey, widgetReady, chartError]);

  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      setActiveSymbol(symbolParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const data = await get24hStats(activeSymbol);
        setStats(data);
      } catch (error) {
        console.error('Error fetching 24h stats:', error);
        setStats(null);
      } finally {
        setLoadingStats(false);
      }
    };
    
    fetchStats();
  }, [activeSymbol]);

  // Load accounts and trading data
  useEffect(() => {
    if (user) {
      loadAccounts();
    }
  }, [user]);

  // Load trading data when account changes
  useEffect(() => {
    if (selectedAccountId) {
      loadTradingData();
    }
  }, [selectedAccountId]);

  const loadAccounts = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('id, name, balance, provider, deriv_token, is_virtual')
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setAccounts(data || []);
      if (data && data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading accounts:', err);
    }
  };

  const loadTradingData = async () => {
    if (!selectedAccountId || !user) return;
    
    setLoadingData(true);
    const account = accounts.find(a => a.id === selectedAccountId);
    if (!account) {
      setLoadingData(false);
      return;
    }
    
    try {
      const positions: OpenPosition[] = [];
      const history: TradeHistoryItem[] = [];
      
      if (account.provider === 'deriv' && account.deriv_token) {
        // Fetch Deriv positions and history
        const ws = getSharedDerivWS();
        await ws.connect();
        await authorizeDerivAccount(account.deriv_token, ws);
        
        // Get open positions (portfolio)
        try {
          const portfolioResponse = await ws.send({ portfolio: 1 });
          if (portfolioResponse.portfolio?.contracts) {
            portfolioResponse.portfolio.contracts.forEach((contract: any) => {
              positions.push({
                id: `deriv-${contract.contract_id}`,
                symbol: contract.symbol || 'Options',
                direction: contract.contract_type?.includes('CALL') ? 'BUY' : 'SELL',
                profit_loss: contract.profit || 0,
                entry_price: contract.buy_price || 0,
                current_price: contract.current_spot,
                source: 'deriv'
              });
            });
          }
        } catch (err) {
          console.warn('Error fetching Deriv portfolio:', err);
        }
        
        // Get trade history (profit_table)
        try {
          const profitResponse = await ws.send({
            profit_table: 1,
            limit: 10,
            description: 1,
            sort: 'DESC'
          });
          
          if (profitResponse.profit_table?.transactions) {
            profitResponse.profit_table.transactions.forEach((tx: any) => {
              history.push({
                id: `deriv-${tx.transaction_id}`,
                symbol: tx.shortcode?.split('_')[0] || 'Options',
                direction: 'BUY',
                profit_loss: tx.sell_price - tx.buy_price,
                executed_at: new Date(tx.purchase_time * 1000).toISOString(),
                source: 'deriv'
              });
            });
          }
        } catch (err) {
          console.warn('Error fetching Deriv history:', err);
        }
        
        // Update balance
        try {
          const balanceResponse = await getDerivBalance(ws);
          const newBalance = Number(balanceResponse.balance?.balance || 0);
          
          setAccounts(prev => prev.map(a => 
            a.id === selectedAccountId ? { ...a, balance: newBalance } : a
          ));
        } catch (err) {
          console.warn('Error fetching balance:', err);
        }
      } else if (account.provider === 'metaapi') {
        // Fetch MetaAPI positions
        const metaapiAccountId = await getMetaApiAccountId(account.id);
        if (metaapiAccountId) {
          try {
            const { data: positionsData } = await supabase.functions.invoke(
              'metaapi-get-positions',
              { body: { accountId: metaapiAccountId } }
            );
            
            if (positionsData?.positions) {
              positionsData.positions.forEach((pos: any) => {
                positions.push({
                  id: `metaapi-${pos.id}`,
                  symbol: pos.symbol,
                  direction: pos.type?.toUpperCase() || 'BUY',
                  profit_loss: pos.profit || 0,
                  entry_price: pos.openPrice || 0,
                  current_price: pos.currentPrice,
                  source: 'metaapi'
                });
              });
            }
          } catch (err) {
            console.warn('Error fetching MetaAPI positions:', err);
          }
        }
      }
      
      // Also get local trade history
      const { data: localTrades } = await supabase
        .from('trade_history')
        .select('id, symbol, direction, profit_loss, executed_at')
        .eq('trading_account_id', selectedAccountId)
        .order('executed_at', { ascending: false })
        .limit(10);
      
      if (localTrades) {
        localTrades.forEach(t => {
          history.push({
            ...t,
            source: 'local'
          });
        });
      }
      
      setOpenPositions(positions);
      setTradeHistory(history.sort((a, b) => 
        new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
      ).slice(0, 10));
    } catch (err) {
      console.error('Error loading trading data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const getMetaApiAccountId = async (accountId: string): Promise<string | null> => {
    const { data } = await supabase
      .from('trading_accounts')
      .select('metaapi_account_id')
      .eq('id', accountId)
      .single();
    
    return data?.metaapi_account_id || null;
  };

  const handleSymbolSelect = (symbol: string) => {
    setActiveSymbol(symbol);
    setSearchParams({ symbol });
  };

  const handleTradeClick = (action: 'BUY' | 'SELL') => {
    setTradeDirection(action);
    setShowQuickTrade(true);
  };

  const handleIntervalChange = (newInterval: string) => {
    setChartInterval(newInterval as IntervalType);
    setChartKey(prev => prev + 1);
  };

  const handleChartStyleChange = (newStyle: string) => {
    setChartStyle(newStyle as StyleType);
    setChartKey(prev => prev + 1);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(5);
    if (price < 100) return price.toFixed(4);
    return price.toFixed(2);
  };

  const formatVolume = (volume: number | null) => {
    if (volume === null) return '-';
    if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
    if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
    return volume.toFixed(0);
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-primary" />
              Market Charts
            </h1>
            <p className="text-muted-foreground mt-1">
              View live market data for 170+ trading instruments
            </p>
          </div>
          <div className="flex items-center gap-3">
            <WatchlistDropdown 
              activeSymbol={activeSymbol}
              onSymbolSelect={handleSymbolSelect}
            />
          </div>
        </div>

        {/* Account Selection & Balance */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground mb-2">Trading Account</div>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} {acc.is_virtual && '(Demo)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Balance</div>
                  <div className="text-2xl font-bold text-foreground">
                    ${selectedAccount?.balance?.toFixed(2) || '0.00'}
                  </div>
                </div>
                <Wallet className="w-8 h-8 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-muted-foreground">Open Positions</div>
                  <div className="text-2xl font-bold text-foreground">
                    {openPositions.length}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={loadTradingData}
                  disabled={loadingData}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Chart */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl">{activeSymbol}</CardTitle>
                <CardDescription>
                  Real-time market data powered by TradingView
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="default"
                  className="bg-profit hover:bg-profit/90"
                  onClick={() => handleTradeClick('BUY')}
                >
                  <ArrowUp className="w-4 h-4 mr-1" />
                  Buy
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="bg-loss hover:bg-loss/90"
                  onClick={() => handleTradeClick('SELL')}
                >
                  <ArrowDown className="w-4 h-4 mr-1" />
                  Sell
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ChartControls
              interval={interval}
              chartStyle={chartStyle}
              onIntervalChange={handleIntervalChange}
              onChartStyleChange={handleChartStyleChange}
            />
            {chartError ? (
              <ChartFallback symbol={activeSymbol} onRetry={handleChartRetry} />
            ) : (
              <TradingViewChart 
                key={chartKey}
                symbol={activeSymbol}
                height={500}
                interval={interval}
                style={chartStyle}
                onReady={() => setWidgetReady(true)}
              />
            )}
            
            {/* Quick Trade Modal */}
            <DerivQuickTrade
              open={showQuickTrade}
              onOpenChange={setShowQuickTrade}
              symbol={activeSymbol}
              direction={tradeDirection}
            />
          </CardContent>
        </Card>

        {/* 24h Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h High</div>
              <div className="text-2xl font-bold text-profit">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatPrice(stats?.high24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Low</div>
              <div className="text-2xl font-bold text-loss">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatPrice(stats?.low24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">24h Volume</div>
              <div className="text-2xl font-bold text-foreground">
                {loadingStats ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  formatVolume(stats?.volume24h ?? null)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Open Positions */}
        {openPositions.length > 0 && (
          <Card className="bg-gradient-card border-border shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Open Positions
              </CardTitle>
              <CardDescription>Currently running trades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {openPositions.map(pos => (
                  <div 
                    key={pos.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${pos.direction === 'BUY' ? 'bg-profit' : 'bg-loss'}`} />
                      <div>
                        <p className="font-medium text-sm">{pos.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          Entry: {formatPrice(pos.entry_price)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={pos.direction === 'BUY' ? 'default' : 'destructive'}>
                        {pos.direction}
                      </Badge>
                      <span className={`font-medium ${pos.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                        {pos.profit_loss >= 0 ? '+' : ''}{pos.profit_loss.toFixed(2)}
                      </span>
                      <Badge variant="outline" className="text-xs">{pos.source}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Trade History */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Trades
            </CardTitle>
            <CardDescription>Your trading history for this account</CardDescription>
          </CardHeader>
          <CardContent>
            {tradeHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No recent trades</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tradeHistory.map(trade => (
                  <div 
                    key={trade.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${trade.direction === 'BUY' ? 'bg-profit' : 'bg-loss'}`} />
                      <div>
                        <p className="font-medium text-sm">{trade.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(trade.executed_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={trade.direction === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                        {trade.direction}
                      </Badge>
                      {trade.profit_loss !== null && (
                        <span className={`text-sm font-medium ${trade.profit_loss >= 0 ? 'text-profit' : 'text-loss'}`}>
                          {trade.profit_loss >= 0 ? '+' : ''}{trade.profit_loss.toFixed(2)}
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">{trade.source}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}