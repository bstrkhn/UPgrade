import {
  CreditCard,
  Flame,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  LogOut,
  MoreHorizontal,
  PieChart,
  Plus,
  Settings,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { extractApiErrorMessage } from '../../api/client';
import { useLogout, useMe } from '../../api/hooks/useAuth';
import { QuickAddProvider, useQuickAdd } from '../../context/QuickAddContext';
import { useToast } from '../../context/ToastContext';
import { LevelBadge } from '../common/LevelBadge';
import { Modal } from '../common/Modal';
import { QuickAddModal } from '../transactions/QuickAddModal';

const DAILY_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Riwayat Transaksi', icon: ListOrdered },
  { to: '/budgets', label: 'Anggaran', icon: PieChart },
] as const;

const STRATEGY_NAV_ITEMS = [
  { to: '/debts', label: 'Bebas Utang', icon: CreditCard },
  { to: '/fire', label: 'Kalkulator FIRE', icon: Flame },
  { to: '/net-worth', label: 'Neraca & Laporan', icon: Landmark },
  { to: '/accounts', label: 'Akun & Kategori', icon: Wallet },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
] as const;

const MOBILE_PRIMARY_TABS = [
  { to: '/dashboard', shortLabel: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', shortLabel: 'Transaksi', icon: ListOrdered },
  { to: '/budgets', shortLabel: 'Anggaran', icon: PieChart },
  { to: '/debts', shortLabel: 'Utang', icon: CreditCard },
] as const;

const MOBILE_MORE_ITEMS = [
  {
    to: '/fire',
    label: 'Kalkulator SWR & FIRE (L5–L7)',
    description: 'Simulasi waktu kebebasan finansial & imbal hasil riil',
    icon: Flame,
  },
  {
    to: '/net-worth',
    label: 'Neraca, Snapshot & Laporan PDF',
    description: 'Tutup buku bulanan, tren Net Worth, & unduh PDF A4',
    icon: Landmark,
  },
  {
    to: '/accounts',
    label: 'Akun Aset & Kategori',
    description: 'Kelola dompet, bank, investasi, dan kategori kustom',
    icon: Wallet,
  },
  {
    to: '/settings',
    label: 'Pengaturan & Parameter',
    description: 'Profil, pengeluaran pokok dasar, dan asumsi SWR/Inflasi',
    icon: Settings,
  },
] as const;

function AppLayoutShell() {
  const { data: user } = useMe();
  const logoutMutation = useLogout();
  const { openQuickAdd } = useQuickAdd();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const isOnMoreRoute = MOBILE_MORE_ITEMS.some((item) => location.pathname.startsWith(item.to));

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      showToast({ variant: 'success', message: 'Anda telah keluar dari sesi UPgrade.' });
      void navigate('/login', { replace: true });
    } catch (error) {
      showToast({ variant: 'error', message: extractApiErrorMessage(error, 'Gagal keluar.') });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white shadow-xs">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-slate-900">UPgrade</span>
            <p className="text-[11px] font-medium text-slate-500">7-Level Financial Roadmap</p>
          </div>
        </div>

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => openQuickAdd('EXPENSE')}
            className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-600"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              <span>Catat Transaksi</span>
            </span>
            <kbd className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">
              Shift + N
            </kbd>
          </button>
        </div>

        <nav aria-label="Menu Utama" className="mt-4 flex-1 space-y-5 overflow-y-auto px-3">
          {/* Group 1: Harian */}
          <div>
            <p className="mb-1.5 px-3.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">Harian</p>
            <div className="space-y-1">
              {DAILY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Group 2: Strategi & Aset */}
          <div>
            <p className="mb-1.5 px-3.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Strategi &amp; Aset
            </p>
            <div className="space-y-1">
              {STRATEGY_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        </nav>

        {user && (
          <div className="border-t border-slate-200 p-4">
            <div className="mb-3">
              <LevelBadge level={user.currentLevel} compact />
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={logoutMutation.isPending}
                title="Keluar dari akun"
                aria-label="Keluar dari akun"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Top Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xs lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <TrendingUp className="h-4 w-4 text-indigo-400" />
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">UPgrade</span>
        </div>
        <div className="flex items-center gap-2">
          {user && <LevelBadge level={user.currentLevel} compact />}
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={logoutMutation.isPending}
            aria-label="Keluar dari akun"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="pb-24 lg:pl-64 lg:pb-10">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile Floating Action Button (56px) */}
      <button
        type="button"
        onClick={() => openQuickAdd('EXPENSE')}
        aria-label="Catat Transaksi Cepat"
        className="fixed right-4 bottom-20 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-4 ring-white transition active:scale-95 lg:hidden"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Mobile 5-Slot Bottom Navigation */}
      <nav
        aria-label="Navigasi Bawah"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur-xs lg:hidden"
      >
        {MOBILE_PRIMARY_TABS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
                  isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.shortLabel}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition ${
            isOnMoreRoute || isMoreOpen ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>Lainnya</span>
        </button>
      </nav>

      {/* Mobile "Lainnya" Bottom Drawer Modal */}
      <Modal
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        title="Menu Strategi & Aset"
        subtitle="Akses Kalkulator FIRE, Neraca & Laporan PDF, Akun Aset, serta Pengaturan."
      >
        <div className="space-y-2.5">
          {MOBILE_MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <button
                key={item.to}
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  void navigate(item.to);
                }}
                className={`flex w-full items-center gap-3.5 rounded-2xl border p-3.5 text-left transition ${
                  active
                    ? 'border-indigo-300 bg-indigo-50/80 text-indigo-900'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Global QuickAddModal */}
      <QuickAddModal />
    </div>
  );
}

export function AppLayout() {
  return (
    <QuickAddProvider enabled>
      <AppLayoutShell />
    </QuickAddProvider>
  );
}
