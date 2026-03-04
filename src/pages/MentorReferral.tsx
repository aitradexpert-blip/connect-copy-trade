import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, ArrowRight } from "lucide-react";

export default function MentorReferral() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [mentorName, setMentorName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const loadMentor = async () => {
      const { data } = await supabase
        .from('mentor_profiles')
        .select('brand_name, is_active')
        .eq('referral_slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setMentorName(data.brand_name);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    };

    loadMentor();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-lg font-medium">Invalid referral link</p>
            <p className="text-muted-foreground mt-2">This mentor link is no longer active.</p>
            <Button className="mt-4" onClick={() => navigate("/auth")}>
              Go to Sign Up
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="max-w-md w-full bg-gradient-card border-border shadow-card">
        <CardHeader className="text-center">
          <Crown className="h-12 w-12 text-primary mx-auto mb-2" />
          <CardTitle className="text-2xl">Welcome to</CardTitle>
          <p className="text-xl font-bold text-primary">{mentorName}</p>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-muted-foreground">
            You've been invited to join HuMi via <strong>{mentorName}</strong>. 
            Create your account to access trading signals, copy trading, and AI-powered tools.
          </p>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate(`/auth?ref=${slug}`)}
          >
            Create Account <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">
            Already have an account? <button onClick={() => navigate("/auth")} className="text-primary underline">Sign in</button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
