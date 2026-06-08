import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface TelegramButtonProps {
  label: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  /** "channel" opens the public HuMi Telegram channel; "dm" opens a DM with @mansamusafx (App download / support). */
  mode?: 'channel' | 'dm';
  /** Override destination URL */
  href?: string;
}

export const TELEGRAM_CHANNEL_URL = "https://t.me/+dFAS3vs7awAwOWJk";
export const TELEGRAM_DM_URL = "https://t.me/mansamusafx";

export default function TelegramButton({
  label,
  description,
  icon,
  className,
  variant = 'outline',
  mode = 'channel',
  href,
}: TelegramButtonProps) {
  const url = href ?? (mode === 'dm' ? TELEGRAM_DM_URL : TELEGRAM_CHANNEL_URL);

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      <Button variant={variant} className="w-full h-auto py-3 px-4 flex items-start gap-3 text-left">
        <div className="flex-shrink-0 mt-0.5">
          {icon || <Send className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-sm">{label}</span>
          {description && (
            <span className="text-xs text-muted-foreground mt-0.5">{description}</span>
          )}
        </div>
      </Button>
    </a>
  );
}
