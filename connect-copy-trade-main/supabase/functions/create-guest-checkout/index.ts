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

    const { tier, email, successUrl, cancelUrl } = await req.json();

    // Validate tier
    if (!tier || !SUBSCRIPTION_PRICES_CENTS[tier]) {
      return new Response(
        JSON.stringify({ error: 'Invalid subscription tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email
    if (!email || !email.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const YOCO_SECRET_KEY = Deno.env.get('YOCO_SECRET_KEY');
    
    if (!YOCO_SECRET_KEY) {
      console.error('[Guest Checkout] Missing YOCO_SECRET_KEY');
      return new Response(
        JSON.stringify({ error: 'Payment service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const amountCents = SUBSCRIPTION_PRICES_CENTS[tier];
    const planName = PLAN_NAMES[tier];

    // Create or update pending subscription record
    const { error: pendingError } = await supabase
      .from('pending_subscriptions')
      .upsert({
        email: email.toLowerCase().trim(),
        plan_name: tier,
        amount_cents: amountCents,
        status: 'pending',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
        ignoreDuplicates: false
      });

    if (pendingError) {
      console.error('[Guest Checkout] Failed to create pending subscription:', pendingError);
      // Continue anyway - payment is more important
    }

    // Generate idempotency key
    const idempotencyKey = `guest-${email}-${tier}-${Date.now()}`;

    console.log(`[Guest Checkout] Creating checkout for ${planName} - R${(amountCents / 100).toFixed(2)} - Email: ${email}`);

    const checkoutPayload = {
      amount: amountCents,
      currency: 'ZAR',
      successUrl: successUrl || `https://40e9ff15-3e58-40fd-8ad7-63a160d226e1.lovableproject.com/auth?plan=${tier}&payment_success=true&email=${encodeURIComponent(email)}`,
      cancelUrl: cancelUrl || `https://40e9ff15-3e58-40fd-8ad7-63a160d226e1.lovableproject.com/pricing?cancelled=true`,
      failureUrl: cancelUrl || `https://40e9ff15-3e58-40fd-8ad7-63a160d226e1.lovableproject.com/pricing?failed=true`,
      metadata: {
        guest_checkout: true,
        email: email.toLowerCase().trim(),
        plan_name: tier,
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
    console.log('[Guest Checkout] Yoco response status:', response.status);

    if (!response.ok) {
      console.error('[Guest Checkout] Yoco checkout failed:', responseText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout session',
          details: responseText 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = JSON.parse(responseText);

    // Update pending subscription with checkout ID
    await supabase
      .from('pending_subscriptions')
      .update({ yoco_checkout_id: data.id })
      .eq('email', email.toLowerCase().trim());

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
    console.error('[Guest Checkout] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
