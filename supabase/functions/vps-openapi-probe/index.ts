Deno.serve(async () => {
  const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
  const h = { 'ngrok-skip-browser-warning': 'true', 'x-vps-secret': Deno.env.get('VPS_API_SECRET') || '' };
  const out: Record<string, unknown> = {};
  for (const p of ['/openapi.json', '/docs', '/']) {
    try {
      const r = await fetch(VPS_URL + p, { headers: h });
      const t = await r.text();
      if (p === '/openapi.json') {
        try {
          const j = JSON.parse(t);
          out[p] = Object.fromEntries(Object.entries(j.paths || {}).map(([k, v]: any) => [k, Object.fromEntries(Object.entries(v).map(([m, d]: any) => [m, { body: d.requestBody?.content?.['application/json']?.schema, params: d.parameters?.map((x: any) => x.name) }]))]));
          out.schemas = j.components?.schemas;
        } catch { out[p] = { status: r.status, text: t.slice(0, 300) }; }
      } else out[p] = { status: r.status, text: t.slice(0, 300) };
    } catch (e) { out[p] = String(e); }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
