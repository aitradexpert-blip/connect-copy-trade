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
          metaapi_account_id: string | null;
          provider: string;
          deriv_token: string | null;
          deriv_currency: string | null;
          is_virtual: boolean | null;
          name: string;
          connection_type: string | null;
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
    // Include provider, deriv_token, deriv_currency for Deriv execution
    const { data: assignments, error: assignmentsError } = await supabase
      .from('ai_bot_assignments')
      .select('*, trading_accounts(id, metaapi_account_id, provider, deriv_token, deriv_currency, is_virtual, name)')
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
      const account = assignment.trading_accounts;
      
      try {
        console.log(`Executing trade for user ${assignment.user_id} on account ${assignment.trading_account_id}`);
        console.log(`Account provider: ${account.provider}, has deriv_token: ${!!account.deriv_token}, has metaapi_id: ${!!account.metaapi_account_id}`);

        let tradeResult;
        let tradeError;

        // Try VPS first if account is VPS-connected
        const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
        if ((account.provider === 'vps' || account.connection_type === 'vps') && VPS_URL) {
          try {
            const vpsRes = await fetch(`${VPS_URL}/order`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                'x-vps-secret': Deno.env.get('VPS_API_SECRET') || '',
              },
              body: JSON.stringify({
                accountId: account.id,
                symbol: signal.symbol,
                order_type: String(signal.direction || '').toLowerCase(),
                volume: signal.lot_size,
                sl: signal.stop_loss ?? null,
                tp: signal.take_profit ?? null,
              }),
            });
            const vpsResult = await vpsRes.json().catch(() => null);
            if (vpsResult?.success) {
              console.log(`VPS auto-execute success for user ${assignment.user_id}`);
              results.push({ user_id: assignment.user_id, success: true, via: 'vps', data: vpsResult });
              continue;
            }
            console.warn(`VPS auto-execute failed for ${assignment.user_id}, falling back:`, vpsResult?.error);
          } catch (e) {
            console.warn(`VPS unreachable for ${assignment.user_id}, falling back:`, e);
          }
        }

        // Check if this is a Deriv account
        if (account.provider === 'deriv' && account.deriv_token) {
          console.log(`Executing via Deriv for user ${assignment.user_id}`);
          
          // Call deriv-execute-signal edge function
          const derivResponse = await supabase.functions.invoke('deriv-execute-signal', {
            body: {
              deriv_token: account.deriv_token,
              deriv_currency: account.deriv_currency || 'USD',
              is_virtual: account.is_virtual || false,
              signal: {
                symbol: signal.symbol,
                direction: signal.direction,
                lot_size: signal.lot_size,
                stop_loss: signal.stop_loss,
                take_profit: signal.take_profit,
                comment: `Auto-executed: ${signal.comment || 'AI Bot'}`
              }
            }
          });
          
          tradeResult = derivResponse.data;
          tradeError = derivResponse.error;
          
        } else if (account.metaapi_account_id) {
          console.log(`Executing via MetaAPI for user ${assignment.user_id}`);
          
          // Call metaapi-execute-trade edge function
          const metaResponse = await supabase.functions.invoke('metaapi-execute-trade', {
            body: {
              accountId: account.metaapi_account_id,
              trade: {
                symbol: signal.symbol,
                direction: signal.direction,
                volume: signal.lot_size,
                stopLoss: signal.stop_loss,
                takeProfit: signal.take_profit,
                comment: `Auto-executed: ${signal.comment || 'AI Bot'}`,
                signal_id: signal_id,
                user_id: assignment.user_id
              }
            }
          });
          
          tradeResult = metaResponse.data;
          tradeError = metaResponse.error;
          
        } else {
          console.error(`No valid trading method for account ${account.id}`);
          results.push({
            user_id: assignment.user_id,
            success: false,
            error: 'No valid trading method configured for this account'
          });
          continue;
        }

        if (tradeError) {
          console.error(`Trade execution failed for ${assignment.user_id}:`, tradeError);
          results.push({
            user_id: assignment.user_id,
            success: false,
            error: tradeError.message || 'Trade execution failed'
          });
        } else {
          console.log(`Trade executed successfully for ${assignment.user_id}`);
          results.push({
            user_id: assignment.user_id,
            success: true,
            data: tradeResult
          });
        }
      } catch (error: any) {
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
