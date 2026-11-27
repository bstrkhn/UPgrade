import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastViewport } from './components/common/ToastViewport';
import { AppLayout } from './components/layout/AppLayout';
import { OnboardingRoute, ProtectedAppRoute, PublicOnlyRoute } from './components/layout/RouteGuards';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TransactionsPage } from './pages/TransactionsPage';

// Lazy-loaded secondary and chart-heavy pages for optimal initial LCP bundle size
const OnboardingPage = lazy(() =>
  import('./pages/OnboardingPage').then((mod) => ({ default: mod.OnboardingPage })),
);
const BudgetPage = lazy(() => import('./pages/BudgetPage').then((mod) => ({ default: mod.BudgetPage })));
const DebtsPage = lazy(() => import('./pages/DebtsPage').then((mod) => ({ default: mod.DebtsPage })));
const FirePage = lazy(() => import('./pages/FirePage').then((mod) => ({ default: mod.FirePage })));
const NetWorthPage = lazy(() =>
  import('./pages/NetWorthPage').then((mod) => ({ default: mod.NetWorthPage })),
);
const AccountsPage = lazy(() =>
  import('./pages/AccountsPage').then((mod) => ({ default: mod.AccountsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((mod) => ({ default: mod.SettingsPage })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
      <p className="mt-2.5 text-xs font-medium text-slate-500">Memuat halaman...</p>
    </div>
  );
}

export function App() {
  return (
    <>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Public Auth Routes */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          {/* Onboarding Wizard Route */}
          <Route element={<OnboardingRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
          </Route>

          {/* Protected Application Routes */}
          <Route element={<ProtectedAppRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/budgets" element={<BudgetPage />} />
              <Route path="/debts" element={<DebtsPage />} />
              <Route path="/fire" element={<FirePage />} />
              <Route path="/net-worth" element={<NetWorthPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Default Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      <ToastViewport />
    </>
  );
}
