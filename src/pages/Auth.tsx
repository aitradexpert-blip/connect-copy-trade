import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Check for payment success from pricing page
  const paymentSuccess = searchParams.get('payment_success') === 'true';
  const planFromUrl = searchParams.get('plan');
  const emailFromUrl = searchParams.get('email');

  // Pre-fill email if coming from payment
  useEffect(() => {
    if (emailFromUrl) {
      setEmail(decodeURIComponent(emailFromUrl));
    }
  }, [emailFromUrl]);

  // Activate pending subscription after successful registration
  const activatePendingSubscription = async (userId: string, userEmail: string) => {
    try {
      // Check for pending paid subscription
      const { data: pendingData, error: pendingError } = await supabase
        .from('pending_subscriptions')
        .select('*')
        .eq('email', userEmail.toLowerCase().trim())
        .eq('status', 'paid')
        .single();

      if (pendingError || !pendingData) {
        console.log('[Auth] No pending subscription found for:', userEmail);
        return false;
      }

      console.log('[Auth] Found pending subscription:', pendingData);

      // Calculate expiry (30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Create user subscription
      const { error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_name: pendingData.plan_name,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          auto_trades_used: 0,
          last_reset_at: new Date().toISOString()
        });

      if (subscriptionError) {
        console.error('[Auth] Failed to create subscription:', subscriptionError);
        return false;
      }

      // Mark pending subscription as activated
      await supabase
        .from('pending_subscriptions')
        .update({
          status: 'activated',
          activated_at: new Date().toISOString(),
          activated_user_id: userId
        })
        .eq('id', pendingData.id);

      console.log('[Auth] ✅ Subscription activated for user:', userId);
      return true;
    } catch (err) {
      console.error('[Auth] Error activating subscription:', err);
      return false;
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) throw error;

      // If user was created and we have a pending subscription, activate it
      if (data?.user) {
        const activated = await activatePendingSubscription(data.user.id, email);
        if (activated) {
          toast({
            title: "Account created & subscription activated!",
            description: "Your subscription is now active. Please check your email to verify your account.",
          });
        } else {
          toast({
            title: "Account created successfully!",
            description: "Please check your email to verify your account.",
          });
        }
      } else {
        toast({
          title: "Account created successfully!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error creating account",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You have been logged in successfully.",
      });
      
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gradient-card border-border shadow-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">
              HuMi
            </CardTitle>
          </div>
          <CardDescription>
            AI-Powered Trading Platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Payment Success Banner */}
          {paymentSuccess && planFromUrl && (
            <div className="mb-6 bg-profit/10 border border-profit rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-profit" />
                <div>
                  <h3 className="font-semibold text-profit">Payment Received!</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete registration to activate your{' '}
                    <Badge variant="secondary" className="ml-1">
                      {planFromUrl.charAt(0).toUpperCase() + planFromUrl.slice(1)}
                    </Badge>
                    {' '}subscription.
                  </p>
                </div>
              </div>
            </div>
          )}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Display Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Your Name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-primary"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;