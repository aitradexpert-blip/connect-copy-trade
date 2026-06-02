import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, ExternalLink, CheckCircle2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const NEW_USER_LINK = "https://clickto.trade/b3gtWBN3fii?ib=44960573";
const EXISTING_USER_LINK = "https://clickto.trade/b7mKraZhMSj?ib=44960573";

/**
 * Promo: 100% deposit bonus + Free Basic plan when funding $25+ via the
 * provided affiliated broker links. Records intent in octafx_promo_claims so
 * an admin can verify the deposit and grant the Basic plan.
 */
export function OctaFxPromoCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState<string | null>(null);

  const claim = async (variant: "new_user" | "existing_user") => {
    if (!user) {
      toast({ title: "Sign in first", description: "Create your HuMi account before claiming the promo." });
      return;
    }
    setClaiming(variant);
    try {
      await supabase.from("octafx_promo_claims").insert({
        user_id: user.id,
        link_variant: variant,
        status: "pending",
      });
      const url = variant === "new_user" ? NEW_USER_LINK : EXISTING_USER_LINK;
      // Append return path so user lands back on Mentor Center after broker signup
      const returnUrl = `${window.location.origin}/mentor-center?octafx_promo=1`;
      try { sessionStorage.setItem("octafx_return", returnUrl); } catch {}
      window.open(url, "_blank", "noopener,noreferrer");
      toast({
        title: "Promo claim recorded",
        description: "Open a broker account, fund $25+, then return — we'll activate your Free Basic plan.",
      });
    } catch (err: any) {
      toast({ title: "Could not record claim", description: err.message, variant: "destructive" });
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-background to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/15">
              <Gift className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                100% Deposit Bonus
                <Badge className="bg-amber-500 text-white">+ FREE Basic Plan</Badge>
              </CardTitle>
              <CardDescription>
                Open a partner broker account, fund $25+ (≈ R470), get your Basic Plan free.
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="text-sm space-y-1.5">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" /> 100% deposit bonus on first funding</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" /> Full Basic Plan unlocked after deposit verification</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-profit mt-0.5 flex-shrink-0" /> All trade ideas, copy trading, and AI tools included</li>
        </ul>
        <div className="grid sm:grid-cols-2 gap-2 pt-2">
          <Button
            onClick={() => claim("new_user")}
            disabled={claiming !== null}
            className="bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            I'm new — open account
            <ExternalLink className="w-3.5 h-3.5 ml-2" />
          </Button>
          <Button
            onClick={() => claim("existing_user")}
            disabled={claiming !== null}
            variant="outline"
            className="border-amber-500/40"
          >
            I have an account — switch IB
            <ExternalLink className="w-3.5 h-3.5 ml-2" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          After funding, return to your Mentor Center and add your trading account details.
          An admin will verify your deposit and activate your Basic Plan within 24 hours.
        </p>
      </CardContent>
    </Card>
  );
}
