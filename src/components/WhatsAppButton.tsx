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
}

const WHATSAPP_NUMBER = "27658323910";

export default function WhatsAppButton({ keyword, label, description, icon, className, variant = 'outline' }: WhatsAppButtonProps) {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(keyword)}`;

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
