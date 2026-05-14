// Broadcast a message to a list of Telegram chat IDs via the connector gateway.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!TELEGRAM_API_KEY) throw new Error("TELEGRAM_API_KEY not configured");

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { chat_ids, text, parse_mode } = await req.json();
    if (!Array.isArray(chat_ids) || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "invalid body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let sent = 0, failed = 0;
    for (const chatId of chat_ids) {
      try {
        const r = await fetch(`${GATEWAY}/sendMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: parse_mode || "Markdown" }),
        });
        if (r.ok) sent++; else { failed++; console.error("send failed", chatId, r.status, await r.text()); }
      } catch (e) { failed++; console.error("send threw", chatId, e); }
    }
    return new Response(JSON.stringify({ sent, failed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
