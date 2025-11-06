import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log('[PWA] Install outcome:', outcome);
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gradient-card border border-border rounded-lg p-4 shadow-elevated z-50">
      <button
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 text-primary flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Install HuMi App</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Get faster access and work offline by installing our app
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleInstall} className="bg-gradient-primary">
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowPrompt(false)}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
