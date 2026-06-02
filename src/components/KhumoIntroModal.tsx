import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, TreeDeciduous, Brain, TrendingUp } from "lucide-react";

export default function KhumoIntroModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Check if user has seen the intro
    const hasSeenIntro = localStorage.getItem("khumo_intro_seen");
    if (!hasSeenIntro) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("khumo_intro_seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary" />
            Meet Khumo
          </DialogTitle>
          <DialogDescription className="text-base">
            The Market's Memory — Your Trading Companion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Khumo studies institutional footprints to help you understand WHY
            markets move at their deepest structural level.
          </p>

          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <TreeDeciduous className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">The Root System</p>
                <p className="text-xs text-muted-foreground">
                  I teach by tracing concepts back to their origins. Every price
                  movement remembers why it started.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Brain className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Pattern Memory</p>
                <p className="text-xs text-muted-foreground">
                  I help you recognize institutional memory patterns and
                  understand market structure at a foundational level.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">What I Can Do</p>
                <p className="text-xs text-muted-foreground">
                  Check your balance, view positions, explain trading concepts,
                  fetch live prices, and prepare trade setups.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-xs font-medium text-primary mb-2">
              Try asking me:
            </p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• "What's the price of gold?"</li>
              <li>• "Explain Fair Value Gaps to me"</li>
              <li>• "What's my account balance?"</li>
              <li>• "Show me today's trading ideas"</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleClose} className="w-full">
          Let's Begin
        </Button>
      </DialogContent>
    </Dialog>
  );
}
