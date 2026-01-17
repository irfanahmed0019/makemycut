import { Route } from 'react-router-dom';
import CustomerAuth from '@/features/customer/pages/CustomerAuth';
import CustomerHome from '@/features/customer/pages/CustomerHome';
import Reviews from '@/features/customer/pages/Reviews';
import ResetPassword from '@/features/customer/pages/ResetPassword';

export const customerRoutes = (
  <>
    <Route path="/" element={<CustomerHome />} />
    <Route path="/auth" element={<CustomerAuth />} />
    <Route path="/reviews" element={<Reviews />} />
    <Route path="/reset-password" element={<ResetPassword />} />
  </>
);
