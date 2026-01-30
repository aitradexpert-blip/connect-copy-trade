import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deriv WebSocket for market data
const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=90127';
const METAAPI_URL = 'https://mt-client-api-v1.london.agiliumtrade.ai';

// Deriv symbol mapping
const DERIV_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'frxEURUSD', 'GBP/USD': 'frxGBPUSD', 'USD/JPY': 'frxUSDJPY',
  'USD/CHF': 'frxUSDCHF', 'AUD/USD': 'frxAUDUSD', 'USD/CAD': 'frxUSDCAD',
  'NZD/USD': 'frxNZDUSD', 'EUR/GBP': 'frxEURGBP', 'EUR/JPY': 'frxEURJPY',
  'GBP/JPY': 'frxGBPJPY', 'XAU/USD': 'frxXAUUSD', 'XAG/USD': 'frxXAGUSD',
  'BTC/USD': 'cryBTCUSD', 'ETH/USD': 'cryETHUSD',
  'Volatility 75': '1HZ75V', 'Volatility 100': '1HZ100V',
  'Boom 300': 'BOOM300N', 'Crash 300': 'CRASH300N',
};

// Pair normalization function
function normalizePairName(text: string): string {
  const pairMap: Record<string, string> = {
    'euro dollar': 'EUR/USD', 'eurusd': 'EUR/USD', 'eur usd': 'EUR/USD',
    'cable': 'GBP/USD', 'pound dollar': 'GBP/USD', 'gbpusd': 'GBP/USD', 'gbp usd': 'GBP/USD',
    'dollar yen': 'USD/JPY', 'usdjpy': 'USD/JPY', 'usd jpy': 'USD/JPY', 'uj': 'USD/JPY',
    'aussie': 'AUD/USD', 'audusd': 'AUD/USD', 'aud usd': 'AUD/USD',
    'loonie': 'USD/CAD', 'usdcad': 'USD/CAD', 'usd cad': 'USD/CAD',
    'swissy': 'USD/CHF', 'usdchf': 'USD/CHF', 'usd chf': 'USD/CHF',
    'kiwi': 'NZD/USD', 'nzdusd': 'NZD/USD', 'nzd usd': 'NZD/USD',
    'gold': 'XAU/USD', 'xauusd': 'XAU/USD', 'xau usd': 'XAU/USD',
    'silver': 'XAG/USD', 'xagusd': 'XAG/USD', 'xag usd': 'XAG/USD',
    'bitcoin': 'BTC/USD', 'btc': 'BTC/USD',
    'ethereum': 'ETH/USD', 'eth': 'ETH/USD',
    'vol 75': 'Volatility 75', 'v75': 'Volatility 75',
    'vol 100': 'Volatility 100', 'v100': 'Volatility 100',
    'nasdaq': 'NAS100', 'nas': 'NAS100',
    'dow': 'US30', 'dow jones': 'US30',
  };
  
  let normalized = text.toLowerCase();
  for (const [variation, standardName] of Object.entries(pairMap)) {
    normalized = normalized.replace(new RegExp(variation, 'gi'), standardName);
  }
  return normalized;
}

// Fetch live price from Deriv WebSocket
async function fetchDerivPrice(symbol: string): Promise<{ price: number; high24h?: number; low24h?: number } | null> {
  const derivSymbol = DERIV_SYMBOL_MAP[symbol];
  if (!derivSymbol) return null;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve(null);
    }, 5000);

    const ws = new WebSocket(DERIV_WS_URL);
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ ticks: derivSymbol }));
    };
    
    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.tick?.quote) {
          clearTimeout(timeout);
          ws.close();
          resolve({ price: data.tick.quote });
        }
        if (data.error) {
          clearTimeout(timeout);
          ws.close();
          resolve(null);
        }
      } catch {
        clearTimeout(timeout);
        ws.close();
        resolve(null);
      }
    };
    
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };
  });
}

// Fetch MetaAPI account data
async function fetchMetaApiAccountData(accountId: string, metaapiToken: string) {
  try {
    const [infoResp, positionsResp] = await Promise.all([
      fetch(`${METAAPI_URL}/users/current/accounts/${accountId}/account-information`, {
        headers: { 'auth-token': metaapiToken, 'Accept': 'application/json' }
      }),
      fetch(`${METAAPI_URL}/users/current/accounts/${accountId}/positions`, {
        headers: { 'auth-token': metaapiToken, 'Accept': 'application/json' }
      })
    ]);
    
    const info = infoResp.ok ? await infoResp.json() : null;
    const positions = positionsResp.ok ? await positionsResp.json() : [];
    
    return { 
      balance: info?.balance || 0, 
      equity: info?.equity || 0,
      positions: Array.isArray(positions) ? positions : []
    };
  } catch (e) {
    console.error('MetaAPI fetch error:', e);
    return { balance: 0, equity: 0, positions: [] };
  }
}

