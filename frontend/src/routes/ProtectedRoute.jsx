import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Paths that only admin can visit
const ADMIN_ONLY_PATHS = ['/dashboard'];

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Not logged in → login page
  if (!user) return <Navigate to="/login" replace />;

  // Non-admin trying to visit /dashboard directly → home
  if (ADMIN_ONLY_PATHS.includes(location.pathname) && user.role !== 'admin') {
    return <Navigate to="/home" replace />;
  }

  // Role not allowed for this route → home
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
