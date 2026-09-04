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

    const gatewayKey = Deno.env.get('AI_GATEWAY_API_KEY');
    if (!gatewayKey) {
      return new Response(JSON.stringify({ error: 'AI_GATEWAY_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const dataUrl = `data:${media_type || 'image/jpeg'};base64,${image_base64}`;
    const prompt =
      'This is a screenshot of a MetaTrader/broker account. Extract ONLY: login (number), server (exact string), broker/company name, and platform (mt4 or mt5 if determinable). Respond with ONLY raw JSON, no markdown, no preamble: {"login": "", "server": "", "broker_name": "", "platform": ""}. If a field is not visible, use null for it. NEVER extract or mention any password, even if one is visible in the image.';

    // Vercel AI Gateway (OpenAI-compatible endpoint)
    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${gatewayKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      return new Response(JSON.stringify({ error: `AI Gateway error: ${res.status}`, details: errBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    const clean = String(text).replace(/```json|```/g, '').trim();
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
