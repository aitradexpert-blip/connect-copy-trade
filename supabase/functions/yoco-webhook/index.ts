import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-yoco-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json();
    console.log('[Yoco Webhook] Received:', payload.type);

    // Verify webhook signature
    const signature = req.headers.get('x-yoco-signature');
    const webhookSecret = Deno.env.get('YOCO_WEBHOOK_SECRET');
    
    if (webhookSecret && !verifyYocoSignature(payload, signature, webhookSecret)) {
      console.error('[Yoco Webhook] Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle payment success
    if (payload.type === 'payment.succeeded') {
      const { metadata } = payload.payload;
      const userId = metadata?.user_id;
      const planName = metadata?.plan_name;

      if (!userId || !planName) {
        console.error('[Yoco Webhook] Missing metadata:', metadata);
        return new Response(JSON.stringify({ error: 'Missing required metadata' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Activate subscription
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: userId,
          plan_name: planName.toLowerCase(),
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          auto_trades_used: 0,
          last_reset_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('[Yoco Webhook] Database error:', error);
        throw error;
      }

      console.log(`[Yoco Webhook] ✅ Activated ${planName} for user ${userId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('[Yoco Webhook Error]:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function verifyYocoSignature(payload: any, signature: string | null, secret: string): boolean {
  // TODO: Implement proper Yoco signature verification
  // This is a placeholder - refer to Yoco's documentation for the actual implementation
  if (!signature) return false;
  
  // Yoco uses HMAC SHA256 for webhook signatures
  // You'll need to implement this based on Yoco's specific requirements
  console.log('[Yoco] Signature verification (placeholder)');
  return true;
}
