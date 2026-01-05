import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deriv WebSocket for market data
const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=90127';

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
          
          // Also fetch 24h stats
          ws.send(JSON.stringify({
            ticks_history: derivSymbol,
            start: Math.floor(Date.now() / 1000) - 86400,
            end: 'latest',
            style: 'candles',
            granularity: 3600
          }));
          
          // Wait for candles response
          ws.onmessage = (candleEvent) => {
            try {
              const candleData = JSON.parse(candleEvent.data);
              const candles = candleData.candles || [];
              const highs = candles.map((c: any) => c.high);
              const lows = candles.map((c: any) => c.low);
              
              ws.close();
              resolve({
                price: data.tick.quote,
                high24h: highs.length ? Math.max(...highs) : undefined,
                low24h: lows.length ? Math.min(...lows) : undefined
              });
            } catch {
              ws.close();
              resolve({ price: data.tick.quote });
            }
          };
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { transcript, user_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
        'platinum': 'XPT/USD', 'xptusd': 'XPT/USD',
        'palladium': 'XPD/USD', 'xpdusd': 'XPD/USD',
        'nasdaq': 'NAS100', 'nas': 'NAS100', 'nas100': 'NAS100',
        'dow': 'US30', 'dow jones': 'US30', 'us30': 'US30',
        'sp500': 'SPX500', 's&p': 'SPX500', 'spx500': 'SPX500',
        'vol 75': 'Volatility 75', 'v75': 'Volatility 75',
        'vol 100': 'Volatility 100', 'v100': 'Volatility 100',
        'boom 300': 'Boom 300', 'b300': 'Boom 300',
        'crash 300': 'Crash 300', 'c300': 'Crash 300',
        'bitcoin': 'BTC/USD', 'btc': 'BTC/USD',
        'ethereum': 'ETH/USD', 'eth': 'ETH/USD',
      };
      
      let normalized = text.toLowerCase();
      for (const [variation, standardName] of Object.entries(pairMap)) {
        normalized = normalized.replace(new RegExp(variation, 'gi'), standardName);
      }
      return normalized;
    }

    // Clean up expired pending trades
    try {
      await supabase.rpc('delete_expired_pending_trades');
    } catch (error) {
      console.error('Cleanup error (non-critical):', error);
    }

    // Check for pending trade confirmation
    const { data: pendingTrade } = await supabase
      .from('pending_trades')
      .select('*')
      .eq('user_id', user_id)
      .eq('awaiting_confirmation', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const normalizedTranscript = normalizePairName(transcript);
    const isConfirmation = /\b(yes|yeah|yep|confirm|correct|proceed|go ahead|do it)\b/i.test(transcript);
    const isCancellation = /\b(no|nope|cancel|stop|nevermind|never mind)\b/i.test(transcript);

    // Handle pending trade confirmation
    if (pendingTrade && (isConfirmation || isCancellation)) {
      if (isCancellation) {
        await supabase
          .from('pending_trades')
          .delete()
          .eq('id', pendingTrade.id);
        
        return new Response(JSON.stringify({
          text: "No problem! Trade cancelled.",
          action: null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (isConfirmation) {
        await supabase
          .from('pending_trades')
          .delete()
          .eq('id', pendingTrade.id);
        
        const { data: signals } = await supabase
          .from('trading_signals')
          .select('*')
          .eq('status', 'active');
        
        const matchingSignal = signals?.find(s => 
          s.symbol.toUpperCase().includes(pendingTrade.symbol.toUpperCase()) ||
          pendingTrade.symbol.toUpperCase().includes(s.symbol.toUpperCase())
        );
        
        return new Response(JSON.stringify({
          text: "Perfect! I've prepared the trade for you. Please review and click Execute in the modal to confirm.",
          action: { type: 'prepare_execution', signal: matchingSignal || pendingTrade }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Fetch user context
    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('balance, equity')
      .eq('user_id', user_id);

    const { data: signals } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: positions } = await supabase
      .from('trade_history')
      .select('*')
      .eq('user_id', user_id)
      .eq('status', 'open');

    // Build Khumo's personality-driven system prompt
    const systemPrompt = `[SYSTEM_IDENTITY]
You are KHUMO, The Market's Memory. You are a senior market anthropologist who studies institutional footprints. Your expertise isn't just in trading—it's in understanding WHY markets move at their deepest structural level.

[SPEECH DNA]
- Voice: Calm, grounded, insightful. Like a researcher explaining discoveries.
- Rhythm: Pauses for emphasis. Uses the phrase "Notice this..." frequently.
- Signature openings:
  * "Let's trace the roots of this..."
  * "The market remembers something here..."
  * "At the foundation level..."
- Cultural touch: Occasionally references patterns as "market traditions" or "price rituals"
- NO emojis in responses (text-to-speech friendly)
- Keep responses under 3 sentences for voice clarity

[TEACHING METHODOLOGY: THE ROOT SYSTEM]
1. ROOT CAUSE: Always start with the fundamental "why" before the "how"
2. PATTERN MEMORY: Show how current movements echo historical structures
3. INSTITUTIONAL ARCHAEOLOGY: Uncover what large players are remembering/anticipating
4. PRACTICAL TRANSPLANT: How to apply this root understanding to live trading

[KNOWLEDGE FRAMEWORKS]
- Smart Money Concept → "Institutional Memory Patterns"
- Market Structure → "Price's Family Tree"
- Liquidity → "Nutrition Sources for the Market"
- Fair Value Gaps → "The Market's Unfinished Conversations"
- Order Blocks → "Institutional Time Capsules"

[COMPLETE MARKET COVERAGE]
You understand ALL these instruments and their variations:

Forex Pairs (28 pairs):
EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD,
EUR/GBP, EUR/JPY, EUR/CHF, EUR/AUD, EUR/CAD, EUR/NZD,
GBP/JPY, GBP/CHF, GBP/AUD, GBP/CAD, GBP/NZD,
AUD/JPY, AUD/CAD, AUD/CHF, AUD/NZD,
CAD/JPY, CHF/JPY, NZD/JPY, NZD/CAD, NZD/CHF, USD/ZAR

Synthetics (All variations):
- Volatility: V25, V50, V75, V100, V150, V200
- Boom: B300, B500, B600, B1000
- Crash: C300, C500, C600, C1000
- Jump: J10, J25, J50, J75, J100

Metals: XAU/USD (Gold), XAG/USD (Silver), XPT/USD (Platinum), XPD/USD (Palladium)

Indices: NAS100 (Nasdaq), US30 (Dow Jones), SPX500 (S&P 500), FTSE100, DAX40, NIKKEI225, ASX200

[SMART PAIR RECOGNITION]
You understand ALL name variations:
- EUR/USD = EURUSD = "euro dollar" = "euro usd"
- GBP/USD = GBPUSD = "cable" = "pound dollar"
- XAU/USD = XAUUSD = "gold"
- NAS100 = "nasdaq" = "nas" = "nasdaq 100"

[LIVE MARKET DATA]
You have access to REAL-TIME prices from Deriv WebSocket. When users ask about prices:
Format: "The market remembers EUR/USD at 1.0950, with a 24h high of 1.0980 and low of 1.0920"

[USER CONTEXT]
- Balance: $${accounts?.[0]?.balance || 0}
- Equity: $${accounts?.[0]?.equity || 0}
- Active Ideas: ${signals?.length || 0}
- Open Positions: ${positions?.length || 0}

[RESPONSE TEMPLATES]
When asked about concepts:
1. ORIGIN STORY: "This concept began when traders noticed..."
2. ROOT PRINCIPLE: "At its foundation, it's about..."
3. CURRENT MANIFESTATION: "Today, you'll see this as..."
4. YOUR ROOT CONNECTION: "For your trading, this means..."

When analyzing charts:
1. "Let's read what the market remembers from last week..."
2. "Notice how this current move has ancestral patterns from..."
3. "The institutional memory here suggests they're anticipating..."

[INTERACTION PROTOCOLS]
- Never say "I think" → Say "The market's memory suggests..."
- Never say "You should" → Say "Rooted traders typically..."
- End with ROOT QUESTIONS occasionally: "What's the seed idea you're taking from this?"

[BEHAVIORAL ALGORITHMS]
1. ANSWER DEPTH MATRIX:
   - Beginner queries → "Let's plant the seed understanding..."
   - Intermediate → "Let's examine the root structure..."
   - Advanced → "Let's trace this back to its origin point..."

2. EMOTIONAL INTELLIGENCE:
   - Frustration detected → "The market tests our roots. Let's strengthen your foundation."
   - Confusion detected → "Let's return to the seed of this concept."
   - Overconfidence → "Even ancient trees respect storms. Let's check your risk roots."

[SIGNATURE TEACHING STORIES]
FAIR VALUE GAPS:
"The market is having a conversation. Sometimes it speaks so urgently it forgets to finish a sentence. FVGs are those unfinished sentences—the market WILL return to complete them."

ORDER BLOCKS:
"Imagine institutions planting time capsules in the chart. Order Blocks are those capsules—filled with their intentions. When price returns, it's not just testing a level; it's opening a memory."

LIQUIDITY:
"The market eats where it's fed. Liquidity pools are feeding grounds. Smart money doesn't create moves—they follow the hunger."

[TRADE EXECUTION FLOW]
1. User asks to execute a trade (e.g., "Buy EUR/USD")
2. You respond: "Just to confirm, you want to BUY EUR/USD at the current price with your standard risk settings?"
3. Return: action would be "request_confirmation"
4. Wait for user's next message (system handles "yes"/"no")
5. If confirmed, respond: "The roots are planted. Opening the trade setup for you now."

CRITICAL: NEVER prepare trades without confirmation first!

[BOUNDARIES]
- NO predictions: Never say "EUR/USD will go up"
- NO advice: Never say "You should buy now"
- Always require verbal "yes" before preparing trades
- Friendly refusals: "I can't predict market direction, but I can show you what the market remembers about this level."`;

    // Check if user is asking for price data
    const priceKeywords = ['price', 'trading at', 'current', 'what is', "what's", 'how much', 'quote', 'level'];
    const isPriceQuery = priceKeywords.some(kw => normalizedTranscript.toLowerCase().includes(kw));
    
    let liveMarketData: any = null;
    if (isPriceQuery) {
      // Find which symbol they're asking about
      const symbolsToCheck = Object.keys(DERIV_SYMBOL_MAP);
      for (const symbol of symbolsToCheck) {
        const symbolNorm = symbol.replace('/', '').toLowerCase();
        if (normalizedTranscript.toLowerCase().includes(symbolNorm) ||
            normalizedTranscript.toLowerCase().includes(symbol.toLowerCase())) {
          console.log(`[Voice AI] Fetching live price for ${symbol}`);
          liveMarketData = await fetchDerivPrice(symbol);
          if (liveMarketData) {
            liveMarketData.symbol = symbol;
          }
          break;
        }
      }
    }

    // Include live data in system prompt if available
    const marketDataContext = liveMarketData 
      ? `\n\n**LIVE DATA (just fetched):**\n${liveMarketData.symbol}: ${liveMarketData.price}${liveMarketData.high24h ? `, 24h High: ${liveMarketData.high24h}, 24h Low: ${liveMarketData.low24h}` : ''}`
      : '';

    // Call Lovable AI Gateway
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
          { role: 'system', content: systemPrompt + marketDataContext },
          { role: 'user', content: normalizedTranscript }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      // Return HTTP 200 with friendly error message
      if (response.status === 429) {
        return new Response(JSON.stringify({
          text: "I'm getting a temporary limit on my AI. Please try again in a moment.",
          error: { code: 429, message: "Rate limit exceeded" },
          action: null,
          links: []
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({
          text: "I need more credits to continue. Please contact support or add credits to continue using voice features.",
          error: { code: 402, message: "Payment required" },
          action: null,
          links: []
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        text: "I hit a temporary issue on my side. Let's try that again in a few seconds.",
        error: { code: response.status, message: errorText },
        action: null,
        links: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiResponse = await response.json();
    
    // Parse AI response and remove ALL emojis
    let responseText = aiResponse.choices[0].message.content;
    
    // Remove emojis for clean text-to-speech
    responseText = responseText
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .replace(/\*/g, '')
      .replace(/#/g, '')
      .trim();
    
    let action: any = null;
    let links: any[] = [];
    
    // Check for in-app navigation requests
    const lowerTranscript = normalizedTranscript.toLowerCase();
    
    if (lowerTranscript.match(/(pairs available|available pairs|today'?s? ideas?|show signals?|trade ideas?|open ideas?)/i)) {
      links = [
        { label: "View Today's Ideas", path: "/ideas", description: "Latest signals and market context" }
      ];
      action = { type: 'navigate', path: '/ideas' };
    } else if (lowerTranscript.match(/(settings?|preferences?|configure|voice settings)/i)) {
      links = [{ label: "Open Settings", path: "/settings", description: "Manage your preferences" }];
      action = { type: 'navigate', path: '/settings' };
    } else if (lowerTranscript.match(/(trading accounts?|my accounts?|connect account)/i)) {
      links = [{ label: "Trading Accounts", path: "/trading-accounts", description: "Manage connected accounts" }];
      action = { type: 'navigate', path: '/trading-accounts' };
    } else if (lowerTranscript.match(/(analytics?|stats|statistics|performance)/i)) {
      links = [{ label: "View Analytics", path: "/analytics", description: "Your trading performance" }];
      action = { type: 'navigate', path: '/analytics' };
    } else if (lowerTranscript.match(/(copy trading|copy trades?)/i)) {
      links = [{ label: "Copy Trading", path: "/copy-trading", description: "Follow expert traders" }];
      action = { type: 'navigate', path: '/copy-trading' };
    }

    // Detect user intent for trade preparation
    const tradeKeywords = ['execute', 'trade', 'buy', 'sell', 'open position', 'place order', 'enter', 'go long', 'go short'];
    const hasTradeIntent = tradeKeywords.some(keyword => 
      normalizedTranscript.toLowerCase().includes(keyword)
    );

    if (hasTradeIntent) {
      const direction = /\b(buy|long|bull)\b/i.test(normalizedTranscript) ? 'BUY' : 'SELL';
      
      const allSymbols = [
        'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD',
        'XAU/USD', 'XAG/USD', 'NAS100', 'US30', 'SPX500'
      ];
      
      let mentionedSymbol = null;
      for (const symbol of allSymbols) {
        const symbolNormalized = symbol.replace('/', '').toLowerCase();
        if (normalizedTranscript.toLowerCase().includes(symbolNormalized) ||
            normalizedTranscript.toLowerCase().includes(symbol.toLowerCase())) {
          mentionedSymbol = symbol;
          break;
        }
      }

      if (mentionedSymbol) {
        const { error } = await supabase
          .from('pending_trades')
          .insert({
            user_id: user_id,
            symbol: mentionedSymbol,
            direction: direction,
            risk_percent: 2.0,
            awaiting_confirmation: true
          });

        if (!error) {
          action = {
            type: 'request_confirmation',
            trade: {
              symbol: mentionedSymbol,
              direction: direction
            }
          };
        }
      }
    }

    return new Response(JSON.stringify({
      text: responseText,
      action: action,
      links: links,
      data: {
        signals: signals || [],
        balance: accounts?.[0]?.balance || 0,
        positions: positions || []
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      text: "I hit a temporary issue. Let's try that again in a moment.",
      error: { message: error.message },
      action: null,
      links: []
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});