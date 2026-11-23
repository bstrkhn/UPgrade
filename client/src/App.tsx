import { Navigate, Route, Routes } from 'react-router-dom';
import { ToastViewport } from './components/common/ToastViewport';
import { AppLayout } from './components/layout/AppLayout';
import { OnboardingRoute, ProtectedAppRoute, PublicOnlyRoute } from './components/layout/RouteGuards';
import { AccountsPage } from './pages/AccountsPage';
import { BudgetPage } from './pages/BudgetPage';
import { DashboardPage } from './pages/DashboardPage';
import { DebtsPage } from './pages/DebtsPage';
import { FirePage } from './pages/FirePage';
import { LoginPage } from './pages/LoginPage';
import { NetWorthPage } from './pages/NetWorthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { RegisterPage } from './pages/RegisterPage';
import { SettingsPage } from './pages/SettingsPage';
import { TransactionsPage } from './pages/TransactionsPage';

export function App() {
  return (
    <>
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
      <ToastViewport />
    </>
  );
}
