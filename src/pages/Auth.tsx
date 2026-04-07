import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, Sparkles, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showSignInPw, setShowSignInPw] = useState(false);
  const [showSignUpPw, setShowSignUpPw] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const paymentSuccess = searchParams.get('payment_success') === 'true';
  const planFromUrl = searchParams.get('plan');
  const emailFromUrl = searchParams.get('email');
  const refSlug = searchParams.get('ref');

  useEffect(() => {
    if (emailFromUrl) setEmail(decodeURIComponent(emailFromUrl));
  }, [emailFromUrl]);

  const activatePendingSubscription = async (userId: string, userEmail: string) => {
    try {
      const { data: pendingData, error: pendingError } = await supabase
        .from('pending_subscriptions')
        .select('*')
        .eq('email', userEmail.toLowerCase().trim())
        .eq('status', 'paid')
        .single();

      if (pendingError || !pendingData) return false;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

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

      if (subscriptionError) return false;

      await supabase
        .from('pending_subscriptions')
        .update({ status: 'activated', activated_at: new Date().toISOString(), activated_user_id: userId })
        .eq('id', pendingData.id);

      return true;
    } catch (err) {
      console.error('[Auth] Error activating subscription:', err);
      return false;
    }
  };

  const linkMentorReferral = async (userId: string) => {
    if (!refSlug) return;
    try {
      const { data: mentor } = await supabase
        .from('mentor_profiles')
        .select('id')
        .eq('referral_slug', refSlug)
        .eq('is_active', true)
        .maybeSingle();

      if (mentor) {
        await supabase.from('mentor_clients').insert({
          mentor_id: mentor.id,
          client_user_id: userId,
          referral_slug_used: refSlug
        });

        // Also set referred_by on profile
        await supabase
          .from('profiles')
          .update({ referred_by: refSlug })
          .eq('user_id', userId);
      }
    } catch (err) {
      console.error('[Auth] Error linking mentor:', err);
    }
  };

  const checkIfMentorClient = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('mentor_clients')
        .select('id')
        .eq('client_user_id', userId)
        .limit(1)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const redirectTo = refSlug 
        ? `${window.location.origin}/mentor-dashboard`
        : `${window.location.origin}/`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: refSlug 
            ? `${window.location.origin}/mentor-dashboard`
            : `${window.location.origin}/`,
          data: { display_name: displayName },
        },
      });
      if (error) throw error;

      if (data?.user) {
        await linkMentorReferral(data.user.id);
        const activated = await activatePendingSubscription(data.user.id, email);
        toast({
          title: activated ? "Account created & subscription activated!" : "Account created successfully!",
          description: "Please check your email to verify your account.",
        });
      }
    } catch (error: any) {
      toast({ title: "Error creating account", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "Welcome back!", description: "You have been logged in successfully." });

      // Check if this user is a mentor client → redirect to branded dashboard
      if (data?.user) {
        if (refSlug) {
          // Link referral if signing in with ref param
          await linkMentorReferral(data.user.id);
          navigate("/mentor-dashboard");
        } else {
          const isMentorClient = await checkIfMentorClient(data.user.id);
          navigate(isMentorClient ? "/mentor-dashboard" : "/");
        }
      } else {
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Error signing in", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex flex-col lg:flex-row">
      {/* Left Panel - Marketing */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="max-w-md mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-black text-foreground">HuMi</h1>
          </div>
          <h2 className="text-2xl font-bold text-foreground leading-tight">
            Institutional-grade trading tools in your pocket.
          </h2>
          <p className="text-muted-foreground">
            Connect MT4, MT5, Deriv & crypto wallets in one mobile-first dashboard.
            AI signals, copy trading, and instant cross-broker transfers.
          </p>
          <div className="space-y-3 text-sm">
            {[
              "Unified dashboard for all your broker accounts",
              "Khumo AI – your voice-activated trading assistant",
              "Copy verified master traders with transparent performance",
              "Move funds between brokers in hours, not days",
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-foreground">
                <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <a href="/pitch" className="text-xs text-primary hover:underline">Investor Deck →</a>
            <a href="/pricing" className="text-xs text-primary hover:underline">Pricing →</a>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border shadow-sm">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2 lg:hidden">
            <Sparkles className="w-6 h-6 text-primary" />
            <CardTitle className="text-2xl font-bold text-foreground">HuMi</CardTitle>
          </div>
          <CardDescription className="lg:hidden">Your gateway to professional trading tools on mobile</CardDescription>
          <CardDescription className="hidden lg:block">Sign in to your trading dashboard</CardDescription>
          {refSlug && (
            <Badge variant="secondary" className="mt-2">Referred by mentor</Badge>
          )}
        </CardHeader>
        <CardContent>
          {paymentSuccess && planFromUrl && (
            <div className="mb-6 bg-profit/10 border border-profit rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-profit" />
                <div>
                  <h3 className="font-semibold text-profit">Payment Received!</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete registration to activate your{' '}
                    <Badge variant="secondary" className="ml-1">{planFromUrl.charAt(0).toUpperCase() + planFromUrl.slice(1)}</Badge> subscription.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Google Sign-In */}
          <Button variant="outline" className="w-full mb-4" onClick={handleGoogleSignIn} disabled={isLoading}>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <Tabs defaultValue={paymentSuccess ? "signup" : "signin"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input id="signin-password" type={showSignInPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" onClick={() => setShowSignInPw(!showSignInPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSignInPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); }} className="text-xs text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Display Name</Label>
                  <Input id="signup-name" type="text" placeholder="Your Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input id="signup-password" type={showSignUpPw ? "text" : "password"} placeholder="Minimum 6 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    <button type="button" onClick={() => setShowSignUpPw(!showSignUpPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showSignUpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-gradient-primary" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Forgot Password Modal */}
          {forgotMode && (
            <div className="mt-4 border-t pt-4 space-y-3">
              <h3 className="font-semibold text-sm">Reset Password</h3>
              {forgotSent ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span>Reset link sent! Check your email.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (!forgotEmail) return;
                        setIsLoading(true);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                            redirectTo: `${window.location.origin}/reset-password`,
                          });
                          if (error) throw error;
                          setForgotSent(true);
                        } catch (err: any) {
                          toast({ title: "Error", description: err.message, variant: "destructive" });
                        } finally {
                          setIsLoading(false);
                        }
                      }}
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      Send Reset Link
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setForgotMode(false); setForgotSent(false); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Auth;