// Fetch Deriv account data
async function fetchDerivAccountData(token: string): Promise<{ balance: number; positions: any[] }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      ws.close();
      resolve({ balance: 0, positions: [] });
    }, 8000);

    const ws = new WebSocket(DERIV_WS_URL);
    let balance = 0;
    let positions: any[] = [];
    let gotBalance = false;
    let gotPortfolio = false;
    
    const checkComplete = () => {
      if (gotBalance && gotPortfolio) {
        clearTimeout(timeout);
        ws.close();
        resolve({ balance, positions });
      }
    };
    
    ws.onopen = () => {
      ws.send(JSON.stringify({ authorize: token }));
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.authorize) {
          balance = data.authorize.balance || 0;
          gotBalance = true;
          ws.send(JSON.stringify({ portfolio: 1 }));
        }
        
        if (data.portfolio) {
          positions = data.portfolio.contracts || [];
          gotPortfolio = true;
        }
        
        if (data.error) {
          console.error('Deriv error:', data.error);
        }
        
        checkComplete();
      } catch (e) {
        console.error('Deriv parse error:', e);
      }
    };
    
    ws.onerror = () => {
      clearTimeout(timeout);
      resolve({ balance: 0, positions: [] });
    };
  });
}

// Execute trade via MetaAPI
async function executeMetaApiTrade(accountId: string, symbol: string, direction: string, volume: number) {
  const metaapiToken = Deno.env.get('METAAPI_TOKEN');
  if (!metaapiToken) throw new Error('METAAPI_TOKEN not configured');
  
  const actionType = direction === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL';
  
  const resp = await fetch(`${METAAPI_URL}/users/current/accounts/${accountId}/trade`, {
    method: 'POST',
    headers: {
      'auth-token': metaapiToken,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      actionType,
      symbol: symbol.replace('/', ''),
      volume,
      comment: 'Khumo Voice Trade'
    })
  });
  
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Trade failed: ${text}`);
  }
  
  return await resp.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, user_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const metaapiToken = Deno.env.get('METAAPI_TOKEN');

    // Clean up expired pending trades
    try {
      await supabase.rpc('delete_expired_pending_trades');
    } catch (error) {
      console.error('Cleanup error (non-critical):', error);
    }

    const normalizedTranscript = normalizePairName(transcript);
    const lowerTranscript = normalizedTranscript.toLowerCase();

    // Fetch all user trading accounts with full details
    const { data: allAccounts } = await supabase
      .from('trading_accounts')
      .select('id, name, login, provider, connection_type, broker_name, balance, equity, deriv_token, deriv_currency, is_virtual, metaapi_account_id, connection_status, platform')
      .eq('user_id', user_id)
      .eq('connection_status', 'connected');

    const tradingAccounts = allAccounts || [];
    
    // Check for pending trade confirmation
    const { data: pendingTrade } = await supabase
      .from('pending_trades')
      .select('*')
      .eq('user_id', user_id)
      .eq('awaiting_confirmation', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const isConfirmation = /\b(yes|yeah|yep|confirm|correct|proceed|go ahead|do it|execute)\b/i.test(transcript);
    const isCancellation = /\b(no|nope|cancel|stop|nevermind|never mind)\b/i.test(transcript);

    // Handle pending trade confirmation/cancellation
    if (pendingTrade && (isConfirmation || isCancellation)) {
      if (isCancellation) {
        await supabase.from('pending_trades').delete().eq('id', pendingTrade.id);
        return new Response(JSON.stringify({
          text: "Trade cancelled. What else can I help you with?",
          action: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (isConfirmation) {
        // Find the target account
        const targetAccount = tradingAccounts.find(a => 
          a.id === pendingTrade.trading_account_id || 
          a.name?.toLowerCase().includes('default') ||
          tradingAccounts[0]?.id === a.id
        ) || tradingAccounts[0];
        
        if (!targetAccount) {
          await supabase.from('pending_trades').delete().eq('id', pendingTrade.id);
          return new Response(JSON.stringify({
            text: "I couldn't find a connected trading account. Please connect an account first.",
            action: { type: 'navigate', path: '/trading-accounts' }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        await supabase.from('pending_trades').delete().eq('id', pendingTrade.id);
        
        // Execute based on connection_type
        try {
          if (targetAccount.connection_type === 'metaapi' && targetAccount.metaapi_account_id) {
            const result = await executeMetaApiTrade(
              targetAccount.metaapi_account_id,
              pendingTrade.symbol,
              pendingTrade.direction,
              pendingTrade.lot_size || 0.01
            );
            
            return new Response(JSON.stringify({
              text: `Trade executed! ${pendingTrade.direction} ${pendingTrade.lot_size || 0.01} lots of ${pendingTrade.symbol} on your ${targetAccount.broker_name || 'MT5'} account.`,
              action: { type: 'trade_executed', result },
              data: { trade: result }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } else {
            // For Deriv accounts, prepare for UI execution
            return new Response(JSON.stringify({
              text: "Opening the trade panel for you. Please review and confirm the trade details.",
              action: { 
                type: 'prepare_execution', 
                signal: {
                  symbol: pendingTrade.symbol,
                  direction: pendingTrade.direction,
                  lot_size: pendingTrade.lot_size || 0.01
                },
                account: targetAccount
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (execError: any) {
          return new Response(JSON.stringify({
            text: `Trade execution failed: ${execError.message}. Please try again or check your account connection.`,
            action: null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // === ACCOUNT QUERIES ===
    
    // List accounts
    if (/\b(list|show|what|which).*(accounts?|connected)/i.test(lowerTranscript)) {
      if (tradingAccounts.length === 0) {
        return new Response(JSON.stringify({
          text: "You don't have any connected trading accounts yet. Would you like to connect one?",
          action: { type: 'navigate', path: '/trading-accounts' },
          links: [{ label: "Connect Account", path: "/trading-accounts" }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Fetch live balances for each account
      const accountSummaries: string[] = [];
      for (const acc of tradingAccounts.slice(0, 5)) {
        let liveBalance = acc.balance || 0;
        
        if (acc.connection_type === 'deriv_api' && acc.deriv_token) {
          const derivData = await fetchDerivAccountData(acc.deriv_token);
          liveBalance = derivData.balance;
        } else if (acc.connection_type === 'metaapi' && acc.metaapi_account_id && metaapiToken) {
          const metaData = await fetchMetaApiAccountData(acc.metaapi_account_id, metaapiToken);
          liveBalance = metaData.balance;
        }
        
        const typeLabel = acc.is_virtual ? 'Demo' : 'Real';
        const brokerName = acc.broker_name || acc.provider || 'Unknown';
        accountSummaries.push(`${acc.name || acc.login} (${brokerName} ${typeLabel}): $${liveBalance.toFixed(2)}`);
      }
      
      return new Response(JSON.stringify({
        text: `You have ${tradingAccounts.length} connected account${tradingAccounts.length > 1 ? 's' : ''}. ${accountSummaries.join('. ')}. Which one would you like to use?`,
        action: null,
        data: { accounts: tradingAccounts }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Balance query
    if (/\b(balance|equity|how much|money)\b/i.test(lowerTranscript)) {
      if (tradingAccounts.length === 0) {
        return new Response(JSON.stringify({
          text: "No trading accounts connected. Connect an account to check your balance.",
          action: { type: 'navigate', path: '/trading-accounts' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Find specific account mentioned or use first
      let targetAccount = tradingAccounts[0];
      for (const acc of tradingAccounts) {
        if (acc.name && lowerTranscript.includes(acc.name.toLowerCase())) {
          targetAccount = acc;
          break;
        }
        if (acc.broker_name && lowerTranscript.includes(acc.broker_name.toLowerCase())) {
          targetAccount = acc;
          break;
        }
      }
      
      let liveBalance = targetAccount.balance || 0;
      let liveEquity = targetAccount.equity || 0;
      
      if (targetAccount.connection_type === 'deriv_api' && targetAccount.deriv_token) {
        const derivData = await fetchDerivAccountData(targetAccount.deriv_token);
        liveBalance = derivData.balance;
      } else if (targetAccount.connection_type === 'metaapi' && targetAccount.metaapi_account_id && metaapiToken) {
        const metaData = await fetchMetaApiAccountData(targetAccount.metaapi_account_id, metaapiToken);
        liveBalance = metaData.balance;
        liveEquity = metaData.equity;
      }
      
      const accountName = targetAccount.name || targetAccount.login;
      const brokerName = targetAccount.broker_name || targetAccount.provider;
      
      return new Response(JSON.stringify({
        text: `Your ${brokerName} account "${accountName}" has a balance of $${liveBalance.toFixed(2)}${liveEquity > 0 ? ` with equity at $${liveEquity.toFixed(2)}` : ''}.`,
        action: null,
        data: { balance: liveBalance, equity: liveEquity, account: targetAccount }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Open positions query
    if (/\b(open|current|active).*(position|trade|order)/i.test(lowerTranscript) || /\b(position|trade)s?\s*(open|running)/i.test(lowerTranscript)) {
      if (tradingAccounts.length === 0) {
        return new Response(JSON.stringify({
          text: "No trading accounts connected. Connect an account to view positions.",
          action: { type: 'navigate', path: '/trading-accounts' }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const allPositions: any[] = [];
      
      for (const acc of tradingAccounts.slice(0, 3)) {
        if (acc.connection_type === 'deriv_api' && acc.deriv_token) {
          const derivData = await fetchDerivAccountData(acc.deriv_token);
          derivData.positions.forEach((p: any) => allPositions.push({ ...p, account: acc.name, broker: 'Deriv' }));
        } else if (acc.connection_type === 'metaapi' && acc.metaapi_account_id && metaapiToken) {
          const metaData = await fetchMetaApiAccountData(acc.metaapi_account_id, metaapiToken);
          metaData.positions.forEach((p: any) => allPositions.push({ ...p, account: acc.name, broker: acc.broker_name }));
        }
      }
      
      if (allPositions.length === 0) {
        return new Response(JSON.stringify({
          text: "You have no open positions across your connected accounts.",
          action: null,
          data: { positions: [] }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const positionSummary = allPositions.slice(0, 5).map(p => 
        `${p.type || p.contract_type || 'TRADE'} ${p.volume || 1} ${p.symbol || p.display_name} on ${p.broker}`
      ).join(', ');
      
      return new Response(JSON.stringify({
        text: `You have ${allPositions.length} open position${allPositions.length > 1 ? 's' : ''}: ${positionSummary}.`,
        action: null,
        data: { positions: allPositions }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Trading history query
    if (/\b(history|past|previous|closed|recent).*(trade|position|deal)/i.test(lowerTranscript) || /\bwhat.*(trade|traded)\b/i.test(lowerTranscript)) {
      // Fetch from local trade_history first
      const { data: localHistory } = await supabase
        .from('trade_history')
        .select('*')
        .eq('user_id', user_id)
        .order('executed_at', { ascending: false })
        .limit(10);
      
      if (localHistory && localHistory.length > 0) {
        const histSummary = localHistory.slice(0, 5).map(h => 
          `${h.direction} ${h.volume} ${h.symbol} - ${h.profit_loss !== null ? (h.profit_loss >= 0 ? '+' : '') + '$' + h.profit_loss?.toFixed(2) : 'open'}`
        ).join(', ');
        
        return new Response(JSON.stringify({
          text: `Your recent trades: ${histSummary}. Check the charts page for the full history.`,
          action: null,
          data: { history: localHistory },
          links: [{ label: "View Full History", path: "/charts" }]
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        text: "I couldn't find any recent trading history. Execute some trades first!",
        action: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // === TRADE EXECUTION INTENTS ===
    
    const tradeKeywords = ['execute', 'trade', 'buy', 'sell', 'open position', 'place order', 'enter', 'go long', 'go short'];
    const hasTradeIntent = tradeKeywords.some(keyword => lowerTranscript.includes(keyword));

    if (hasTradeIntent) {
      const direction = /\b(buy|long|bull|rise)\b/i.test(lowerTranscript) ? 'BUY' : 'SELL';
      
      const allSymbols = [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD',
        'XAU/USD', 'XAG/USD', 'NAS100', 'US30', 'SPX500', 'BTC/USD', 'ETH/USD'
      ];
      
      let mentionedSymbol = null;
      for (const symbol of allSymbols) {
        const symbolNormalized = symbol.replace('/', '').toLowerCase();
        if (lowerTranscript.includes(symbolNormalized) || lowerTranscript.includes(symbol.toLowerCase())) {
          mentionedSymbol = symbol;
          break;
        }
      }
      
      // Parse lot size
      let lotSize = 0.01;
      const lotMatch = lowerTranscript.match(/(\d+\.?\d*)\s*(lot|lots)/i);
      if (lotMatch) {
        lotSize = parseFloat(lotMatch[1]) || 0.01;
      }
      
      // Find account mentioned
      let targetAccountId = tradingAccounts[0]?.id;
      for (const acc of tradingAccounts) {
        if (acc.name && lowerTranscript.includes(acc.name.toLowerCase())) {
          targetAccountId = acc.id;
          break;
        }
        if (acc.broker_name && lowerTranscript.includes(acc.broker_name.toLowerCase())) {
          targetAccountId = acc.id;
          break;
        }
        if (lowerTranscript.includes('mt5') || lowerTranscript.includes('mt4') || lowerTranscript.includes('metatrader')) {
          if (acc.connection_type === 'metaapi') {
            targetAccountId = acc.id;
            break;
          }
        }
        if (lowerTranscript.includes('deriv')) {
          if (acc.connection_type === 'deriv_api') {
            targetAccountId = acc.id;
            break;
          }
        }
      }

      if (mentionedSymbol) {
        const targetAccount = tradingAccounts.find(a => a.id === targetAccountId);
        const accountName = targetAccount?.broker_name || targetAccount?.name || 'your account';
        
        // Store pending trade
        const { error } = await supabase
          .from('pending_trades')
          .insert({
            user_id: user_id,
            symbol: mentionedSymbol,
            direction: direction,
            lot_size: lotSize,
            trading_account_id: targetAccountId,
            awaiting_confirmation: true
          });

        if (!error) {
          return new Response(JSON.stringify({
            text: `Just to confirm: ${direction} ${lotSize} lots of ${mentionedSymbol} on ${accountName}? Say "yes" to execute or "cancel" to abort.`,
            action: {
              type: 'request_confirmation',
              trade: {
                symbol: mentionedSymbol,
                direction: direction,
                lot_size: lotSize,
                account: targetAccount
              }
            }
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // === NAVIGATION & GENERAL QUERIES ===
    
    let action: any = null;
    let links: any[] = [];
    
    if (/\b(ideas?|signals?|today'?s?)\b/i.test(lowerTranscript)) {
      links = [{ label: "View Today's Ideas", path: "/ideas" }];
      action = { type: 'navigate', path: '/ideas' };
    } else if (/\b(settings?|preferences?)\b/i.test(lowerTranscript)) {
      links = [{ label: "Open Settings", path: "/settings" }];
      action = { type: 'navigate', path: '/settings' };
    } else if (/\b(chart|charts?|market)\b/i.test(lowerTranscript)) {
      links = [{ label: "View Charts", path: "/charts" }];
      action = { type: 'navigate', path: '/charts' };
    } else if (/\b(copy|copy\s*trading?)\b/i.test(lowerTranscript)) {
      links = [{ label: "Copy Trading", path: "/copy-trading" }];
      action = { type: 'navigate', path: '/copy-trading' };
    }

    // Price query
    const priceKeywords = ['price', 'trading at', 'current', 'what is', "what's", 'how much', 'quote', 'level'];
    const isPriceQuery = priceKeywords.some(kw => lowerTranscript.includes(kw));
    
    let liveMarketData: any = null;
    if (isPriceQuery) {
      for (const symbol of Object.keys(DERIV_SYMBOL_MAP)) {
        const symbolNorm = symbol.replace('/', '').toLowerCase();
        if (lowerTranscript.includes(symbolNorm) || lowerTranscript.includes(symbol.toLowerCase())) {
          liveMarketData = await fetchDerivPrice(symbol);
          if (liveMarketData) {
            liveMarketData.symbol = symbol;
          }
          break;
        }
      }
    }

    // Fetch signals for context
    const { data: signals } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    // Build system prompt
    const totalBalance = tradingAccounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);
    
    const systemPrompt = `[SYSTEM_IDENTITY]
