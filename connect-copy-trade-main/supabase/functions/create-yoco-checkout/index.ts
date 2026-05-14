import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Subscription prices in ZAR cents (USD * 18 exchange rate * 100)
const SUBSCRIPTION_PRICES_CENTS: Record<string, number> = {
  basic: 17820,        // R178.20 ($9.90 * 18)
  professional: 53820, // R538.20 ($29.90 * 18)
  enterprise: 71982,   // R719.82 ($39.99 * 18)
};

const PLAN_NAMES: Record<string, string> = {
  basic: 'Basic Plan',
  professional: 'Professional Plan',
  enterprise: 'Enterprise Plan',
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

    const { tier, userId, userEmail, successUrl, cancelUrl } = await req.json();

    // Validate tier
    if (!tier || !SUBSCRIPTION_PRICES_CENTS[tier]) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const YOCO_SECRET_KEY = Deno.env.get('YOCO_SECRET_KEY');
    
    if (!YOCO_SECRET_KEY) {
      console.error('[Yoco] Missing YOCO_SECRET_KEY');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountCents = SUBSCRIPTION_PRICES_CENTS[tier];
    const planName = PLAN_NAMES[tier];

    // Generate idempotency key to prevent duplicate charges
    const idempotencyKey = `${userId}-${tier}-${Date.now()}`;

    console.log(`[Yoco] Creating checkout for ${planName} - R${(amountCents / 100).toFixed(2)}`);

    const checkoutPayload = {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: successUrl || `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com')}/subscription?success=true`,
      cancelUrl: cancelUrl || `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com')}/subscription?cancelled=true`,
      failureUrl: cancelUrl || `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com')}/subscription?failed=true`,
      metadata: {
        user_id: userId,
        plan_name: tier,
        user_email: userEmail || '',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOCO_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(checkoutPayload),
    });

    const responseText = await response.text();
    console.log('[Yoco] Response status:', response.status);
    console.log('[Yoco] Response:', responseText);

    if (!response.ok) {
      console.error('[Yoco] Checkout creation failed:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout session',
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);

    return new Response(
      JSON.stringify({
        checkoutId: data.id,
        redirectUrl: data.redirectUrl,
        amount: amountCents,
        currency: 'ZAR',
        planName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Yoco] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
