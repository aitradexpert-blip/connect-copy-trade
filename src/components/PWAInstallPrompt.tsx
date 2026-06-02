import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export const PWAInstallPrompt = () => {
  const { showBanner, install, dismiss } = usePWAInstall();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border border-border rounded-lg p-4 shadow-lg z-50">
      <button
        onClick={dismiss}
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
            <Button size="sm" onClick={install}>
              Install
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
