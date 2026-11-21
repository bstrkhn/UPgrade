import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Percent,
  PiggyBank,
  Plus,
  ReceiptText,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { extractApiErrorMessage } from '../api/client';
import { useAccounts, useCreateAccount } from '../api/hooks/useAccounts';
import { useMe } from '../api/hooks/useAuth';
import { useDashboardSummary } from '../api/hooks/useDashboard';
import { useTransactions } from '../api/hooks/useTransactions';
import type { AccountType } from '../api/types';
import { EmptyState } from '../components/common/EmptyState';
import { LevelBadge } from '../components/common/LevelBadge';
import { Modal } from '../components/common/Modal';
import { MoneyInput } from '../components/common/MoneyInput';
import { TransactionRow } from '../components/transactions/TransactionRow';
import { useQuickAdd } from '../context/QuickAddContext';
import { useToast } from '../context/ToastContext';
import { ACCOUNT_TYPE_LABELS } from '../utils/constants';
import {
  clampPercentBarWidth,
  compareMoney,
  finalizeMoneyInput,
  formatPercent,
  formatRupiah,
  isNegativeMoney,
  isValidNonNegativeMoney,
} from '../utils/currency';
import { formatPeriodId, getCurrentWibPeriod, isSamePeriod, shiftPeriod, type Period } from '../utils/date';

