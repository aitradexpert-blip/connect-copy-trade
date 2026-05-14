# HuMi: Africa's Capital Management Operating System

## I. Executive Summary

**HuMi** is a mobile-first Capital Management Operating System (Capital OS) for the African market. We unify fragmented trading capital, brokers, and crypto liquidity into a single, intelligent dashboard accessible from any phone.

**Core Promise:** "HuMi puts institutional-grade trading tools in the pocket of every African trader."

**What We Are:** A technology connector — not a broker. Your funds stay with your broker. We provide the tools, AI intelligence, and unified experience.

**Analogy:** If brokers are "app stores," HuMi is the "operating system" that manages them all.

---

## II. The Problem We Solve

| Problem | HuMi Solution |
|---------|---------------|
| Traders juggle 3–5 broker apps | One unified dashboard for MT4, MT5, Deriv, and crypto |
| Cross-border transfers take 3–5 days at 8–15% fees | Move funds between brokers in hours at <2% via crypto rails |
| No unified analytics or AI guidance | AI-powered signals, auto-trading bot, copy trading, and personalised journal |
| Mobile trading is an afterthought | Built mobile-first from day one — full PWA with offline and push notifications |
| Signal groups are unverified | Transparent copy trading with verified performance stats |
| Expensive courses with no follow-up | Built-in Training Center with AI tutor and community |

---

## III. Core Features

### 1. Multi-Broker Orchestration
- **MetaAPI Bridge:** Connect any MT4/MT5 broker account via cloud provisioning
- **Deriv OAuth:** One-click native integration with Deriv synthetic indices
- **Unified View:** All account balances, open positions, equity, and trade history in one dashboard

### 2. Khumo AI Assistant
- **Voice-Activated:** Natural language trade execution ("Buy 0.1 lots of EURUSD")
- **Market Analysis:** Real-time market commentary, risk assessment, and trade recommendations
- **Signal Generation:** AI-analysed opportunities with entry, stop loss, take profit, and rationale
- **Auto-Execution:** AI bot executes signals on connected accounts with user-defined risk parameters
- **Powered By:** OpenAI GPT-5 (intelligence) + ElevenLabs (South African voice)

### 3. Copy Trading System
- **MetaAPI CopyFactory:** Create and subscribe to MT4/MT5 master strategies
- **Deriv Native:** Copy trading for synthetic indices
- **Real-Time Mirroring:** Trades copied within milliseconds via Edge Functions
- **Transparent Stats:** Win rate, total P&L, drawdown, and follower count for every master

### 4. Capital Mobility Engine
- **Cross-Broker Transfers:** Move funds between brokers via Bankii crypto settlement
- **Multi-Step Orchestration:** Automated withdrawal → crypto conversion → deposit flow
- **Real-Time Tracking:** Live progress updates, estimated completion, and error handling
- **Cost:** Under 2% vs traditional 8–15% bank wire fees

### 5. AI-Powered Trade Journal & Analytics
- **Automatic Logging:** Every trade recorded with entry, exit, P&L, holding time
- **AI Analysis:** Strategy detection, pattern recognition, personalised recommendations
- **Insights:** Win rate by day, best/worst pairs, risk-reward analysis, streaks

### 6. Training Center
- **Structured Learning:** Beginner to advanced topics (forex basics, technical analysis, psychology)
- **Content Types:** Text lessons, video tutorials, quizzes
- **AI Tutor:** Khumo integrated — ask questions about any lesson
- **Progress Tracking:** Track completed lessons, notes, and achievements

### 7. Mentor Center (White-Label)
- **Brand Customisation:** Custom brand name, feature renaming, logo
- **Referral System:** Unique links with signup attribution and tracking
- **Client Management:** View student lists, monitor progress
- **Revenue Share:** Earn from students' subscriptions

### 8. Live Market Charts
- **TradingView-Powered:** Full charting with indicators, drawing tools, multiple timeframes
- **Instruments:** Forex pairs, crypto, indices, Deriv synthetic instruments
- **Chart Types:** Candlestick, line, area, bar with zoom, pan, crosshair

### 9. One-Click Signal Execution
- **Tap to Trade:** Select account, adjust lot size/risk, confirm — trade placed in seconds
- **Risk Slider:** Visual risk percentage control with lot size calculation
- **Order Types:** Market orders, pending orders, automatic SL/TP placement

### 10. Real-Time Notifications
- **Push Notifications:** New signals, executed trades, copy activity, balance changes
- **In-App Alerts:** System notifications with configurable preferences
- **PWA Support:** Works like a native app notification system

---

## IV. User Journey

1. **Subscribe:** Choose a plan on the Pricing page, pay via Yoco
2. **Register:** Create account with same email — subscription auto-activates
3. **Connect Brokers:** Deriv (OAuth) or MT4/MT5 (login credentials via MetaAPI)
4. **Dashboard:** View all accounts, balances, positions, P&L in one place
5. **Trade:** Execute signals, activate AI bot, copy traders, or ask Khumo
6. **Learn:** Training Center lessons with AI tutor, journal analytics

---

