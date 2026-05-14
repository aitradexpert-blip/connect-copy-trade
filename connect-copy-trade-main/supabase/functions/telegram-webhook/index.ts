// HuMi Telegram bot — "Path to Profit" onboarding flow
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const APK_URL = "https://connect-copy-trade.lovable.app/HuMi_Mobile.apk";
const APP_URL = "https://connect-copy-trade.lovable.app";
const OCTAFX_NEW = "https://clickto.trade/b3gtWBN3fii?ib=44960573";
const OCTAFX_EXISTING = "https://clickto.trade/b7mKraZhMSj?ib=44960573";
const YOCO_LINK = `${APP_URL}/pricing`;
const WA_CHANNEL = "https://whatsapp.com/channel/0029VaY0Klp9Gv7VhypIt61A";
const WA_BUSINESS = "https://wa.me/message/WOH4AWGKQWSWL1";

async function tg(method: string, body: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) throw new Error("Telegram secrets missing");
  const r = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) console.error("Telegram error", method, r.status, JSON.stringify(data));
  return data;
}

function startKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🆓 Get Free Basic Plan", callback_data: "free_plan" }],
      [{ text: "❓ How it works", callback_data: "how" }],
      [{ text: "📥 Download App", callback_data: "install" }],
    ],
  };
}

function freePlanKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🔗 Register OctaFX (Free)", url: OCTAFX_NEW }],
      [{ text: "✅ I have an OctaFX account", callback_data: "have_octafx" }],
      [{ text: "🔁 Switch IB to HuMi", url: OCTAFX_EXISTING }],
      [{ text: "💳 Pay R179/month (any broker)", url: YOCO_LINK }],
    ],
  };
}

function installKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📥 Download HuMi APK", url: APK_URL }],
      [{ text: "🌐 Open Web App", url: APP_URL }],
      [{ text: "📱 WhatsApp Channel", url: WA_CHANNEL }],
      [{ text: "💬 Chat Support", url: WA_BUSINESS }],
    ],
  };
}

const WELCOME = `🚀 *Welcome to HuMi — Path to Profit*\n\nLock in the bag with AI-powered trade ideas, copy trading, and live signals tuned for NY Open setups.\n\n*Choose your path:*`;

const HOW = `*How HuMi works (60 seconds):*\n\n1️⃣ Open or link an OctaFX account → app + signals are *FREE*\n2️⃣ Already on another broker? Pay *R179 (~$10)/month* for full access\n3️⃣ Get live trade ideas, copy verified mentors, and run AI bots\n4️⃣ Manage all your accounts in one mobile app\n\nReady? Hit *Get Free Basic Plan* to start. 🔥`;

const DEAL = `💰 *The Deal:*\n\n✅ Trade with *OctaFX* via our link → HuMi is *100% FREE*\n💳 Use another broker → *R179/month* ($10) for full access\n\n*Pick one below:*`;

const ASK_OCTAFX_ID = `Sharp! 💯\n\nDrop your *7-8 digit OctaFX Account ID* now (numbers only).\n\nWe'll verify and unlock your free signals within 24 hours. While we work on that, get the app ready 👇`;

const PREP_MSG = `Received! 🛠️\n\n*Get the app ready while we verify:*\n\n📥 *Download HuMi:* tap the APK button below.\n\n⚙️ *Allow Unknown Sources:* Settings → Apps → Special access → Install unknown apps → enable for Chrome.\n\n📍 *GPS / Location fix:* If OctaFX says "country not supported", go to Chrome → Site Settings → Location → Allow, then reload.\n\nWe'll ping you the second you're verified. 🚀`;

const VERIFIED = `🎉 *Verification Successful!*\n\nYour signals are now *LIVE*. Use /signals to see today's setups.\n\nLet's get the bag! 💼`;

const NOT_VERIFIED = `Your account isn't verified yet. We usually approve within 24 hours. Hold tight — DM @humisupport if it's been longer.`;

async function getDb() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

async function upsertLead(chatId: number, patch: Record<string, any>) {
  const db = await getDb();
  await db.from("telegram_leads").upsert({
    telegram_chat_id: chatId,
    last_interaction_at: new Date().toISOString(),
    ...patch,
  }, { onConflict: "telegram_chat_id" });
}

async function getLead(chatId: number) {
  const db = await getDb();
  const { data } = await db.from("telegram_leads").select("*").eq("telegram_chat_id", chatId).maybeSingle();
  return data;
}

