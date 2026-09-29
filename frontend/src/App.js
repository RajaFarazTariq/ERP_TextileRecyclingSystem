import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './routes/ProtectedRoute';


// Pages
import Login          from './pages/auth/Login';
import Dashboard      from './pages/Dashboard';
import Warehouse      from './pages/warehouse/Warehouse';
import Sorting        from './pages/sorting/Sorting';
import Decolorization from './pages/decolorization/Decolorization';
import Drying         from './pages/drying/Drying';
import Sales          from './pages/sales/Sales';
import Users          from './pages/users/Users';
import Home           from './pages/Home';
import Reports        from './pages/Reports';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* reports */}
          <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['admin']}>
                  <Reports />
              </ProtectedRoute>
          } />

          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* /home and /dashboard both go to Dashboard */}
          <Route path="/home" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          {/* Warehouse — admin + warehouse_supervisor */}
          <Route path="/warehouse" element={
            <ProtectedRoute allowedRoles={['admin', 'warehouse_supervisor']}>
              <Warehouse />
            </ProtectedRoute>
          } />

          {/* Sorting — admin + sorting_supervisor */}
          <Route path="/sorting" element={
            <ProtectedRoute allowedRoles={['admin', 'sorting_supervisor']}>
              <Sorting />
            </ProtectedRoute>
          } />

          {/* Decolorization — admin + decolorization_supervisor */}
          <Route path="/decolorization" element={
            <ProtectedRoute allowedRoles={['admin', 'decolorization_supervisor']}>
              <Decolorization />
            </ProtectedRoute>
          } />

          {/* Drying — admin + drying_supervisor */}
          <Route path="/drying" element={
          <ProtectedRoute allowedRoles={['admin', 'drying_supervisor']}>
              <Drying />
          </ProtectedRoute>
          } />

          {/* Sales — admin only */}
          <Route path="/sales" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Sales />
            </ProtectedRoute>
          } />

          {/* Users — admin only */}
          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
