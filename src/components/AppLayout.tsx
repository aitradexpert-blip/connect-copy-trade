import { TopHeader } from "@/components/TopHeader";
import { BottomNav } from "@/components/BottomNav";
import FSCADisclaimer from "@/components/FSCADisclaimer";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col w-full bg-background">
      <TopHeader />
      
      <main className="flex-1 p-6 pb-24">
        <FSCADisclaimer />
        {children}
      </main>

      <BottomNav />
    </div>
  );
}