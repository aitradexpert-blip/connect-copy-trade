import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Send,
  Lightbulb,
  Copy,
  Bot,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PopiaConsentCheckbox, { recordConsent } from "@/components/PopiaConsentCheckbox";
import HeroBull from "@/components/landing/HeroBull";
import FeatureCard from "@/components/landing/FeatureCard";
import LandingNav from "@/components/landing/LandingNav";

const TELEGRAM_DOWNLOAD_URL = "https://t.me/mansamusafx";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [downloadClicked, setDownloadClicked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showSignInPw, setShowSignInPw] = useState(false);
  const [showSignUpPw, setShowSignUpPw] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [signupConsent, setSignupConsent] = useState(false);
  const [authTab, setAuthTab] = useState<"signin" | "signup">("signin");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const authRef = useRef<HTMLDivElement>(null);

  const paymentSuccess = searchParams.get("payment_success") === "true";
  const planFromUrl = searchParams.get("plan");
  const emailFromUrl = searchParams.get("email");
  const refSlug = searchParams.get("ref");

  useEffect(() => {
    if (emailFromUrl) setEmail(decodeURIComponent(emailFromUrl));
  }, [emailFromUrl]);

  useEffect(() => {
    if (paymentSuccess) setAuthTab("signup");
  }, [paymentSuccess]);

  const scrollToAuth = (tab: "signin" | "signup") => {
    setAuthTab(tab);
    requestAnimationFrame(() => {
      authRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDownloadApp = () => {
    if (downloadClicked) return;
    setDownloadClicked(true);
    window.open(TELEGRAM_DOWNLOAD_URL, "_blank", "noopener,noreferrer");
    setTimeout(() => setDownloadClicked(false), 1500);
  };

  // ────────── Auth handlers (unchanged behaviour) ──────────
  const activatePendingSubscription = async (userId: string, userEmail: string) => {
    try {
      const { data: pendingData, error: pendingError } = await supabase
        .from("pending_subscriptions")
        .select("*")
        .eq("email", userEmail.toLowerCase().trim())
        .eq("status", "paid")
        .single();
      if (pendingError || !pendingData) return false;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      const { error: subscriptionError } = await supabase.from("user_subscriptions").insert({
        user_id: userId,
        plan_name: pendingData.plan_name,
        status: "active",
        started_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        auto_trades_used: 0,
        last_reset_at: new Date().toISOString(),
      });
      if (subscriptionError) return false;
      await supabase
        .from("pending_subscriptions")
        .update({
          status: "activated",
          activated_at: new Date().toISOString(),
          activated_user_id: userId,
        })
        .eq("id", pendingData.id);
      return true;
    } catch (err) {
      console.error("[Auth] Error activating subscription:", err);
      return false;
    }
  };

  const linkMentorReferral = async (userId: string) => {
    if (!refSlug) return;
    try {
      const { data: mentor } = await supabase
        .from("mentor_profiles")
        .select("id")
        .eq("referral_slug", refSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (mentor) {
        await supabase.from("mentor_clients").insert({
          mentor_id: mentor.id,
          client_user_id: userId,
          referral_slug_used: refSlug,
        });
        await supabase.from("profiles").update({ referred_by: refSlug }).eq("user_id", userId);
      }
    } catch (err) {
      console.error("[Auth] Error linking mentor:", err);
    }
  };

  const checkIfMentorClient = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("mentor_clients")
        .select("id")
        .eq("client_user_id", userId)
        .limit(1)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  };

  const checkIfMentor = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("mentor_profiles")
        .select("id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupConsent) {
      toast({ title: "Please accept the Terms & Privacy Policy", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: displayName },
        },
      });
      if (error) throw error;
      if (data?.user) {
        await recordConsent(supabase, data.user.id, "signup", { email });
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
      if (data?.user) {
        const isMentor = await checkIfMentor(data.user.id);
        if (isMentor) {
          navigate("/mentor-hub");
          return;
        }
        if (refSlug) {
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
    <div
      id="top"
      className="relative min-h-screen overflow-x-hidden bg-[hsl(0_0%_4%)] text-white"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at top, hsl(0 0% 8%) 0%, hsl(0 0% 3%) 60%)",
      }}
    >
      <LandingNav onSignIn={() => scrollToAuth("signin")} onSignUp={() => scrollToAuth("signup")} />

      {/* ─────────────── HERO ─────────────── */}
      <section className="relative isolate flex min-h-[100svh] flex-col items-center justify-center px-4 pb-16 pt-24 sm:pt-32">
        <HeroBull />

        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
          }}
          className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <motion.h1
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
            }}
            className="font-black leading-[0.95] tracking-tight text-white"
            style={{ fontSize: "clamp(2.75rem, 10vw, 5.5rem)", letterSpacing: "-0.035em" }}
          >
            Khumo Copy <span className="text-[hsl(354_90%_60%)] drop-shadow-[0_0_28px_hsl(354_82%_45%/0.6)]">AI</span>
          </motion.h1>

          <motion.p
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="mt-4 max-w-xl font-semibold text-white sm:mt-6"
            style={{ fontSize: "clamp(1.05rem, 3.2vw, 1.35rem)" }}
          >
            Welcome to the future of money.
          </motion.p>
          <motion.p
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
            }}
            className="mt-2 max-w-xl text-white/70"
            style={{ fontSize: "clamp(0.95rem, 2.8vw, 1.1rem)" }}
          >
            Precision-engineered trading tools for the next generation of SA market leaders.
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 16 },
              show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
            }}
            className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10"
          >
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleDownloadApp}
              disabled={downloadClicked}
              className="group relative inline-flex h-14 min-w-[260px] items-center justify-center gap-3 overflow-hidden rounded-full bg-gradient-to-r from-[hsl(354_82%_38%)] via-[hsl(354_82%_45%)] to-[hsl(354_82%_38%)] px-8 text-base font-bold text-white shadow-[0_10px_40px_-8px_hsl(354_82%_45%/0.8)] transition disabled:opacity-70 sm:h-16 sm:text-lg"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
              />
              {downloadClicked ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
              Download App
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => scrollToAuth("signup")}
              className="inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.03] px-6 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/[0.08] sm:h-14 sm:text-base"
            >
              Join Now
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ─────────────── FEATURE GRID ─────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.12 } },
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          <FeatureCard
            icon={Lightbulb}
            title="Trade Ideas"
            body="Premium market analysis and actionable intelligence, delivered the moment opportunity strikes."
          />
          <FeatureCard
            icon={Copy}
            title="Copy Trading"
            body="Automated execution and terminal mirroring — follow proven traders with precision allocation."
          />
          <FeatureCard
            icon={Bot}
            title="AI Bot System"
            body="Algorithmic performance with automated risk profiles engineered for the disciplined trader."
          />
        </motion.div>
      </section>

      {/* ─────────────── AUTH FORM ─────────────── */}
      <section
        id="auth-form"
        ref={authRef}
        className="relative z-10 mx-auto max-w-md px-4 pb-24 sm:px-6"
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <Card className="border-white/10 bg-[hsl(0_0%_7%)]/80 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-black tracking-tight text-white">
                Get started
              </CardTitle>
              <CardDescription className="text-white/60">
                Sign in or create your Khumo Copy AI account
              </CardDescription>
              {refSlug && (
                <Badge variant="secondary" className="mx-auto mt-2 w-fit">
                  Referred by mentor
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {paymentSuccess && planFromUrl && (
                <div className="mb-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <div>
                      <h3 className="font-semibold text-emerald-300">Payment Received!</h3>
                      <p className="text-sm text-white/70">
                        Complete registration to activate your{" "}
                        <Badge variant="secondary" className="ml-1">
                          {planFromUrl.charAt(0).toUpperCase() + planFromUrl.slice(1)}
                        </Badge>{" "}
                        subscription.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="mb-4 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </Button>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-[hsl(0_0%_7%)] px-2 text-white/50">Or continue with email</span>
                </div>
              </div>

              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "signin" | "signup")} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-white/5">
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
                        className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[hsl(354_82%_45%)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signin-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSignInPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[hsl(354_82%_45%)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignInPw(!showSignInPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          {showSignInPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setForgotEmail(email);
                        }}
                        className="text-xs text-[hsl(354_90%_65%)] hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button
                      type="submit"
                      className="h-12 w-full bg-[hsl(354_82%_45%)] font-semibold text-white hover:bg-[hsl(354_82%_38%)]"
                      disabled={isLoading}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                        className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[hsl(354_82%_45%)]"
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
                        className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[hsl(354_82%_45%)]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password</Label>
                      <div className="relative">
                        <Input
                          id="signup-password"
                          type={showSignUpPw ? "text" : "password"}
                          placeholder="Minimum 6 characters"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                          className="h-12 border-white/10 bg-white/5 text-white placeholder:text-white/40 focus-visible:ring-[hsl(354_82%_45%)]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSignUpPw(!showSignUpPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                        >
                          {showSignUpPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <PopiaConsentCheckbox
                      checked={signupConsent}
                      onChange={setSignupConsent}
                      id="signup-consent"
                    />
                    <Button
                      type="submit"
                      className="h-12 w-full bg-[hsl(354_82%_45%)] font-semibold text-white hover:bg-[hsl(354_82%_38%)]"
                      disabled={isLoading || !signupConsent}
                    >
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              {forgotMode && (
                <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                  <h3 className="text-sm font-semibold">Reset Password</h3>
                  {forgotSent ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      <span>Reset link sent! Check your email.</span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/40"
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
                          className="bg-[hsl(354_82%_45%)] hover:bg-[hsl(354_82%_38%)]"
                        >
                          {isLoading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          Send Reset Link
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setForgotMode(false);
                            setForgotSent(false);
                          }}
                          className="text-white/70 hover:bg-white/5 hover:text-white"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <p className="mx-auto mt-8 max-w-md text-center text-[11px] leading-relaxed text-white/40">
          HuMi Mobile (Pty) Ltd is a technology mediator providing trading tools and educational content.
          We are not a licensed financial services provider under the Financial Sector Conduct Authority (FSCA).
          Trading in leveraged products carries a high level of risk and may not be suitable for all investors.
        </p>
      </section>
    </div>
  );
};

export default Auth;
