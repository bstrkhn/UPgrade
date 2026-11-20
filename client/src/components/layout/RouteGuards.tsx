import { useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useMe } from '../../api/hooks/useAuth';

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
      <p className="mt-3 text-xs font-medium text-slate-500">Memuat sesi UPgrade...</p>
    </div>
  );
}

export function PublicOnlyRoute() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return <FullPageLoader />;
  if (user) {
    return <Navigate to={user.onboardingCompleted ? '/dashboard' : '/onboarding'} replace />;
  }
  return <Outlet />;
}

export function OnboardingRoute() {
  const { data: user, isLoading } = useMe();
  const enteredIncompleteRef = useRef(false);

  if (isLoading) return <FullPageLoader />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.onboardingCompleted) {
    enteredIncompleteRef.current = true;
  }
  // If user already completed onboarding before visiting /onboarding, redirect to /dashboard.
  // If they just completed it inside the wizard, keep /onboarding mounted so the Closure Screen is shown.
  if (user.onboardingCompleted && !enteredIncompleteRef.current) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
}

export function ProtectedAppRoute() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return <FullPageLoader />;
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
