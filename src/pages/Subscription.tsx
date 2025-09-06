import { useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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
}

const plans: Plan[] = [
  {
    name: "Basic",
    price: 100,
    description: "Perfect for getting started with copy trading",
    features: [
      { text: "2 Auto-Trades per month", included: true },
      { text: "Up to 3 Copy Accounts", included: true },
      { text: "Basic market signals", included: true },
      { text: "Email support", included: true },
      { text: "Advanced AI bots", included: false },
      { text: "Priority signals", included: false },
      { text: "Custom risk management", included: false },
    ],
  },
  {
    name: "Professional",
    price: 300,
    description: "For serious traders who need more features",
    features: [
      { text: "Unlimited Auto-Trades", included: true },
      { text: "Up to 10 Copy Accounts", included: true },
      { text: "Premium market signals", included: true },
      { text: "Priority email support", included: true },
      { text: "Advanced AI bots", included: true },
      { text: "Priority signals", included: true },
      { text: "Custom risk management", included: false },
    ],
    popular: true,
  },
  {
    name: "Enterprise",
    price: 500,
    description: "Complete trading solution for professionals",
    features: [
      { text: "Unlimited Auto-Trades", included: true },
      { text: "Unlimited Copy Accounts", included: true },
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
  const [cardNumber, setCardNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    if (!selectedPlan) return;
    
    setIsProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      toast({
        title: "Subscription successful!",
        description: `Premium features unlocked for ${selectedPlan.name} plan.`,
      });
      setIsProcessing(false);
      setSelectedPlan(null);
      setCardNumber("");
      setExpiry("");
      setCvc("");
    }, 2000);
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
                  R{plan.price}<span className="text-sm text-muted-foreground">/mo</span>
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
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      className={`w-full ${
                        plan.popular 
                          ? 'bg-gradient-primary' 
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                      onClick={() => setSelectedPlan(plan)}
                    >
                      Subscribe to {plan.name}
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent className="bg-gradient-card border-border">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        Complete Payment
                      </DialogTitle>
                      <DialogDescription>
                        Subscribe to {selectedPlan?.name} plan for R{selectedPlan?.price}/month
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="card-number">Card Number</Label>
                        <Input
                          id="card-number"
                          placeholder="1234 5678 9012 3456"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                          maxLength={19}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="expiry">Expiry Date</Label>
                          <Input
                            id="expiry"
                            placeholder="MM/YY"
                            value={expiry}
                            onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                            maxLength={5}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="cvc">CVC</Label>
                          <Input
                            id="cvc"
                            placeholder="123"
                            value={cvc}
                            onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                            maxLength={4}
                          />
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handlePayment}
                        className="w-full bg-gradient-primary"
                        disabled={isProcessing || !cardNumber || !expiry || !cvc}
                      >
                        {isProcessing ? "Processing..." : `Pay R${selectedPlan?.price}`}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Subscription;