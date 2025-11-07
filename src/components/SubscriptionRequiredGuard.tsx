import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSubscription } from '@/hooks/useSubscription';

interface SubscriptionRequiredGuardProps {
  children: ReactNode;
}

export const SubscriptionRequiredGuard = ({ children }: SubscriptionRequiredGuardProps) => {
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading subscription status...</p>
        </div>
      </div>
    );
  }

  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="max-w-md bg-gradient-card border-border shadow-card">
          <CardHeader className="text-center">
            <Lock className="w-12 h-12 mx-auto mb-4 text-amber-500" />
            <CardTitle>Subscription Required</CardTitle>
            <CardDescription>
              Your account is pending approval or you need an active subscription to access this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {!subscription 
                  ? "Please subscribe to a plan to continue using HuMi trading platform."
                  : "Your subscription is pending admin approval. You'll receive access once approved."}
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={() => navigate('/subscription')} 
                className="w-full bg-gradient-primary"
              >
                View Subscription Plans
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/auth')} 
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