You are KHUMO, The Market's Memory - a senior trading assistant for the HuMi platform.

[VOICE STYLE]
- Keep responses under 3 sentences for voice clarity
- Be confident and helpful
- NO emojis (text-to-speech friendly)

[USER CONTEXT]
- Connected Accounts: ${tradingAccounts.length} (${tradingAccounts.map(a => a.broker_name || a.provider).join(', ') || 'None'})
- Total Balance: $${totalBalance.toFixed(2)}
- Active Signals: ${signals?.length || 0}
${liveMarketData ? `\n[LIVE PRICE] ${liveMarketData.symbol}: ${liveMarketData.price}` : ''}

[CAPABILITIES]
You can help with:
- Checking account balances and positions
- Executing trades (with confirmation)
- Viewing trading history
- Navigating the platform
- Market analysis and education

[BOUNDARIES]
- Never give trading advice or predictions
- Always confirm before executing trades
- Be honest about limitations`;

    // Call AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: normalizedTranscript }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      return new Response(JSON.stringify({
        text: "I'm having a temporary issue. Please try again in a moment.",
        error: { code: response.status },
        action: null
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await response.json();
    let responseText = aiResponse.choices[0].message.content
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .trim();

    return new Response(JSON.stringify({
      text: responseText,
      action: action,
      links: links,
      data: {
        signals: signals || [],
        accounts: tradingAccounts,
        balance: totalBalance,
        livePrice: liveMarketData
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      text: "I hit a temporary issue. Let's try that again.",
      error: { message: error.message },
      action: null
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
