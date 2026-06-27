import { lazy, Suspense } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';
import ToastContainer from './components/ui/Toast';
import Spinner from './components/ui/Spinner';
import LoginPage from './pages/LoginPage';

const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const DeviceGroupsPage = lazy(() => import('./pages/DeviceGroupsPage'));
const MacrosPage = lazy(() => import('./pages/MacrosPage'));
const MacroDetailPage = lazy(() => import('./pages/MacroDetailPage'));
const RunsPage = lazy(() => import('./pages/RunsPage'));
const RunDetailPage = lazy(() => import('./pages/RunDetailPage'));
const RunMonitorPage = lazy(() =>
  import('./pages/RunMonitorPage').then((module) => ({
    default: module.RunMonitorPage,
  }))
);
const ApprovalsPage = lazy(() => import('./pages/ApprovalsPage'));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage'));
const DemoPage = lazy(() => import('./pages/DemoPage'));
const DeviceSetupPage = lazy(() => import('./pages/DeviceSetupPage'));
const MobileMcpOrchestratorPage = lazy(() => import('./pages/mobile-mcp-orchestrator-page'));
const AccountSetupPage = lazy(() => import('./pages/AccountSetupPage'));
const SocialDashboardPage = lazy(() => import('./pages/social-dashboard-page'));
const FleetHealthPage = lazy(() => import('./pages/fleet-health-page'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
    },
  },
});

function AuthGate() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/devices" element={withPageFallback(<DevicesPage />)} />
        <Route path="/device-groups" element={withPageFallback(<DeviceGroupsPage />)} />
        <Route path="/macros" element={withPageFallback(<MacrosPage />)} />
        <Route path="/macros/:id" element={withPageFallback(<MacroDetailPage />)} />
        <Route path="/runs" element={withPageFallback(<RunsPage />)} />
        <Route path="/runs/:id" element={withPageFallback(<RunDetailPage />)} />
        <Route path="/runs/:runId/monitor" element={withPageFallback(<RunMonitorPage />)} />
        <Route path="/approvals" element={withPageFallback(<ApprovalsPage />)} />
        <Route path="/audit-logs" element={withPageFallback(<AuditLogsPage />)} />
        <Route path="/demo" element={withPageFallback(<DemoPage />)} />
        <Route path="/device-setup" element={withPageFallback(<DeviceSetupPage />)} />
        <Route
          path="/mobile-mcp-orchestrator"
          element={withPageFallback(<MobileMcpOrchestratorPage />)}
        />
        <Route path="/account-setup" element={withPageFallback(<AccountSetupPage />)} />
        <Route path="/social-dashboard" element={withPageFallback(<SocialDashboardPage />)} />
        <Route path="/fleet-health" element={withPageFallback(<FleetHealthPage />)} />
        <Route path="*" element={<Navigate to="/devices" replace />} />
      </Route>
      </Routes>
  );
}

function withPageFallback(element: ReactElement) {
  return <Suspense fallback={<PageFallback />}>{element}</Suspense>;
}

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate />
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
