import AppLayout from "@/components/AppLayout";
import { TrendingUp, Globe, Smartphone, Bot, Copy, Wallet, Users, Rocket, Target, Shield, BarChart3, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  { icon: Smartphone, title: "Mobile-First", desc: "Built for traders who live on their phones. Full PWA with offline support." },
  { icon: Bot, title: "Khumo AI", desc: "Voice-activated trading assistant with South African personality and deep market knowledge." },
  { icon: Copy, title: "Copy Trading", desc: "Follow verified master traders with transparent performance tracking." },
  { icon: Wallet, title: "Crypto Wallet", desc: "Move funds between brokers in hours, not days. Under 2% fees." },
  { icon: BarChart3, title: "AI Analytics", desc: "Automated trade journaling with strategy detection and personalised insights." },
  { icon: GraduationCap, title: "Training Center", desc: "Beginner to advanced education with Khumo AI as your personal tutor." },
  { icon: Users, title: "Mentor Center", desc: "White-label apps for trading mentors with referral tracking and client management." },
  { icon: Globe, title: "Multi-Broker", desc: "Connect MT4, MT5, and Deriv accounts into one unified dashboard." },
];

const timeline = [
  { period: "Now", title: "Foundation", desc: "Live platform with 2 paying users. Multi-broker dashboard, AI assistant, copy trading, and training center." },
  { period: "6 Months", title: "Growth", desc: "100 users via lead magnets. Mentor onboarding. Content marketing campaigns." },
  { period: "1 Year", title: "Scale", desc: "B2B API connector. School partnerships for financial education. Multiple broker partnerships." },
  { period: "3 Years", title: "Pan-African", desc: "Expansion to Nigeria, Kenya, Ghana. Bank integrations. Multi-million rand platform." },
];

export default function About() {
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-10">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto">
            <TrendingUp className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">About HuMi</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Africa's Capital Management Operating System — putting institutional-grade trading tools in the pocket of every African trader.
          </p>
        </div>

        {/* Mission */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              Our Mission
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
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
            </p>
          </CardContent>
        </Card>

        {/* Features */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4">What We Build</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.map((f, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <f.icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roadmap */}
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Roadmap
          </h2>
          <div className="space-y-3">
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-4 p-4 rounded-xl bg-card border border-border">
                <div className="w-20 flex-shrink-0">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded">{t.period}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legal */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="w-4 h-4 text-primary" />
              Important Disclosure
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>HuMi is a technology platform only. We do not provide financial advice.</p>
            <p>All trading carries risk of loss. Trade at your own risk.</p>
            <p>AI signals are analysis tools, not guarantees. Always do your own research.</p>
            <p>Cross-broker transfers via crypto carry market volatility risk during the transfer window.</p>
          </CardContent>
        </Card>

        {/* Contact */}
        <div className="text-center text-sm text-muted-foreground pb-8">
          <p>partnerships@humi.app • support@humi.app</p>
          <p className="mt-1">HuMi (Pty) Ltd — South Africa</p>
        </div>
      </div>
    </AppLayout>
  );
}
