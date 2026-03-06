import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, Globe, Smartphone, Bot, Copy, Wallet, Users, Rocket, Target, Shield,
  BarChart3, GraduationCap, ArrowRight, Zap, CheckCircle2, CreditCard, BookOpen,
  Mic, RefreshCw, Bell, LineChart, Lock, Layers, ArrowLeftRight, Sparkles, Info
} from "lucide-react";

const coreFeatures = [
  {
    icon: Smartphone,
    title: "Mobile-First Trading Dashboard",
    desc: "HuMi is built from the ground up for mobile traders. The full Progressive Web App (PWA) gives you push notifications, offline access, and an app-like experience without needing to download from an app store. Every screen, button, and chart is optimised for thumb-friendly navigation on any device — Android, iOS, tablet, or desktop.",
  },
  {
    icon: Globe,
    title: "Multi-Broker Orchestration",
    desc: "Connect your MT4, MT5, and Deriv accounts into a single unified dashboard. See all your balances, open positions, trade history, and equity across every broker in one place. No more switching between five different apps. HuMi uses MetaAPI to bridge MT4/MT5 and Deriv's WebSocket API for synthetic indices.",
  },
  {
    icon: Bot,
    title: "Khumo AI Assistant",
    desc: "Khumo is your personal AI trading assistant with a South African personality. Ask Khumo about market conditions, get trade recommendations, or execute trades using your voice. Powered by GPT-5 for intelligence and ElevenLabs for natural-sounding South African voice responses. Khumo analyses market data, your trade history, and current positions to give you personalised advice.",
  },
  {
    icon: Copy,
    title: "Copy Trading System",
    desc: "Follow and automatically copy verified master traders in real time. HuMi integrates MetaAPI CopyFactory for MT4/MT5 accounts and Deriv's native copy trading for synthetic indices. View transparent performance stats — win rate, total P&L, drawdown, and number of followers — before you decide to copy. Trades are mirrored within milliseconds via Supabase Edge Functions.",
  },
  {
    icon: Zap,
    title: "AI Auto-Trading Bot",
    desc: "Activate the AI trading bot to automatically execute signals on your connected accounts. The bot analyses market conditions, generates signals with entry, stop loss, and take profit levels, and executes trades without you lifting a finger. You control the risk parameters — lot size, maximum trades per day, and which accounts to trade on.",
  },
  {
    icon: Wallet,
    title: "Cross-Broker Capital Mobility",
    desc: "Move funds between brokers in hours instead of days. Traditional bank wires take 3–5 days and cost 5–10% in fees. HuMi's Capital Mobility Engine uses crypto settlement via Bankii wallet integration to transfer funds at under 2% fees. The multi-step orchestration handles withdrawal → crypto conversion → deposit automatically, with real-time status tracking.",
  },
  {
    icon: BarChart3,
    title: "AI-Powered Trade Journal & Analytics",
    desc: "Every trade is automatically logged with entry, exit, P&L, holding time, and market conditions. The AI analyses your trading patterns to detect strategies, identify weaknesses, and provide personalised recommendations. See your win rate by day of week, best and worst currency pairs, average risk-reward ratio, and streaks — all generated automatically.",
  },
  {
    icon: GraduationCap,
    title: "Training Center",
    desc: "A structured learning path from absolute beginner to advanced trader. Topics include: What is Forex, Technical Analysis, Candlestick Patterns, Risk Management, Trading Psychology, and Algorithmic Trading. Content is delivered via text lessons, video tutorials, and interactive quizzes. Khumo AI is integrated as your personal tutor — ask questions about any lesson.",
  },
  {
    icon: Users,
    title: "Mentor Center (White-Label)",
    desc: "Trading mentors get their own white-label sub-app within HuMi. Customise your brand name, rename features to match your teaching methodology, generate unique referral links, and track which students signed up through you. View client lists, monitor student progress, and earn revenue share from your students' subscriptions.",
  },
  {
    icon: LineChart,
    title: "Live Market Charts",
    desc: "Full TradingView-powered charts with technical indicators, drawing tools, and multiple timeframes. View charts for forex pairs, crypto, indices, and Deriv synthetic instruments. Charts support candlestick, line, area, and bar chart types with zoom, pan, and crosshair tools.",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications",
    desc: "Get instant push notifications for new trading signals, executed trades, copy trade activity, account balance changes, and system alerts. Notifications are delivered in-app, via push (PWA), and can be configured per notification type in your settings.",
  },
  {
    icon: ArrowLeftRight,
    title: "One-Click Signal Execution",
    desc: "When a trading signal appears, tap once to execute it on any of your connected accounts. Choose your account, adjust the lot size or risk percentage with a slider, and confirm. The trade is sent to your broker in seconds. Supports market orders, pending orders, and includes automatic stop loss and take profit placement.",
  },
];

