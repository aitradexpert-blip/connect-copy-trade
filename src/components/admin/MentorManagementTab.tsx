import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Crown, Users, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MentorData {
  id: string;
  user_id: string;
  brand_name: string;
  referral_slug: string;
  feature_renames: any;
  is_active: boolean;
  created_at: string;
  client_count?: number;
}

export function MentorManagementTab() {
  const { toast } = useToast();
  const [mentors, setMentors] = useState<MentorData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMentors();
  }, []);

  const loadMentors = async () => {
    setLoading(true);
    try {
      const { data: mentorData } = await supabase
        .from('mentor_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (mentorData) {
        // Get client counts
        const mentorsWithCounts = await Promise.all(
          mentorData.map(async (m) => {
            const { count } = await supabase
              .from('mentor_clients')
              .select('*', { count: 'exact', head: true })
              .eq('mentor_id', m.id);
            return { ...m, client_count: count || 0 };
          })
        );
        setMentors(mentorsWithCounts);
      }
    } catch (err) {
      console.error("Error loading mentors:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleMentorStatus = async (mentorId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('mentor_profiles')
        .update({ is_active: !currentStatus })
        .eq('id', mentorId);

      if (error) throw error;
      toast({ title: `Mentor ${currentStatus ? 'deactivated' : 'activated'}` });
      loadMentors();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading mentors...</div>;
  }

  return (
    <Card className="bg-gradient-card border-border shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Mentor Management
        </CardTitle>
        <CardDescription>View and manage all mentor profiles (read-only)</CardDescription>
      </CardHeader>
      <CardContent>
        {mentors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No mentors registered yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Brand</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Clients</TableHead>
                <TableHead>Custom Names</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mentors.map(mentor => {
                const renames = mentor.feature_renames || {};
                return (
                  <TableRow key={mentor.id}>
                    <TableCell className="font-medium">{mentor.brand_name}</TableCell>
                    <TableCell className="text-xs font-mono">/ref/{mentor.referral_slug}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                        <Users className="h-3 w-3" />
                        {mentor.client_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {renames.ai_bot_name !== 'AI Trading Bot' && <div>Bot: {renames.ai_bot_name}</div>}
                      {renames.copy_trading_name !== 'Copy Trading' && <div>Copy: {renames.copy_trading_name}</div>}
                      {renames.trading_ideas_name !== 'Trading Ideas' && <div>Ideas: {renames.trading_ideas_name}</div>}
                      {renames.ai_bot_name === 'AI Trading Bot' && renames.copy_trading_name === 'Copy Trading' && renames.trading_ideas_name === 'Trading Ideas' && (
                        <span className="text-muted-foreground">Default</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={mentor.is_active ? "default" : "destructive"}>
                        {mentor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(mentor.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={mentor.is_active ? "destructive" : "default"}
                        onClick={() => toggleMentorStatus(mentor.id, mentor.is_active)}
                      >
                        {mentor.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
