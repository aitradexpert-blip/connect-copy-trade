import { useState } from "react";
import { 
  LayoutDashboard, 
  TrendingUp, 
  Copy, 
  Bot, 
  CreditCard,
  Settings,
  LogOut,
  Shield,
  Bell,
  BarChart3,
  Wallet,
  Zap,
  User,
  Code,
  LineChart,
  BookOpen,
  GraduationCap,
  Crown,
  Info
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useMentor } from "@/contexts/MentorContext";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/?dashboard=main", icon: LayoutDashboard },
  { title: "Trading Ideas", url: "/ideas", icon: TrendingUp },
  { title: "Copy Trading", url: "/copy-trading", icon: Copy },
  { title: "AI Auto-Trading", url: "/ai-trading", icon: Bot },
  { title: "Trading Accounts", url: "/accounts", icon: CreditCard },
  { title: "Market Charts", url: "/charts", icon: LineChart },
  { title: "Journal", url: "/journal", icon: BookOpen },
  { title: "Training Center", url: "/training", icon: GraduationCap },
  { title: "Analytics", url: "/analytics", icon: BarChart3 },
  { title: "Credit Usage", url: "/credits", icon: Zap },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

const settingsItems = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Subscription", url: "/subscription", icon: CreditCard },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "API Docs", url: "/api-docs", icon: Code },
  { title: "About HuMi", url: "/about", icon: Info },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const { isAdmin } = useAdminCheck();
  const { subscription } = useSubscription();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === "collapsed";
  const { isMentor: hasMentorProfile } = useMentor();
  // Show Mentor Hub for users with mentor subscription tier OR existing mentor profile
  const showMentorHub = subscription?.plan_name === 'mentor' || hasMentorProfile;

  const isActive = (path: string) => currentPath === path;
  const getNavCls = ({ isActive }: { isActive: boolean }) =>
    isActive 
      ? "bg-primary text-primary-foreground font-medium shadow-sm" 
      : "hover:bg-accent hover:text-accent-foreground transition-smooth";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="border-r border-border bg-card">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-lg font-bold text-foreground">HuMi</h1>
                <p className="text-xs text-muted-foreground">Capital Management OS</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Account</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls}>
                      <item.icon className="w-4 h-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/admin" className={getNavCls}>
                        <Shield className="w-4 h-4" />
                        {!collapsed && <span>Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/admin-panel" className={getNavCls}>
                        <Shield className="w-4 h-4" />
                        {!collapsed && <span>Admin Panel</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
              {/* Mentor Hub - only for mentor-tier users or users with existing mentor profile */}
              {showMentorHub && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/mentor-hub" className={getNavCls}>
                      <Crown className="w-4 h-4" />
                      {!collapsed && <span>Mentor Hub</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {/* Mentor Center (client view) - for ALL users to see their mentor */}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/mentor-dashboard" className={getNavCls}>
                    <Crown className="w-4 h-4" />
                    {!collapsed && <span>Mentor Center</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border bg-card p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="w-4 h-4" />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
