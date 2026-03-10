# Free Tier Implementation Plan

## Current State

- **ProtectedRoute** requires subscription (`requireSubscription=true` by default) — free users with no `user_subscriptions` row get redirected to `/subscription`
- **useSubscription** returns `null` if no active subscription — this blocks free users from the dashboard
- **Khumo chat** Edge Function has no query limiting
- **Home page (Index.tsx)** is paid-user focused — no WhatsApp buttons, no OctaFx banner, no free-tier experience
- **Pricing page** only shows paid tiers (Basic, Professional, Enterprise from DB)
- **Journal, Training, Charts** pages exist but are behind subscription guard

## What Already Exists (No Rebuild Needed)

- Journal page with manual trade logging
- Training Center with lesson content and progress tracking
- Charts page with TradingView
- Khumo AI chat Edge Function + EnhancedVoiceAssistant component
- Notification system (useNotifications, notification service, Edge Functions)
- OctaFx affiliate link already on home page broker section
- PWA service worker registered

---

## Implementation Steps

### 1. Database: Add `khumo_queries_used` + `khumo_queries_reset_at` to `profiles`

Migration to add two columns to `profiles`:

- `khumo_queries_used` (integer, default 0)
- `khumo_queries_reset_at` (timestamptz, default now())

No new tables needed. We do NOT store tier on profiles (that's in `user_subscriptions` / `subscription_plans`).

### 2. Update `useSubscription` Hook — Support Free Tier

Modify `useSubscription` to treat "no subscription" as a valid "free" tier rather than returning `null`. Add a `tierName` derived field:

- If active subscription exists → use it (basic/professional/enterprise/mentor)
- If no subscription → `tierName = 'free'`

Add `isFree` boolean and `khumoQueriesRemaining` to returned values. This prevents the redirect to `/subscription` for free users.

### 3. Update `ProtectedRoute` — Allow Free Users

Change `ProtectedRoute` so `requireSubscription` no longer redirects users without a subscription. Instead, all authenticated users access the dashboard. Feature-gating happens at the component level.

### 4. Rewrite Home Page (`Index.tsx`) — Free-Tier Aware

Restructure the dashboard to show different content based on tier:

**For ALL users (including free):**

- Welcome banner with user's name
- WhatsApp tool buttons section (4 buttons: Community, Signals, EA, Mentorship) — each opens `https://wa.me/27658323910?text=KEYWORD`
- OctaFx banner with affiliate link and "Get 100% Free Trading Credit on Deposit" CTA
- Feature cards: Journal, Training Center, Charts, Khumo AI (with usage counter for free users)
- Market Charts quick access (already exists)

**For paid users only (additionally):**

- Metrics grid (balance, equity, P&L, positions)
- Broker operations, quick actions, crypto wallet, trade history
- Full Khumo AI voice assistant

**For free users:**

- Demo metrics with "Connect a broker to see live data" prompt, also include this on the trading journal page and other relevant pages.
- Upgrade cards showing what paid tiers unlock

### 5. Create `WhatsAppButton` Component

Reusable component accepting `keyword`, `label`, `description`, and `icon`. Generates `https://wa.me/27658323910?text={keyword}` link. Used on home page and potentially about/pricing pages.

### 6. Create `OctaFxBanner` Component

Prominent banner component with:

- Headline: "Get 100% Free Trading Bonus"
- Subtext: "100% Deposit Bonus when you open an account with OctaFx"
- CTA button linking to `https://octa.click/b3gtWBN3fii?ib=44960573` (opens new tab)
- Dismissible (stores dismissed state in localStorage)

### 7. Update Khumo Chat Edge Function — Query Limiting

Modify `khumo-chat/index.ts`:

1. Fetch user's subscription tier
2. Fetch `khumo_queries_used` and `khumo_queries_reset_at` from `profiles`
3. If reset_at is older than 30 days, reset counter to 0
4. If free tier and queries >= 5, return upgrade prompt instead of AI response
5. If free tier and queries < 5, increment counter after successful response
6. Basic/paid tiers: 50/unlimited based on tier

### 8. Update Pricing Page — Add Free Tier Column

Add a "Free" column (R0/mo) to the pricing comparison on `/pricing` with all included free features checked. Show a "Get Started Free" button that navigates to `/auth`. Restructure from card layout to a comparison table for clarity.

### 9. Update Subscription Page — Show Free Tier

Update `/subscription` page to show current plan including "Free" and what upgrading unlocks.

### 10. Route Access Updates

Make these routes accessible without subscription (remove `requireSubscription` or set to `false`):

- `/` (home) — free-tier aware dashboard
- `/journal` — manual logging for free, AI analysis gated
- `/training` — full access for free
- `/charts` — full access for free
- `/notifications` — full access

Keep subscription required for:

- `/copy-trading`, `/ai-trading`, `/accounts`, `/wallet`, `/analytics`, `/credits, /ideas (free signals are only obtained through our WhatsApp Community)`

### 11. Update Journal Page — Gate AI Features

Journal already exists. For free users:

- Manual trade logging works as-is
- "AI Analysis" button checks tier and shows upgrade prompt for free users (3 uses for free users)
- Strategy Builder checks tier (3 uses for free users)

### 12. Notification Settings Enhancement

Add a notification preferences section to Settings page (partially exists). Ensure free users get limited notifications (new signals, system alerts) while paid users get trade-related notifications.

---

## Files to Create

- `src/components/WhatsAppButton.tsx`
- `src/components/OctaFxBanner.tsx`

## Files to Modify

- `supabase/migrations/` — new migration for profiles columns
- `src/hooks/useSubscription.tsx` — free tier support
- `src/App.tsx` — route access changes
- `src/pages/Index.tsx` — major rewrite for free-tier dashboard
- `src/pages/Pricing.tsx` — add free tier column + comparison table
- `src/pages/Subscription.tsx` — show free tier
- `src/pages/Journal.tsx` — gate AI features by tier
- `supabase/functions/khumo-chat/index.ts` — query limiting
- `src/components/EnhancedVoiceAssistant.tsx` — show query counter for free users

## Technical Notes

- WhatsApp auto-replies are configured outside the app (in WhatsApp Business Manager) — the app only generates the correct `wa.me` links
- No new Edge Functions needed
- No new tables needed — reuse existing `profiles` with 2 new columns