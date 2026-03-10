import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface SubscriptionPlan {
  name: string;
  price_zar: number;
  price_usd: number;
  auto_trades_limit: number;
  trading_accounts_limit: number;
  copy_accounts_limit: number;
  ai_bots_enabled: boolean;
  priority_support: boolean;
  custom_risk_enabled: boolean;
  features: string[];
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: 'active' | 'inactive' | 'cancelled' | 'expired';
  started_at: string;
  expires_at: string;
  auto_trades_used: number;
  last_reset_at: string;
  subscription_plans: SubscriptionPlan;
}

export type TierName = 'free' | 'basic' | 'professional' | 'enterprise' | 'mentor';

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [khumoQueriesUsed, setKhumoQueriesUsed] = useState(0);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const fetchSubscription = async () => {
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans(*)
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();
        
        if (!error) {
          setSubscription(data as unknown as UserSubscription);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
      
      // Fetch khumo query usage from profiles
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('khumo_queries_used, khumo_queries_reset_at')
          .eq('user_id', user.id)
          .single();
        
        if (profile) {
          // Check if reset is needed (older than 30 days)
          const resetAt = new Date(profile.khumo_queries_reset_at);
          const now = new Date();
          const daysSinceReset = (now.getTime() - resetAt.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceReset >= 30) {
            setKhumoQueriesUsed(0);
          } else {
            setKhumoQueriesUsed(profile.khumo_queries_used || 0);
          }
        }
      } catch (err) {
        console.error('Error fetching khumo queries:', err);
      }
      
      setLoading(false);
    };
    
    fetchSubscription();
    
    const channel = supabase
      .channel('subscription-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_subscriptions',
        filter: `user_id=eq.${user.id}`
      }, fetchSubscription)
      .subscribe();
      
    return () => { 
      channel.unsubscribe(); 
    };
  }, [user]);

  const tierName: TierName = subscription 
    ? (subscription.plan_name?.toLowerCase() as TierName) || 'basic'
    : 'free';

  const isFree = tierName === 'free';

  const khumoQueryLimit = (() => {
    switch (tierName) {
      case 'free': return 5;
      case 'basic': return 50;
      default: return Infinity;
    }
  })();

  const khumoQueriesRemaining = Math.max(0, khumoQueryLimit - khumoQueriesUsed);

  const canAccessFeature = (feature: string): boolean => {
    if (isFree) {
      // Free tier features
      const freeFeatures = ['training', 'charts', 'journal_manual', 'notifications_basic', 'whatsapp_tools'];
      return freeFeatures.includes(feature);
    }
    if (!subscription) return false;
    const plan = subscription.subscription_plans;
    
    switch(feature) {
      case 'ai_bots':
        return plan.ai_bots_enabled;
      case 'priority_support':
        return plan.priority_support;
      case 'custom_risk':
        return plan.custom_risk_enabled;
      case 'training':
      case 'charts':
      case 'journal_manual':
      case 'notifications_basic':
      case 'whatsapp_tools':
        return true;
      default:
        return true;
    }
  };

  const hasCreditsRemaining = (): boolean => {
    if (!subscription) return false;
    const limit = subscription.subscription_plans.auto_trades_limit;
    if (limit === -1) return true;
    return subscription.auto_trades_used < limit;
  };

  const getRemainingTrades = (): number => {
    if (!subscription) return 0;
    const limit = subscription.subscription_plans.auto_trades_limit;
    if (limit === -1) return Infinity;
    return Math.max(0, limit - subscription.auto_trades_used);
  };

  return { 
    subscription, 
    loading, 
    canAccessFeature, 
    hasCreditsRemaining,
    getRemainingTrades,
    tierName,
    isFree,
    khumoQueriesUsed,
    khumoQueriesRemaining,
    khumoQueryLimit,
  };
};