async function handleCommand(chatId: number, text: string, from: any) {
  if (text === "/start") {
    await upsertLead(chatId, {
      telegram_username: from?.username || null,
      telegram_first_name: from?.first_name || null,
      conversation_state: "start",
    });
    await tg("sendMessage", { chat_id: chatId, text: WELCOME, parse_mode: "Markdown", reply_markup: startKeyboard() });
    return;
  }
  if (text === "/install") {
    await tg("sendMessage", { chat_id: chatId, text: "Install HuMi 👇", reply_markup: installKeyboard() });
    return;
  }
  if (text === "/plans") {
    await tg("sendMessage", { chat_id: chatId, text: DEAL, parse_mode: "Markdown", reply_markup: freePlanKeyboard() });
    return;
  }
  if (text === "/support") {
    await tg("sendMessage", { chat_id: chatId, text: "Need help? Chat with us:", reply_markup: { inline_keyboard: [[{ text: "💬 WhatsApp Support", url: WA_BUSINESS }]] } });
    return;
  }
  if (text === "/signals") {
    const lead = await getLead(chatId);
    if (!lead?.verified) {
      await tg("sendMessage", { chat_id: chatId, text: NOT_VERIFIED });
      return;
    }
    // Pull latest 3 active signals
    const db = await getDb();
    const { data: signals } = await db.from("trading_signals")
      .select("symbol, direction, lot_size, stop_loss, take_profit, comment, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(3);
    if (!signals?.length) {
      await tg("sendMessage", { chat_id: chatId, text: "No active signals right now. NY Open setups drop soon — stay ready. 🎯" });
      return;
    }
    const txt = signals.map((s: any) =>
      `*${s.direction} ${s.symbol}* (${s.lot_size} lots)\nSL: \`${s.stop_loss ?? "—"}\` | TP: \`${s.take_profit ?? "—"}\`\n${s.comment ?? ""}`
    ).join("\n\n────────\n\n");
    await tg("sendMessage", { chat_id: chatId, text: `📊 *Today's Live Signals*\n\n${txt}`, parse_mode: "Markdown" });
    return;
  }

  // Otherwise: check if awaiting OctaFX ID
  const lead = await getLead(chatId);
  if (lead?.conversation_state === "awaiting_octafx_id") {
    const id = text.replace(/\D/g, "");
    if (id.length < 6 || id.length > 10) {
      await tg("sendMessage", { chat_id: chatId, text: "That doesn't look like an OctaFX ID. It should be 7-8 digits. Try again." });
      return;
    }
    await upsertLead(chatId, {
      octafx_account_id: id,
      plan_choice: "free_octafx",
      conversation_state: "awaiting_payment",
    });
    await tg("sendMessage", { chat_id: chatId, text: PREP_MSG, parse_mode: "Markdown", reply_markup: installKeyboard() });
    return;
  }

  // Default fallback
  await tg("sendMessage", { chat_id: chatId, text: "Type /start to begin or /signals for today's setups.", reply_markup: startKeyboard() });
}

async function handleCallback(chatId: number, data: string, callbackId: string) {
  await tg("answerCallbackQuery", { callback_query_id: callbackId });

  if (data === "free_plan") {
    await tg("sendMessage", { chat_id: chatId, text: DEAL, parse_mode: "Markdown", reply_markup: freePlanKeyboard() });
    return;
  }
  if (data === "how") {
    await tg("sendMessage", { chat_id: chatId, text: HOW, parse_mode: "Markdown", reply_markup: startKeyboard() });
    return;
  }
  if (data === "install") {
    await tg("sendMessage", { chat_id: chatId, text: "Get HuMi on your phone:", reply_markup: installKeyboard() });
    return;
  }
  if (data === "have_octafx") {
    await upsertLead(chatId, { conversation_state: "awaiting_octafx_id" });
    await tg("sendMessage", { chat_id: chatId, text: ASK_OCTAFX_ID, parse_mode: "Markdown" });
    return;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const update = await req.json();
    const message = update.message ?? update.edited_message;
    const callback = update.callback_query;

    if (callback) {
      const chatId = callback.message?.chat?.id;
      if (chatId) await handleCallback(chatId, callback.data, callback.id);
    } else if (message?.chat?.id && message.text) {
      await handleCommand(message.chat.id, message.text.trim(), message.from);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("telegram-webhook error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