const userJourneySteps = [
  {
    step: 1,
    title: "Choose a Plan & Subscribe",
    desc: "Visit the Pricing page, select a plan (Basic at R178/mo, Professional at R538/mo, or Enterprise at R718/mo), enter your email, and pay securely via Yoco. Your subscription is recorded and linked to your email.",
    icon: CreditCard,
  },
  {
    step: 2,
    title: "Create Your Account",
    desc: "After payment, you're redirected to the registration page. Sign up using the same email you paid with — your subscription is automatically activated. You can also sign up with Google OAuth for faster onboarding.",
    icon: Lock,
  },
  {
    step: 3,
    title: "Connect Your Broker Accounts",
    desc: "Go to Trading Accounts and connect your existing broker accounts. For Deriv: one-click OAuth login. For MT4/MT5: enter your login credentials, server name, and platform type — MetaAPI provisions and bridges your account automatically. You can connect multiple accounts.",
    icon: Layers,
  },
  {
    step: 4,
    title: "Explore Your Unified Dashboard",
    desc: "Your home screen shows all connected account balances, total equity, today's P&L, and recent trades — all in one view. You'll see quick action buttons for deposits, withdrawals, and navigation to every feature.",
    icon: BarChart3,
  },
  {
    step: 5,
    title: "Start Trading",
    desc: "Execute signals from the Ideas page, activate the AI bot from the AI Trading page, follow a master trader on Copy Trading, or ask Khumo for market analysis. Every trade is logged automatically in your Journal for AI-powered analysis.",
    icon: TrendingUp,
  },
  {
    step: 6,
    title: "Learn & Grow",
    desc: "Visit the Training Center to learn from structured lessons. Ask Khumo AI to explain any concept. Review your Journal analytics to understand your strengths and weaknesses. Follow mentors for guided learning paths.",
    icon: GraduationCap,
  },
];

const howItWorks = [
  {
    title: "Broker Integration Layer",
    desc: "HuMi connects to your brokers through secure APIs. For MT4/MT5 brokers, we use MetaAPI — a cloud bridge that provisions a connection to your trading server. For Deriv, we use their official WebSocket API with OAuth authentication. HuMi never stores your broker passwords; all authentication is handled through the broker's own secure systems.",
  },
  {
    title: "AI Signal Pipeline",
    desc: "Khumo AI analyses market data using technical indicators (moving averages, support/resistance, Fair Value Gaps, ICT methodology) and generates trading signals. Each signal includes: currency pair, direction (BUY/SELL), entry price, stop loss, take profit, lot size, and a written rationale. Signals are filtered for quality before being published.",
  },
  {
    title: "Trade Execution Flow",
    desc: "When you tap 'Execute' on a signal, HuMi sends the trade parameters to a Supabase Edge Function. The Edge Function authenticates with your broker (via MetaAPI or Deriv API), places the trade, and returns confirmation with the trade ID, execution price, and timestamp. The entire process takes 1–3 seconds.",
  },
  {
    title: "Copy Trading Engine",
    desc: "Master traders create strategies via MetaAPI CopyFactory. When a master places a trade, it's instantly replicated to all follower accounts. The copy engine handles lot size scaling (proportional to follower balance), risk management (max position size), and synchronisation. For Deriv, the platform uses native copy trading tokens.",
  },
  {
    title: "Capital Transfer Orchestrator",
    desc: "Cross-broker transfers follow a multi-step state machine: (1) Initiate withdrawal from source broker, (2) Convert to crypto via Bankii wallet, (3) Send crypto to destination broker's deposit address, (4) Confirm deposit. Each step has real-time status tracking, estimated completion times, and error handling with automatic retries.",
  },
  {
    title: "Real-Time Data Sync",
    desc: "Account balances, positions, and trade history are synced in real-time using Supabase Realtime subscriptions and WebSocket connections. Deriv data streams live via their WebSocket API. MT4/MT5 data is polled via MetaAPI at regular intervals. All data is stored in a PostgreSQL database with Row-Level Security ensuring users only see their own data.",
  },
];

