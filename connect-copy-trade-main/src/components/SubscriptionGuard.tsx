import { ReactNode } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGuardProps {
  feature: string;
  children: ReactNode;
  fallback?: ReactNode;
}

const UpgradePrompt = ({ feature }: { feature: string }) => {
  const navigate = useNavigate();
  
  const featureNames: Record<string, string> = {
    ai_bots: "Advanced AI Bots",
    priority_support: "Priority Support",
    custom_risk: "Custom Risk Management"
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>Upgrade Required</CardTitle>
              <CardDescription>
                Access {featureNames[feature] || feature}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This feature is available on Professional and Enterprise plans.
            Upgrade now to unlock advanced trading capabilities.
          </p>
          <Button 
            onClick={() => navigate('/subscription')} 
            className="w-full"
          >
            <Zap className="w-4 h-4 mr-2" />
            View Plans
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export const SubscriptionGuard = ({ 
  feature, 
  children, 
  fallback 
}: SubscriptionGuardProps) => {
  const { canAccessFeature, loading } = useSubscription();
  
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  
  if (!canAccessFeature(feature)) {
    return fallback || <UpgradePrompt feature={feature} />;
  }
  
  return <>{children}</>;
};
