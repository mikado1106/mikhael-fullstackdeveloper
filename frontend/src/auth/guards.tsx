import { Navigate, Outlet, useLocation } from 'react-router';
import { homePathFor } from '../lib/format';
import type { Role } from '../types/api';
import { useAuth } from './auth-context';

/** Blocks unauthenticated users, and optionally users without one of the given roles. */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Outlet />;
}

// Also the single place that decides where a signed-in user lands:
// back to state.from, or their role home.
export function PublicOnly() {
  const { user } = useAuth();
  const location = useLocation();
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homePathFor(user.role)} replace />;
  }
  return <Outlet />;
}