export function DashboardPage() {
  const { data: user } = useMe();
  const { openQuickAdd } = useQuickAdd();
  const { showToast } = useToast();

  const currentWibPeriod = getCurrentWibPeriod();
  const [period, setPeriod] = useState<Period>(currentWibPeriod);

  const summaryQuery = useDashboardSummary(period.year, period.month);
  const accountsQuery = useAccounts();
  const recentTxQuery = useTransactions({ page: 1, pageSize: 5 });
  const createAccountMutation = useCreateAccount();

  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<AccountType>('BANK');
  const [newAccBalance, setNewAccBalance] = useState('0');
  const [newAccError, setNewAccError] = useState<string | null>(null);

  const summary = summaryQuery.data;
  const accounts = accountsQuery.data ?? [];
  const recentTransactions = recentTxQuery.data?.transactions ?? [];

  const surplusIsNegative = summary ? isNegativeMoney(summary.cashFlow.surplus) : false;
  const savingRateBarWidth = summary ? clampPercentBarWidth(summary.cashFlow.savingRatePct) : '0.00';

  const handleCreateAccount = async (event: FormEvent) => {
    event.preventDefault();
    setNewAccError(null);

    if (!newAccName.trim()) {
      setNewAccError('Nama akun wajib diisi.');
      return;
    }
    const cleanBalance = finalizeMoneyInput(newAccBalance || '0');
    if (!isValidNonNegativeMoney(cleanBalance)) {
      setNewAccError('Saldo awal akun tidak valid.');
      return;
    }

    try {
      const response = await createAccountMutation.mutateAsync({
        name: newAccName.trim(),
        type: newAccType,
        balance: cleanBalance,
        isLiquid: newAccType !== 'INVESTMENT',
      });
      showToast({
        variant: 'success',
        message: response.message || `Akun "${response.data.account.name}" berhasil ditambahkan.`,
      });
      setIsAddAccountOpen(false);
      setNewAccName('');
      setNewAccBalance('0');
    } catch (error) {
      setNewAccError(extractApiErrorMessage(error, 'Gagal membuat akun baru.'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar: Greeting & Period Switcher */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Halo, {user?.name?.split(' ')[0] ?? 'Sobat UPgrade'}!
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Ringkasan kondisi arus kas dan kekayaan bersih Anda pada periode{' '}
            <strong className="font-semibold text-slate-700">{formatPeriodId(period)}</strong>
          </p>
        </div>

        {/* Period Month/Year Switcher */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setPeriod((prev) => shiftPeriod(prev, -1))}
              aria-label="Bulan sebelumnya"
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-36 px-3 text-center text-xs font-bold text-slate-800">
              {formatPeriodId(period)}
            </span>
            <button
              type="button"
              onClick={() => setPeriod((prev) => shiftPeriod(prev, 1))}
              aria-label="Bulan berikutnya"
              className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {!isSamePeriod(period, currentWibPeriod) && (
            <button
              type="button"
              onClick={() => setPeriod(currentWibPeriod)}
              className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
            >
              Bulan Ini
            </button>
          )}
        </div>
      </div>

      {/* Level Badge Banner */}
      {user && (
        <LevelBadge
          level={user.currentLevel}
          highestLevel={user.highestLevel}
          healthStatus={user.healthStatus}
          dataSourceBadge="Estimasi Awal"
        />
      )}

      {/* 3 Core KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 1. Net Worth */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Kekayaan Bersih (Net Worth)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Landmark className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3">
            {summaryQuery.isLoading ? (
              <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <p
                className={`money text-2xl font-extrabold ${
                  summary && isNegativeMoney(summary.netWorth.netWorth) ? 'text-rose-600' : 'text-slate-900'
                }`}
              >
                {formatRupiah(summary?.netWorth.netWorth ?? '0')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            <div>
              <p className="text-slate-400">Total Aset</p>
              <p className="money font-bold text-emerald-600">
                {formatRupiah(summary?.netWorth.totalAssets ?? '0')}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Utang Aktif</p>
              <p className="money font-bold text-rose-600">
                {formatRupiah(summary?.netWorth.totalLiabilities ?? '0')}
              </p>
            </div>
          </div>
        </div>

        {/* 2. Monthly Cash Flow */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Arus Kas {formatPeriodId(period)}
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                surplusIsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3">
            {summaryQuery.isLoading ? (
              <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <>
                <p
                  className={`money text-2xl font-extrabold ${
                    surplusIsNegative ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {surplusIsNegative ? '' : '+'}
                  {formatRupiah(summary?.cashFlow.surplus ?? '0')}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {surplusIsNegative ? 'Defisit bulan ini' : 'Surplus bersih bulan ini'}
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <ArrowDownLeft className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-slate-400">Masuk</p>
                <p className="money truncate font-bold text-emerald-600">
                  {formatRupiah(summary?.cashFlow.totalIncome ?? '0')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <p className="text-slate-400">Keluar</p>
                <p className="money truncate font-bold text-rose-600">
                  {formatRupiah(summary?.cashFlow.totalExpense ?? '0')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Saving Rate */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Rasio Tabungan (Saving Rate)
            </span>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                surplusIsNegative ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <Percent className="h-4 w-4" />
            </div>
          </div>

          <div className="my-3">
            {summaryQuery.isLoading ? (
              <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
            ) : (
              <>
                <p
                  className={`money text-2xl font-extrabold ${
                    summary && compareMoney(summary.cashFlow.savingRatePct, '20') >= 0
                      ? 'text-emerald-600'
                      : summary && isNegativeMoney(summary.cashFlow.savingRatePct)
                        ? 'text-rose-600'
                        : 'text-slate-900'
                  }`}
                >
                  {formatPercent(summary?.cashFlow.savingRatePct ?? '0')}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${savingRateBarWidth}%` }}
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
            <span>
              Pokok:{' '}
              <strong className="money text-slate-700">
                {formatRupiah(summary?.cashFlow.essentialExpense ?? '0')}
              </strong>
            </span>
            <span>
              Keinginan:{' '}
              <strong className="money text-slate-700">
                {formatRupiah(summary?.cashFlow.discretionaryExpense ?? '0')}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs">
        <div className="flex items-center gap-2.5 text-xs text-slate-600">
          <PiggyBank className="h-4 w-4 text-indigo-600" />
          <span>
            Catat setiap transaksi kurang dari 10 detik. Transfer antar akun otomatis dikecualikan dari pengeluaran.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickAdd('EXPENSE')}
            className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
          >
            + Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd('INCOME')}
            className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            + Pemasukan
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd('TRANSFER')}
            className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          >
            + Transfer
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd('DEBT_PAYMENT')}
            className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-violet-700"
          >
            + Bayar Utang
          </button>
        </div>
      </div>

      {/* Account Balances Grid */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Saldo Akun Aset</h2>
            <p className="text-xs text-slate-500">Dompet, rekening bank, dana darurat, dan portofolio investasi</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNewAccError(null);
                setIsAddAccountOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Akun</span>
            </button>
            <Link
              to="/accounts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <span>Kelola</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {accountsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white p-4" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Wallet className="h-6 w-6" />}
            title="Belum ada akun aset"
            description="Tambahkan dompet tunai atau rekening bank pertama Anda untuk mulai mencatat transaksi."
            action={
              <button
                type="button"
                onClick={() => setIsAddAccountOpen(true)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
              >
                + Tambah Akun Pertama
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((acc) => {
              const negative = isNegativeMoney(acc.balance);
              return (
                <div
                  key={acc.id}
                  className={`flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-2xs transition ${
                    negative ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{acc.name}</p>
                      <span className="mt-1 inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {ACCOUNT_TYPE_LABELS[acc.type]} • {acc.isLiquid ? 'Likuid' : 'Non-Likuid'}
                      </span>
                    </div>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Wallet className="h-4 w-4" />
                    </div>
                  </div>
                  <p className={`money mt-4 text-lg font-extrabold ${negative ? 'text-amber-700' : 'text-slate-900'}`}>
                    {formatRupiah(acc.balance)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 5 Latest Transactions */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">5 Transaksi Terakhir</h2>
            <p className="text-xs text-slate-500">
              Klik ikon tempat sampah untuk menghapus (dilengkapi tombol Urungkan 7 detik)
            </p>
          </div>
          <Link
            to="/transactions"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentTxQuery.isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-6 w-6" />}
            title="Belum ada transaksi tercatat"
            description="Catat pemasukan atau pengeluaran pertama Anda dengan menekan tombol Catat Transaksi (Shift + N)."
            action={
              <button
                type="button"
                onClick={() => openQuickAdd('EXPENSE')}
                className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600"
              >
                + Catat Transaksi Sekarang
              </button>
            }
          />
        ) : (
          <div className="space-y-2.5">
            {recentTransactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </section>

      {/* Quick Add Account Modal */}
      <Modal
        isOpen={isAddAccountOpen}
        onClose={() => setIsAddAccountOpen(false)}
        title="Tambah Akun Aset Baru"
        subtitle="Tambahkan rekening bank, e-wallet, dana darurat, atau akun investasi baru."
      >
        <form onSubmit={(event) => void handleCreateAccount(event)} className="space-y-4">
          <div>
            <label htmlFor="dash-new-acc-name" className="mb-1.5 block text-sm font-medium text-slate-700">
              Nama Akun<span className="ml-0.5 text-rose-500">*</span>
            </label>
            <input
              id="dash-new-acc-name"
              type="text"
              maxLength={80}
              required
              autoFocus
              value={newAccName}
              onChange={(event) => setNewAccName(event.target.value)}
              placeholder="Contoh: Bank Mandiri / OVO"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label htmlFor="dash-new-acc-type" className="mb-1.5 block text-sm font-medium text-slate-700">
              Jenis Akun
            </label>
            <select
              id="dash-new-acc-type"
              value={newAccType}
              onChange={(event) => setNewAccType(event.target.value as AccountType)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="CASH">Tunai / Dompet</option>
              <option value="BANK">Rekening Bank</option>
              <option value="EWALLET">E-Wallet (GoPay/OVO/Dana)</option>
              <option value="EMERGENCY_FUND">Tabungan Dana Darurat</option>
              <option value="INVESTMENT">Portofolio Investasi</option>
            </select>
          </div>

          <MoneyInput
            id="dash-new-acc-balance"
            label="Saldo Awal"
            value={newAccBalance}
            onChange={setNewAccBalance}
            placeholder="0"
          />

          {newAccError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {newAccError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsAddAccountOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createAccountMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {createAccountMutation.isPending ? 'Menyimpan...' : 'Simpan Akun'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
