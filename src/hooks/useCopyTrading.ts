import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

/**
 * Shared hook — surfaces the user's active copy-trading state and a
 * `stopAllCopying` action. Used by CopyTradingNew, MentorHub, and
 * MentorCenter so the "Copy Trading Active" banner behaves identically
 * across dashboards.
 */
export function useCopyTrading() {
  const { user } = useAuth();
  const [activeRelationships, setActiveRelationships] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setActiveRelationships([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("copy_trading_relationships")
      .select("id, master_account_id, master_user_id")
      .eq("follower_user_id", user.id)
      .eq("status", "active");
    setActiveRelationships(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stopAllCopying = useCallback(async () => {
    if (!user) return;
    const { error } = await supabase
      .from("copy_trading_relationships")
      .update({ status: "inactive" })
      .eq("follower_user_id", user.id)
      .eq("status", "active");
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Copy trading stopped",
      description: "All active copy relationships have been paused.",
    });
    setActiveRelationships([]);
  }, [user]);

  return { activeRelationships, isActive: activeRelationships.length > 0, loading, refresh, stopAllCopying };
}
