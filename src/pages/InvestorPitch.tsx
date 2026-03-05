import { useState } from "react";
import { 
  TrendingUp, ChevronLeft, ChevronRight, Globe, Smartphone, 
  Bot, Copy, Wallet, Users, BarChart3, Shield, Rocket, 
  Target, DollarSign, Layers, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const slides = [
  {
    id: "cover",
    title: "HuMi",
    subtitle: "Africa's Capital Management Operating System",
    tagline: "Institutional-grade trading tools in every African trader's pocket.",
    icon: TrendingUp,
    bg: "from-primary/20 via-background to-background",
  },
  {
    id: "problem",
    title: "The Problem",
    subtitle: "African traders are underserved",
    points: [
      { icon: Layers, text: "Traders juggle 3–5 broker accounts with no unified view" },
      { icon: DollarSign, text: "Cross-border transfers take 3–5 days and cost 8–15% in fees" },
      { icon: Smartphone, text: "Platforms are desktop-centric — 70% of African internet is mobile" },
      { icon: Shield, text: "Signal groups are unverified — high trust deficit in retail trading" },
    ],
    bg: "from-destructive/10 via-background to-background",
  },
  {
    id: "solution",
    title: "The Solution",
    subtitle: "One OS for all your trading",
    points: [
      { icon: Globe, text: "Unified dashboard for MT4, MT5, Deriv, and crypto" },
      { icon: Zap, text: "Cross-broker transfers in hours via crypto settlement (<2% fees)" },
      { icon: Bot, text: "Khumo AI — voice-activated trading assistant with SA accent" },
      { icon: Copy, text: "Copy trading with transparent, verified performance tracking" },
    ],
    bg: "from-primary/10 via-background to-background",
  },
  {
    id: "market",
    title: "Market Opportunity",
    subtitle: "$15B+ Total Addressable Market",
    stats: [
      { value: "R40B+", label: "SA retail trading market (annually)" },
      { value: "70%", label: "Active traders using 2+ brokers" },
      { value: "8–15%", label: "Average cross-border transfer fees" },
      { value: "$15B+", label: "Total Addressable Market (Africa)" },
    ],
    bg: "from-primary/10 via-background to-background",
  },
  {
    id: "product",
    title: "Product Suite",
    subtitle: "Everything a mobile trader needs",
    features: [
      { icon: Layers, title: "Multi-Broker", desc: "MT4, MT5, Deriv in one view" },
      { icon: Bot, title: "Khumo AI", desc: "Voice assistant + AI signals" },
      { icon: Copy, title: "Copy Trading", desc: "Follow verified master traders" },
      { icon: Wallet, title: "Crypto Wallet", desc: "Instant cross-broker transfers" },
      { icon: BarChart3, title: "Analytics", desc: "AI trade journaling & insights" },
      { icon: Users, title: "Mentor Center", desc: "White-label apps for mentors" },
    ],
    bg: "from-accent/50 via-background to-background",
  },
  {
    id: "revenue",
    title: "Revenue Model",
    subtitle: "Multiple revenue streams",
    tiers: [
      { name: "Basic", price: "R99/mo", features: "10 auto-trades, 2 accounts" },
      { name: "Pro", price: "R299/mo", features: "30 auto-trades, AI bot, 5 accounts" },
      { name: "Enterprise", price: "R399/mo", features: "Unlimited, custom risk, VIP support" },
      { name: "Mentor", price: "R999/mo", features: "White-label app, client management" },
    ],
    extras: ["IB broker rebates on active trades", "Transfer fees on cross-broker movements", "B2B/White-label licensing (future)"],
    bg: "from-primary/10 via-background to-background",
  },
  {
    id: "traction",
    title: "Traction & Status",
    subtitle: "Early stage, validated product",
    metrics: [
      { value: "2", label: "Active Users" },
      { value: "R716", label: "Monthly Recurring Revenue" },
      { value: "0%", label: "Churn Rate" },
      { value: "~R36", label: "Customer Acquisition Cost" },
    ],
    note: "Product built and live. Entering growth phase with lead magnet campaigns.",
    bg: "from-accent/50 via-background to-background",
  },
  {
    id: "moat",
    title: "Competitive Moats",
    subtitle: "Why this is hard to replicate",
    points: [
      { icon: Layers, text: "18+ Edge Functions, 25+ DB tables — deep integration complexity" },
      { icon: Globe, text: "Local-first: ZAR payments, SA English AI voice, community trust" },
      { icon: BarChart3, text: "Data network effects — more users → better AI → more users" },
      { icon: Users, text: "Mentor ecosystem creates sticky B2B2C relationships" },
    ],
    bg: "from-primary/10 via-background to-background",
  },
  {
    id: "vision",
    title: "The Vision",
    subtitle: "From connector to continent-wide OS",
    timeline: [
      { period: "Now", desc: "SA mobile traders — unified dashboard + AI" },
      { period: "6 months", desc: "100 users, mentor onboarding, lead magnets" },
      { period: "1 year", desc: "B2B API connector, school partnerships" },
      { period: "3 years", desc: "Pan-African expansion, bank integrations, multi-million rand platform" },
    ],
    bg: "from-primary/20 via-background to-background",
  },
  {
    id: "ask",
    title: "The Ask",
    subtitle: "Partner with us",
    items: [
      { icon: DollarSign, title: "R20,000 Seed Capital", desc: "Marketing campaigns, API fees, content creation" },
      { icon: Users, title: "Strategic Partners", desc: "Broker partnerships, mentor networks, educational institutions" },
      { icon: Rocket, title: "Growth Advisors", desc: "FinTech expertise, African market expansion, regulatory guidance" },
    ],
    cta: "Let's build Africa's trading future together.",
    bg: "from-primary/20 via-background to-background",
  },
];

export default function InvestorPitch() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();
  const slide = slides[currentSlide];

  const next = () => setCurrentSlide((p) => Math.min(p + 1, slides.length - 1));
  const prev = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
          ← Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm">HuMi Investor Deck</span>
        </div>
        <span className="text-xs text-muted-foreground">{currentSlide + 1}/{slides.length}</span>
      </div>

      {/* Slide Content */}
      <div className={`flex-1 flex items-center justify-center p-6 md:p-12 bg-gradient-to-br ${slide.bg}`}>
        <div className="w-full max-w-4xl animate-in fade-in duration-300">
          
          {/* Cover */}
          {slide.id === "cover" && (
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <TrendingUp className="w-10 h-10 text-primary-foreground" />
              </div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-foreground">{slide.title}</h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">{slide.subtitle}</p>
              <p className="text-lg text-primary font-medium">{slide.tagline}</p>
              <div className="pt-4">
                <Button onClick={next} size="lg" className="bg-primary text-primary-foreground">
                  View Deck <ChevronRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Problem / Solution / Moat */}
          {(slide.id === "problem" || slide.id === "solution" || slide.id === "moat") && slide.points && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {slide.points.map((p, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 rounded-xl bg-card border border-border shadow-sm">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <p.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-foreground leading-relaxed">{p.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market */}
          {slide.id === "market" && slide.stats && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {slide.stats.map((s, i) => (
                  <div key={i} className="text-center p-6 rounded-xl bg-card border border-border">
                    <p className="text-3xl md:text-4xl font-black text-primary">{s.value}</p>
                    <p className="text-sm text-muted-foreground mt-2">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product */}
          {slide.id === "product" && slide.features && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {slide.features.map((f, i) => (
                  <div key={i} className="p-5 rounded-xl bg-card border border-border text-center space-y-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                      <f.icon className="w-5 h-5 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revenue */}
          {slide.id === "revenue" && slide.tiers && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {slide.tiers.map((t, i) => (
                  <div key={i} className="p-4 rounded-xl bg-card border border-border text-center space-y-2">
                    <p className="font-bold text-foreground">{t.name}</p>
                    <p className="text-xl font-black text-primary">{t.price}</p>
                    <p className="text-xs text-muted-foreground">{t.features}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {slide.extras?.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Traction */}
          {slide.id === "traction" && slide.metrics && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {slide.metrics.map((m, i) => (
                  <div key={i} className="text-center p-5 rounded-xl bg-card border border-border">
                    <p className="text-3xl font-black text-primary">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
                  </div>
                ))}
              </div>
              {slide.note && (
                <p className="text-center text-sm text-muted-foreground italic">{slide.note}</p>
              )}
            </div>
          )}

          {/* Vision */}
          {slide.id === "vision" && slide.timeline && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="space-y-4">
                {slide.timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border">
                    <div className="w-20 flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{t.period}</span>
                    </div>
                    <p className="text-foreground">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask */}
          {slide.id === "ask" && slide.items && (
            <div className="space-y-8">
              <div className="text-center">
                <h2 className="text-3xl md:text-5xl font-bold text-foreground">{slide.title}</h2>
                <p className="text-lg text-muted-foreground mt-2">{slide.subtitle}</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {slide.items.map((item, i) => (
                  <div key={i} className="p-6 rounded-xl bg-card border border-border text-center space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                      <item.icon className="w-6 h-6 text-primary" />
                    </div>
                    <p className="font-bold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
              {slide.cta && (
                <p className="text-center text-xl font-semibold text-primary">{slide.cta}</p>
              )}
              <div className="text-center">
                <p className="text-sm text-muted-foreground">partnerships@humi.app • support@humi.app</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
        <Button variant="ghost" size="sm" onClick={prev} disabled={currentSlide === 0}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <div className="flex gap-1">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentSlide ? "bg-primary" : "bg-muted-foreground/30"}`}
            />
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={next} disabled={currentSlide === slides.length - 1}>
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
