import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StopCircle } from "lucide-react";
import { useCopyTrading } from "@/hooks/useCopyTrading";

/**
 * Standalone banner — visible on every dashboard when the user has active
 * copy relationships. Keeps state/UI identical across CopyTradingNew,
 * MentorHub, and MentorCenter.
 */
export default function CopyTradingActiveBanner({ className }: { className?: string }) {
  const { isActive, stopAllCopying } = useCopyTrading();
  if (!isActive) return null;
  return (
    <Card className={`border-profit/30 bg-profit/10 ${className || ""}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-profit animate-pulse" />
            <div>
              <p className="font-semibold text-profit">Copy Trading Active</p>
              <p className="text-sm text-muted-foreground">
                Your mentor's trades are being copied to your account
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={stopAllCopying}
            className="flex items-center gap-2"
          >
            <StopCircle className="w-4 h-4" />
            Stop Copy Trading
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
