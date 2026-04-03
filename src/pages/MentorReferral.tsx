import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, TrendingUp, Shield, Zap } from "lucide-react";

interface MentorData {
  brand_name: string;
  landing_page_media_url: string | null;
  landing_page_media_type: string | null;
  ui_config: Record<string, string> | null;
}

export default function MentorReferral() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState<MentorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    const loadMentor = async () => {
      const { data } = await supabase
        .from('mentor_profiles')
        .select('brand_name, landing_page_media_url, landing_page_media_type, ui_config, is_active')
        .eq('referral_slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setMentor({
          brand_name: data.brand_name,
          landing_page_media_url: data.landing_page_media_url,
          landing_page_media_type: data.landing_page_media_type,
          ui_config: data.ui_config as Record<string, string> | null,
        });
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };
    loadMentor();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="text-center text-white space-y-4">
          <p className="text-xl font-bold">Invalid referral link</p>
          <p className="text-white/60">This mentor link is no longer active.</p>
          <Button onClick={() => navigate("/auth")} variant="outline" className="border-white/20 text-white hover:bg-white/10">
            Go to Sign Up
          </Button>
        </div>
      </div>
    );
  }

  const primaryColor = mentor?.ui_config?.primary_color || "#6366f1";
  const secondaryColor = mentor?.ui_config?.secondary_color || "#8b5cf6";
  const welcomeText = mentor?.ui_config?.welcome_text || "Join the trading community and access exclusive signals, copy trading, and AI-powered tools.";

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Full-screen media background */}
      {mentor?.landing_page_media_url ? (
        mentor.landing_page_media_type === 'video' ? (
          <video
            src={mentor.landing_page_media_url}
            autoPlay muted loop playsInline
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <img
            src={mentor.landing_page_media_url}
            alt={mentor.brand_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, #000)` }} />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/40" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-lg space-y-8">
          {/* Brand name */}
          <div>
            <h1
              className="text-5xl md:text-7xl font-black tracking-tight"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, #fff)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {mentor?.brand_name}
            </h1>
            <p className="text-white/70 text-lg mt-4 leading-relaxed">{welcomeText}</p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: TrendingUp, label: "Trading Signals" },
              { icon: Zap, label: "Copy Trading" },
              { icon: Shield, label: "AI Bot" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-center">
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${primaryColor}30` }}>
                  <Icon className="w-6 h-6" style={{ color: primaryColor }} />
                </div>
                <span className="text-white/60 text-xs">{label}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full text-lg py-6 font-bold text-white border-0"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              onClick={() => navigate(`/auth?ref=${slug}`)}
            >
              Join Now <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-white/40 text-sm">
              Already have an account?{' '}
              <button onClick={() => navigate(`/auth?ref=${slug}`)} className="underline hover:text-white/60">Sign in</button>
            </p>
          </div>

          {/* Powered by */}
          <p className="text-white/20 text-xs">Powered by HuMi Trading Platform</p>
        </div>
      </div>
    </div>
  );
}
