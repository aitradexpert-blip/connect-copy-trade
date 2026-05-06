import { Home, TrendingUp, Copy, Bot, MoreHorizontal, Shield, LogOut, CreditCard, BarChart, Zap, Send, BookOpen, GraduationCap, Crown, Info, HelpCircle, ChevronRight } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useMentor } from "@/contexts/MentorContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { title: "Home", url: "/?dashboard=main", icon: Home },
  { title: "Ideas", url: "/ideas", icon: TrendingUp },
  { title: "Copy", url: "/copy-trading", icon: Copy },
  { title: "AI", url: "/ai-trading", icon: Bot },
];

export function BottomNav() {
  const { isAdmin } = useAdminCheck();
  const { signOut } = useAuth();
  const { tierName } = useSubscription();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [tradingOpen, setTradingOpen] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const isMentor = tierName === 'mentor';
  const { isMentorClient } = useMentor();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setIsMenuOpen(false);
  };

  const getNavCls = (isActive: boolean) =>
    `flex flex-col items-center justify-center gap-1 min-w-[56px] min-h-[48px] p-2 rounded-lg transition-colors touch-manipulation ${
      isActive
        ? "text-primary bg-primary/10"
        : "text-muted-foreground hover:text-foreground hover:bg-accent active:bg-accent"
    }`;

  const MenuButton = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
    <Button
      variant="ghost"
      className="justify-start w-full h-12 text-sm touch-manipulation"
      onClick={onClick}
    >
      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Button>
  );

  const SectionHeader = ({ label, isOpen, onToggle }: { label: string; isOpen: boolean; onToggle: () => void }) => (
    <CollapsibleTrigger asChild>
      <button 
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider touch-manipulation"
        onClick={onToggle}
      >
        {label}
        <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
      </button>
    </CollapsibleTrigger>
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-1">
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
          <SheetContent side="bottom" className="h-[70vh] max-h-[600px] overflow-y-auto">
            <SheetHeader className="pb-2">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            
            <div className="space-y-1 pb-4">
              {/* Trading Section */}
              <Collapsible open={tradingOpen} onOpenChange={setTradingOpen}>
                <SectionHeader label="Trading" isOpen={tradingOpen} onToggle={() => setTradingOpen(!tradingOpen)} />
                <CollapsibleContent className="space-y-1 pl-1">
                  <MenuButton icon={CreditCard} label="Trading Accounts" onClick={() => navigateTo("/accounts")} />
                  <MenuButton icon={TrendingUp} label="Market Charts" onClick={() => navigateTo("/charts")} />
                  <MenuButton icon={BarChart} label="Analytics" onClick={() => navigateTo("/analytics")} />
                  <MenuButton icon={Zap} label="Credit Usage" onClick={() => navigateTo("/credits")} />
                  <MenuButton icon={BookOpen} label="Trade Journal" onClick={() => navigateTo("/journal")} />
                </CollapsibleContent>
              </Collapsible>

              {/* Account Section */}
              <Collapsible open={accountOpen} onOpenChange={setAccountOpen}>
                <SectionHeader label="Account" isOpen={accountOpen} onToggle={() => setAccountOpen(!accountOpen)} />
                <CollapsibleContent className="space-y-1 pl-1">
                  <MenuButton icon={CreditCard} label="Subscription" onClick={() => navigateTo("/subscription")} />
                  <MenuButton icon={GraduationCap} label="Training Center" onClick={() => navigateTo("/training")} />
                  {/* Mentor Hub - only for mentor-tier users */}
                  {isMentor && (
                    <MenuButton icon={Crown} label="Mentor Hub" onClick={() => navigateTo("/mentor-hub")} />
                  )}
                  {/* Mentor Center (client view) - for ALL users to see their mentor */}
                  <MenuButton icon={Crown} label="Mentor Center" onClick={() => navigateTo("/mentor-dashboard")} />
                  {isAdmin && (
                    <>
                      <MenuButton icon={Send} label="Publish Ideas" onClick={() => navigateTo("/admin")} />
                      <MenuButton icon={Shield} label="Admin Panel" onClick={() => navigateTo("/admin-panel")} />
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Support Section */}
              <Collapsible open={supportOpen} onOpenChange={setSupportOpen}>
                <SectionHeader label="Support" isOpen={supportOpen} onToggle={() => setSupportOpen(!supportOpen)} />
                <CollapsibleContent className="space-y-1 pl-1">
                  <MenuButton icon={Info} label="About HuMi" onClick={() => navigateTo("/about")} />
                  <MenuButton icon={HelpCircle} label="API Documentation" onClick={() => navigateTo("/api-docs")} />
                </CollapsibleContent>
              </Collapsible>

              {/* Logout */}
              <div className="pt-2 border-t border-border mt-4">
                <Button
                  variant="ghost"
                  className="justify-start w-full h-12 text-sm text-destructive hover:text-destructive hover:bg-destructive/10 touch-manipulation"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-5 w-5 flex-shrink-0" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
