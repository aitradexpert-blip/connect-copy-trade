

# Mega Feature Implementation Plan

This is a large-scale upgrade spanning 7 major feature areas. Due to scope, this plan is split into **4 implementation batches** to keep each deployment stable and testable.

---

## Batch 1: Auth Enhancements + ElevenLabs Voice + Password Management

### 1A. Google OAuth Login
- Add "Continue with Google" button to `Auth.tsx` using `supabase.auth.signInWithOAuth({ provider: 'google' })`
- **User action required**: You must configure Google OAuth in your Supabase dashboard (Authentication > Providers > Google) with your Google Cloud Console credentials
- The `handle_new_user` trigger already creates a profile on signup, so Google users will get profiles automatically

### 1B. Password Visibility Toggle
- Add eye/eye-off icon toggle to all 3 password fields in `Auth.tsx` (sign-in password, sign-up password)
- Toggle `type` between `"password"` and `"text"`

### 1C. Change Password (Settings > Security)
- Add form to `Settings.tsx` Security card with: Current Password (not needed by Supabase -- uses session), New Password, Confirm New Password
- Use `supabase.auth.updateUser({ password: newPassword })` to update
- Show success/error toast

### 1D. ElevenLabs TTS Integration
- Store API key `sk_0ae11f56b9da14b396275d6b24bf9a2d607f3a17fe59fed0` as Supabase secret `ELEVENLABS_API_KEY`
- Create Edge Function `elevenlabs-tts` that accepts `{ text, voiceId }` and returns audio stream
- Voice IDs for South African-sounding voices:
  - Female: "EXAVITQu4vr4xnSDxMaL" (Sarah - warm, clear)
  - Male: "JBFqnCBsd6RMkjVDRZzb" (George - deep, confident)
- Update `EnhancedVoiceAssistant.tsx`: replace browser `SpeechSynthesis` with ElevenLabs TTS via the edge function
- Update `Settings.tsx` voice section: replace browser voice list with Male/Female ElevenLabs selection with preview button
- Store voice preference in `user_settings` table (add `voice_preference` JSONB column)

### 1E. Speech-to-Text Transcription
- The existing browser `SpeechRecognition` API is already being used for STT -- it works well
- Enhance: when user taps mic, transcribed text fills the chat input box (instead of auto-sending), user can edit before sending
- Add visual feedback: pulsing mic icon with live transcript preview

**Files to create:**
- `supabase/functions/elevenlabs-tts/index.ts`

**Files to modify:**
- `src/pages/Auth.tsx` - Google button + password toggle
- `src/pages/Settings.tsx` - Change password + ElevenLabs voice selector
- `src/components/EnhancedVoiceAssistant.tsx` - ElevenLabs playback + STT to input box
- `supabase/config.toml` - Add elevenlabs-tts function

**Database migration:**
- Add `voice_preference` JSONB column to `user_settings`

---

## Batch 2: Mentor Center (White-Label Tier)

### 2A. Database Schema

New tables:

**`mentor_profiles`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (unique) | References auth.users |
| brand_name | text (unique) | Mentor's brand |
| referral_slug | text (unique) | Auto-generated URL slug |
| feature_renames | jsonb | `{ ai_bot_name, copy_trading_name, trading_ideas_name }` |
| logo_url | text | Optional brand logo |
| is_active | boolean | Default true |
| created_at / updated_at | timestamptz | |

**`mentor_clients`**
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| mentor_id | uuid | FK to mentor_profiles |
| client_user_id | uuid | FK to auth.users |
| registered_at | timestamptz | |
| referral_slug_used | text | Which link was used |

RLS Policies:
- Mentors can SELECT/UPDATE their own profile
- Mentors can SELECT their own clients
- Clients can SELECT their mentor's profile (for branding)
- Admins can SELECT all mentor data (read-only)

### 2B. Mentor Subscription Tier
- Add "Mentor" plan to `subscription_plans` table: R999/month
- Features: Everything in Enterprise + White-label branding, Referral system, Client management, Custom feature naming
- Update `Pricing.tsx` and `Subscription.tsx` to show Mentor tier

### 2C. Mentor Registration Flow
- New page: `src/pages/MentorCenter.tsx` - Setup wizard + dashboard
- When user with Mentor subscription visits Mentor Center:
  - If no profile: Setup wizard (brand name, feature renames, auto-generate referral link)
  - If profile exists: Dashboard showing client count, referral link with copy button, feature rename editor
- Referral link format: `https://connect-copy-trade.lovable.app/ref/{slug}`

### 2D. Referral Registration
- New route: `/ref/:slug` - Landing page showing mentor's brand, then redirects to `/auth?ref={slug}`
- On signup, if `ref` param exists, create `mentor_clients` record linking the new user to the mentor
- Client's UI reads mentor's `feature_renames` and applies them via React Context

### 2E. Admin Mentor Oversight
- New tab in `AdminPanel.tsx`: "Mentor Management"
- Shows all mentors, their client counts, feature renames, activity
- Read-only view with ability to deactivate mentors

### 2F. Navigation
- Add "Mentor Center" to sidebar and bottom nav (visible only to users with Mentor subscription)
- Add route `/mentor-center` to `App.tsx`

**Files to create:**
- `src/pages/MentorCenter.tsx`
- `src/pages/MentorReferral.tsx` (the `/ref/:slug` landing)
- `src/contexts/MentorContext.tsx` (provides feature renames to client UI)
- `src/components/admin/MentorManagementTab.tsx`

**Files to modify:**
- `src/App.tsx` - New routes
- `src/components/AppSidebar.tsx` - Mentor Center link
- `src/components/BottomNav.tsx` - Mentor Center link
- `src/pages/Pricing.tsx` - Mentor tier
- `src/pages/Subscription.tsx` - Mentor tier
- `src/pages/AdminPanel.tsx` - Mentor tab
- `src/pages/Auth.tsx` - Handle referral param

