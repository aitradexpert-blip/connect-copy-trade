 import { useState } from "react";
 import AppLayout from "@/components/AppLayout";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
 import { Bell, Check, CheckCheck, TrendingUp, Bot, Users, Settings } from "lucide-react";
 import { useNotifications, Notification } from "@/hooks/useNotifications";
 import { formatDistanceToNow } from "date-fns";
 
 const NOTIFICATION_ICONS: Record<string, React.ReactNode> = {
   COPY_TRADE_EXECUTED: <Users className="w-4 h-4 text-blue-500" />,
   NEW_IDEA_PUBLISHED: <TrendingUp className="w-4 h-4 text-green-500" />,
   AI_BOT_TRADE: <Bot className="w-4 h-4 text-purple-500" />,
   SUBSCRIPTION_ACTIVATED: <Check className="w-4 h-4 text-green-500" />,
   ACCOUNT_CONNECTED: <Settings className="w-4 h-4 text-blue-500" />,
   SYSTEM: <Bell className="w-4 h-4 text-muted-foreground" />,
 };
 
 const NOTIFICATION_FILTERS = [
   { value: 'all', label: 'All' },
   { value: 'COPY_TRADE_EXECUTED', label: 'Copy Trading' },
   { value: 'NEW_IDEA_PUBLISHED', label: 'Trade Ideas' },
   { value: 'AI_BOT_TRADE', label: 'AI Bot' },
   { value: 'SYSTEM', label: 'System' },
 ];
 
 function NotificationItem({ 
   notification, 
   onMarkAsRead 
 }: { 
   notification: Notification; 
   onMarkAsRead: (id: string) => void;
 }) {
   const icon = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.SYSTEM;
   
   return (
     <div 
       className={`p-4 rounded-lg border transition-colors ${
         notification.read 
           ? 'bg-background border-border' 
           : 'bg-primary/5 border-primary/20'
       }`}
     >
       <div className="flex items-start gap-3">
         <div className="mt-1">{icon}</div>
         <div className="flex-1 min-w-0">
           <div className="flex items-center gap-2 mb-1">
             <h4 className="font-medium text-sm">{notification.title}</h4>
             {!notification.read && (
               <Badge variant="default" className="text-xs px-1.5 py-0">New</Badge>
             )}
           </div>
           <p className="text-sm text-muted-foreground">{notification.message}</p>
           <p className="text-xs text-muted-foreground mt-1">
             {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
           </p>
         </div>
         {!notification.read && (
           <Button 
             variant="ghost" 
             size="sm"
             onClick={() => onMarkAsRead(notification.id)}
           >
             <Check className="w-4 h-4" />
           </Button>
         )}
       </div>
     </div>
   );
 }
 
 export default function Notifications() {
   const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications(100);
   const [filter, setFilter] = useState('all');
 
   const filteredNotifications = filter === 'all' 
     ? notifications 
     : notifications.filter(n => n.type === filter);
 
   return (
     <AppLayout>
       <div className="space-y-6">
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-3xl font-bold text-foreground">Notifications</h1>
             <p className="text-muted-foreground mt-1">
               {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
             </p>
           </div>
           {unreadCount > 0 && (
             <Button variant="outline" onClick={markAllAsRead}>
               <CheckCheck className="w-4 h-4 mr-2" />
               Mark all as read
             </Button>
           )}
         </div>
 
         <Tabs value={filter} onValueChange={setFilter}>
           <TabsList>
             {NOTIFICATION_FILTERS.map(f => (
               <TabsTrigger key={f.value} value={f.value}>
                 {f.label}
               </TabsTrigger>
             ))}
           </TabsList>
         </Tabs>
 
         <Card className="bg-gradient-card border-border shadow-card">
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
               <Bell className="w-5 h-5" />
               {filter === 'all' ? 'All Notifications' : NOTIFICATION_FILTERS.find(f => f.value === filter)?.label}
             </CardTitle>
           </CardHeader>
           <CardContent>
             {loading ? (
               <div className="flex items-center justify-center py-8">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
               </div>
             ) : filteredNotifications.length === 0 ? (
               <div className="text-center py-12">
                 <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                 <h3 className="text-lg font-medium mb-2">No notifications</h3>
                 <p className="text-muted-foreground">
                   {filter === 'all' 
                     ? "You don't have any notifications yet." 
                     : `No ${NOTIFICATION_FILTERS.find(f => f.value === filter)?.label.toLowerCase()} notifications.`}
                 </p>
               </div>
             ) : (
               <div className="space-y-3">
                 {filteredNotifications.map(notification => (
                   <NotificationItem 
                     key={notification.id} 
                     notification={notification}
                     onMarkAsRead={markAsRead}
                   />
                 ))}
               </div>
             )}
           </CardContent>
         </Card>
       </div>
     </AppLayout>
   );
 }