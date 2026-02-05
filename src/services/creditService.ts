 // Credit Service - Centralized credit deduction and tracking
 import { supabase } from "@/integrations/supabase/client";
 
 export const CREDIT_COSTS = {
   khumo_ai_query: 5,
   trade_execution: 2,
   copy_trade_setup: 3,
   signal_unlock: 1,
   voice_assistant: 3,
   ai_bot_trade: 2,
 } as const;
 
 export type CreditService = keyof typeof CREDIT_COSTS;
 
 /**
  * Deduct credits from user's account and log the usage
  */
 export async function deductCredits(
   userId: string,
   service: CreditService,
   description?: string
 ): Promise<{ success: boolean; error?: string }> {
   try {
     const creditsUsed = CREDIT_COSTS[service];
     
     const { error } = await supabase.from('credit_usage').insert({
       user_id: userId,
       service,
       credits_used: creditsUsed,
       description: description || `${service} usage`,
     });
 
     if (error) {
       console.error('[CreditService] Failed to log credit usage:', error);
       return { success: false, error: error.message };
     }
 
     console.log(`[CreditService] Deducted ${creditsUsed} credits for ${service} from user ${userId}`);
     return { success: true };
   } catch (err: any) {
     console.error('[CreditService] Error:', err);
     return { success: false, error: err.message };
   }
 }
 
 /**
  * Get total credits used by a user
  */
 export async function getTotalCreditsUsed(userId: string): Promise<number> {
   try {
     const { data, error } = await supabase
       .from('credit_usage')
       .select('credits_used')
       .eq('user_id', userId);
 
     if (error) {
       console.error('[CreditService] Failed to fetch credits:', error);
       return 0;
     }
 
     return data?.reduce((sum, row) => sum + row.credits_used, 0) || 0;
   } catch (err) {
     console.error('[CreditService] Error:', err);
     return 0;
   }
 }
 
 /**
  * Get credit usage history for a user
  */
 export async function getCreditHistory(
   userId: string,
   limit: number = 50
 ): Promise<Array<{
   id: string;
   service: string;
   credits_used: number;
   description: string | null;
   created_at: string;
 }>> {
   try {
     const { data, error } = await supabase
       .from('credit_usage')
       .select('*')
       .eq('user_id', userId)
       .order('created_at', { ascending: false })
       .limit(limit);
 
     if (error) {
       console.error('[CreditService] Failed to fetch history:', error);
       return [];
     }
 
     return data || [];
   } catch (err) {
     console.error('[CreditService] Error:', err);
     return [];
   }
 }