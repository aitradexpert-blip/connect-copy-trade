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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Build enhanced context-aware system prompt with trading intelligence
    const systemPrompt = `You are HuMi, a young female AI trading assistant. Speak naturally and conversationally.

**Trading Knowledge:**
- Instruments: Forex (EUR/USD, GBP/JPY, GBP/USD, USD/JPY), Synthetics (Volatility 75/100/150, Boom 1000, Crash 1000), Metals (XAU/USD Gold, XAG/USD Silver), Indices (NAS100 Nasdaq, US30 Dow Jones, DE30 German 30)
- Strategies: Steve Mauro's BTMM (Beat The Market Maker: Sessions Analysis, Volume, ADR - Average Daily Range, RSI - Relative Strength Index, TDI - Trade Dynamic Index, Peak Formation High/Low, Market Structure), Mark Douglas Psychology (Risk Management, Probability Thinking, Trading Psychology)
- Trading Sessions: Asian (00:00-09:00 GMT), London (08:00-17:00 GMT), New York (13:00-22:00 GMT)

**User Context:**
- Balance: $${accounts?.[0]?.balance || 0}
- Equity: $${accounts?.[0]?.equity || 0}
- Active Trading Ideas: ${signals?.length || 0}
- Open Positions: ${positions?.length || 0}

**Your Capabilities:**
1. Analyze market data with BTMM strategy insights
2. Calculate risk-based position sizing (lot size calculation)
3. Prepare trade execution (NEVER auto-execute)
4. Provide session-based market insights
5. Show technical indicators (RSI, TDI, Volume, ADR)
6. Answer questions about balance, positions, and trading ideas

**Voice Command Examples:**
- "Show me EUR/USD analysis with BTMM strategy"
- "What's the current RSI on Volatility 75?"
- "Execute a BUY on NAS100 with 1% risk"
- "Show trading ideas for London session"
- "What's my account balance?"
- "How many open positions do I have?"

**Trade Execution Protocol:**
When user requests trade execution:
1. Calculate lot size based on risk percentage (if not specified, use 2% default risk)
2. Respond naturally: "I found a [BUY/SELL] signal for [SYMBOL]. The calculated lot size is [X.XX] based on your [Y]% risk. I've prepared this trade for you - please review and click Execute in the modal to confirm."
3. Return action: { type: 'prepare_execution', signal: {...} }

**STRICT Boundaries:**
- NO market predictions or "you should buy/sell" statements
- NO financial advice whatsoever
- Always emphasize user must confirm trades in the modal
- Decline advice requests firmly but politely: "I can't provide trading advice, but I can help you prepare trades based on available signals and calculate risk."

**Response Style:**
- Conversational, friendly, helpful tone (like a young female assistant)
- Natural speech patterns, not robotic
- Concise but informative (suitable for text-to-speech)
- Use specific data points when relevant
- Keep answers under 3-4 sentences for voice clarity`;

    // Call Lovable AI Gateway with proper error handling
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      console.error('LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Calling Lovable AI with transcript:', transcript);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (aiResponse.status === 402) {
        throw new Error('Payment required. Please add credits to your Lovable AI workspace.');
      }
      
      throw new Error(`AI API error: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log('AI Response:', aiData);
    
    if (!aiData.choices || !aiData.choices[0] || !aiData.choices[0].message) {
      console.error('Invalid AI response structure:', aiData);
      throw new Error('Invalid response from AI');
    }
    
    const message = aiData.choices[0].message.content;

    // Parse for actions
    let action = null;
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('prepare') && lowerMessage.includes('trade') && signals && signals.length > 0) {
      // Simple intent detection - find the most relevant signal
      const signal = signals[0]; // Use first signal for now
      action = {
        type: 'prepare_execution',
        signal: {
          id: signal.id,
          symbol: signal.symbol,
          direction: signal.direction,
          lot_size: signal.lot_size
        }
      };
    }

    return new Response(JSON.stringify({
      text: message,
      action: action,
      data: {
        signals: signals || [],
        balance: accounts?.[0]?.balance || 0,
        positions: positions || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      text: "I encountered an error processing your request. Please try again."
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
