import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Share2, MessageCircle, Send, Facebook, Instagram, Music2, Link2 } from "lucide-react";

interface Props { text: string; url: string; size?: "sm" | "default"; }

export default function ShareMenu({ text, url, size = "sm" }: Props) {
  const { toast } = useToast();
  const full = `${text}\n\n${url}`;
  const enc = encodeURIComponent;
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  const copyThenOpen = async (app: string, href: string) => {
    // TikTok & Instagram have no web share link: use the phone share sheet, else copy the caption.
    if (navigator.share) {
      try { await navigator.share({ text, url }); return; } catch { /* cancelled */ }
    }
    await navigator.clipboard?.writeText(full).catch(() => {});
    toast({ title: `Caption copied for ${app}`, description: "Paste it into your post or story." });
    open(href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="h-8 px-2"><Share2 className="h-4 w-4 mr-1" />Share</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" onClick={() => open(`https://wa.me/?text=${enc(full)}`)}><MessageCircle className="h-4 w-4 mr-2" />WhatsApp</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={() => open(`https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`)}><Send className="h-4 w-4 mr-2" />Telegram</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`)}><Facebook className="h-4 w-4 mr-2" />Facebook</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={() => copyThenOpen("Instagram", "https://www.instagram.com/")}><Instagram className="h-4 w-4 mr-2" />Instagram</DropdownMenuItem>
        <DropdownMenuItem className="min-h-11" onClick={() => copyThenOpen("TikTok", "https://www.tiktok.com/upload")}><Music2 className="h-4 w-4 mr-2" />TikTok</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onClick={async () => { await navigator.clipboard?.writeText(full); toast({ title: "Link copied" }); }}><Link2 className="h-4 w-4 mr-2" />Copy link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
