import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, CreditCard, Upload, Sparkles, X, MessageCircle, BookOpen, GraduationCap, LineChart, Bot, Users, Shield, Headphones } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
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

const freeFeatures = [
  "WhatsApp Trading Community",
  "Daily Trading Signals (WhatsApp)",
  "Free Expert Advisor (w/ OctaFx)",
  "Free Mentorship Program",
  "Training Center (full access)",
  "Live Market Charts (170+ instruments)",
  "Manual Trade Journal with stats",
  "Khumo AI – 5 questions/month",
  "Mobile Dashboard (demo mode)",
  "Real-Time Notifications (limited)",
];

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tierName, isFree } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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

  const handleYocoPayment = async (plan: Plan) => {
    if (!user) { toast({ title: "Please sign in", variant: "destructive" }); return; }
    setLoading(plan.tier);
    try {
      const { data, error } = await supabase.functions.invoke('create-yoco-checkout', {
        body: { tier: plan.tier, userId: user.id, userEmail: user.email, successUrl: `${window.location.origin}/subscription?success=true`, cancelUrl: `${window.location.origin}/subscription?cancelled=true` }
      });
      if (error) throw error;
      if (data?.redirectUrl) window.location.href = data.redirectUrl;
      else throw new Error('No redirect URL received');
    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message, variant: "destructive" });
      setSelectedPlan(plan); setShowProofDialog(true);
    } finally { setLoading(null); }
  };

  const handleProofUpload = async () => {
    if (!proofFile || !selectedPlan || !user) return;
    setUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('payment-proofs').upload(fileName, proofFile);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('payment_proofs').insert({ user_id: user.id, email: user.email || '', plan: selectedPlan.tier, amount: selectedPlan.priceZar, image_url: urlData.publicUrl, status: 'pending' });
      if (dbError) throw dbError;
      toast({ title: "Proof uploaded", description: "We'll activate your subscription within 24 hours." });
      setShowProofDialog(false); setProofFile(null); setSelectedPlan(null);
    } catch (error: any) { toast({ title: "Upload failed", description: error.message, variant: "destructive" }); }
    finally { setUploading(false); }
  };

  const urlParams = new URLSearchParams(window.location.search);
  const paymentSuccess = urlParams.get('success') === 'true';
  const paymentCancelled = urlParams.get('cancelled') === 'true';

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">Choose Your Plan</h1>
          <p className="text-muted-foreground mt-2">
            {isFree
              ? "You're currently on the Free plan. Upgrade to unlock the full HuMi experience."
              : `You're on the ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} plan.`}
          </p>
        </div>

        {paymentSuccess && (
          <div className="bg-profit/10 border border-profit rounded-lg p-4 text-center">
            <h3 className="text-profit font-semibold">Payment Successful!</h3>
            <p className="text-sm text-muted-foreground">Your subscription is being activated.</p>
          </div>
        )}
        {paymentCancelled && (
          <div className="bg-amber-500/10 border border-amber-500 rounded-lg p-4 text-center">
            <h3 className="text-amber-500 font-semibold">Payment Cancelled</h3>
            <p className="text-sm text-muted-foreground">You can try again whenever you're ready.</p>
          </div>
        )}

        {plansLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free Tier Card */}
            <Card className={`relative bg-gradient-card border-border shadow-card ${isFree ? 'ring-2 ring-profit' : ''}`}>
              {isFree && <Badge className="absolute -top-3 right-4 bg-profit">Current</Badge>}
              <CardHeader className="text-center">
                <CardTitle className="text-xl">Free</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">R0</span>
                  <span className="text-muted-foreground">/month</span>
                  <br /><span className="text-sm text-muted-foreground">Forever free</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {freeFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-profit flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" disabled={isFree}>
                  {isFree ? 'Current Plan' : 'Downgrade'}
                </Button>
              </CardContent>
            </Card>

            {/* Paid Plans */}
            {plans.map((plan) => (
              <Card key={plan.name} className={`relative bg-gradient-card border-border shadow-card ${plan.popular ? 'ring-2 ring-primary' : ''} ${plan.tier === tierName ? 'ring-2 ring-profit' : ''}`}>
                {plan.popular && <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary">Most Popular</Badge>}
                {plan.tier === tierName && <Badge className="absolute -top-3 right-4 bg-profit">Current</Badge>}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">R{plan.priceZar.toFixed(2)}</span>
                    <span className="text-muted-foreground">/month</span>
                    <br /><span className="text-sm text-muted-foreground">(${plan.priceUsd.toFixed(2)} USD)</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-profit flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"} onClick={() => handleYocoPayment(plan)} disabled={loading !== null || plan.tier === tierName}>
                    {plan.tier === tierName ? 'Current Plan' : loading === plan.tier ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : <><CreditCard className="w-4 h-4 mr-2" />Subscribe</>}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>All payments processed via Yoco. Cancel anytime.</p>
          <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/pricing')}>
            View full feature comparison →
          </Button>
        </div>
      </div>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Payment Proof</DialogTitle>
            <DialogDescription>If automatic payment failed, upload your proof for manual verification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Selected Plan</Label><p className="text-sm font-medium">{selectedPlan?.name} - R{selectedPlan?.priceZar.toFixed(2)}/month</p></div>
            <div><Label htmlFor="proof">Payment Screenshot</Label><Input id="proof" type="file" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} /></div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowProofDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleProofUpload} disabled={!proofFile || uploading} className="flex-1">
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploading...</> : <><Upload className="w-4 h-4 mr-2" />Upload Proof</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
