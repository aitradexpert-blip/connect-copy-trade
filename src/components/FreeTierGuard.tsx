import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Returns a guard fn — call before any execution action on Trading Ideas /
 * Copy Trading / AI Bot. If the user is on the free tier, shows an upgrade
 * toast and routes to /subscription. Returns true if the action is allowed.
 */
export function useFreeTierGuard() {
  const { isFree } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();

  return (featureName = "this feature") => {
    if (!isFree) return true;
    toast({
      title: "Upgrade required",
      description: `${featureName} requires a paid subscription. Tap to view plans.`,
      action: (
        <Button size="sm" onClick={() => navigate("/subscription")}>
          View Plans
        </Button>
      ) as any,
    });
    return false;
  };
}

/** Slim banner shown at the top of Trading Ideas / Copy Trading / AI Bot when free. */
export function FreeTierBanner({ feature }: { feature: string }) {
  const { isFree } = useSubscription();
  const navigate = useNavigate();
  if (!isFree) return null;
  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2 text-sm">
          <Lock className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>
            <strong>Free preview</strong> — browse {feature} freely. Upgrade to execute live trades.
          </span>
        </div>
        <Button size="sm" onClick={() => navigate("/subscription")} className="flex-shrink-0">
          <Zap className="w-3.5 h-3.5 mr-1.5" />
          Upgrade
        </Button>
      </CardContent>
    </Card>
  );
}
