import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SharerKind } from "@/lib/referral";

/** Works out whether the signed-in user shares as a mentor (slug) or affiliate (code). Mentor wins. */
export function useSharerIdentity(userId?: string | null) {
  const [identity, setIdentity] = useState<{ kind: SharerKind; code: string | null }>({ kind: "none", code: null });
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: m } = await supabase.from("mentor_profiles").select("referral_slug").eq("user_id", userId).eq("is_active", true).maybeSingle();
      if (m?.referral_slug) { if (!cancelled) setIdentity({ kind: "mentor", code: m.referral_slug }); return; }
      const { data: a } = await supabase.from("affiliates").select("referral_code").eq("user_id", userId).eq("status", "active").maybeSingle();
      if (!cancelled) setIdentity(a?.referral_code ? { kind: "affiliate", code: a.referral_code } : { kind: "none", code: null });
    })();
    return () => { cancelled = true; };
  }, [userId]);
  return identity;
}
