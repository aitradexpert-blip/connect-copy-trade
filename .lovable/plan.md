# Comprehensive Fix & Polish Pass

This plan addresses the 9 issues you raised, in priority order.

## 1. Trading Ideas — Full Symbol Catalog

Today `MentorCenter` and `MentorHub` use plain text inputs / a tiny built-in symbol list when posting ideas. The full catalog (170+ symbols, including `USD/ZAR`, exotics, indices, metals, synthetics, crypto, stocks) already exists in `src/config/watchlist.ts` (`COMPREHENSIVE_WATCHLIST` / `ALL_SYMBOLS`).

- Replace the symbol input in MentorCenter (idea form, quick-trade form) and MentorHub (post-idea & quick-trade) with a searchable Combobox sourced from `COMPREHENSIVE_WATCHLIST`, grouped by category (Major Forex, Minor Forex, Indices, Metals, Synthetics, Crypto, Stocks).
- Allow free-text fallback (typing a custom symbol) for brokers that have niche pairs.
- Apply same Combobox to the Admin signal-creation panel.

## 2. Mentor Center — Permission Denied / Duplicate Profile

The main account `mphoforex5@gmail.com` already has a mentor profile (`KHUMO AI COPY TRADING`, slug `apex-copy-trading-m9ef`, admin role). The "permission denied for table mentor_profiles" comes from `MentorCenter` showing the create form on slow loads and the user submitting — INSERT then collides with the existing row, surfacing as RLS denial.

- Add a unique constraint on `mentor_profiles.user_id` (one mentor profile per user).
- In `MentorCenter.loadProfile`, await with a clear loading spinner; never render the "Create profile" form until load completes.
- If a profile exists, route the user straight to the Edit view.
- Auto-create a mentor profile on first visit for any user whose subscription tier is `mentor` (or who is admin), so they never see the create form blocking them. Brand name defaults to their display name; they can edit later.
- Update the create handler to UPSERT on `user_id` (so a stale duplicate click is harmless) and surface friendlier errors.
- Confirm RLS: the existing `Mentors can insert own profile` policy with `auth.uid() = user_id` is correct — no policy change needed.

Also, since `apex-copy-trading-m9ef` is configured in `app_settings.default_mentor_slug`, every direct-signup HuMi user is already auto-linked to this main mentor via the `link_default_mentor` trigger. We will:

- Verify the trigger is currently attached (it is in code, but `db-triggers` shows none — re-attach it on `auth.users AFTER INSERT`).
- Backfill `mentor_clients` rows for any existing direct-signup users not yet linked.

## 3. Notification Deep-Links → 404

Notification rows include a `data.link` field (e.g. `/trading-ideas`, `/ai-auto-trading`) but the actual routes in `App.tsx` are `/ideas` and `/ai-trading`. Every click 404s.

- Update the 5 DB notification triggers (`notify_new_signal`, `notify_trade_executed`, `notify_bot_assignment`, `notify_subscription_change`, `notify_account_connected`) to use the correct route paths: `/ideas`, `/ai-trading`, `/journal`, `/subscription`, `/accounts`, `/copy-trading`.
- Add a small client-side route alias map in `TopHeader` and `Notifications` page so legacy `data.link` values from already-stored notifications still resolve (`/trading-ideas` → `/ideas`, `/ai-auto-trading` → `/ai-trading`, `/trading-accounts` → `/accounts`).
- For ideas/bot trades, deep-link to the specific row (`/ideas?signal=<id>`, `/journal?trade=<id>`) and have the target page scroll/highlight that item.

## 4. WhatsApp Channel (not DM)

Today every `WhatsAppButton` opens `wa.me/<number>?text=KEYWORD` (a private DM).

- Add a `mode: 'channel' | 'dm'` prop to `WhatsAppButton`.
- The 4 dashboard tools (`COMMUNITY`, `SIGNALS`, `EA`, `MENTOR`) switch to `mode="channel"` and open `https://whatsapp.com/channel/0029VaY0Klp9Gv7VhypIt61A`.
- Keep DM mode for any internal flows that genuinely need a 1:1 message (none on the dashboard right now).

## 5. Auto-Populate Trading Journal from Platform Trades

Today `trade_history` only fills via the Manual Entry dialog. Trades executed through Trading Ideas, Copy Trading, and the AI Bot go to MetaAPI/Deriv but never get written back.

- In `src/services/brokerExecution.ts` (and `derivSignalExecution.ts`, `auto-execute-signal` edge function), after a successful execution, INSERT into `trade_history` with: `user_id`, `trading_account_id`, `symbol`, `direction`, `volume`, `entry_price`, `signal_id` (when applicable), `status='open'`, `executed_at=now()`, `comment` (`'Copy trade'` / `'AI bot'` / `'Trade idea'`).
- Add a periodic sync (Journal page `useEffect` + a `metaapi-sync-history` edge function) that pulls the last 30 days of position closures from MetaAPI / Deriv and updates matching `trade_history` rows with `exit_price`, `profit_loss`, `closed_at`, `status='closed'`.
- Journal page already reads from `trade_history` — once writes happen, all features (AI analysis, P&L, strategy detection) work automatically.