const subscriptionTiers = [
  {
    name: "Basic",
    price: "R178",
    features: [
      "10 auto-trades per month",
      "2 trading accounts",
      "1 copy trading connection",
      "Basic analytics dashboard",
      "Email support (48h response)",
      "Training Center access",
      "Khumo AI chat",
    ],
  },
  {
    name: "Professional",
    price: "R538",
    popular: true,
    features: [
      "30 auto-trades per month",
      "5 trading accounts",
      "3 copy trading connections",
      "AI Bot access",
      "Advanced analytics & journal",
      "Priority chat support",
      "Full Training Center",
      "Market alerts & signals",
    ],
  },
  {
    name: "Enterprise",
    price: "R718",
    features: [
      "Unlimited auto-trades",
      "10 trading accounts",
      "5 copy trading connections",
      "AI Bot with custom risk settings",
      "Full analytics suite",
      "24/7 VIP support",
      "Dedicated account manager",
      "API access",
    ],
  },
];

const techStack = [
  { label: "Frontend", value: "React 18, TypeScript, Tailwind CSS, Vite (PWA)" },
  { label: "Backend", value: "Supabase — PostgreSQL, Auth, Edge Functions, Realtime" },
  { label: "Broker APIs", value: "MetaAPI (MT4/MT5 bridge), Deriv WebSocket API" },
  { label: "AI Engine", value: "OpenAI GPT-5 (Khumo intelligence), ElevenLabs (SA voice)" },
  { label: "Payments", value: "Yoco (ZAR), Bankii (crypto wallet & transfers)" },
  { label: "Copy Trading", value: "MetaAPI CopyFactory, Deriv native copy trading" },
  { label: "Database", value: "20+ tables with Row-Level Security, real-time subscriptions" },
  { label: "Edge Functions", value: "18+ serverless functions for trade execution, AI, payments" },
];

