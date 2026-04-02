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
  mentorMediaUrl: string | null;
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
  mentorMediaUrl: null,
  loading: true,
  getFeatureName: (key) => defaultRenames[key],
});

export function MentorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isMentorClient, setIsMentorClient] = useState(false);
  const [mentorBrandName, setMentorBrandName] = useState<string | null>(null);
  const [featureRenames, setFeatureRenames] = useState<FeatureRenames>(defaultRenames);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentorMediaUrl, setMentorMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadMentorContext = async () => {
      try {
        const { data: clientRecord } = await supabase
          .from('mentor_clients')
          .select('mentor_id')
          .eq('client_user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (clientRecord?.mentor_id) {
          const { data: mentor } = await supabase
            .from('mentor_profiles')
            .select('id, brand_name, feature_renames, is_active, ui_config, landing_page_media_url')
            .eq('id', clientRecord.mentor_id)
            .eq('is_active', true)
            .maybeSingle();

          if (mentor) {
            setIsMentorClient(true);
            setMentorBrandName(mentor.brand_name);
            setMentorId(mentor.id);
            setMentorMediaUrl(mentor.landing_page_media_url);
            
            const renames = mentor.feature_renames as unknown as FeatureRenames;
            if (renames) {
              setFeatureRenames({
                ai_bot_name: renames.ai_bot_name || defaultRenames.ai_bot_name,
                copy_trading_name: renames.copy_trading_name || defaultRenames.copy_trading_name,
                trading_ideas_name: renames.trading_ideas_name || defaultRenames.trading_ideas_name,
              });
            }

            // Apply branding CSS variables if ui_config exists
            const uiConfig = mentor.ui_config as Record<string, string> | null;
            if (uiConfig) {
              const root = document.documentElement;
              if (uiConfig.primary_color) {
                root.style.setProperty('--mentor-primary', uiConfig.primary_color);
              }
              if (uiConfig.secondary_color) {
                root.style.setProperty('--mentor-secondary', uiConfig.secondary_color);
              }
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

    return () => {
      // Clean up custom CSS variables
      const root = document.documentElement;
      root.style.removeProperty('--mentor-primary');
      root.style.removeProperty('--mentor-secondary');
    };
  }, [user]);

  const getFeatureName = (key: keyof FeatureRenames) => featureRenames[key];

  return (
    <MentorContext.Provider value={{ isMentorClient, mentorBrandName, featureRenames, mentorId, mentorMediaUrl, loading, getFeatureName }}>
      {children}
    </MentorContext.Provider>
  );
}

export const useMentor = () => useContext(MentorContext);
