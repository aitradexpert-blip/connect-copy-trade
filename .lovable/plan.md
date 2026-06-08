## Goal

Single cohesive build pass covering 8 phases: Notice Board, Notifications, Telegram migration, POPIA consent, EFT payments, Mentor system, Broker reorder, and Telegram bot menu — reusing existing tables/components wherever possible.

---

### Phase 1 — Telegram Bot Menu (extend existing `telegram-webhook`)

Update `supabase/functions/telegram-webhook/index.ts` to add an inline keyboard with three brokers in order: OctaFX (with HUMI100 promo message), PrimeXBT, WelTrade. Each "Submit Proof" callback puts the user into an `awaiting_proof:<broker>` state (stored in a small `telegram_bot_sessions` table — new, minimal). When an image arrives, forward to `@mansamusafx` and group `+dFAS3vs7awAwOWJk` via `forwardMessage`, then reply with confirmation.

### Phase 2 — Main Dashboard Broker Reorder

Edit `src/pages/Index.tsx` (and `OctaFxPromoCard.tsx` if applicable) so the broker registration block lists OctaFX → PrimeXBT → WelTrade at the top with min-deposit labels and the HUMI100 highlight on OctaFX. Other brokers collapse into a "More Brokers" accordion. Each card gets a "Submit Proof" button opening a small dialog that uploads to existing `payment-proofs` bucket and calls a new edge function `submit-broker-proof` that pushes a Telegram message to `@mansamusafx`.

### Phase 3 — WhatsApp → Telegram Migration

Replace links in the 7 known files (`WhatsAppButton.tsx`, `Subscription.tsx`, `useSubscription.tsx`, `Pricing.tsx`, `Index.tsx`, `Install.tsx`, `About.tsx`) and `Auth.tsx`. 

- Support/group link: `https://t.me/+dFAS3vs7awAwOWJk`
- Personal/download link on Sign-in/Sign-up CTA: `https://t.me/mansamusafx` ("Download HuMi App")
Rename `WhatsAppButton.tsx` usage to a new `TelegramButton.tsx` (keep WhatsApp file as deprecated shim re-exporting Telegram button to avoid breaking imports).

### Phase 4 — Payment Migration (remove Yoco)

- Replace Yoco UI in `Subscription.tsx` / `Pricing.tsx` with a static Capitec banking-details card (Acc 1609645411, Branch 470010) + "Upload Proof of Payment" button + "Contact Support on Telegram" button.
- Reuse existing `payment_proofs` table and `payment-proofs` storage bucket. Add columns if missing (e.g. `reference`, `telegram_forwarded_at`) — already has user_id/plan/amount/image_url/status.
- New edge function `submit-payment-proof` uploads file, inserts row, forwards image+caption to `@mansamusafx` via Telegram Bot gateway.
- Delete (or leave dormant) `create-yoco-checkout`, `create-guest-checkout`, `yoco-webhook` — remove all frontend calls. Keep secrets untouched.

### Phase 5 — POPIA Consent

- New table `user_consents` (user_id, consent_type, version, accepted_at) — reused for all checkpoints. Extend existing `user_settings` only if simpler — but separate table is cleaner for audit.
- New static pages `/terms` and `/privacy` with POPIA-compliant text (South African data-protection language, mediator disclaimer per memory).
- Add mandatory checkbox + link on: Sign-up (`Auth.tsx`), Copy Trading activation (`CopyTradingNew.tsx`), AI Bot activation (`AIAutoTrading.tsx`), Trade Ideas execution (`TradingIdeas.tsx`), Payment submission.
- Block submit until checked; insert one row per acceptance.

### Phase 6 — Mentor System & Execution

