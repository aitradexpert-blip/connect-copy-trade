import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      ai_bot_assignments: {
        Row: {
          id: string;
          bot_id: string;
          user_id: string;
          trading_account_id: string;
          auto_execute: boolean;
        };
      };
      trading_accounts: {
        Row: {
          id: string;
          metaapi_account_id: string;
          name: string;
        };
      };
    };
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    const { signal_id } = await req.json();

    if (!signal_id) {
      return new Response(
        JSON.stringify({ error: 'signal_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Auto-executing signal:', signal_id);

    // Get signal details
    const { data: signal, error: signalError } = await supabase
      .from('trading_signals')
      .select('*')
      .eq('id', signal_id)
      .single();

    if (signalError || !signal) {
      console.error('Signal not found:', signalError);
      return new Response(
        JSON.stringify({ error: 'Signal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all active bot assignments with auto_execute enabled
    const { data: assignments, error: assignmentsError } = await supabase
      .from('ai_bot_assignments')
      .select('*, trading_accounts(*)')
      .eq('auto_execute', true);

    if (assignmentsError) {
      console.error('Failed to fetch assignments:', assignmentsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch assignments' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${assignments?.length || 0} active bot assignments`);

    const results = [];

    // Execute trade for each assignment
    for (const assignment of assignments || []) {
      try {
        console.log(`Executing trade for user ${assignment.user_id} on account ${assignment.trading_account_id}`);

        // Call metaapi-execute-trade edge function
        const { data: tradeResult, error: tradeError } = await supabase.functions.invoke('metaapi-execute-trade', {
          body: {
            accountId: assignment.trading_accounts.metaapi_account_id,
            trade: {
              symbol: signal.symbol,
              direction: signal.direction,
              volume: signal.lot_size,
              stopLoss: signal.stop_loss,
              takeProfit: signal.take_profit,
              comment: `Auto-executed: ${signal.comment || 'Swing Trader Bot'}`,
              signal_id: signal_id,
              user_id: assignment.user_id
            }
          }
        });

        if (tradeError) {
          console.error(`Trade execution failed for ${assignment.user_id}:`, tradeError);
          results.push({
            user_id: assignment.user_id,
            success: false,
            error: tradeError.message
          });
        } else {
          console.log(`Trade executed successfully for ${assignment.user_id}`);
          results.push({
            user_id: assignment.user_id,
            success: true,
            data: tradeResult
          });
        }
      } catch (error) {
        console.error(`Exception executing trade for ${assignment.user_id}:`, error);
        results.push({
          user_id: assignment.user_id,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        signal_id,
        executed_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Auto-execute error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
