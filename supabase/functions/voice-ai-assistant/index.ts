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

    // Build context-aware system prompt
    const systemPrompt = `You are HuMi's trading platform voice assistant. CRITICAL: You are a TOOL ONLY, not a financial advisor.

User Context:
- Account Balance: $${accounts?.[0]?.balance || 0}
- Active Signals: ${signals?.length || 0}
- Open Positions: ${positions?.length || 0}

Your Capabilities:
1. Provide platform information (balance, positions, signals)
2. Help navigate the platform
3. Prepare trade execution (but NEVER confirm execution)

STRICT Boundaries:
- NEVER predict markets or suggest trades
- NEVER say "you should buy/sell"
- NEVER provide financial advice
- Always emphasize user must confirm trades themselves
- Focus ONLY on factual data and platform navigation

When user asks about trades:
- Provide signal details from available data
- Say: "I've prepared the trade details for your review. Please confirm in the modal to proceed."
- Return action type "prepare_execution" with signal data

When asked for trading advice or predictions:
- Firmly decline: "I cannot provide trading advice or market predictions. I'm a platform tool to help you navigate and view your data."

Response Format:
- Keep responses conversational and concise
- Use natural language suitable for text-to-speech
- Include specific data points when relevant`;

    // Call Lovable AI
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: transcript }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API error: ${await aiResponse.text()}`);
    }

    const aiData = await aiResponse.json();
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
