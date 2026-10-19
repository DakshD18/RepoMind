import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import LandingPage from '../pages/LandingPage';
import LoginPage from '../pages/LoginPage';
import Dashboard from '../pages/Dashboard';
import RepositoryOverview from '../pages/RepositoryOverview';
import RepositoryChat from '../pages/RepositoryChat';
import ImpactAnalysis from '../pages/ImpactAnalysis';
import HealthDashboard from '../pages/HealthDashboard';
import ProductivityDashboard from '../pages/ProductivityDashboard';
import { useAuth } from '../context/AuthContext';

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />}
      />
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repository/:id"
        element={
          <ProtectedRoute>
            <RepositoryOverview />
          </ProtectedRoute>
        }
      />
      {/* Phase 2 — Repository Intelligence (AI Chat) */}
      <Route
        path="/repository/:id/chat"
        element={
          <ProtectedRoute>
            <RepositoryChat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repository/:id/chat/:sessionId"
        element={
          <ProtectedRoute>
            <RepositoryChat />
          </ProtectedRoute>
        }
      />

      {/* Phase 4 — Impact Analysis */}
      <Route
        path="/repository/:id/impact"
        element={
          <ProtectedRoute>
            <ImpactAnalysis />
          </ProtectedRoute>
        }
      />

      {/* Phase 5 — Health Dashboard */}
      <Route
        path="/repository/:id/health"
        element={
          <ProtectedRoute>
            <HealthDashboard />
          </ProtectedRoute>
        }
      />

      {/* Phase 6 — Productivity Intelligence */}
      <Route
        path="/repository/:id/productivity"
        element={
          <ProtectedRoute>
            <ProductivityDashboard />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;

