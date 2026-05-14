 // Real-time notification hook with Supabase Realtime
 import { useState, useEffect, useCallback } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useAuth } from '@/hooks/useAuth';
 import { markAsRead, markAllAsRead, NotificationType, NotificationData } from '@/services/notificationService';
 
 export interface Notification {
   id: string;
   type: string;
   title: string;
   message: string;
   data: Record<string, any>;
   read: boolean;
   created_at: string;
 }
 
 export function useNotifications(limit: number = 20) {
   const { user } = useAuth();
   const [notifications, setNotifications] = useState<Notification[]>([]);
   const [unreadCount, setUnreadCount] = useState(0);
   const [loading, setLoading] = useState(true);
 
   // Fetch notifications
   const fetchNotifications = useCallback(async () => {
     if (!user) return;
 
     try {
       const { data, error } = await supabase
         .from('notifications')
         .select('*')
         .eq('user_id', user.id)
         .order('created_at', { ascending: false })
         .limit(limit);
 
       if (error) {
         console.error('[useNotifications] Fetch error:', error);
         return;
       }
 
       const typedData = (data || []) as Notification[];
       setNotifications(typedData);
       setUnreadCount(typedData.filter(n => !n.read).length);
     } catch (err) {
       console.error('[useNotifications] Error:', err);
     } finally {
       setLoading(false);
     }
   }, [user, limit]);
 
   // Mark single notification as read
   const handleMarkAsRead = useCallback(async (notificationId: string) => {
     const success = await markAsRead(notificationId);
     if (success) {
       setNotifications(prev => 
         prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
       );
       setUnreadCount(prev => Math.max(0, prev - 1));
     }
     return success;
   }, []);
 
   // Mark all as read
   const handleMarkAllAsRead = useCallback(async () => {
     if (!user) return false;
     const success = await markAllAsRead(user.id);
     if (success) {
       setNotifications(prev => prev.map(n => ({ ...n, read: true })));
       setUnreadCount(0);
     }
     return success;
   }, [user]);
 
   // Initial fetch and realtime subscription
   useEffect(() => {
     if (!user) {
       setNotifications([]);
       setUnreadCount(0);
       setLoading(false);
       return;
     }
 
     fetchNotifications();
 
     // Subscribe to realtime updates
     const channel = supabase
       .channel(`notifications:${user.id}`)
       .on(
         'postgres_changes',
         {
           event: 'INSERT',
           schema: 'public',
           table: 'notifications',
           filter: `user_id=eq.${user.id}`,
         },
         (payload) => {
           const newNotification = payload.new as Notification;
           setNotifications(prev => [newNotification, ...prev.slice(0, limit - 1)]);
           if (!newNotification.read) {
             setUnreadCount(prev => prev + 1);
           }
         }
       )
       .subscribe();
 
     return () => {
       supabase.removeChannel(channel);
     };
   }, [user, limit, fetchNotifications]);
 
   return {
     notifications,
     unreadCount,
     loading,
     markAsRead: handleMarkAsRead,
     markAllAsRead: handleMarkAllAsRead,
     refresh: fetchNotifications,
   };
 }