## V. Technical Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite (PWA) |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Realtime) |
| Broker Integration | MetaAPI (MT4/MT5), Deriv WebSocket API |
| Crypto/Payments | Bankii wallet integration, Yoco payment gateway |
| AI | OpenAI GPT-5 (Khumo), ElevenLabs (SA voice) |
| Copy Trading | MetaAPI CopyFactory, Deriv native copy trading |
| Database | 20+ tables with Row-Level Security |
| Edge Functions | 18+ serverless functions (trade execution, AI, payments) |

### Edge Functions (18+)
- `voice-ai-assistant` — Khumo NLP processing
- `metaapi-execute-trade` — MT4/MT5 trade execution
- `deriv-execute-signal` — Deriv trade execution
- `auto-execute-signal` — AI bot automation
- `copyfactory-create-strategy` — Master strategy creation
- `copyfactory-subscribe` — Follower subscription
- `create-yoco-checkout` / `yoco-webhook` — Payment processing
- `metaapi-provision-account` — Account provisioning
- `metaapi-account-info` / `metaapi-get-positions` / `metaapi-get-history` — Account data
- `journal-analyze-trade` — AI trade analysis
- `khumo-chat` — Chat interface
- `elevenlabs-tts` — Text-to-speech
- `bankii-api` — Crypto wallet operations
- `deriv-copy-bridge` — Copy trading bridge

---

## VI. Subscription Tiers

| Feature | Basic (R178/mo) | Professional (R538/mo) | Enterprise (R718/mo) |
|---------|-----------------|------------------------|----------------------|
| Auto-trades/month | 10 | 30 | Unlimited |
| Trading accounts | 2 | 5 | 10 |
| Copy trading connections | 1 | 3 | 5 |
| AI Bot access | ❌ | ✅ | ✅ |
| Custom risk settings | ❌ | ❌ | ✅ |
| Support | Email (48h) | Priority chat | 24/7 VIP |
| Analytics | Basic | Advanced | Full suite |
| Dedicated manager | ❌ | ❌ | ✅ |

---

## VII. Market Opportunity

- **South African retail trading market:** R40+ billion annually
- **Multi-broker usage:** 70% of active traders use 2+ brokers
- **Cross-border remittance fees:** 8–15% average → HuMi: <2% via crypto rails
- **Total Addressable Market (Africa):** $15+ billion

---

## VIII. Competitive Moats

1. **Integration Complexity:** 18+ Edge Functions, 20+ DB tables with RLS, MetaAPI CopyFactory, Deriv WebSocket, Bankii crypto — non-trivial to replicate
2. **Local Trust & Community:** First-mover in SA trading community OS, local payment rails (Yoco), FSCA-structured architecture
3. **Data Network Effects:** More users → better AI signals → more users; copy trading creates sticky relationships
4. **Mobile-First DNA:** Every feature designed for phone-first — not retrofitted from desktop

---

## IX. Roadmap

### Now — Foundation
Live platform with paying users. Multi-broker dashboard, Khumo AI, copy trading, AI auto-trading, Training Center, Mentor Center.

### 6 Months — Growth
100 users via lead magnets. Mentor onboarding. OctaFx partnership. Stokvel pools. Local payment rails (Instant EFT, Ozow, SnapScan).

### 1 Year — Scale
B2B API connector. School partnerships for financial education. Multiple broker partnerships. Advanced analytics.

### 3 Years — Pan-African
Expand to Nigeria, Kenya, Ghana. Bank integrations. White-label licensing. RegTech module. Multi-million rand platform.

---

## X. Business Model

### Revenue Streams
1. **Subscriptions:** R178/R538/R718 per month (Basic/Professional/Enterprise)
2. **Transfer Fees:** Percentage on cross-broker transfers
3. **IB Commissions:** Rebates from broker partnerships (e.g., OctaFx)
4. **Mentor Fees:** Mentor tier subscriptions
5. **B2B Licensing:** White-label solutions for institutions (future)

### Unit Economics
- **Cost per user:** ~R160–R200/month (MetaAPI, AI APIs, hosting)
- **CAC:** ~$2 per customer via social media → WhatsApp funnel
- **Break-even:** Scales with user growth; profitable from ~Professional tier

---

## XI. Honest Limitations

⚠️ **We are not a broker** — You need existing broker accounts. HuMi connects to them.

⚠️ **Learning curve** — Advanced features require platform understanding.

⚠️ **AI signals are not financial advice** — Analysis tools, not guarantees. Always DYOR.

⚠️ **Crypto transfer volatility** — Market risk exists during the transfer window.

⚠️ **Broker dependency** — Features depend on broker API availability.

⚠️ **Not FSCA-licensed** — We operate as a technology connector to licensed brokers.

---

## XII. Contact & Resources

- **Website:** [connect-copy-trade.lovable.app](https://connect-copy-trade.lovable.app)
- **About:** [/about](https://connect-copy-trade.lovable.app/about)
- **Pricing:** [/pricing](https://connect-copy-trade.lovable.app/pricing)
- **Investor Pitch:** [/pitch](https://connect-copy-trade.lovable.app/pitch)
- **API Documentation:** [/api-docs](https://connect-copy-trade.lovable.app/api-docs)
- **Partnerships:** partnerships@humi.app
- **Support:** support@humi.app
- **Entity:** HuMi (Pty) Ltd — South Africa

---

*Document Version: 2.0 | Last Updated: March 2026*
