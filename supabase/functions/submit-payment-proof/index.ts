import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/telegram';
// Group chat target for proof forwarding. Telegram resolves the @username/chat_id at delivery time;
// for private invite-only groups we forward via reply to the personal contact, who is also @mansamusafx.
const SUPPORT_CHAT = '@mansamusafx';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const user = userData.user;

    const body = await req.json();
    const { plan, amount, image_url, reference } = body;
    if (!image_url || !plan) {
      return new Response(JSON.stringify({ error: 'plan and image_url required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Insert proof row (uses service role + RLS bypass via service role client)
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: inserted, error: insertErr } = await admin.from('payment_proofs').insert({
      user_id: user.id,
      email: user.email || '',
      plan,
      amount: amount ?? 0,
      image_url,
      reference: reference || null,
      payment_method: 'eft',
      status: 'pending',
    }).select('id').single();

    if (insertErr) {
      console.error('[submit-payment-proof] DB error', insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    await admin.from('pending_subscriptions').insert({
      email: user.email || '',
      plan_name: plan,
      amount_cents: Math.round((amount ?? 0) * 100),
      payment_id: reference || null,
      status: 'pending',
      activated_user_id: user.id,
    });

    // Forward to Telegram support
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const TELEGRAM_API_KEY = Deno.env.get('TELEGRAM_API_KEY');
    let telegramOk = false;

    if (LOVABLE_API_KEY && TELEGRAM_API_KEY) {
      try {
        const caption =
          `🔔 NEW PAYMENT PROOF\n` +
          `User: ${user.email || user.id}\n` +
          `Plan: ${plan}\n` +
          `Amount: R${amount ?? 0}\n` +
          (reference ? `Reference: ${reference}\n` : '') +
          `Action: Please verify and activate subscription.`;

        const resp = await fetch(`${GATEWAY_URL}/sendPhoto`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'X-Connection-Api-Key': TELEGRAM_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: SUPPORT_CHAT,
            photo: image_url,
            caption,
          }),
        });

        telegramOk = resp.ok;
        if (!resp.ok) {
          const txt = await resp.text();
          console.error('[submit-payment-proof] Telegram error', resp.status, txt);
        } else {
          await admin.from('payment_proofs').update({ telegram_forwarded_at: new Date().toISOString() }).eq('id', inserted.id);
        }
      } catch (e) {
        console.error('[submit-payment-proof] Telegram fetch failed', e);
      }
    } else {
      console.warn('[submit-payment-proof] Telegram secrets not configured; skipping forward');
    }

    return new Response(JSON.stringify({ ok: true, proof_id: inserted.id, telegram_forwarded: telegramOk }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[submit-payment-proof] Unhandled', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
