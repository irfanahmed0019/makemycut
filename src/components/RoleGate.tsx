import { Navigate, useLocation } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui/skeleton';
import { useUserRole, AppRole } from '@/hooks/useUserRole';

export const homePathForRole = (role: AppRole) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'barber':
      return '/barber-dashboard';
    case 'owner':
      return '/salon-dashboard';
    default:
      return '/';
  }
};

interface RoleGateProps {
  allow: AppRole[];
  children: React.ReactNode;
  /** When true, unauthenticated visitors are allowed through (public pages). */
  allowAnonymous?: boolean;
}

/**
 * Keeps each account type inside its own area of the app.
 * Barbers only ever land on the barber dashboard, owners on the salon
 * dashboard, admins on the admin dashboard, customers on the customer app.
 */
export const RoleGate = ({ allow, children, allowAnonymous = false }: RoleGateProps) => {
  const { role, loading, user } = useUserRole();
  const location = useLocation();

  if (loading) return <PageSkeleton />;

  if (!user) {
    if (allowAnonymous) return <>{children}</>;
    return <Navigate to="/salon-login" replace state={{ from: location.pathname }} />;
  }

  if (!allow.includes(role)) {
    return <Navigate to={homePathForRole(role)} replace />;
  }

  return <>{children}</>;
};