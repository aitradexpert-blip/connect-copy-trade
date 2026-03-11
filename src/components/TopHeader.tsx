import { Bell, User, LogOut, CreditCard, Settings, TrendingUp, Moon, Sun, Check, Download } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePWAInstall } from "@/hooks/usePWAInstall";

export function TopHeader() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(10);
  const { canInstall, install } = usePWAInstall();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">HuMi</h2>
          <p className="text-xs text-muted-foreground hidden md:block">AI Trading Platform</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="w-5 h-5" />
               {unreadCount > 0 && (
                 <Badge
                   variant="destructive"
                   className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs"
                 >
                   {unreadCount > 9 ? '9+' : unreadCount}
                 </Badge>
               )}
            </Button>
          </PopoverTrigger>
           <PopoverContent align="end" className="w-80 p-0 bg-popover border border-border">
             <div className="flex items-center justify-between p-3 border-b border-border">
               <span className="text-sm font-medium">Notifications</span>
               {unreadCount > 0 && (
                 <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                   Mark all read
                 </Button>
               )}
             </div>
             <ScrollArea className="max-h-80">
               {notifications.length === 0 ? (
                 <div className="text-sm text-muted-foreground py-8 text-center">
                   You're all caught up.
                 </div>
               ) : (
                 <div className="divide-y divide-border">
                   {notifications.slice(0, 5).map((notification) => (
                     <div 
                       key={notification.id} 
                       className={`p-3 hover:bg-muted/50 cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                       onClick={() => {
                         if (!notification.read) markAsRead(notification.id);
                         if (notification.data?.link) navigate(notification.data.link);
                       }}
                     >
                       <div className="flex items-start gap-2">
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-medium truncate">{notification.title}</p>
                           <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                           <p className="text-xs text-muted-foreground mt-1">
                             {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                           </p>
                         </div>
                         {!notification.read && (
                           <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </ScrollArea>
             {notifications.length > 0 && (
               <div className="p-2 border-t border-border">
                 <Button 
                   variant="ghost" 
                   className="w-full text-xs" 
                   onClick={() => navigate('/notifications')}
                 >
                   View all notifications
                 </Button>
               </div>
             )}
          </PopoverContent>
        </Popover>


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <span className="hidden md:block text-sm font-medium">
                {user?.user_metadata?.display_name || user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-popover border border-border">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/profile")}>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/subscription")}>
              <CreditCard className="mr-2 h-4 w-4" />
              Subscription
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}