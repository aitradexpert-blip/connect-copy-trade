import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      copy_trading_relationships: {
        Row: {
          id: string;
          master_user_id: string;
          master_account_id: string;
          follower_user_id: string;
          follower_account_id: string;
          status: string;
        };
      };
      trading_accounts: {
        Row: {
          id: string;
          metaapi_account_id: string;
          balance: number;
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

    const { signal_id, master_user_id } = await req.json();

    if (!signal_id || !master_user_id) {
      return new Response(
        JSON.stringify({ error: 'signal_id and master_user_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Copy trading triggered for signal:', signal_id, 'by master:', master_user_id);

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

    // Get all active copy relationships where this user is the master
    const { data: relationships, error: relationshipsError } = await supabase
      .from('copy_trading_relationships')
      .select('*, follower_account:trading_accounts!follower_account_id(*), master_account:trading_accounts!master_account_id(*)')
      .eq('master_user_id', master_user_id)
      .eq('status', 'active');

    if (relationshipsError) {
      console.error('Failed to fetch relationships:', relationshipsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch copy relationships' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${relationships?.length || 0} active copy relationships`);

    const results = [];

    // Execute trade for each follower
    for (const relationship of relationships || []) {
      try {
        const masterBalance = relationship.master_account.balance || 10000;
        const followerBalance = relationship.follower_account.balance || 10000;
        
        // Calculate proportional volume based on balance ratio
        const balanceRatio = followerBalance / masterBalance;
        const adjustedVolume = Number((signal.lot_size * balanceRatio).toFixed(2));

        console.log(`Copying trade for follower ${relationship.follower_user_id} with adjusted volume ${adjustedVolume}`);

        // Call metaapi-execute-trade edge function
        const { data: tradeResult, error: tradeError } = await supabase.functions.invoke('metaapi-execute-trade', {
          body: {
            accountId: relationship.follower_account.metaapi_account_id,
            trade: {
              symbol: signal.symbol,
              direction: signal.direction,
              volume: adjustedVolume,
              stopLoss: signal.stop_loss,
              takeProfit: signal.take_profit,
              comment: `Copy from ${relationship.master_account.name}`,
              signal_id: signal_id,
              user_id: relationship.follower_user_id
            }
          }
        });

        if (tradeError) {
          console.error(`Copy trade failed for follower ${relationship.follower_user_id}:`, tradeError);
          results.push({
            follower_user_id: relationship.follower_user_id,
            success: false,
            error: tradeError.message
          });
        } else {
          console.log(`Copy trade executed successfully for follower ${relationship.follower_user_id}`);
          results.push({
            follower_user_id: relationship.follower_user_id,
            success: true,
            data: tradeResult
          });
        }
      } catch (error) {
        console.error(`Exception copying trade for follower ${relationship.follower_user_id}:`, error);
        results.push({
          follower_user_id: relationship.follower_user_id,
          success: false,
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        signal_id,
        copied_count: results.filter(r => r.success).length,
        failed_count: results.filter(r => !r.success).length,
        results 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Copy trade listener error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
