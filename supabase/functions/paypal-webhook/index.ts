import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, paypal-transmission-id, paypal-transmission-time, paypal-cert-url, paypal-auth-algo, paypal-transmission-sig',
};

// Map each Hosted Button's price to a plan. Update these to your real
// amounts (in the currency PayPal reports, typically USD).
const AMOUNT_TO_PLAN: Record<string, string> = {
   "10.00": "basic",
   "29.99": "professional",
   "55.00": "mentor",
  "39.99": "enterprise",
};

async function getPayPalAccessToken(): Promise<string> {
  const clientId = Deno.env.get('PAYPAL_CLIENT_ID')!;
  const secret = Deno.env.get('PAYPAL_SECRET')!;
  const auth = btoa(`${clientId}:${secret}`);
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  return data.access_token;
}

async function verifyWebhookSignature(headers: Headers, body: string, accessToken: string): Promise<boolean> {
  const verifyRes = await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: headers.get('paypal-transmission-id'),
      transmission_time: headers.get('paypal-transmission-time'),
      cert_url: headers.get('paypal-cert-url'),
      auth_algo: headers.get('paypal-auth-algo'),
      transmission_sig: headers.get('paypal-transmission-sig'),
      webhook_id: Deno.env.get('PAYPAL_WEBHOOK_ID'),
      webhook_event: JSON.parse(body),
    }),
  });
  const result = await verifyRes.json();
  return result.verification_status === 'SUCCESS';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const rawBody = await req.text();
    const accessToken = await getPayPalAccessToken();

    const isValid = await verifyWebhookSignature(req.headers, rawBody, accessToken);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const event = JSON.parse(rawBody);

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource;
      const amount = capture?.amount?.value;
      const currency = capture?.amount?.currency_code;
      const payerEmail = capture?.payer?.email_address;
      const captureId = capture?.id;

      const plan = AMOUNT_TO_PLAN[amount] || 'unknown';

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );

      await supabase.from('pending_subscriptions').insert({
        email: payerEmail || 'unknown@paypal.com',
        plan_name: plan,
        amount_cents: Math.round(parseFloat(amount || '0') * 100),
        payment_id: captureId,
        status: 'pending',
        paid_at: new Date().toISOString(),
      });

      console.log(`PayPal payment captured: ${captureId}, ${amount} ${currency}, plan=${plan}, payer=${payerEmail}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('PayPal webhook error:', e);
    return new Response(JSON.stringify({ received: true, loggedError: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
