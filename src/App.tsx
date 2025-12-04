import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import TradingIdeas from "./pages/TradingIdeas";
import CopyTrading from "./pages/CopyTradingNew";
import AIAutoTrading from "./pages/AIAutoTrading";
import TradingAccounts from "./pages/TradingAccounts";
import Subscription from "./pages/Subscription";
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

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdminCheck();
  
  if (loading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }
  
  if (user) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/ideas" element={<ProtectedRoute><TradingIdeas /></ProtectedRoute>} />
            <Route path="/copy-trading" element={<ProtectedRoute><CopyTrading /></ProtectedRoute>} />
            <Route path="/ai-trading" element={<ProtectedRoute><AIAutoTrading /></ProtectedRoute>} />
            <Route path="/accounts" element={<ProtectedRoute><TradingAccounts /></ProtectedRoute>} />
            <Route path="/subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/wallet" element={<ProtectedRoute><CryptoWallet /></ProtectedRoute>} />
            <Route path="/credits" element={<ProtectedRoute><CreditUsage /></ProtectedRoute>} />
            <Route path="/charts" element={<ProtectedRoute><Charts /></ProtectedRoute>} />
            <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
            <Route path="/admin-panel" element={<AdminRoute><AdminPanel /></AdminRoute>} />
            <Route path="/deriv-callback" element={<ProtectedRoute><DerivCallback /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
