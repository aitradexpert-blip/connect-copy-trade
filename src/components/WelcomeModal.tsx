import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Smartphone, CheckCircle } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const ONBOARDED_KEY = "humi_onboarded";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const { canInstall, install } = usePWAInstall();

  useEffect(() => {
    if (localStorage.getItem(ONBOARDED_KEY) !== "true") {
      // Small delay so the page renders first
      const t = setTimeout(() => setOpen(true), 1000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(ONBOARDED_KEY, "true");
  };

  const handleInstall = async () => {
    if (canInstall) {
      await install();
    }
    handleClose();
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">Welcome to HuMi! 🎉</DialogTitle>
          <DialogDescription className="text-center">
            Your all-in-one trading dashboard is ready. Here's what you can do:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {[
            "Connect your MT4, MT5 or Deriv trading accounts",
            "Get AI-powered trading signals from Khumo",
            "Copy verified master traders automatically",
            "Track your performance with analytics"
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="border-t pt-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4" /> Install the App
          </p>
          {canInstall ? (
            <Button onClick={handleInstall} className="w-full bg-gradient-primary">
              <Download className="w-4 h-4 mr-2" /> Install HuMi App
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1 bg-muted p-3 rounded-lg">
              {isIOS ? (
                <p>Open in <strong>Safari</strong> → tap <strong>Share ↗</strong> → <strong>"Add to Home Screen"</strong></p>
              ) : isAndroid ? (
                <p>Open in <strong>Chrome</strong> → tap <strong>⋮ Menu</strong> → <strong>"Add to Home Screen"</strong></p>
              ) : (
                <p>Open in <strong>Chrome</strong> → click the install icon in the address bar, or use <strong>⋮ → Install App</strong></p>
              )}
            </div>
          )}
        </div>

        <Button onClick={handleClose} variant="outline" className="w-full">
          Get Started
        </Button>
      </DialogContent>
    </Dialog>
  );
}
