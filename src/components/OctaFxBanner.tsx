import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const OCTAFX_LINK = "https://octa.click/b3gtWBN3fii?ib=44960573";
const DISMISS_KEY = "octafx_banner_dismissed";

export default function OctaFxBanner() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === 'true');

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  return (
    <Card className="relative overflow-hidden border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors z-10"
        aria-label="Dismiss banner"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
      <CardContent className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 text-center md:text-left">
          <h3 className="text-lg font-bold text-foreground">Get 100% Free Trading Bonus 🎉</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Open an OctaFx account and get a 100% deposit bonus on your first deposit. Start trading with double the capital!
          </p>
        </div>
        <Button 
          onClick={() => window.open(OCTAFX_LINK, '_blank')}
          className="flex items-center gap-2 whitespace-nowrap"
          size="lg"
        >
          <ExternalLink className="w-4 h-4" />
          Claim Bonus Now
        </Button>
      </CardContent>
    </Card>
  );
}
