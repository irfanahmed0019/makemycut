import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { InstallPrompt } from "@/components/InstallPrompt";

// Customer routes
import CustomerHome from "@/features/customer/pages/CustomerHome";
import CustomerAuth from "@/features/customer/pages/CustomerAuth";
import Reviews from "./pages/Reviews";
import ResetPassword from "./pages/ResetPassword";

// Salon routes
import SalonAuth from "@/features/salon/pages/SalonAuth";
import SalonDashboard from "./pages/SalonDashboard";

// Shared
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <InstallPrompt />
        <BrowserRouter>
          <Routes>
            {/* Customer Routes */}
            <Route path="/" element={<CustomerHome />} />
            <Route path="/auth" element={<CustomerAuth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/reviews" element={<Reviews />} />
            
            {/* Salon Routes */}
            <Route path="/salon-login" element={<SalonAuth />} />
            <Route path="/salon-dashboard" element={<SalonDashboard />} />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
