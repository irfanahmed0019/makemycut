import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AreaIndexProvider } from "./contexts/AreaIndexContext";

// Customer routes
import CustomerHome from "@/features/customer/pages/CustomerHome";
import CustomerAuth from "@/features/customer/pages/CustomerAuth";
import SalonRedirect from "@/features/customer/pages/SalonRedirect";
import Reviews from "./pages/Reviews";
import ResetPassword from "./pages/ResetPassword";

// Salon routes
import SalonAuth from "@/features/salon/pages/SalonAuth";
import SalonDashboard from "./pages/SalonDashboard";

// Admin routes
import AdminDashboard from "@/features/admin/pages/AdminDashboard";

// Directory (SEO) routes
import DistrictPage from "@/features/directory/pages/DistrictPage";
import AreaPage from "@/features/directory/pages/AreaPage";

// Shared
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <LanguageProvider>
          <AreaIndexProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Customer Routes */}
                <Route path="/" element={<CustomerHome />} />
                <Route path="/auth" element={<CustomerAuth />} />
                <Route path="/book" element={<SalonRedirect action="book" />} />
                <Route path="/join-queue" element={<SalonRedirect action="queue" />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reviews" element={<Reviews />} />

                {/* SEO Directory Routes */}
                <Route path="/salons/:district" element={<DistrictPage />} />
                <Route path="/salons/:district/:area" element={<AreaPage />} />

                {/* Salon Routes */}
                <Route path="/salon-login" element={<SalonAuth />} />
                <Route path="/salon-dashboard" element={<SalonDashboard />} />

                {/* Admin Routes */}
                <Route path="/admin" element={<AdminDashboard />} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </AreaIndexProvider>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
