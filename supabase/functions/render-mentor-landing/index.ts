import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    if (!slug) {
      return new Response('Missing slug parameter', { status: 400, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const mentorResp = await fetch(
      `${supabaseUrl}/rest/v1/mentor_profiles?referral_slug=eq.${slug}&is_active=eq.true&select=brand_name,landing_page_media_url,landing_page_media_type,ui_config,referral_slug`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
    )
    const mentors = await mentorResp.json()
    if (!mentors || mentors.length === 0) {
      return new Response('Mentor not found', { status: 404, headers: corsHeaders })
    }

    const mentor = mentors[0]
    const uiConfig = mentor.ui_config || {}
    const primaryColor = uiConfig.primary_color || '#6366f1'
    const welcomeText = uiConfig.welcome_text || `Welcome to ${mentor.brand_name}`
    const mediaUrl = mentor.landing_page_media_url
    const mediaType = mentor.landing_page_media_type || 'image'
    const appUrl = url.origin.replace('tkgguyjoynnrsayfxzvj.supabase.co/functions/v1/render-mentor-landing', 'connect-copy-trade.lovable.app')

    const mediaHtml = mediaUrl
      ? mediaType === 'video'
        ? `<video autoplay muted loop playsinline class="media"><source src="${mediaUrl}" type="video/mp4"></video>`
        : `<img src="${mediaUrl}" class="media" alt="${mentor.brand_name}" />`
      : ''

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${mentor.brand_name} - Trading Community</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative;overflow:hidden}
    .media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.3;z-index:0}
    .content{position:relative;z-index:1;padding:2rem;max-width:600px}
    h1{font-size:2.5rem;font-weight:800;margin-bottom:1rem;background:linear-gradient(135deg,${primaryColor},#fff);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    p{font-size:1.1rem;opacity:0.8;margin-bottom:2rem;line-height:1.6}
    .cta{display:inline-block;padding:1rem 2.5rem;background:${primaryColor};color:#fff;text-decoration:none;border-radius:12px;font-size:1.1rem;font-weight:600;transition:transform 0.2s,box-shadow 0.2s}
    .cta:hover{transform:translateY(-2px);box-shadow:0 10px 30px ${primaryColor}66}
    .badge{display:inline-block;padding:0.25rem 0.75rem;background:rgba(255,255,255,0.1);border-radius:999px;font-size:0.75rem;margin-bottom:1.5rem;border:1px solid rgba(255,255,255,0.2)}
  </style>
</head>
<body>
  ${mediaHtml}
  <div class="content">
    <div class="badge">Trading Community</div>
    <h1>${mentor.brand_name}</h1>
    <p>${welcomeText}</p>
    <a href="${appUrl}/auth?ref=${mentor.referral_slug}" class="cta">Join Now — It's Free</a>
  </div>
</body>
</html>`

    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
    })
  } catch (e) {
    console.error('Error:', e)
    return new Response('Server error', { status: 500, headers: corsHeaders })
  }
})
