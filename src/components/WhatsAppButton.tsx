import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReactNode } from "react";

interface WhatsAppButtonProps {
  keyword: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  /** "channel" opens the public WhatsApp channel; "dm" opens a 1:1 chat with the business number. Defaults to "channel". */
  mode?: 'channel' | 'dm';
}

const WHATSAPP_NUMBER = "27658323910";
const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VaY0Klp9Gv7VhypIt61A";

export default function WhatsAppButton({ keyword, label, description, icon, className, variant = 'outline', mode = 'channel' }: WhatsAppButtonProps) {
  const url = mode === 'channel'
    ? WHATSAPP_CHANNEL_URL
    : `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(keyword)}`;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      <Button variant={variant} className="w-full h-auto py-3 px-4 flex items-start gap-3 text-left">
        <div className="flex-shrink-0 mt-0.5">
          {icon || <MessageCircle className="w-5 h-5 text-profit" />}
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
