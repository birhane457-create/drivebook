import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { canAccess } from '@/lib/route-access';
import Forbidden from '@/pages/Forbidden';

// Sits between ProtectedRoute (auth check) and AppLayout/page rendering.
// Checks the current user's role against the route access map on every navigation.
// If the user manually navigates to a URL their role can't access, they see a 403.
export default function RoleGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || 'cashier';

  if (!canAccess(location.pathname, role)) {
    return <Forbidden />;
  }

  return <Outlet />;
}