import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'mentor_hub' | 'mentor_center' | 'admins';
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

export function AnnouncementsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Announcement['audience']>('all');
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: "Failed to load notices", description: error.message, variant: "destructive" });
      return;
    }
    setItems((data || []) as Announcement[]);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and body required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        title: title.trim(),
        body: body.trim(),
        audience,
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        created_by: user?.id,
      });
      if (error) throw error;
      toast({ title: "Notice published" });
      setTitle("");
      setBody("");
      setEndsAt("");
      setAudience('all');
      load();
    } catch (err: any) {
      toast({ title: "Failed to publish", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('announcements').update({ is_active }).eq('id', id);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this notice?")) return;
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5" /> Publish a Notice
          </CardTitle>
          <CardDescription>
            Shown on the main dashboard, Mentor Hub, and Mentor Center based on audience.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important update" />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Announcement['audience'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  <SelectItem value="mentor_hub">Mentor Hub only</SelectItem>
                  <SelectItem value="mentor_center">Mentor Center only</SelectItem>
                  <SelectItem value="admins">Admins only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              placeholder="Share the announcement details…"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expires (optional)</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button onClick={create} disabled={saving} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> {saving ? "Publishing…" : "Publish Notice"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-card border-border shadow-card">
        <CardHeader>
          <CardTitle>All Notices</CardTitle>
          <CardDescription>Toggle visibility or delete.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notices yet.</p>
          ) : (
            items.map((a) => (
              <div key={a.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.title}</span>
                    <Badge variant="outline">{a.audience}</Badge>
                    {!a.is_active && <Badge variant="secondary">Hidden</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{a.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(a.created_at).toLocaleString()}
                    {a.ends_at ? ` · ends ${new Date(a.ends_at).toLocaleString()}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.is_active} onCheckedChange={(v) => toggle(a.id, v)} />
                  <Button variant="ghost" size="sm" onClick={() => remove(a.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
