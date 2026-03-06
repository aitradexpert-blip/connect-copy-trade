import { Home, TrendingUp, Copy, Bot, MoreHorizontal, Settings, Shield, LogOut, CreditCard, BarChart, Wallet, Zap, Send, Bell, User, Code, BookOpen, GraduationCap, Crown, Info } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/hooks/useAuth";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const mainNavItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Ideas", url: "/ideas", icon: TrendingUp },
  { title: "Copy", url: "/copy-trading", icon: Copy },
  { title: "AI", url: "/ai-trading", icon: Bot },
];

export function BottomNav() {
  const { isAdmin } = useAdminCheck();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const getNavCls = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-1 p-2 rounded-lg transition-colors ${
      isActive
        ? "text-primary bg-primary/10"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
        {mainNavItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end
            className={({ isActive }) => getNavCls(isActive)}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{item.title}</span>
          </NavLink>
        ))}

        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <button className={getNavCls(false)}>
              <MoreHorizontal className="w-5 h-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <div className="grid gap-2 py-4">
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/accounts");
                  setIsMenuOpen(false);
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Trading Accounts
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/wallet");
                  setIsMenuOpen(false);
                }}
              >
                <Wallet className="mr-2 h-4 w-4" />
                Crypto Wallet
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/credits");
                  setIsMenuOpen(false);
                }}
              >
                <Zap className="mr-2 h-4 w-4" />
                Credit Usage
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/analytics");
                  setIsMenuOpen(false);
                }}
              >
                <BarChart className="mr-2 h-4 w-4" />
                Analytics
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/charts");
                  setIsMenuOpen(false);
                }}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Market Charts
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/notifications");
                  setIsMenuOpen(false);
                }}
              >
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/profile");
                  setIsMenuOpen(false);
                }}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Button>
              <Button
                variant="ghost"
                className="justify-start"
                onClick={() => {
                  navigate("/subscription");
                  setIsMenuOpen(false);
                }}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Subscription
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/settings"); setIsMenuOpen(false); }}>
                <Settings className="mr-2 h-4 w-4" /> Settings
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/journal"); setIsMenuOpen(false); }}>
                <BookOpen className="mr-2 h-4 w-4" /> Journal
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/training"); setIsMenuOpen(false); }}>
                <GraduationCap className="mr-2 h-4 w-4" /> Training Center
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/mentor-center"); setIsMenuOpen(false); }}>
                <Crown className="mr-2 h-4 w-4" /> Mentor Center
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/api-docs"); setIsMenuOpen(false); }}>
                <Code className="mr-2 h-4 w-4" /> API Docs
              </Button>
              <Button variant="ghost" className="justify-start" onClick={() => { navigate("/about"); setIsMenuOpen(false); }}>
                <Info className="mr-2 h-4 w-4" /> About HuMi
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      navigate("/admin");
                      setIsMenuOpen(false);
                    }}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Publish Ideas
                  </Button>
                  <Button
                    variant="ghost"
                    className="justify-start"
                    onClick={() => {
                      navigate("/admin-panel");
                      setIsMenuOpen(false);
                    }}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Admin Panel
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                className="justify-start text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
