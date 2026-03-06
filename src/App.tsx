import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { ThemeProvider } from "next-themes";
import { MentorProvider } from "@/contexts/MentorContext";
import Index from "./pages/Index";
import TradingIdeas from "./pages/TradingIdeas";
import CopyTrading from "./pages/CopyTradingNew";
import AIAutoTrading from "./pages/AIAutoTrading";
import TradingAccounts from "./pages/TradingAccounts";
import Subscription from "./pages/Subscription";
import Pricing from "./pages/Pricing";
import Admin from "./pages/Admin";
import AdminPanel from "./pages/AdminPanel";
import DerivCallback from "./pages/DerivCallback";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import Charts from "./pages/Charts";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import Analytics from "./pages/Analytics";
import CryptoWallet from "./pages/CryptoWallet";
import CreditUsage from "./pages/CreditUsage";
import KhumoIntroModal from "./components/KhumoIntroModal";
import Notifications from "./pages/Notifications";
import ApiDocs from "./pages/ApiDocs";
import Journal from "./pages/Journal";
import TrainingCenter from "./pages/TrainingCenter";
import MentorCenter from "./pages/MentorCenter";
import MentorReferral from "./pages/MentorReferral";
import InvestorPitch from "./pages/InvestorPitch";
import About from "./pages/About";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requireSubscription = true }: { children: React.ReactNode; requireSubscription?: boolean }) => {
  const { user, loading } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  
  if (loading || subLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (requireSubscription && !subscription) return <Navigate to="/subscription" replace />;
  return <>{children}</>;
};

const DerivCallbackRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = window.location;
  const hasTokens = location.search.includes('token1') || location.search.includes('acct1') || location.hash.includes('token1') || location.hash.includes('acct1');
  if (hasTokens) return <>{children}</>;
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  if (loading || adminLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <MentorProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <KhumoIntroModal />
            <BrowserRouter>
              <Routes>
                <Route path="/pricing" element={<Pricing />} />
                <Route path="/pitch" element={<InvestorPitch />} />
                <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                <Route path="/ref/:slug" element={<MentorReferral />} />
                <Route path="/about" element={<About />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/ideas" element={<ProtectedRoute><TradingIdeas /></ProtectedRoute>} />
                <Route path="/copy-trading" element={<ProtectedRoute><CopyTrading /></ProtectedRoute>} />
                <Route path="/ai-trading" element={<ProtectedRoute><AIAutoTrading /></ProtectedRoute>} />
                <Route path="/accounts" element={<ProtectedRoute><TradingAccounts /></ProtectedRoute>} />
                <Route path="/subscription" element={<ProtectedRoute requireSubscription={false}><Subscription /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
                <Route path="/wallet" element={<ProtectedRoute><CryptoWallet /></ProtectedRoute>} />
                <Route path="/credits" element={<ProtectedRoute><CreditUsage /></ProtectedRoute>} />
                <Route path="/charts" element={<ProtectedRoute><Charts /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                <Route path="/journal" element={<ProtectedRoute><Journal /></ProtectedRoute>} />
                <Route path="/training" element={<ProtectedRoute><TrainingCenter /></ProtectedRoute>} />
                <Route path="/mentor-center" element={<ProtectedRoute><MentorCenter /></ProtectedRoute>} />
                <Route path="/api-docs" element={<ApiDocs />} />
                <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                <Route path="/admin-panel" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                <Route path="/deriv-callback" element={<DerivCallbackRoute><DerivCallback /></DerivCallbackRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </MentorProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
