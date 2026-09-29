import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canAccess } from '../config/access';

export default function ProtectedRoute({ children }) {
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

  // Role not allowed for this route (see config/access.js) → home
  if (!canAccess(user.role, location.pathname)) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
