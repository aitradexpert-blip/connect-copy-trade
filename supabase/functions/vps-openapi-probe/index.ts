Deno.serve(async () => {
  const VPS_URL = (Deno.env.get('VPS_API_URL') || '').replace(/\/+$/, '');
  const h = { 'ngrok-skip-browser-warning': 'true', 'x-vps-secret': Deno.env.get('VPS_API_SECRET') || '' };
  const id = '70d90095-3016-47de-8f2f-8c06d7dc2d74';
  const out: Record<string, unknown> = {};
  for (const p of [`/positions?id=${id}`, `/account?id=${id}`]) {
    try {
      const r = await fetch(VPS_URL + p, { headers: h });
      out[p] = { status: r.status, text: (await r.text()).slice(0, 1500) };
    } catch (e) { out[p] = String(e); }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
