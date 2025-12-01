import { useState } from "react";
import { Check, Upload, ExternalLink, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface Plan {
  name: string;
  price: number;
  description: string;
  features: PlanFeature[];
  popular?: boolean;
  yocoLink: string;
}

const USD_TO_ZAR = 18;

const plans: Plan[] = [
  {
    name: "Basic",
    price: 9.90,
    description: "Perfect for getting started with copy trading",
    yocoLink: `https://pay.yoco.com/r/78avpk?amount=${Math.round(9.90 * USD_TO_ZAR * 100)}`,
    features: [
      { text: "10 Auto-Trades per month", included: true },
      { text: "Add up to 2 Trading Accounts", included: true },
      { text: "Up to 1 Copy Account", included: true },
      { text: "Premium Trading Signals", included: true },
      { text: "Email support", included: true },
      { text: "Advanced AI bots", included: false },
      { text: "Priority Ideas", included: false },
      { text: "Custom risk management", included: false },
    ],
  },
  {
    name: "Professional",
    price: 29.90,
    description: "For serious traders who need more features",
    yocoLink: `https://pay.yoco.com/r/731Eg5?amount=${Math.round(29.90 * USD_TO_ZAR * 100)}`,
    features: [
      { text: "Up to 30 Auto-Trades", included: true },
      { text: "Add up to 5 Trading Accounts", included: true },
      { text: "Up to 3 Copy Accounts", included: true },
      { text: "Premium Trading Ideas", included: true },
      { text: "Priority email support", included: true },
      { text: "Advanced AI bots", included: true },
      { text: "Priority Ideas", included: true },
      { text: "Custom risk management", included: false },
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 39.99,
    description: "Complete trading solution for professionals",
    yocoLink: `https://pay.yoco.com/r/2YaDjW?amount=${Math.round(39.99 * USD_TO_ZAR * 100)}`,
    features: [
      { text: "Unlimited Auto-Trades", included: true },
      { text: "Add up to 10 Trading Accounts", included: true },
      { text: "Up to 5 Copy Accounts", included: true },
      { text: "VIP market signals", included: true },
      { text: "24/7 phone & email support", included: true },
      { text: "Advanced AI bots", included: true },
      { text: "Priority signals", included: true },
      { text: "Custom risk management", included: true },
    ],
  },
];

const Subscription = () => {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showProofDialog, setShowProofDialog] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleYocoPayment = (plan: Plan) => {
    setSelectedPlan(plan);
    // Open Yoco payment link in new tab
    window.open(plan.yocoLink, '_blank');
    // Show proof of payment dialog
    setTimeout(() => setShowProofDialog(true), 1000);
  };

  const handleProofUpload = async () => {
    if (!paymentProofFile || !selectedPlan || !user) return;
    
    setIsUploading(true);
    
    try {
      // Upload file to storage
      const fileName = `${user.id}/${Date.now()}-${paymentProofFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, paymentProofFile);

      if (uploadError) throw uploadError;

      // Create payment proof record
      const { error: dbError } = await supabase
        .from('payment_proofs')
        .insert({
          user_id: user.id,
          email: user.email!,
          plan: selectedPlan.name,
          amount: selectedPlan.price,
          image_url: uploadData.path,
          status: 'pending'
        });

      if (dbError) throw dbError;

      toast({
        title: "Proof of payment submitted!",
        description: "Your payment will be reviewed by our team within 24 hours.",
      });

      setShowProofDialog(false);
      setPaymentProofFile(null);
      setSelectedPlan(null);
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground">
            Unlock premium trading features with our subscription plans
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative bg-gradient-card border-border shadow-card ${
                plan.popular ? 'ring-2 ring-primary' : ''
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                <div className="text-3xl font-bold text-primary">
                  ${plan.price}<span className="text-sm text-muted-foreground">/mo</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  R{Math.round(plan.price * USD_TO_ZAR)} ZAR
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check 
                        className={`w-4 h-4 ${
                          feature.included 
                            ? 'text-profit' 
                            : 'text-muted-foreground opacity-50'
                        }`} 
                      />
                      <span 
                        className={`text-sm ${
                          feature.included 
                            ? 'text-foreground' 
                            : 'text-muted-foreground line-through'
                        }`}
                      >
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-primary' 
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                  onClick={() => handleYocoPayment(plan)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Subscribe to {plan.name}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Proof of Payment Dialog */}
        <Dialog open={showProofDialog} onOpenChange={setShowProofDialog}>
          <DialogContent className="bg-gradient-card border-border">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Submit Proof of Payment
              </DialogTitle>
              <DialogDescription>
                Upload a screenshot of your payment confirmation for {selectedPlan?.name} plan (${selectedPlan?.price}/month)
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="payment-proof">Payment Proof Screenshot</Label>
                <Input
                  id="payment-proof"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPaymentProofFile(e.target.files?.[0] || null)}
                />
                <p className="text-sm text-muted-foreground">
                  Please upload a clear screenshot of your Yoco payment confirmation
                </p>
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => setShowProofDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleProofUpload}
                  className="flex-1 bg-gradient-primary"
                  disabled={isUploading || !paymentProofFile}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? "Uploading..." : "Submit Proof"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Subscription;