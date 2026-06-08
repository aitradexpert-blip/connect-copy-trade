import { useEffect, useState } from "react";
import { Megaphone, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  starts_at: string;
  ends_at: string | null;
}

interface NoticeBoardProps {
  /** Filter to a specific audience or 'all' (default 'all') */
  audience?: 'all' | 'mentor_hub' | 'mentor_center';
  className?: string;
}

const DISMISS_KEY = "humi:dismissed-announcements";

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch {
    return [];
  }
}

export default function NoticeBoard({ audience = 'all', className = "" }: NoticeBoardProps) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(getDismissed());

  useEffect(() => {
    const load = async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from('announcements')
        .select('id, title, body, audience, starts_at, ends_at')
        .eq('is_active', true)
        .lte('starts_at', nowIso)
        .order('starts_at', { ascending: false });

      if (audience !== 'all') {
        q = q.in('audience', ['all', audience]);
      }
      const { data } = await q;
      const filtered = (data || []).filter(
        (a) => !a.ends_at || new Date(a.ends_at) > new Date()
      );
      setItems(filtered);
    };
    load();

    const channel = supabase
      .channel('announcements-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [audience]);

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {}
  };

  const visible = items.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {visible.map((a) => (
        <Card
          key={a.id}
          className="bg-primary/5 border-primary/30 shadow-sm"
        >
          <CardContent className="p-4 flex items-start gap-3">
            <Megaphone className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground">{a.title}</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{a.body}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss"
              className="flex-shrink-0 h-7 w-7 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
