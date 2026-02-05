 import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
 import { useSubscriptionPlans, getFeatureList } from "@/hooks/useSubscriptionPlans";

interface Plan {
  name: string;
  priceUsd: number;
  priceZar: number;
  tier: string;
  features: string[];
  popular?: boolean;
}

export default function Pricing() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [email, setEmail] = useState("");
   const { plans: dbPlans, loading: plansLoading } = useSubscriptionPlans();
 
   const plans: Plan[] = useMemo(() => {
     if (dbPlans.length === 0) return [];
     return dbPlans.map(plan => ({
       name: plan.name.charAt(0).toUpperCase() + plan.name.slice(1),
       priceUsd: plan.price_usd,
       priceZar: plan.price_zar,
       tier: plan.name.toLowerCase(),
       features: getFeatureList(plan),
       popular: plan.name.toLowerCase() === 'professional',
     }));
   }, [dbPlans]);

  const handleSubscribe = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowEmailDialog(true);
  };

  const handlePayment = async () => {
    if (!email || !selectedPlan) {
      toast({ title: "Please enter your email", variant: "destructive" });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Please enter a valid email", variant: "destructive" });
      return;
    }

    setLoading(selectedPlan.tier);
    setShowEmailDialog(false);

    try {
      // Store the selected plan in sessionStorage for after registration
      sessionStorage.setItem('pending_subscription', JSON.stringify({
        plan: selectedPlan.tier,
        email: email,
        timestamp: Date.now()
      }));

      // Create guest checkout
      const { data, error } = await supabase.functions.invoke('create-guest-checkout', {
        body: {
          tier: selectedPlan.tier,
          email: email,
          successUrl: `${window.location.origin}/auth?plan=${selectedPlan.tier}&payment_success=true&email=${encodeURIComponent(email)}`,
          cancelUrl: `${window.location.origin}/pricing?cancelled=true`,
        }
      });

      if (error) throw error;

      if (data?.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else {
        throw new Error('No redirect URL received');
      }
    } catch (error: any) {
      console.error('[Pricing] Checkout error:', error);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to create checkout session. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(null);
    }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const paymentCancelled = urlParams.get('cancelled') === 'true';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">HuMi</span>
          </div>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            Sign In
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Trading Platform
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            Choose Your Trading Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Subscribe first, then create your account. Your subscription will be automatically activated.
          </p>
        </div>

        {/* Status Messages */}
        {paymentCancelled && (
          <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4 text-center max-w-md mx-auto">
            <h3 className="text-amber-500 font-semibold">Payment Cancelled</h3>
            <p className="text-sm text-muted-foreground">You can try again whenever you're ready.</p>
          </div>
        )}

        {/* Pricing Cards */}
        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative bg-gradient-card border-border shadow-card transition-all hover:shadow-lg ${
                plan.popular ? 'ring-2 ring-primary scale-105 md:scale-110' : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="space-y-1">
                  <span className="text-4xl font-bold text-foreground">
                    R{plan.priceZar.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  <div className="text-sm text-muted-foreground">
                    (${plan.priceUsd.toFixed(2)} USD)
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 text-sm">
                      <Check className="w-5 h-5 text-profit flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className="w-full" 
                  size="lg"
                  variant={plan.popular ? "default" : "outline"}
                  onClick={() => handleSubscribe(plan)}
                  disabled={loading !== null}
                >
                  {loading === plan.tier ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Subscribe Now
                    </>
                  )}
                </Button>
              </CardContent>
             </Card>
            ))}
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>All payments are processed securely via Yoco.</p>
          <p>Subscriptions are billed monthly. Cancel anytime.</p>
          <p className="pt-4">
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>
              Sign in here
            </Button>
          </p>
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Your Email</DialogTitle>
            <DialogDescription>
              We'll use this email for your receipt and to activate your subscription after you register.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Selected Plan</Label>
              <p className="text-lg font-medium">
                {selectedPlan?.name} - R{selectedPlan?.priceZar.toFixed(2)}/month
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input 
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePayment()}
              />
              <p className="text-xs text-muted-foreground">
                Use the same email when you register to automatically activate your subscription.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setShowEmailDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handlePayment}
                disabled={!email || loading !== null}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Continue to Payment
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
