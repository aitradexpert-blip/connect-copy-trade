 // Hook to fetch subscription plans from database (single source of truth)
 import { useState, useEffect } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 
 export interface SubscriptionPlan {
   id: string;
   name: string;
   price_usd: number;
   price_zar: number;
   trading_accounts_limit: number | null;
   copy_accounts_limit: number | null;
   auto_trades_limit: number | null;
   ai_bots_enabled: boolean | null;
   custom_risk_enabled: boolean | null;
   priority_support: boolean | null;
   features: any;
 }
 
  // Feature list generator based on plan data
  export function getFeatureList(plan: SubscriptionPlan): string[] {
    const features: string[] = [];
    
    // Daily Trading Ideas - available on ALL tiers
    features.push('Daily Trading Ideas');
    
    if (plan.auto_trades_limit === null || plan.auto_trades_limit >= 1000) {
      features.push('Unlimited Auto-trades');
    } else {
      features.push(`${plan.auto_trades_limit} Auto-trades per month`);
    }
    
    features.push(`${plan.trading_accounts_limit || 2} Trading accounts`);
    features.push(`${plan.copy_accounts_limit || 1} Copy trading connection${(plan.copy_accounts_limit || 1) > 1 ? 's' : ''}`);
    
    if (plan.priority_support) {
      features.push(plan.name.toLowerCase() === 'enterprise' ? '24/7 Phone + VIP support' : 'Priority email + Live chat');
    } else {
      features.push('Email support (48h response)');
    }
    
    features.push(plan.priority_support ? 'Full analytics suite' : 'Basic analytics');
    
    if (plan.custom_risk_enabled) {
      features.push('Custom risk settings');
    }
    
    if (plan.ai_bots_enabled) {
      features.push(plan.name.toLowerCase() === 'enterprise' ? 'All AI Bots' : 'AI Bot access');
    }
    
    if (plan.name.toLowerCase() === 'enterprise') {
      features.push('Dedicated account manager');
    }
    
    return features;
  }
 
 export function useSubscriptionPlans() {
   const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
 
   useEffect(() => {
     const fetchPlans = async () => {
       try {
         const { data, error: fetchError } = await supabase
           .from('subscription_plans')
           .select('*')
           .order('price_zar', { ascending: true });
 
         if (fetchError) {
           console.error('[useSubscriptionPlans] Error:', fetchError);
           setError(fetchError.message);
           return;
         }
 
         setPlans(data || []);
       } catch (err: any) {
         console.error('[useSubscriptionPlans] Error:', err);
         setError(err.message);
       } finally {
         setLoading(false);
       }
     };
 
     fetchPlans();
   }, []);
 
   return { plans, loading, error };
 }