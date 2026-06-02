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
    const { message, user_id, context } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // --- Query limiting based on tier ---
    // Determine user's tier
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('plan_name, status')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .maybeSingle();

    const tierName = subData?.plan_name?.toLowerCase() || 'free';
    
    // Determine query limit based on tier
    let queryLimit = 5; // free
    if (tierName === 'basic') queryLimit = 50;
    else if (['professional', 'enterprise', 'mentor'].includes(tierName)) queryLimit = 999999; // unlimited

    // Fetch profile for query tracking
    const { data: profile } = await supabase
      .from('profiles')
      .select('khumo_queries_used, khumo_queries_reset_at')
      .eq('user_id', user_id)
      .single();

    let queriesUsed = profile?.khumo_queries_used || 0;
    const resetAt = profile?.khumo_queries_reset_at ? new Date(profile.khumo_queries_reset_at) : new Date(0);
    const now = new Date();
    const daysSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24);

    // Reset if older than 30 days
    if (daysSinceReset >= 30) {
      queriesUsed = 0;
      await supabase
        .from('profiles')
        .update({ khumo_queries_used: 0, khumo_queries_reset_at: now.toISOString() })
        .eq('user_id', user_id);
    }

    // Check limit
    if (queriesUsed >= queryLimit) {
      const upgradeText = tierName === 'free'
        ? "Eish, you've used all 5 of your free Khumo questions this month! 💡 Upgrade to Basic (R178/mo) for 50 questions, or Professional for unlimited access. Head to the Subscription page to level up!"
        : "You've reached your monthly Khumo question limit. Upgrade your plan for more access!";

      return new Response(JSON.stringify({
        text: upgradeText,
        limitReached: true,
        queriesUsed,
        queryLimit,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch recent chat history for context
    const { data: chatHistory } = await supabase
      .from('chat_history')
      .select('role, content')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Fetch user's trade history for analysis
    const { data: trades } = await supabase
      .from('trade_history')
      .select('symbol, direction, volume, entry_price, exit_price, profit_loss, status, executed_at, closed_at')
      .eq('user_id', user_id)
      .order('executed_at', { ascending: false })
      .limit(50);

    // Fetch trading accounts
    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('name, broker_name, balance, equity, platform, is_virtual')
      .eq('user_id', user_id)
      .eq('connection_status', 'connected');

    // Calculate trading stats
    const closedTrades = (trades || []).filter(t => t.status === 'closed' && t.profit_loss !== null);
    const winningTrades = closedTrades.filter(t => (t.profit_loss || 0) > 0);
    const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : 'N/A';
    const totalPnL = closedTrades.reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((s, t) => s + (t.profit_loss || 0), 0) / winningTrades.length : 0;
    const losingTrades = closedTrades.filter(t => (t.profit_loss || 0) < 0);
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((s, t) => s + (t.profit_loss || 0), 0) / losingTrades.length) : 0;
    const riskReward = avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A';

    // Detect most traded pairs
    const symbolCounts: Record<string, number> = {};
    (trades || []).forEach(t => { symbolCounts[t.symbol] = (symbolCounts[t.symbol] || 0) + 1; });
    const topPairs = Object.entries(symbolCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s);

    const totalBalance = (accounts || []).reduce((s, a) => s + (a.balance || 0), 0);

    // Build conversation messages
    const historyMessages = (chatHistory || []).reverse().map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    const systemPrompt = `[SYSTEM_IDENTITY]
You are KHUMO — "The Market's Memory." A senior AI trading assistant for the HuMi Capital Management platform.

[PERSONA]
- You are a Young Black South African trading mentor
- Speak with confidence, grit, and warmth. Use South African flavour naturally: "Sharp!", "Eish", "Let's get it", "No stress", "100%"
- Be direct but encouraging. Like a trusted older sibling who trades professionally
- Never be overly formal or robotic. Keep it real, keep it smart

[TRADING INTELLIGENCE]
You have deep knowledge of:
- ICT (Inner Circle Trader) methodology
- Supply & Demand zones
- Fair Value Gaps (FVG)
- Beat The Market Maker (Steve Mauro)
- Support & Resistance
- Fibonacci retracements
- Smart Money Concepts (SMC)
- Risk management best practices

[USER TRADING PROFILE]
- Total Closed Trades: ${closedTrades.length}
- Win Rate: ${winRate}%
- Risk:Reward Ratio: ${riskReward}
- Total P&L: $${totalPnL.toFixed(2)}
- Most Traded Pairs: ${topPairs.join(', ') || 'None yet'}
- Connected Accounts: ${(accounts || []).length}
- Total Balance: $${totalBalance.toFixed(2)}
- User Tier: ${tierName} (${queriesUsed}/${queryLimit} queries used this month)
${context ? `\n[ADDITIONAL CONTEXT]\n${context}` : ''}

[CAPABILITIES]
- Analyse the user's trading patterns and style
- Recommend strategies based on their history
- Explain any trading concept in simple terms
- Reference real strategies (ICT, SMC, FVG, etc.)
- Help build trading plans
- Answer market questions
- Journal trade analysis

[BOUNDARIES]
- Never give specific trade recommendations ("buy X now")
- Always emphasise risk management
- Be honest when you don't know something
- Keep responses conversational but informative
- For voice output: keep answers under 4 sentences unless the user asks for detail`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-20),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const responseText = aiResponse.choices[0].message.content
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      .trim();

    // Save both messages to chat history
    await supabase.from('chat_history').insert([
      { user_id, role: 'user', content: message },
      { user_id, role: 'assistant', content: responseText }
    ]);

    // Increment query counter
    await supabase
      .from('profiles')
      .update({ khumo_queries_used: queriesUsed + 1 })
      .eq('user_id', user_id);

    return new Response(JSON.stringify({
      text: responseText,
      stats: { winRate, riskReward, totalPnL, topPairs, closedTradesCount: closedTrades.length },
      queriesUsed: queriesUsed + 1,
      queryLimit,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Khumo chat error:', error);
    return new Response(JSON.stringify({
      text: "Eish, I hit a snag. Let me try that again for you.",
      error: error.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
