import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface FeatureRenames {
  ai_bot_name: string;
  copy_trading_name: string;
  trading_ideas_name: string;
}

interface UiConfig {
  primary_color?: string;
  secondary_color?: string;
  welcome_text?: string;
  logo_url?: string;
}

interface MentorContextType {
  isMentorClient: boolean;
  isMentor: boolean;
  isDefaultMentorClient: boolean;
  mentorBrandName: string | null;
  featureRenames: FeatureRenames;
  mentorId: string | null;
  mentorUserId: string | null;
  mentorMediaUrl: string | null;
  mentorMediaType: string | null;
  mentorUiConfig: UiConfig;
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
  isMentor: false,
  isDefaultMentorClient: false,
  mentorBrandName: null,
  featureRenames: defaultRenames,
  mentorId: null,
  mentorUserId: null,
  mentorMediaUrl: null,
  mentorMediaType: null,
  mentorUiConfig: {},
  loading: true,
  getFeatureName: (key) => defaultRenames[key],
});

export function MentorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isMentorClient, setIsMentorClient] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [isDefaultMentorClient, setIsDefaultMentorClient] = useState(false);
  const [mentorBrandName, setMentorBrandName] = useState<string | null>(null);
  const [featureRenames, setFeatureRenames] = useState<FeatureRenames>(defaultRenames);
  const [mentorId, setMentorId] = useState<string | null>(null);
  const [mentorUserId, setMentorUserId] = useState<string | null>(null);
  const [mentorMediaUrl, setMentorMediaUrl] = useState<string | null>(null);
  const [mentorMediaType, setMentorMediaType] = useState<string | null>(null);
  const [mentorUiConfig, setMentorUiConfig] = useState<UiConfig>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadMentorContext = async () => {
      try {
        // Read default mentor slug
        const { data: setting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'default_mentor_slug')
          .maybeSingle();
        const defaultSlug = setting?.value || null;

        const { data: mentorProfile } = await supabase
          .from('mentor_profiles')
          .select('id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        
        if (mentorProfile) {
          setIsMentor(true);
        }

        const { data: clientRecord } = await supabase
          .from('mentor_clients')
          .select('mentor_id, referral_slug_used')
          .eq('client_user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (clientRecord?.mentor_id) {
          const { data: mentor } = await supabase
            .from('mentor_profiles')
            .select('id, user_id, brand_name, feature_renames, is_active, ui_config, landing_page_media_url, landing_page_media_type, referral_slug')
            .eq('id', clientRecord.mentor_id)
            .eq('is_active', true)
            .maybeSingle();

          if (mentor) {
            setIsMentorClient(true);
            const isDefault = !!defaultSlug && mentor.referral_slug === defaultSlug;
            setIsDefaultMentorClient(isDefault);
            setMentorBrandName(mentor.brand_name);
            setMentorId(mentor.id);
            setMentorUserId(mentor.user_id);
            setMentorMediaUrl(mentor.landing_page_media_url);
            setMentorMediaType(mentor.landing_page_media_type);
            
            const uiConfig = mentor.ui_config as unknown as UiConfig;
            if (uiConfig) {
              setMentorUiConfig(uiConfig);
            }

            const renames = mentor.feature_renames as unknown as FeatureRenames;
            if (renames) {
              setFeatureRenames({
                ai_bot_name: renames.ai_bot_name || defaultRenames.ai_bot_name,
                copy_trading_name: renames.copy_trading_name || defaultRenames.copy_trading_name,
                trading_ideas_name: renames.trading_ideas_name || defaultRenames.trading_ideas_name,
              });
            }

            // Apply branding CSS variables — only for genuinely-referred clients (not default)
            if (!isDefault) {
              const root = document.documentElement;
              if (uiConfig?.primary_color) {
                root.style.setProperty('--mentor-primary', uiConfig.primary_color);
              }
              if (uiConfig?.secondary_color) {
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
      const root = document.documentElement;
      root.style.removeProperty('--mentor-primary');
      root.style.removeProperty('--mentor-secondary');
    };
  }, [user]);

  const getFeatureName = (key: keyof FeatureRenames) => featureRenames[key];

  return (
    <MentorContext.Provider value={{ 
      isMentorClient, isMentor, isDefaultMentorClient, mentorBrandName, featureRenames, mentorId, mentorUserId,
      mentorMediaUrl, mentorMediaType, mentorUiConfig, loading, getFeatureName 
    }}>
      {children}
    </MentorContext.Provider>
  );
}

export const useMentor = () => useContext(MentorContext);
