import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SessionPage from './pages/SessionPage';
import CacheDashboardPage from './pages/CacheDashboardPage';
import JoinSessionPage from './pages/JoinSessionPage';
import ExperimentTestingPage from './pages/ExperimentTestingPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join/:shareToken" element={<JoinSessionPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="session/:sessionId" element={<SessionPage />} />
        <Route path="cache" element={<CacheDashboardPage />} />
        <Route path="experiments" element={<ExperimentTestingPage />} />
      </Route>
    </Routes>
  );
}
