import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, PlugZap, SignalHigh } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CopyTrading() {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Copy Trading</h1>
          <p className="text-muted-foreground mt-2">
            This feature is coming soon. Connect your accounts and follow admin signals in the meantime.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlugZap className="w-5 h-5" />
                Connect Trading Accounts
              </CardTitle>
              <CardDescription>Link your MT4/MT5 brokerage accounts.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/accounts?connect=1')} className="bg-gradient-primary">
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SignalHigh className="w-5 h-5" />
                View Trading Signals
              </CardTitle>
              <CardDescription>Execute admin-published signals.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => navigate('/signals')} variant="secondary">
                Browse Signals
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
