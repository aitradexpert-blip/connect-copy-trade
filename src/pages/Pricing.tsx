import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, CreditCard, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionPlans } from "@/hooks/useSubscriptionPlans";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Plan {
  name: string;
  priceUsd: number;
  priceZar: number;
  tier: string;
  features: string[];
  popular?: boolean;
}

// Feature comparison rows
const comparisonFeatures = [
  { label: "WhatsApp Community", free: true, basic: true, pro: true, enterprise: true },
  { label: "Daily Signals (WhatsApp)", free: true, basic: true, pro: true, enterprise: true },
  { label: "Free Expert Advisor", free: true, basic: true, pro: true, enterprise: true },
  { label: "Free Mentorship", free: true, basic: true, pro: true, enterprise: true },
  { label: "Training Center", free: true, basic: true, pro: true, enterprise: true },
  { label: "Live Market Charts", free: true, basic: true, pro: true, enterprise: true },
  { label: "Mobile Dashboard", free: "Demo", basic: true, pro: true, enterprise: true },
  { label: "Khumo AI Questions", free: "5/month", basic: "50/month", pro: "Unlimited", enterprise: "Unlimited" },
  { label: "Trade Journal", free: "Manual", basic: "Auto + Basic AI", pro: "Auto + Advanced AI", enterprise: "Full Suite" },
  { label: "Multi-Broker Dashboard", free: false, basic: "2 accounts", pro: "5 accounts", enterprise: "10 accounts" },
  { label: "One-Click Signal Execution", free: false, basic: "10/mo", pro: "30/mo", enterprise: "Unlimited" },
  { label: "Khumo AI Voice Trading", free: false, basic: "Limited", pro: "Full", enterprise: "Full" },
  { label: "AI Auto-Trading Bot", free: false, basic: false, pro: true, enterprise: true },
  { label: "Copy Trading", free: false, basic: "1 conn", pro: "3 conn", enterprise: "5 conn" },
  { label: "Real-Time Notifications", free: "Limited", basic: true, pro: true, enterprise: true },
  { label: "Custom Risk Settings", free: false, basic: false, pro: false, enterprise: true },
  { label: "Dedicated Manager", free: false, basic: false, pro: false, enterprise: true },
];

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="w-5 h-5 text-profit mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
  return <span className="text-xs text-foreground">{value}</span>;
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
      features: [],
      popular: plan.name.toLowerCase() === 'professional',
    }));
  }, [dbPlans]);

  const handleSubscribe = (plan: Plan) => {
    setSelectedPlan(plan);
    setShowEmailDialog(true);
  };

  const handlePayment = async () => {
    if (!selectedPlan) return;
    if (!email) { toast({ title: "Please enter your email", variant: "destructive" }); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { toast({ title: "Please enter a valid email", variant: "destructive" }); return; }
    setLoading(selectedPlan.tier);
    try {
      // Record a pending subscription so the admin can activate it once the
      // manual EFT clears. Guest checkout — matched to the user on signup.
      const { error } = await supabase.from('pending_subscriptions').insert({
        email: email.toLowerCase().trim(),
        plan_name: selectedPlan.tier,
        amount_zar: selectedPlan.priceZar,
        status: 'awaiting_payment',
      } as any);
      if (error) throw error;
      toast({
        title: "Payment instructions saved",
        description: "Please transfer the amount to the bank details shown, then register with the same email.",
      });
      setShowEmailDialog(false);
    } catch (error: any) {
      toast({ title: "Could not record request", description: error.message, variant: "destructive" });
    } finally { setLoading(null); }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const paymentCancelled = urlParams.get('cancelled') === 'true';

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <div className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">HuMi</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/about')}>About</Button>
            <Button variant="outline" onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <Badge variant="secondary" className="mb-4">AI-Powered Trading Platform</Badge>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">Start Free. Upgrade Anytime.</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get instant access to trading tools, community, and AI — completely free. Upgrade when you're ready for more.
          </p>
        </div>

        {paymentCancelled && (
          <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4 text-center max-w-md mx-auto">
            <h3 className="text-amber-500 font-semibold">Payment Cancelled</h3>
            <p className="text-sm text-muted-foreground">You can try again whenever you're ready.</p>
          </div>
        )}

        {/* Free Tier CTA */}
        <div className="text-center">
          <Button size="lg" variant="outline" onClick={() => navigate('/auth')} className="text-lg px-8 py-6">
            Get Started Free — R0/month
          </Button>
        </div>

        {/* Comparison Table */}
        {plansLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Feature</TableHead>
                  <TableHead className="text-center min-w-[120px]">
                    <div className="space-y-1">
                      <div className="font-bold">Free</div>
                      <div className="text-xs text-muted-foreground">R0/mo</div>
                    </div>
                  </TableHead>
                  {plans.map(plan => (
                    <TableHead key={plan.tier} className={`text-center min-w-[120px] ${plan.popular ? 'bg-primary/5' : ''}`}>
                      <div className="space-y-1">
                        {plan.popular && <Badge className="mb-1">Popular</Badge>}
                        <div className="font-bold">{plan.name}</div>
                        <div className="text-xs text-muted-foreground">R{plan.priceZar.toFixed(0)}/mo</div>
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonFeatures.map((feature) => (
                  <TableRow key={feature.label}>
                    <TableCell className="font-medium text-sm">{feature.label}</TableCell>
                    <TableCell className="text-center"><FeatureValue value={feature.free} /></TableCell>
                    <TableCell className="text-center"><FeatureValue value={feature.basic} /></TableCell>
                    <TableCell className={`text-center ${plans.find(p => p.tier === 'professional')?.popular ? 'bg-primary/5' : ''}`}><FeatureValue value={feature.pro} /></TableCell>
                    <TableCell className="text-center"><FeatureValue value={feature.enterprise} /></TableCell>
                  </TableRow>
                ))}
                {/* Action row */}
                <TableRow>
                  <TableCell />
                  <TableCell className="text-center py-4">
                    <Button variant="outline" size="sm" onClick={() => navigate('/auth')}>Start Free</Button>
                  </TableCell>
                  {plans.map(plan => (
                    <TableCell key={plan.tier} className={`text-center py-4 ${plan.popular ? 'bg-primary/5' : ''}`}>
                      <Button
                        size="sm"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handleSubscribe(plan)}
                        disabled={loading !== null}
                      >
                        {loading === plan.tier ? <Loader2 className="w-4 h-4 animate-spin" /> : "Subscribe"}
                      </Button>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>Subscriptions are activated after payment is confirmed by our team. Cancel anytime.</p>
          <p>
            Already have an account?{" "}
            <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/auth')}>Sign in here</Button>
          </p>
        </div>
      </div>

      {/* Bank Transfer Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bank Transfer Payment</DialogTitle>
            <DialogDescription>
              Transfer the plan amount to the account below, then we will activate your subscription within one business day.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg border border-border p-3 space-y-1">
              <div className="text-sm text-muted-foreground">Selected Plan</div>
              <div className="text-lg font-semibold">
                {selectedPlan?.name} — R{selectedPlan?.priceZar.toFixed(2)}/month
              </div>
            </div>

            <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">Standard Bank</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account Name</span><span className="font-medium">HUMI MOBILE (Pty) Ltd</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account Type</span><span className="font-medium">Business Account</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Account Number</span><span className="font-medium">10280624016</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Branch Code</span><span className="font-medium">051001</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Swift Code</span><span className="font-medium">SBZAZAJJXXX</span></div>
              <div className="pt-2 text-xs text-muted-foreground">
                Reference: your email address (used to match the payment to your account).
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Your Email (payment reference)</Label>
              <Input id="email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handlePayment()} />
              <p className="text-xs text-muted-foreground">Register with this same email so we can activate your subscription automatically once payment clears.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowEmailDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handlePayment} disabled={!email || loading !== null} className="flex-1">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><CreditCard className="w-4 h-4 mr-2" />I've Made the Transfer</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
