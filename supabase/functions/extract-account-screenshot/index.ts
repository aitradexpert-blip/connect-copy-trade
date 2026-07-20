import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image_base64, media_type } = await req.json();
    if (!image_base64) {
      return new Response(JSON.stringify({ error: 'image_base64 required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY') || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 } },
            { type: 'text', text: 'This is a screenshot of a MetaTrader/broker account. Extract ONLY: login (number), server (exact string), broker/company name, and platform (mt4 or mt5 if determinable). Respond with ONLY raw JSON, no markdown, no preamble: {"login": "", "server": "", "broker_name": "", "platform": ""}. If a field is not visible, use null for it. NEVER extract or mention any password, even if one is visible in the image.' },
          ],
        }],
      }),
    });

    const data = await res.json();
    const text = data?.content?.find((b: any) => b.type === 'text')?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    let extracted;
    try { extracted = JSON.parse(clean); } catch { extracted = {}; }

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