---

## Batch 3: GPT-5 Powered Khumo + AI Journaling

### 3A. Enhanced Khumo with Lovable GPT-5
- The voice assistant already uses Lovable AI Gateway (`google/gemini-2.5-flash`)
- Upgrade to `google/gemini-3-flash-preview` (the default recommended model)
- Enhance the system prompt with the Khumo persona: South African-infused language, Root System methodology, grit and confidence
- Add trade history context: fetch user's recent trades and feed them into the prompt for personalised analysis
- Add trading style detection: analyse win rate, preferred instruments, session times

### 3B. Chat History Persistence
- New table: `chat_history`
  - id, user_id, role (user/assistant), content, metadata (jsonb), created_at
- Store all Khumo conversations for context continuity
- Load last 30 messages as conversation context when user opens assistant

### 3C. Journaling Page
- New page: `src/pages/Journal.tsx`
- **Auto-Generated Journal tab**: Timeline of all trades from `trade_history` table, with AI analysis per trade
- **Strategy Builder tab**: Interactive form for user inputs (instruments, risk tolerance, time availability, goals) that generates a personalised trading plan via GPT-5
- Edge function `journal-analyze-trade` that takes trade data and returns AI analysis

### 3D. Trade Analysis
- New table: `trade_analysis`
  - id, user_id, trade_id (FK to trade_history), ai_analysis (text), strategy_detected (text), created_at
- When user opens Journal, auto-analyse recent un-analysed trades
- Show statistics: win rate, average RR, max drawdown, most traded pairs, best session

**Files to create:**
- `src/pages/Journal.tsx`
- `supabase/functions/journal-analyze-trade/index.ts`
- `supabase/functions/khumo-chat/index.ts` (enhanced GPT-5 chat with history)

**Files to modify:**
- `supabase/functions/voice-ai-assistant/index.ts` - Upgrade model + enhanced prompt
- `src/components/EnhancedVoiceAssistant.tsx` - Persist chat history
- `src/App.tsx` - Journal route
- `src/components/AppSidebar.tsx` - Journal link
- `src/components/BottomNav.tsx` - Journal link
- `supabase/config.toml` - New functions

---

## Batch 4: Training Center

### 4A. Database Schema
- New table: `training_content`
  - id, title, description, type (lesson/video/book/pdf/tool), url, content_text, difficulty (beginner/intermediate/advanced), tags (text[]), category, order_index, created_at

- New table: `user_training_progress`
  - id, user_id, content_id, completed (boolean), completed_at, notes

### 4B. Training Center Page
- New page: `src/pages/TrainingCenter.tsx`
- **Learning Paths**: Beginner / Intermediate / Advanced tabs
- Pre-populated content:
  - Beginner: BabyPips fundamentals, candlestick patterns, support/resistance basics
  - Intermediate: Fibonacci, supply & demand, ICT concepts, risk management
  - Advanced: Beat the Market Maker (Steve Mauro), FVG/SMC, algorithmic concepts
- Each lesson card shows: title, difficulty badge, type icon, completion status
- Embedded YouTube videos (curated), book recommendations, PDF downloads
- Khumo AI chat widget available on the page for Q&A about lesson content

### 4C. Personalised Recommendations
- Based on Journal analysis (trading style, weaknesses), Khumo recommends specific lessons
- E.g., "You cut winners short -- here's a lesson on trailing stops"

### 4D. Content Seeding
- Pre-populate `training_content` with 20-30 curated entries covering major trading strategies
- Include YouTube video links, book titles, and lesson summaries

**Files to create:**
- `src/pages/TrainingCenter.tsx`

**Files to modify:**
- `src/App.tsx` - Training Center route
- `src/components/AppSidebar.tsx` - Training Center link
- `src/components/BottomNav.tsx` - Training Center link
- `supabase/config.toml` - Any new functions

---

## Database Migrations Summary

```text
Migration 1 (Batch 1):
  - ALTER TABLE user_settings ADD COLUMN voice_preference JSONB

Migration 2 (Batch 2):
  - CREATE TABLE mentor_profiles (...)
  - CREATE TABLE mentor_clients (...)
  - INSERT INTO subscription_plans (Mentor tier at R999)
  - RLS policies for mentor tables

Migration 3 (Batch 3):
  - CREATE TABLE chat_history (...)
  - CREATE TABLE trade_analysis (...)
  - RLS policies

Migration 4 (Batch 4):
  - CREATE TABLE training_content (...)
  - CREATE TABLE user_training_progress (...)
  - INSERT training content seed data
  - RLS policies
```

---

## Edge Functions Summary

| Function | Purpose |
|----------|---------|
| `elevenlabs-tts` | Text-to-speech via ElevenLabs API |
| `khumo-chat` | Enhanced GPT-5 chat with history + trade context |
| `journal-analyze-trade` | AI analysis of individual trades |

---

## Secrets Required
- `ELEVENLABS_API_KEY` - Will be stored securely (provided by user)

---

## User Actions Required
1. **Google OAuth**: Configure Google provider in Supabase Dashboard (Authentication > Providers > Google) with Google Cloud Console OAuth credentials
2. **Site URL**: Ensure Supabase Auth redirect URLs include `https://connect-copy-trade.lovable.app`

---

## Implementation Order

1. **Batch 1** (Auth + Voice) -- Foundation improvements, immediate user impact
2. **Batch 2** (Mentor Center) -- New revenue tier + community features
3. **Batch 3** (AI Journaling) -- Intelligence layer
4. **Batch 4** (Training Center) -- Educational content hub

Each batch will be fully functional and testable after we are complete. All these should be built parallel simultaneously concurrently.
