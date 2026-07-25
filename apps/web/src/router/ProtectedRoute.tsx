import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface ProtectedRouteProps {
  roles?: string[];
}

export default function ProtectedRoute({ roles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // SuperAdmin bypass — has access to everything
  if (user?.role === 'superadmin') {
    return <Outlet />;
  }

  if (roles && user && !roles.includes(user.role)) {
    if (user.role === 'client') {
      return <Navigate to="/client" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}