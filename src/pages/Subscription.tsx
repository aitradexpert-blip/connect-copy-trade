import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Upload, Copy as CopyIcon, Building2, Send } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubscriptionPlans, getFeatureList } from "@/hooks/useSubscriptionPlans";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayPalHostedButton } from "@/components/PayPalHostedButton";
import { CreditCard } from "lucide-react";

const PAYPAL_CONFIG: Record<string, { hostedButtonId: string; qrCode: string }> = {
  basic: { hostedButtonId: "MZNVMXGUBRKSQ", qrCode: "/qr-codes/basic.png" },
  professional: { hostedButtonId: "ETQMRGQBSLG2Y", qrCode: "/qr-codes/professional.png" },
  enterprise: { hostedButtonId: "U8ZAJNT797Q58", qrCode: "/qr-codes/enterprise.png" },
  mentor: { hostedButtonId: "S7CTAQUZVG528", qrCode: "/qr-codes/mentor.png" },
};
import TelegramButton, { TELEGRAM_CHANNEL_URL, TELEGRAM_DM_URL } from "@/components/TelegramButton";
import PopiaConsentCheckbox, { recordConsent } from "@/components/PopiaConsentCheckbox";

interface Plan {
  name: string;
  priceUsd: number;
  priceZar: number;
  tier: string;
  features: string[];
  popular?: boolean;
}

const freeFeatures = [
  "Telegram Trading Community",
  "Daily Trading Signals (Telegram)",
  "Free Expert Advisor",
  "Free Mentorship Program",
  "Training Center (full access)",
  "Live Market Charts (170+ instruments)",
  "Manual Trade Journal with stats",
  "Khumo AI – 5 questions/month",
  "Mobile Dashboard (demo mode)",
  "Real-Time Notifications (limited)",
];

const BANK = {
  bank: "Standard Bank",
  accountName: "HUMI MOBILE (Pty) Ltd",
  accountType: "Business Account",
  accountNumber: "10280624016",
  branchCode: "051001",
  swiftCode: "SBZAZAJJXXX",
};

export default function Subscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { tierName, isFree } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");
  const [uploading, setUploading] = useState(false);
  const [consent, setConsent] = useState(false);
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

  const openProofDialog = (plan: Plan) => {
    if (!user) {
      toast({ title: "Please sign in to subscribe", variant: "destructive" });
      navigate('/auth');
      return;
    }
    setSelectedPlan(plan);
    setConsent(false);
    setReference(`HUMI-${plan.tier.toUpperCase()}-${user.email?.split('@')[0] || user.id.slice(0, 6)}`);
    setShowProofDialog(true);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() =>
      toast({ title: `${label} copied` }),
    );
  };

  const handleProofUpload = async () => {
    if (!proofFile || !selectedPlan || !user) return;
    if (!consent) {
      toast({ title: "Please accept the Terms & Privacy Policy", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const fileExt = proofFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, proofFile);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(fileName);

      const { error: fnErr } = await supabase.functions.invoke('submit-payment-proof', {
        body: {
          plan: selectedPlan.tier,
          amount: selectedPlan.priceZar,
          image_url: urlData.publicUrl,
          reference,
        },
      });
      if (fnErr) throw fnErr;

      await recordConsent(supabase, user.id, 'payment', { plan: selectedPlan.tier, amount: selectedPlan.priceZar });

      toast({
        title: "Proof submitted",
        description: "Forwarded to our team on Telegram. We'll activate within a few hours.",
      });
      setShowProofDialog(false);
      setProofFile(null);
      setSelectedPlan(null);
      setReference("");
      setConsent(false);
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

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

        {/* Bank details card */}
        <Card className="bg-gradient-card border-border shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Pay by EFT
            </CardTitle>
            <CardDescription>
              Deposit into the HuMi account below, then upload your proof of payment for activation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {[
                ["Bank", BANK.bank],
                ["Account Name", BANK.accountName],
                ["Account Type", BANK.accountType],
                ["Account Number", BANK.accountNumber],
                ["Branch Code", BANK.branchCode],
                ["Swift Code", BANK.swiftCode],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-background/40"
                >
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium truncate">{value}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(value, label)}
                    aria-label={`Copy ${label}`}
                  >
                    <CopyIcon className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <TelegramButton
                mode="dm"
                label="Contact Support on Telegram"
                description="@mansamusafx · DM us with payment questions"
                icon={<Send className="w-5 h-5 text-primary" />}
              />
              <TelegramButton
                mode="channel"
                label="Join HuMi Community"
                description="Free signals, updates and announcements"
              />
            </div>
          </CardContent>
        </Card>

        {plansLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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

            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative bg-gradient-card border-border shadow-card ${plan.popular ? 'ring-2 ring-primary' : ''} ${plan.tier === tierName ? 'ring-2 ring-profit' : ''}`}
              >
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
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => openProofDialog(plan)}
                    disabled={plan.tier === tierName}
                  >
                    {plan.tier === tierName ? 'Current Plan' : <><CreditCard className="w-4 h-4 mr-2" />Upgrade</>}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>Subscriptions are activated within a few hours of payment verification. Cancel anytime.</p>
          <Button variant="link" className="p-0 h-auto text-sm" onClick={() => navigate('/pricing')}>
            View full feature comparison →
          </Button>
        </div>
      </div>

      <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.name} Plan</DialogTitle>
            <DialogDescription>Choose how you'd like to pay.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="paypal">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="paypal">Pay Here</TabsTrigger>
              <TabsTrigger value="eft">Bank Transfer</TabsTrigger>
            </TabsList>
            <TabsContent value="paypal" className="space-y-4 pt-4">
              {selectedPlan && PAYPAL_CONFIG[selectedPlan.tier] && (
                <>
                  <div className="flex justify-center">
                    <PayPalHostedButton hostedButtonId={PAYPAL_CONFIG[selectedPlan.tier].hostedButtonId} />
                  </div>
                  <div className="text-center space-y-2 pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">On another device? Scan to pay:</p>
                    <img
                      src={PAYPAL_CONFIG[selectedPlan.tier].qrCode}
                      alt={`${selectedPlan.name} PayPal QR code`}
                      className="w-40 h-40 mx-auto rounded-lg border border-border"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Activates once payment is confirmed and reviewed by our team.
                  </p>
                </>
              )}
            </TabsContent>
            <TabsContent value="eft">
          <div className="space-y-4">
            <div>
              <Label>Selected Plan</Label>
              <p className="text-sm font-medium">
                {selectedPlan?.name} - R{selectedPlan?.priceZar.toFixed(2)}/month
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Payment Reference (use this as EFT reference)</Label>
              <Input id="reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proof">Bank Confirmation / Screenshot</Label>
              <Input
                id="proof"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />
            </div>
            <PopiaConsentCheckbox checked={consent} onChange={setConsent} id="consent-payment" />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowProofDialog(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleProofUpload}
                disabled={!proofFile || uploading || !consent}
                className="flex-1"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
                ) : (
                  <><Upload className="w-4 h-4 mr-2" />Submit Proof</>
                )}
              </Button>
            </div>
            <a
              href={TELEGRAM_DM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-center text-primary hover:underline"
            >
              Need help? Chat with support on Telegram →
            </a>
          </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
