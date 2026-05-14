import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { trade_id, user_id, trade_data } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) throw new Error('LOVABLE_API_KEY not configured');

    // Get user's overall stats for context
    const { data: allTrades } = await supabase
      .from('trade_history')
      .select('symbol, direction, volume, entry_price, exit_price, profit_loss, status')
      .eq('user_id', user_id)
      .eq('status', 'closed')
      .limit(100);

    const closedTrades = allTrades || [];
    const winRate = closedTrades.length > 0
      ? ((closedTrades.filter(t => (t.profit_loss || 0) > 0).length / closedTrades.length) * 100).toFixed(1)
      : 'N/A';

    const tradeInfo = trade_data || {};

    const prompt = `Analyse this trade and provide a brief, actionable journal entry (3-4 sentences max):

Trade: ${tradeInfo.direction || 'Unknown'} ${tradeInfo.volume || 0} lots of ${tradeInfo.symbol || 'Unknown'}
Entry: ${tradeInfo.entry_price || 'N/A'} → Exit: ${tradeInfo.exit_price || 'N/A'}
P&L: $${tradeInfo.profit_loss?.toFixed(2) || '0.00'}
Duration: ${tradeInfo.executed_at && tradeInfo.closed_at ? 
  Math.round((new Date(tradeInfo.closed_at).getTime() - new Date(tradeInfo.executed_at).getTime()) / 60000) + ' minutes' : 'Unknown'}

User's overall win rate: ${winRate}%
Total closed trades: ${closedTrades.length}

Provide: 1) What went right/wrong, 2) Strategy pattern detected (if any), 3) One improvement tip.
Use a supportive South African mentor tone. Be concise.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are Khumo, a trading journal analyst. Provide brief, insightful trade analysis. Use South African English naturally.' },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI error: ${response.status} ${errorText}`);
    }

    const aiResponse = await response.json();
    const analysis = aiResponse.choices[0].message.content.replace(/\*/g, '').trim();

    // Detect strategy
    const strategies = ['ICT', 'SMC', 'FVG', 'supply demand', 'support resistance', 'fibonacci', 'breakout', 'scalp', 'swing'];
    const detectedStrategy = strategies.find(s => analysis.toLowerCase().includes(s.toLowerCase())) || null;

    // Save analysis
    if (trade_id) {
      await supabase.from('trade_analysis').insert({
        user_id,
        trade_id,
        ai_analysis: analysis,
        strategy_detected: detectedStrategy
      });
    }

    return new Response(JSON.stringify({
      analysis,
      strategy_detected: detectedStrategy
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Journal analysis error:', error);
    return new Response(JSON.stringify({
      analysis: "Could not analyse this trade right now. Try again later.",
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
