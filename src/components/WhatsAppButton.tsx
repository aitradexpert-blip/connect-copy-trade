// Backwards-compatible shim: WhatsApp has been replaced by Telegram across HuMi.
// Existing imports of WhatsAppButton continue to work and now render a Telegram button.
import TelegramButton from "@/components/TelegramButton";
import { ReactNode } from "react";

interface WhatsAppButtonProps {
  keyword?: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  variant?: 'default' | 'outline' | 'secondary';
  mode?: 'channel' | 'dm';
}

export default function WhatsAppButton(props: WhatsAppButtonProps) {
  const { keyword: _keyword, ...rest } = props;
  return <TelegramButton {...rest} />;
}
