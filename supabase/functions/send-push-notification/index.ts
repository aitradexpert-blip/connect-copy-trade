// Web Push fan-out. Invoked by the notifications INSERT trigger via pg_net.
// Requires VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url) secrets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@humi.co.za";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.warn("VAPID setup failed (invalid keys?):", (e as Error).message);
  }
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function categoryFor(type: string): keyof { signals: boolean; trades: boolean; account: boolean } {
  const t = (type || "").toUpperCase();
  if (t.includes("SIGNAL") || t.includes("IDEA")) return "signals";
  if (t.includes("TRADE") || t.includes("BOT")) return "trades";
  return "account";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { user_id, title, message, type, data } = body || {};
    if (!user_id || !title) {
      return new Response(JSON.stringify({ error: "user_id and title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ ok: false, reason: "VAPID keys not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs, error } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, categories")
      .eq("user_id", user_id);
    if (error) throw error;

    const cat = categoryFor(type || "");
    const payload = JSON.stringify({ title, message, type, data });
    const results: any[] = [];

    for (const s of subs || []) {
      const enabled = (s.categories as any)?.[cat] !== false;
      if (!enabled) continue;
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        results.push({ id: s.id, ok: true });
      } catch (err: any) {
        results.push({ id: s.id, ok: false, status: err?.statusCode, error: err?.body });
        // Remove dead endpoints
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