export default function About() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Sticky Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">HuMi</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/pricing")}>
              View Pricing
            </Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-16">
        {/* Hero */}
        <section className="text-center space-y-6">
          <Badge variant="secondary" className="text-sm">Africa's Capital Management Operating System</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
            Professional Trading Tools<br className="hidden md:block" /> in the Palm of Your Hand
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            HuMi is a mobile-first trading platform that connects all your broker accounts — MT4, MT5, and Deriv — into one unified dashboard. 
            Get AI-powered signals, copy top traders, automate your trades, move funds between brokers in hours, and learn from structured training — all from your phone.
          </p>
          <p className="text-base text-muted-foreground max-w-2xl mx-auto">
            We are <strong className="text-foreground">not a broker</strong>. We are a technology connector. 
            Your funds stay with your broker. HuMi provides the tools, intelligence, and unified experience that no single broker offers alone.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button size="lg" onClick={() => navigate("/pricing")}>
              <CreditCard className="w-4 h-4 mr-2" />
              Get Started
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/pitch")}>
              <Sparkles className="w-4 h-4 mr-2" />
              Investor Pitch
            </Button>
          </div>
        </section>

        {/* The Problem We Solve */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">The Problem We Solve</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { problem: "Traders juggle 3–5 broker apps", solution: "One unified dashboard for MT4, MT5, Deriv, and crypto" },
              { problem: "Cross-border transfers take 3–5 days and cost 8–15%", solution: "Move funds between brokers in hours at under 2% via crypto rails" },
              { problem: "No unified analytics, no AI guidance", solution: "AI-powered signals, auto-trading bot, and personalised journal insights" },
              { problem: "Mobile trading is an afterthought", solution: "Built mobile-first from day one — PWA with offline support and push notifications" },
              { problem: "Signal groups are unverified and unregulated", solution: "Transparent copy trading with real performance stats and verified track records" },
              { problem: "Expensive trading courses with no follow-up", solution: "Built-in Training Center with AI tutor and ongoing community support" },
            ].map((item, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm text-destructive font-medium">❌ {item.problem}</p>
                  <p className="text-sm text-primary font-medium">✅ {item.solution}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">How HuMi Works Under the Hood</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            HuMi sits between you and your brokers as an intelligent middleware layer. Here's what happens behind the scenes:
          </p>
          <div className="space-y-4">
            {howItWorks.map((item, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5">
                  <h3 className="font-bold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* User Journey */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">Your Journey on HuMi</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            From signup to your first profitable trade — here's the exact step-by-step flow:
          </p>
          <div className="space-y-4">
            {userJourneySteps.map((step) => (
              <div key={step.step} className="flex gap-4 p-5 rounded-xl bg-card border border-border">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">{step.step}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <step.icon className="w-4 h-4 text-primary" />
                    <h3 className="font-bold text-foreground">{step.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* All Features */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">Every Feature, Explained</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto">
            HuMi is not just a dashboard — it's a complete trading operating system. Here's everything you get:
          </p>
          <div className="space-y-4">
            {coreFeatures.map((f, i) => (
              <Card key={i} className="bg-card border-border">
                <CardContent className="p-5 flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Subscription Tiers */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {subscriptionTiers.map((tier) => (
              <Card key={tier.name} className={`bg-card border-border ${tier.popular ? 'ring-2 ring-primary' : ''}`}>
                {tier.popular && (
                  <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">Most Popular</Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle>{tier.name}</CardTitle>
                  <p className="text-3xl font-bold text-foreground">{tier.price}<span className="text-sm text-muted-foreground font-normal">/month</span></p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full mt-4" variant={tier.popular ? "default" : "outline"} onClick={() => navigate("/pricing")}>
                    Subscribe <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Technology Stack */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">Technology Stack</h2>
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {techStack.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-sm font-semibold text-primary min-w-[110px]">{item.label}:</span>
                    <span className="text-sm text-muted-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Roadmap */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center flex items-center justify-center gap-2">
            <Rocket className="w-6 h-6 text-primary" />
            Roadmap
          </h2>
          <div className="space-y-3">
            {[
              { period: "Now", title: "Foundation", desc: "Live platform with paying users. Multi-broker dashboard, Khumo AI assistant, copy trading, AI auto-trading bot, Training Center, and Mentor Center with white-label apps." },
              { period: "6 Months", title: "Growth", desc: "100 users via lead magnets and content marketing. Mentor onboarding. OctaFx partnership activation. WhatsApp-based lead nurturing. Stokvel (collective investment) pools. Local payment rails (Instant EFT, Ozow, SnapScan)." },
              { period: "1 Year", title: "Scale", desc: "B2B API connector for brokers and institutions. School partnerships for financial education programs. Multiple broker partnerships. Advanced portfolio optimization and risk scoring." },
              { period: "3 Years", title: "Pan-African Expansion", desc: "Expand to Nigeria, Kenya, Ghana. Bank integrations for direct funding. White-label licensing to prop firms and investment groups. RegTech module for automated FSCA compliance reporting. Multi-million rand platform." },
            ].map((t, i) => (
              <div key={i} className="flex gap-4 p-5 rounded-xl bg-card border border-border">
                <div className="flex-shrink-0">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-0 font-bold">{t.period}</Badge>
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{t.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Our Mission */}
        <section className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Our Mission
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-muted-foreground leading-relaxed">
              <p>
                HuMi was born from frustration. As a mobile-first South African trader, existing platforms were laptop-centric, 
                required complex EA installations, and made it nearly impossible to manage multiple broker accounts seamlessly.
              </p>
              <p>
                We built the gateway to professional trading tools on your mobile — a unified operating system that gives 
                traders the same power as desktop users, from the palm of their hand.
              </p>
              <p>
                We are <strong className="text-foreground">not a broker</strong>. We are a technology connector. Our broker partners 
                already hold the necessary licences — HuMi provides the tools, the intelligence, and the unified experience. 
                Your funds always remain with your broker; we never hold or manage client capital.
              </p>
              <p>
                Our vision is to become the primary trading operating system for mobile traders across Africa and the world — 
                integrated in schools for financial education, partnered with banks and brokers for market access, 
                and developing FinTech tools that benefit the entire African financial industry.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Market Opportunity */}
        <section className="space-y-6">
          <h2 className="text-3xl font-bold text-foreground text-center">Market Opportunity</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { stat: "R40B+", label: "SA retail trading market (annually)" },
              { stat: "70%", label: "Active traders use 2+ brokers" },
              { stat: "8–15%", label: "Current cross-border transfer fees" },
              { stat: "$15B+", label: "Total addressable market (Africa)" },
            ].map((item, i) => (
              <Card key={i} className="bg-card border-border text-center">
                <CardContent className="p-4">
                  <p className="text-2xl font-bold text-primary">{item.stat}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Legal Disclosure */}
        <section>
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="w-5 h-5 text-primary" />
                Important Disclosures & Disclaimers
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2 leading-relaxed">
              <p><strong className="text-foreground">HuMi is a technology platform only.</strong> We do not provide financial advice, investment recommendations, or portfolio management services. All content, signals, and AI-generated analysis are for informational purposes only.</p>
              <p><strong className="text-foreground">All trading carries risk of loss.</strong> You could lose some or all of your invested capital. Past performance is not indicative of future results. Trade at your own risk.</p>
              <p><strong className="text-foreground">AI signals are analysis tools, not guarantees.</strong> Khumo AI provides market analysis based on technical indicators and historical data. It does not guarantee profits. Always do your own research before executing any trade.</p>
              <p><strong className="text-foreground">Cross-broker transfers via crypto carry market volatility risk</strong> during the transfer window. The value of cryptocurrency can fluctuate between the time funds are withdrawn and deposited.</p>
              <p><strong className="text-foreground">We are not FSCA-licensed.</strong> HuMi operates as a technology connector between users and FSCA-compliant broker partners. Your broker holds the regulatory licence and manages your funds. We do not hold, manage, or have access to your trading capital.</p>
              <p><strong className="text-foreground">Broker dependency.</strong> Our features depend on broker API availability. If MetaAPI, Deriv, or any broker API experiences downtime, the affected features will be temporarily unavailable.</p>
            </CardContent>
          </Card>
        </section>

        {/* Contact & CTA */}
        <section className="text-center space-y-4 pb-12">
          <h2 className="text-2xl font-bold text-foreground">Ready to Get Started?</h2>
          <p className="text-muted-foreground">Join HuMi and take control of your trading across every broker, from one app.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" onClick={() => navigate("/pricing")}>
              <CreditCard className="w-4 h-4 mr-2" />
              View Pricing & Subscribe
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
          <div className="text-sm text-muted-foreground pt-4 space-y-1">
            <p>partnerships@humi.app • support@humi.app</p>
            <p>HuMi (Pty) Ltd — South Africa</p>
          </div>
        </section>
      </div>
    </div>
  );
}
