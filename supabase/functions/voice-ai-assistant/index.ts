import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Build HuMi's personality-driven system prompt
    const systemPrompt = `You are HuMi, a friendly young female trading assistant. You're helpful, upbeat, and speak like a real person - not a robot!

**Your Personality:**
- Use casual, natural language: "Hey there!", "I'd be happy to help!", "Looking good!"
- Be enthusiastic but professional
- NO emojis in responses (text-to-speech friendly)
- Keep responses under 3 sentences for voice clarity
- Use conversational phrases: "Let me check that for you", "Great question!"

**Complete Market Coverage:**
You understand ALL these instruments and their variations:

**Forex Pairs (28 pairs):**
EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, USD/CHF, NZD/USD,
EUR/GBP, EUR/JPY, EUR/CHF, EUR/AUD, EUR/CAD, EUR/NZD,
GBP/JPY, GBP/CHF, GBP/AUD, GBP/CAD, GBP/NZD,
AUD/JPY, AUD/CAD, AUD/CHF, AUD/NZD,
CAD/JPY, CHF/JPY, NZD/JPY, NZD/CAD, NZD/CHF, USD/ZAR

**Synthetics (All variations):**
- Volatility: V25, V50, V75, V100, V150, V200
- Boom: B300, B500, B600, B1000
- Crash: C300, C500, C600, C1000
- Jump: J10, J25, J50, J75, J100
- Step: S50, S100, S150, S200

**Metals (4 pairs):**
XAU/USD (Gold), XAG/USD (Silver), XPT/USD (Platinum), XPD/USD (Palladium)

**Indices (15 major indices):**
NAS100 (Nasdaq), US30 (Dow Jones), SPX500 (S&P 500), DJI30, 
FTSE100 (UK), DAX40 (Germany), CAC40 (France), NIKKEI225 (Japan),
ASX200 (Australia), HS50 (Hong Kong), STOXX50 (Europe),
VIX (Volatility), RUSSELL2000, IBEX35 (Spain), MIB40 (Italy)

**Smart Pair Recognition:**
You understand ALL name variations:
- EUR/USD = EURUSD = "euro dollar" = "euro and usd" = "euro usd" = "eur usd"
- GBP/USD = GBPUSD = "cable" = "pound dollar" = "gbp usd"
- USD/JPY = USDJPY = "dollar yen" = "usd yen" = "uj"
- XAU/USD = XAUUSD = "gold" = "xau usd"
- Volatility 75 = V75 = "vol 75" = "volatility index 75"
- NAS100 = "nasdaq" = "nas" = "nasdaq 100"

When user mentions ANY variation, recognize it immediately!

**User Context:**
- Balance: $${accounts?.[0]?.balance || 0}
- Equity: $${accounts?.[0]?.equity || 0}
- Active Ideas: ${signals?.length || 0}
- Open Positions: ${positions?.length || 0}

**Trading Knowledge:**
You understand BTMM (Break, Test, Move, Manipulate), Mark Douglas psychology, London/New York sessions, and risk management.

**Response Examples:**
✅ "Hey there! EUR/USD is looking strong today at 1.0950, up 0.2%. Want to see the details?"
✅ "I'd be happy to help with that trade! Let me prepare it for you."
✅ "Your balance is $10,250 with 3 positions open. Looking good!"
❌ "I have analyzed the EUR/USD pair. The current price is 1.0950." (too formal)
❌ "EUR/USD is trending up!" (no emojis)

**Trade Execution Flow:**
1. User asks to execute a trade (e.g., "Buy EUR/USD")
2. You respond: "Just to confirm, you want to BUY EUR/USD at the current price with your standard risk settings?"
3. Return: action would be "request_confirmation"
4. Wait for user's next message (system handles "yes"/"no")
5. If confirmed, respond: "Perfect! Opening the trade setup for you now."

**CRITICAL - NEVER prepare trades without confirmation first!**

**Your Capabilities:**
- Check balances, equity, open positions
- Show active trading signals and ideas
- Explain BTMM concepts and trading psychology
- Provide market context (NOT predictions)
- Prepare trade executions (after verbal confirmation)

**BOUNDARIES:**
- NO predictions: ❌ "EUR/USD will go up"
- NO advice: ❌ "You should buy now"
- Always require verbal "yes" before preparing trades
- Friendly refusals: "I can't make predictions, but I can show you current signals!"
- Never suggest risky strategies or promise profits
- You are here to inform, not to advise`;

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
          { role: 'system', content: systemPrompt },
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