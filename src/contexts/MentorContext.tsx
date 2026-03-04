import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeatureRenames {
  ai_bot_name: string;
  copy_trading_name: string;
  trading_ideas_name: string;
}

interface MentorContextType {
  isMentorClient: boolean;
  mentorBrandName: string | null;
  featureRenames: FeatureRenames;
  mentorId: string | null;
  loading: boolean;
  getFeatureName: (key: keyof FeatureRenames) => string;
}

const defaultRenames: FeatureRenames = {
  ai_bot_name: "AI Trading Bot",
  copy_trading_name: "Copy Trading",
  trading_ideas_name: "Trading Ideas",
};

const MentorContext = createContext<MentorContextType>({
  isMentorClient: false,
  mentorBrandName: null,
  featureRenames: defaultRenames,
  mentorId: null,
  loading: true,
  getFeatureName: (key) => defaultRenames[key],
});

export function MentorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isMentorClient, setIsMentorClient] = useState(false);
  const [mentorBrandName, setMentorBrandName] = useState<string | null>(null);
  const [featureRenames, setFeatureRenames] = useState<FeatureRenames>(defaultRenames);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadMentorContext = async () => {
      try {
        // Check if user is a client of any mentor
        const { data: clientRecord } = await supabase
          .from('mentor_clients')
          .select('mentor_id')
          .eq('client_user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (clientRecord?.mentor_id) {
          // Fetch mentor profile
          const { data: mentor } = await supabase
            .from('mentor_profiles')
            .select('id, brand_name, feature_renames, is_active')
            .eq('id', clientRecord.mentor_id)
            .eq('is_active', true)
            .maybeSingle();

          if (mentor) {
            setIsMentorClient(true);
            setMentorBrandName(mentor.brand_name);
            setMentorId(mentor.id);
            const renames = mentor.feature_renames as unknown as FeatureRenames;
            if (renames) {
              setFeatureRenames({
                ai_bot_name: renames.ai_bot_name || defaultRenames.ai_bot_name,
                copy_trading_name: renames.copy_trading_name || defaultRenames.copy_trading_name,
                trading_ideas_name: renames.trading_ideas_name || defaultRenames.trading_ideas_name,
              });
            }
          }
        }
      } catch (err) {
        console.error("Error loading mentor context:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMentorContext();
  }, [user]);

  const getFeatureName = (key: keyof FeatureRenames) => featureRenames[key];

  return (
    <MentorContext.Provider value={{ isMentorClient, mentorBrandName, featureRenames, mentorId, loading, getFeatureName }}>
      {children}
    </MentorContext.Provider>
  );
}

export const useMentor = () => useContext(MentorContext);
