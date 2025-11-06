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

export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

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
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscription();
    
    // Subscribe to realtime updates
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

  const canAccessFeature = (feature: string): boolean => {
    if (!subscription) return false;
    const plan = subscription.subscription_plans;
    
    switch(feature) {
      case 'ai_bots':
        return plan.ai_bots_enabled;
      case 'priority_support':
        return plan.priority_support;
      case 'custom_risk':
        return plan.custom_risk_enabled;
      default:
        return true;
    }
  };

  const hasCreditsRemaining = (): boolean => {
    if (!subscription) return false;
    const limit = subscription.subscription_plans.auto_trades_limit;
    if (limit === -1) return true; // Unlimited
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
    getRemainingTrades
  };
};
