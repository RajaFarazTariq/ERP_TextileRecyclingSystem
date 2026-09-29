import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';

import LoginPage          from './features/auth/LoginPage';
import HomePage           from './features/home/HomePage';
import DashboardPage      from './features/dashboard/DashboardPage';
import WarehousePage      from './features/warehouse/WarehousePage';
import SortingPage        from './features/sorting/SortingPage';
import DecolorizationPage from './features/decolorization/DecolorizationPage';
import DryingPage         from './features/drying/DryingPage';
import SalesPage          from './features/sales/SalesPage';
import ReportsPage        from './features/reports/ReportsPage';
import UsersPage          from './features/users/UsersPage';

// Role access per path lives in config/access.js
const protectedRoutes = [
  { path: '/home',           element: <HomePage /> },
  { path: '/dashboard',      element: <DashboardPage /> },
  { path: '/warehouse',      element: <WarehousePage /> },
  { path: '/sorting',        element: <SortingPage /> },
  { path: '/decolorization', element: <DecolorizationPage /> },
  { path: '/drying',         element: <DryingPage /> },
  { path: '/sales',          element: <SalesPage /> },
  { path: '/reports',        element: <ReportsPage /> },
  { path: '/users',          element: <UsersPage /> },
];

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {protectedRoutes.map(({ path, element }) => (
            <Route key={path} path={path} element={<ProtectedRoute>{element}</ProtectedRoute>} />
          ))}

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
