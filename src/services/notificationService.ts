 // Notification Service - Create and manage user notifications
 import { supabase } from "@/integrations/supabase/client";
 
 export type NotificationType = 
   | 'COPY_TRADE_EXECUTED'
   | 'NEW_IDEA_PUBLISHED'
   | 'AI_BOT_TRADE'
   | 'SUBSCRIPTION_ACTIVATED'
   | 'ACCOUNT_CONNECTED'
   | 'WITHDRAWAL_PROCESSED'
   | 'SYSTEM';
 
 export interface NotificationData {
   symbol?: string;
   direction?: string;
   account?: string;
   plan?: string;
   link?: string;
   [key: string]: any;
 }
 
 /**
  * Create a notification for a user (client-side)
  * Note: For server-side (edge functions), insert directly with service role
  */
 export async function createNotification(
   userId: string,
   type: NotificationType,
   title: string,
   message: string,
   data?: NotificationData
 ): Promise<{ success: boolean; error?: string }> {
   try {
     // Use a direct REST API call with anon key for authenticated user
     const { error } = await supabase.from('notifications').insert({
       user_id: userId,
       type,
       title,
       message,
       data: data || {},
     });
 
     if (error) {
       console.error('[NotificationService] Failed to create notification:', error);
       return { success: false, error: error.message };
     }
 
     return { success: true };
   } catch (err: any) {
     console.error('[NotificationService] Error:', err);
     return { success: false, error: err.message };
   }
 }
 
 /**
  * Mark a notification as read
  */
 export async function markAsRead(notificationId: string): Promise<boolean> {
   try {
     const { error } = await supabase
       .from('notifications')
       .update({ read: true })
       .eq('id', notificationId);
 
     return !error;
   } catch (err) {
     console.error('[NotificationService] markAsRead error:', err);
     return false;
   }
 }
 
 /**
  * Mark all notifications as read for a user
  */
 export async function markAllAsRead(userId: string): Promise<boolean> {
   try {
     const { error } = await supabase
       .from('notifications')
       .update({ read: true })
       .eq('user_id', userId)
       .eq('read', false);
 
     return !error;
   } catch (err) {
     console.error('[NotificationService] markAllAsRead error:', err);
     return false;
   }
 }
 
 /**
  * Get notifications for a user
  */
 export async function getNotifications(
   userId: string,
   limit: number = 20,
   unreadOnly: boolean = false
 ): Promise<Array<{
   id: string;
   type: string;
   title: string;
   message: string;
   data: Record<string, any>;
   read: boolean;
   created_at: string;
 }>> {
   try {
     let query = supabase
       .from('notifications')
       .select('*')
       .eq('user_id', userId)
       .order('created_at', { ascending: false })
       .limit(limit);
 
     if (unreadOnly) {
       query = query.eq('read', false);
     }
 
     const { data, error } = await query;
 
     if (error) {
       console.error('[NotificationService] Failed to fetch notifications:', error);
       return [];
     }
 
     return (data || []).map(item => ({
       ...item,
       data: (item.data as Record<string, any>) || {},
     }));
   } catch (err) {
     console.error('[NotificationService] Error:', err);
     return [];
   }
 }