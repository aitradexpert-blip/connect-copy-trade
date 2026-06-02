# HuMi — Continuation Plan

Grouped into 10 work items. Each is independently shippable. Items 1–9 first; Telegram bot (item 10) last as requested.

---

## 1. Mount OctaFx Promo Card

- Add `<OctaFxPromoCard />` to:
  - `src/pages/MentorCenter.tsx` — top of dashboard, above stats
  - `src/pages/TradingAccounts.tsx` — above "Connect account" CTA
- Hide automatically once user has an `octafx_promo_claims` row with status `granted` (query on mount).

## 2. Live Market Price for Khumo Forex Sessions

- New helper `src/services/priceFeed.ts` with `getLivePrice(symbol)`:
  1. Try Deriv WS tick (`derivMarketData.subscribeTicks`) — already free/connected.
  2. Fallback: TradingView cached snapshot via existing chart cache.
  3. Final fallback: MetaAPI symbol price (5 min cache).
- `KhumoForexSessions.tsx`: fetch live price every 30s, pass `currentPrice` into Khumo prompt; clamp Entry/SL/TP to realistic offsets per symbol class (forex pips, synthetics points, crypto %).
- Same helper reused by `TradingIdeas` AI generation and Admin signal preview.

## 3. Mobile Fit — Index & MentorHub

- `src/pages/Index.tsx`: wrap top stat row in `grid-cols-2 sm:grid-cols-4`, add `overflow-x-auto` to horizontal tab/widget rows, replace fixed `min-w-[…]` with `w-full max-w-full`, ensure `KhumoForexSessions` card stacks on `<sm`.
- `src/pages/MentorHub.tsx`: same audit — tabs scroll horizontally, cards full width, break-words on long broker names.
- Verify at 375×812 via preview.

## 4. Notifications Scoping Bug (Mentor Hub seeing others')

Root cause hypothesis: `useNotifications` filter is correct, but the `notify_new_signal()` trigger inserts a row for **every profile** when `mentor_id IS NULL`. Admin "Khumo Suggestion" signals from `mphoforex5@gmail.com` now get `mentor_id` stamped via `attach_default_mentor_to_signal`, but the notify trigger fires **BEFORE** that BEFORE-INSERT trigger sets it, depending on order. Fix:

- Reorder triggers: ensure `attach_default_mentor_to_signal` is `BEFORE INSERT` and `notify_new_signal` is `AFTER INSERT`.
- In `notify_new_signal`, when `mentor_id IS NOT NULL`, only notify `mentor_clients` of that mentor (already correct).
- Add safety: skip global broadcast for signals whose author is the default mentor — they should always route via `mentor_id`.
- Also audit Realtime channel filter in `useNotifications.ts` — confirm `filter: user_id=eq.${user.id}` is applied (it is), so the bug is purely server-side row creation.

## 5. Google OAuth Sign-In

- Supabase Google provider is now configured by user.
- Update `src/pages/Auth.tsx`: add "Continue with Google" button calling `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo:` ${origin}/ `} })`.
- Ensure `handle_new_user` trigger (already idempotent) handles OAuth signups — it does.
- Add Google logo SVG; style matches existing buttons.

## 6. Training Center — Full PDF Ingestion

- Parse `Pro_Forex_Institute_Guide_1.pdf` end-to-end (already in repo).
- Break into Topics → Sub-topics → Lessons across Foundation / Intermediate / Advanced / Pro tracks.
- Migration to **replace** seeded `training_content` with the full hierarchy (~40-60 lessons) and chunk full text into `khumo_knowledge_base` for RAG.
- Add `category` field values: "Market Basics", "Technical Analysis", "Risk Management", "Psychology", "Strategies", "Pro Tools".
- `TrainingCenter.tsx`: add category accordion grouping under each difficulty tab.

## 7. Mobile App / APK — Install & Permissions

- Add `/install` page already discussed → expand it:
  - Direct APK download button (host APK in `mentor-assets` Supabase storage bucket; copy uploaded `HuMi_Mobile.apk` there).
  - "Install on Android" guide (Allow Unknown Sources, 3 steps).
  - "Install as PWA on iPhone" instructions.
- Median.co APK supports notifications via OneSignal/FCM bridge — add manifest meta `median-notifications` placeholders, document the Median dashboard step.
- Update `public/manifest.json` icons + add notification permission request on first dashboard load via existing `PWAInstallPrompt`.

## 8. Memory: Branding Policy Exception (OctaFX)

- Update `mem://branding/white-label-policy`: **OctaFX may be referenced explicitly** in promo CTAs and partner-broker contexts because it is the named affiliated broker for the free-Basic-Plan offer. All other broker brand names remain hidden.
- Update `mem://index.md` Core line accordingly.

## 9. Telegram Bot — HuMi "Path to Profit" (LAST)

- Bot already connected via standard connector.
- Set bot identity via `setMyName`, `setMyDescription`, `setMyShortDescription`, `setMyCommands` through gateway:
  - Name: "HuMi — Path to Profit"
  - About: "AI-powered trade signals & copy trading. Free with OctaFX, R179/mo otherwise."
  - Description: full HuMi pitch + WhatsApp links.
  - Commands: `/start`, `/signals`, `/plans`, `/install`, `/support`.
- New edge function `telegram-webhook` implementing the onboarding state machine:
  - `/start` → 2 inline buttons: Free Basic / How it works.
  - Free Basic → explanation + 3 buttons: Register OctaFX (affiliate link), I have an account, Pay R179 (Yoco link).
  - "I have an account" → ask for OctaFX ID → save to new `telegram_leads` table → reply with APK download link + GPS fix tip.
  - Verified flag (admin toggle) unlocks `/signals`.
- Migration: `telegram_leads` (telegram_chat_id, octafx_id, verified, plan, created_at) + admin Leads page tab in `Admin.tsx` with Verify toggle + Broadcast button.
- WhatsApp: add the channel + business URLs to `WhatsAppButton` and `/install` page.

---

## Open questions before I implement

1. **APK hosting** — OK to upload your APK to Supabase Storage (`mentor-assets/HuMi_Mobile.apk`) and serve from there? Yes this is Okay.
2. **Notification fix** — should I additionally **purge existing duplicate notifications** that mentor-hub users are currently seeing, or only fix forward? Both
3. **Training Center** — replace existing 16 seeded lessons entirely with the full PDF breakdown, or keep both and tag PDF lessons with `source: "Pro Forex Institute"`? Create new where needed but tag where needed we do not want to recreate what is already there to save credits.
4. **Telegram leads admin page** — bolt onto existing `/admin` as a new tab, or a dedicated `/admin/leads` route? existing /admin

Once you answer, I'll execute items 1–9 in one batch and item 10 (Telegram) immediately after.