- Insert a `user_roles` row (`role='mentor'`) for `mphoforex5@gmail.com` via insert tool.
- Ensure `mentor_profiles` row exists & `is_active=true` for that user (idempotent insert).
- Verify the existing `enforce_master_user_id` trigger + `subscription_mentor_id` column on `ai_bot_assignments` (already added in earlier migration) — no new schema.
- Audit `CopyTradingNew.tsx` activation flow: when follower clicks "Follow", ensure the call uses `mentor_profiles.user_id` (not profile id) and `mentor_clients` link is created. Add explicit error toasts.
- `signalBroadcast.ts` already handles dual pathway (subscription_mentor_id) — verify and add a manual MT5 mirror trigger note (the VPS gateway already pushes manual trades via `trade_history` insert → existing `notify_trade_executed` fan-out).

### Phase 7 — Notice Board

- New table `announcements` (id, title, body, audience enum: `all|mentor_hub|mentor_center`, is_active, starts_at, ends_at, created_by). Full GRANTs + RLS (admin write via `has_role`, public read of active).
- Admin tab in `AdminPanel.tsx` → new `AnnouncementsTab.tsx` (create/edit/toggle/delete).
- New `NoticeBoard.tsx` component embedded in `Index.tsx`, `MentorHub.tsx`, `MentorCenter.tsx`, `MentorClientDashboard.tsx`.

### Phase 8 — Notification Centre Fix

- Audit `useNotifications.ts` — already filters by `user_id=eq.<auth.uid>`, so the bug is upstream. Check `notify_new_signal` trigger (correct), `notify_account_connected` (correct), `notify_trade_executed` (correct).
- The real gap: copy-trade execution path (VPS gateway / `signalBroadcast.ts`) may not insert into `trade_history` per follower → no notification fires. Patch `signalBroadcast.ts` to insert a `trade_history` row per follower execution so triggers fan out, and to insert an explicit `notifications` row when AI bot executes.
- Add RLS verification: `notifications` SELECT policy must be `auth.uid() = user_id` only.

---

### New files

- `src/components/TelegramButton.tsx`
- `src/components/NoticeBoard.tsx`
- `src/components/admin/AnnouncementsTab.tsx`
- `src/components/PopiaConsentCheckbox.tsx`
- `src/components/BrokerProofUploadDialog.tsx`
- `src/pages/Terms.tsx`, `src/pages/Privacy.tsx`
- `supabase/functions/submit-payment-proof/index.ts`
- `supabase/functions/submit-broker-proof/index.ts`

### Edited files

- Bot menu: `supabase/functions/telegram-webhook/index.ts`
- WhatsApp→Telegram: `WhatsAppButton.tsx`, `Auth.tsx`, `Index.tsx`, `Install.tsx`, `About.tsx`, `Pricing.tsx`, `Subscription.tsx`, `useSubscription.tsx`
- Consent: `Auth.tsx`, `CopyTradingNew.tsx`, `AIAutoTrading.tsx`, `TradingIdeas.tsx`, `Subscription.tsx`
- Notices: `Index.tsx`, `MentorHub.tsx`, `MentorCenter.tsx`, `MentorClientDashboard.tsx`, `AdminPanel.tsx`
- Execution fix: `services/signalBroadcast.ts`
- Routes: `App.tsx` (Terms/Privacy)

### Migrations

1. `announcements` table + GRANTs + RLS + update trigger.
2. `user_consents` table + GRANTs + RLS.
3. `telegram_bot_sessions` table (chat_id PK, state, broker, updated_at) + GRANTs.
4. Insert mentor role + ensure `mentor_profiles` for `mphoforex5@gmail.com` (via insert tool, not migration).

### Out of scope (will not touch)

- MT5 VPS gateway code (unchanged; we only adapt the client to its existing payloads).
- Existing security policies tightened in prior pass.
- Yoco secrets (left in place but unused).

### Confirmation needed before build

1. POPIA Terms/Privacy text: should I draft standard South-African POPIA text (mediator, data controller = HuMi, no financial advice) or do you have your own copy to paste? Draft it for me and use it.
2. Bank "Account Name" was left blank in your spec — what name should display? M Maphanga  
  
Important change by Phases:  
Phase 4  
Phase 7  
Phase 5  
Phase 6  
  
Then choose which one works best to save more credits