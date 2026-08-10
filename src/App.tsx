import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AreaIndexProvider } from "./contexts/AreaIndexContext";
import { RoleGate } from "./components/RoleGate";
import PhoneCaptureGate from "./components/PhoneCaptureGate";
import { PageSkeleton } from "@/components/ui/skeleton";

// Customer routes
import CustomerHome from "@/features/customer/pages/CustomerHome";
import CustomerAuth from "@/features/customer/pages/CustomerAuth";
import SalonRedirect from "@/features/customer/pages/SalonRedirect";

// Route-level code splitting: dashboards and secondary pages are only
// downloaded when a user actually visits them, keeping the customer
// first load small.
const Reviews = lazy(() => import("./pages/Reviews"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const SalonAuth = lazy(() => import("@/features/salon/pages/SalonAuth"));
const SalonDashboard = lazy(() => import("./pages/SalonDashboard"));
const AdminDashboard = lazy(() => import("@/features/admin/pages/AdminDashboard"));
const BarberDashboard = lazy(() => import("@/features/barber/pages/BarberDashboard"));
const DistrictPage = lazy(() => import("@/features/directory/pages/DistrictPage"));
const AreaPage = lazy(() => import("@/features/directory/pages/AreaPage"));

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
              <PhoneCaptureGate />
              <Suspense fallback={<PageSkeleton />}>
              <Routes>
                {/* Customer Routes */}
                <Route path="/" element={<RoleGate allow={["customer"]} allowAnonymous><CustomerHome /></RoleGate>} />
                <Route path="/auth" element={<CustomerAuth />} />
                <Route path="/book" element={<RoleGate allow={["customer"]} allowAnonymous><SalonRedirect action="book" /></RoleGate>} />
                <Route path="/join-queue" element={<RoleGate allow={["customer"]} allowAnonymous><SalonRedirect action="queue" /></RoleGate>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reviews" element={<Reviews />} />

                {/* SEO Directory Routes */}
                <Route path="/salons/:district" element={<DistrictPage />} />
                <Route path="/salons/:district/:area" element={<AreaPage />} />

                {/* Salon Routes */}
                <Route path="/salon-login" element={<SalonAuth />} />
                <Route path="/salon-dashboard" element={<RoleGate allow={["owner"]}><SalonDashboard /></RoleGate>} />

                {/* Admin Routes */}
                <Route path="/admin" element={<RoleGate allow={["admin"]}><AdminDashboard /></RoleGate>} />

                {/* Barber Routes */}
                <Route path="/barber-dashboard" element={<RoleGate allow={["barber"]}><BarberDashboard /></RoleGate>} />

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </AreaIndexProvider>
        </LanguageProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
