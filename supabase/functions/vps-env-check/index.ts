// TEMPORARY DIAGNOSTIC — reports only presence/shape of VPS env vars, never values.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
  const secret = Deno.env.get('VPS_API_SECRET') || '';

  let health: unknown = 'not attempted';
  if (url) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(`${url}/health`, {
        headers: { 'ngrok-skip-browser-warning': 'true', 'x-vps-secret': secret },
        signal: ctrl.signal,
      }).finally(() => clearTimeout(t));
      health = { status: r.status, body: (await r.text().catch(() => '')).slice(0, 200) };
    } catch (e) {
      health = { error: String((e as Error)?.message || e) };
    }
  }

  return new Response(
    JSON.stringify({
      VPS_API_URL_present: !!url,
      VPS_API_URL_length: url.length,
      VPS_API_URL_host: url ? new URL(url).host.replace(/^[^.]*/, '***') : null,
      VPS_API_SECRET_present: !!secret,
      health,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
