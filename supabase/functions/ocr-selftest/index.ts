// TEMPORARY diagnostic function — verifies the Lovable AI Gateway vision call
// used by extract-account-screenshot. Deleted after verification.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*' } });
  try {
    const { image_base64, media_type } = await req.json();
    const key = Deno.env.get('LOVABLE_API_KEY');
    if (!key) return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY missing' }), { status: 500 });

    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: 'Extract ONLY: login, server, broker/company name, platform (mt4/mt5). Respond with ONLY raw JSON: {"login":"","server":"","broker_name":"","platform":""}. Never extract passwords.' },
            { type: 'image_url', image_url: { url: `data:${media_type || 'image/jpeg'};base64,${image_base64}` } },
          ],
        }],
      }),
    });
    const text = await res.text();
    return new Response(JSON.stringify({ gateway_status: res.status, body: text.slice(0, 1200) }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