## 6. Economic Calendar — Open Real News + TradingView

- Make each event row a clickable link that opens TradingView's economic calendar filtered by currency + date: `https://www.tradingview.com/economic-calendar/?currencies=<CCY>` (new tab).
- Add a "View on TradingView" button in the card header.
- For Khumo voice AI: extend `khumo-chat` and `voice-ai-assistant` edge functions with a price-lookup tool that calls TradingView quote endpoint + falls back to MetaAPI `metaapi-get-positions`/symbol price for connected accounts. When the user asks "what's the current price of XAUUSD?", Khumo fetches live and reads it back.

## 7. Read-Only Paid Features for Free Users

Free-tier users currently get blocked at the route level (`PaidRoute` redirects to `/subscription`). You want them to *see* the page and only get blocked on action.

- Replace `PaidRoute` with `ProtectedRoute` for `/ideas`, `/copy-trading`, `/ai-trading`. The pages stay accessible to free users.
- Inside each page, on every action button (Execute Trade, Connect Master, Activate Bot), check `useSubscription().isFree`. If true, instead of executing, open the existing `UpgradePrompt` dialog (used in `SubscriptionGuard`) with a contextual message and a "View Plans" CTA → `/subscription`.
- Add a thin "Free preview — upgrade to execute" banner at the top of each page when the user is free.

## 8. Training Center — Real Course Links

DB shows 20 lessons, only 8 have URLs, only 5 are advanced.

- Curate a vetted list of YouTube videos / PDFs per topic (forex basics, technical analysis, risk management, smart money concepts, ICT, Wyckoff, options, synthetic indices, MT5 usage, etc.) — published creators with stable links.
- Insert/update `training_content` rows so every lesson has a real `url`, with at least 5 lessons per difficulty (beginner / intermediate / advanced).
- Add an in-page video embed for YouTube URLs and a PDF preview iframe for PDF URLs.
- Verify each link resolves before saving (manual QA list in the migration).

## 9. End-to-End Verification & App Overview Document

- **Browser-test**: Log in as the main mentor, walk through Add Account, post Trading Idea, set up Copy Trading, activate AI Bot, click each dashboard WhatsApp tool, click each notification, open economic calendar event, complete one training lesson. Capture screenshots; report any breakage.
- **Generate `/mnt/documents/HUMI_APP_OVERVIEW.md**` — a single marketing-ready document covering: what the app does, every page (purpose, status, completeness %), mentor model, client model, monetisation, integrations (MetaAPI, Deriv, TradingView, Yoco, Bankii, ElevenLabs), what's polished, what still needs work, and recommended go-to-market positioning.
- Deliver the overview via a `presentation-artifact` link.

## Technical Details

```text
Database
├── ALTER TABLE mentor_profiles ADD CONSTRAINT mentor_profiles_user_id_key UNIQUE (user_id)
├── CREATE TRIGGER on auth.users → public.link_default_mentor (re-attach)
├── UPDATE all 5 notification trigger funcs → fix link paths
└── INSERT/UPDATE training_content (curated YouTube + PDF set)

Edge functions
├── metaapi-sync-history  (new) — closes journal trades with real P&L
├── khumo-chat            — add live-price tool
└── voice-ai-assistant    — add live-price tool

Frontend
├── src/components/SymbolCombobox.tsx  (new, reusable)
├── src/pages/MentorCenter.tsx         — UPSERT, gated render
├── src/pages/MentorHub.tsx            — symbol combobox
├── src/pages/AdminPanel.tsx           — symbol combobox in signal form
├── src/components/WhatsAppButton.tsx  — channel mode
├── src/pages/Index.tsx                — channel buttons
├── src/components/EconomicCalendar.tsx — TradingView links
├── src/pages/TradingIdeas.tsx, CopyTradingNew.tsx, AIAutoTrading.tsx
│                                      — read-only mode for free tier
├── src/pages/Journal.tsx              — auto-load synced trades
├── src/services/brokerExecution.ts    — write trade_history on execute
├── src/services/derivSignalExecution.ts — same
├── src/components/TopHeader.tsx       — notification link alias map
├── src/pages/Notifications.tsx        — same alias map + click-to-open
└── src/App.tsx                        — /ideas, /copy-trading, /ai-trading
                                         move from PaidRoute → ProtectedRoute
```

No new secrets required (all existing: METAAPI_TOKEN, ELEVENLABS_API_KEY, etc.).

## Out of Scope (Flag for Now and Implement immediately)

- Real-time sync of trades closed *outside* HuMi requires a CopyFactory webhook; we will poll every 5 min instead in this pass.
- TradingView "embedded news" requires a paid TradingView Charting Library license — we will deep-link to the public TradingView site instead.

Approve this plan and I will implement all 9 items in one pass.