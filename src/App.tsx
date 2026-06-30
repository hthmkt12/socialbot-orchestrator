import { lazy, Suspense, useState } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from './hooks/useAuth';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';
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
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const AccountDetailPage = lazy(() => import('./pages/AccountDetailPage'));
const SocialDashboardPage = lazy(() => import('./pages/social-dashboard-page'));
const FleetHealthPage = lazy(() => import('./pages/fleet-health-page'));
const SystemMonitorPage = lazy(() => import('./pages/system-monitor-page'));
const SchedulesPage = lazy(() => import('./pages/SchedulesPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));

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
      <Route element={<ErrorBoundary><AppLayout /></ErrorBoundary>}>
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
        <Route path="/accounts" element={withPageFallback(<AccountsPage />)} />
        <Route path="/accounts/:id" element={withPageFallback(<AccountDetailPage />)} />
        <Route path="/social-dashboard" element={withPageFallback(<SocialDashboardPage />)} />
        <Route path="/fleet-health" element={withPageFallback(<FleetHealthPage />)} />
        <Route path="/system-monitor" element={withPageFallback(<SystemMonitorPage />)} />
        <Route path="/schedules" element={withPageFallback(<SchedulesPage />)} />
        <Route path="/analytics" element={withPageFallback(<AnalyticsPage />)} />
        <Route path="/docs" element={withPageFallback(<DocsPage />)} />
        <Route path="/pricing" element={withPageFallback(<PricingPage />)} />
        <Route path="*" element={<Navigate to="/social-dashboard" replace />} />
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
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthGate />
          <ToastContainer />
        </BrowserRouter>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
