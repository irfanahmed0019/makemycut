import { Route } from 'react-router-dom';
import SalonAuth from '@/features/salon/pages/SalonAuth';
import SalonDashboard from '@/features/salon/pages/SalonDashboard';

export const salonRoutes = (
  <>
    <Route path="/salon-login" element={<SalonAuth />} />
    <Route path="/salon-dashboard" element={<SalonDashboard />} />
  </>
);
