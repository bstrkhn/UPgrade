import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CreditCard,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { extractApiErrorMessage } from '../api/client';
import { useCompleteOnboarding } from '../api/hooks/useOnboarding';
import type {
  AccountType,
  BudgetFramework,
  InitialLevelSummary,
  InterestType,
  OnboardingAccountInput,
  OnboardingDebtInput,
} from '../api/types';
import { MoneyInput } from '../components/common/MoneyInput';
import { useToast } from '../context/ToastContext';
import {
  compareMoney,
  finalizeMoneyInput,
  formatRupiah,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  sanitizeMoneyInput,
  sumMoney,
} from '../utils/currency';

const ACCOUNT_TYPE_OPTIONS: Array<{ value: AccountType; label: string }> = [
  { value: 'CASH', label: 'Tunai / Dompet' },
  { value: 'BANK', label: 'Rekening Bank' },
  { value: 'EWALLET', label: 'E-Wallet (GoPay/OVO/Dana)' },
  { value: 'EMERGENCY_FUND', label: 'Tabungan Dana Darurat' },
  { value: 'INVESTMENT', label: 'Portofolio Investasi' },
];

interface DraftAccount {
  key: string;
  name: string;
  type: AccountType;
  balance: string;
}

interface DraftDebt {
  key: string;
  name: string;
  isConsumptive: boolean;
  totalPrincipal: string;
  remainingBalance: string;
  minimumMonthlyPay: string;
  annualInterestPct: string;
  interestType: InterestType;
}

const STEPS = [
  { number: 1, title: 'Pengeluaran Pokok', subtitle: 'Estimasi biaya hidup wajib bulanan' },
  { number: 2, title: 'Akun Aset Awal', subtitle: 'Dompet, rekening, dan tabungan' },
  { number: 3, title: 'Utang Aktif', subtitle: 'Pinjaman atau cicilan berjalan' },
] as const;

export function OnboardingPage() {
  const onboardingMutation = useCompleteOnboarding();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [baselineEssential, setBaselineEssential] = useState('3000000');
  const [budgetFramework, setBudgetFramework] = useState<BudgetFramework>('ZERO_BASED');

  const [accounts, setAccounts] = useState<DraftAccount[]>([
    { key: 'acc-1', name: 'Rekening Utama', type: 'BANK', balance: '1000000' },
    { key: 'acc-2', name: 'Dompet Tunai', type: 'CASH', balance: '200000' },
  ]);

  const [debts, setDebts] = useState<DraftDebt[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [closureSummary, setClosureSummary] = useState<InitialLevelSummary | null>(null);

  const liveTotalAssets = useMemo(
    () =>
      sumMoney(
        accounts.map((acc) => {
          const clean = finalizeMoneyInput(acc.balance);
          return isValidNonNegativeMoney(clean) ? clean : '0';
        }),
      ),
    [accounts],
  );

  const liveTotalLiabilities = useMemo(
    () =>
      sumMoney(
        debts.map((debt) => {
          const clean = finalizeMoneyInput(debt.remainingBalance || debt.totalPrincipal);
          return isValidNonNegativeMoney(clean) ? clean : '0';
        }),
      ),
    [debts],
  );

  const validateStep1 = (): boolean => {
    const clean = finalizeMoneyInput(baselineEssential);
    if (!isValidPositiveMoney(clean)) {
      setErrorMessage('Pengeluaran pokok bulanan wajib lebih besar dari Rp0.');
      return false;
    }
    setErrorMessage(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    if (accounts.length === 0) {
      setErrorMessage('Tambahkan minimal satu akun aset awal.');
      return false;
    }
    for (const acc of accounts) {
      if (!acc.name.trim()) {
        setErrorMessage('Semua nama akun wajib diisi.');
        return false;
      }
      const cleanBalance = finalizeMoneyInput(acc.balance || '0');
      if (!isValidNonNegativeMoney(cleanBalance)) {
        setErrorMessage(`Saldo akun "${acc.name}" tidak valid.`);
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  const validateStep3 = (debtsToValidate: DraftDebt[]): boolean => {
    for (const debt of debtsToValidate) {
      if (!debt.name.trim()) {
        setErrorMessage('Nama utang wajib diisi.');
        return false;
      }
      const principal = finalizeMoneyInput(debt.totalPrincipal);
      const remaining = finalizeMoneyInput(debt.remainingBalance || debt.totalPrincipal);
      const minPay = finalizeMoneyInput(debt.minimumMonthlyPay || '0');
      const rate = finalizeMoneyInput(debt.annualInterestPct || '0');

      if (!isValidPositiveMoney(principal)) {
        setErrorMessage(`Total pokok utang "${debt.name}" harus lebih besar dari Rp0.`);
        return false;
      }
      if (!isValidNonNegativeMoney(remaining)) {
        setErrorMessage(`Sisa utang "${debt.name}" tidak valid.`);
        return false;
      }
      if (compareMoney(remaining, principal) > 0) {
        setErrorMessage(`Sisa utang "${debt.name}" tidak boleh melebihi total pokok pinjaman.`);
        return false;
      }
      if (!isValidNonNegativeMoney(minPay)) {
        setErrorMessage(`Cicilan minimum bulanan "${debt.name}" tidak valid.`);
        return false;
      }
      if (!isValidNonNegativeMoney(rate) || compareMoney(rate, '100') > 0) {
        setErrorMessage(`Bunga tahunan "${debt.name}" harus di antara 0% hingga 100%.`);
        return false;
      }
    }
    setErrorMessage(null);
    return true;
  };

  const submitOnboarding = async (debtsToSubmit: DraftDebt[]) => {
    if (!validateStep1() || !validateStep2() || !validateStep3(debtsToSubmit)) {
      return;
    }

    const formattedAccounts: OnboardingAccountInput[] = accounts.map((acc) => ({
      name: acc.name.trim(),
      type: acc.type,
      balance: finalizeMoneyInput(acc.balance || '0'),
      isLiquid: acc.type !== 'INVESTMENT',
    }));

    const formattedDebts: OnboardingDebtInput[] = debtsToSubmit.map((debt) => ({
      name: debt.name.trim(),
      isConsumptive: debt.isConsumptive,
      totalPrincipal: finalizeMoneyInput(debt.totalPrincipal),
      remainingBalance: finalizeMoneyInput(debt.remainingBalance || debt.totalPrincipal),
      minimumMonthlyPay: finalizeMoneyInput(debt.minimumMonthlyPay || '0'),
      annualInterestPct: finalizeMoneyInput(debt.annualInterestPct || '0'),
      interestType: debt.interestType,
    }));

    try {
      const response = await onboardingMutation.mutateAsync({
        baselineEssential: finalizeMoneyInput(baselineEssential),
        budgetFramework,
        accounts: formattedAccounts,
        debts: formattedDebts,
      });

      setClosureSummary(response.data.summary);
      showToast({
        variant: 'success',
        message: response.message || 'Onboarding selesai! Level awal UPgrade Anda telah ditetapkan.',
      });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Gagal menyimpan data onboarding.'));
    }
  };

  // Celebratory Closure Screen (Golden Rule #4)
  if (closureSummary) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="animate-pop-in overflow-hidden rounded-3xl border border-indigo-200 bg-white shadow-xl">
            <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-6 py-8 text-center text-white sm:px-10">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 ring-2 ring-indigo-400/50">
                <Award className="h-9 w-9 text-indigo-300" />
              </div>
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-indigo-500/25 px-3.5 py-1 text-xs font-semibold text-indigo-200">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Titik Awal Perjalanan Finansial Anda</span>
              </div>
              <h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">
                Level {closureSummary.level}: {closureSummary.title}
              </h1>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-0.5 text-xs font-medium text-slate-200">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
                <span>Basis Data: {closureSummary.badge}</span>
              </div>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
                {closureSummary.description}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
                Ringkasan Neraca Awal Anda
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium text-slate-500">Total Aset Awal</p>
                  <p className="money mt-1 text-lg font-extrabold text-emerald-600">
                    {formatRupiah(closureSummary.totalAssets)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium text-slate-500">Total Utang Aktif</p>
                  <p className="money mt-1 text-lg font-extrabold text-rose-600">
                    {formatRupiah(closureSummary.totalLiabilities)}
                  </p>
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
                  <p className="text-xs font-medium text-indigo-700">Kekayaan Bersih (Net Worth)</p>
                  <p className="money mt-1 text-lg font-extrabold text-slate-900">
                    {formatRupiah(closureSummary.netWorth)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-xs font-medium text-slate-500">Estimasi Pengeluaran Pokok / Bulan</p>
                  <p className="money mt-1 text-lg font-extrabold text-slate-900">
                    {formatRupiah(closureSummary.baselineEssential)}
                  </p>
                </div>
              </div>

              <div className="mt-7 flex justify-end">
                <button
                  type="button"
                  onClick={() => void navigate('/dashboard', { replace: true })}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-indigo-600 sm:w-auto"
                >
                  <span>Masuk ke Dashboard</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <TrendingUp className="h-5 w-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Siapkan Profil Keuangan UPgrade</h1>
            <p className="text-xs text-slate-500">
              3 langkah singkat untuk menetapkan Level Kebebasan Finansial awal Anda
            </p>
          </div>
        </div>

        {/* Visual 3-Step Progress Stepper */}
        <ol className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((item) => {
            const isCurrent = step === item.number;
            const isCompleted = step > item.number;
            return (
              <li
                key={item.number}
                className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${
                  isCurrent
                    ? 'border-indigo-600 bg-white shadow-xs'
                    : isCompleted
                      ? 'border-emerald-200 bg-emerald-50/60'
                      : 'border-slate-200 bg-white/60 opacity-75'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    isCurrent
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : item.number}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">{item.title}</p>
                  <p className="truncate text-[11px] text-slate-500">{item.subtitle}</p>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Step Card */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs sm:p-8">
          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Langkah 1: Berapa Pengeluaran Pokok Bulanan Anda?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Masukkan estimasi biaya hidup wajib per bulan (makan pokok, tempat tinggal, listrik/air/internet,
                  transportasi kerja, dan kesehatan). Angka ini menjadi dasar perhitungan Dana Darurat (
                  <strong>Estimasi Awal</strong>) selama riwayat transaksi aktual Anda belum mencapai 3 bulan.
                </p>
              </div>

              <MoneyInput
                id="onboarding-baseline-essential"
                label="Estimasi Pengeluaran Pokok per Bulan"
                value={baselineEssential}
                onChange={setBaselineEssential}
                placeholder="Contoh: 3000000"
                helperText="Wajib lebih besar dari Rp0"
                required
                autoFocus
              />

              <div>
                <p className="mb-2 block text-sm font-medium text-slate-700">Pilih Kerangka Anggaran Pilihan Anda</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setBudgetFramework('ZERO_BASED')}
                    className={`rounded-2xl border p-4 text-left transition ${
                      budgetFramework === 'ZERO_BASED'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Zero-Based Budgeting</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Setiap Rupiah penghasilan diberi tugas spesifik hingga sisa tak teralokasi menjadi Rp0. Sangat
                      efektif untuk disiplin arus kas.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBudgetFramework('RULE_50_30_20')}
                    className={`rounded-2xl border p-4 text-left transition ${
                      budgetFramework === 'RULE_50_30_20'
                        ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-100'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <p className="text-sm font-bold text-slate-900">Aturan 50 / 30 / 20</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">
                      Panduan proporsional: 50% Kebutuhan Pokok, 30% Keinginan, dan 20% Tabungan / Pelunasan Utang.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Langkah 2: Daftarkan Akun Aset Awal Anda</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Masukkan dompet tunai, rekening bank, e-wallet, atau investasi yang Anda miliki saat ini.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-right">
                  <p className="text-[11px] font-medium text-emerald-800">Total Aset Terdaftar</p>
                  <p className="money text-sm font-extrabold text-emerald-700">{formatRupiah(liveTotalAssets)}</p>
                </div>
              </div>

              <div className="space-y-3">
                {accounts.map((acc, index) => (
                  <div
                    key={acc.key}
                    className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <Wallet className="h-3.5 w-3.5 text-indigo-600" />
                        Akun #{index + 1}
                      </span>
                      {accounts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAccounts((prev) => prev.filter((item) => item.key !== acc.key))}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Nama Akun</label>
                        <input
                          type="text"
                          maxLength={80}
                          value={acc.name}
                          onChange={(event) => {
                            const val = event.target.value;
                            setAccounts((prev) =>
                              prev.map((item) => (item.key === acc.key ? { ...item, name: val } : item)),
                            );
                          }}
                          placeholder="Contoh: BCA / GoPay"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">Jenis Akun</label>
                        <select
                          value={acc.type}
                          onChange={(event) => {
                            const val = event.target.value as AccountType;
                            setAccounts((prev) =>
                              prev.map((item) => (item.key === acc.key ? { ...item, type: val } : item)),
                            );
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                        >
                          {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <MoneyInput
                          label="Saldo Saat Ini"
                          value={acc.balance}
                          onChange={(val) =>
                            setAccounts((prev) =>
                              prev.map((item) => (item.key === acc.key ? { ...item, balance: val } : item)),
                            )
                          }
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  setAccounts((prev) => [
                    ...prev,
                    {
                      key: `acc-${Date.now()}-${prev.length}`,
                      name: '',
                      type: 'EWALLET',
                      balance: '0',
                    },
                  ])
                }
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100/70"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Akun Aset Lainnya</span>
              </button>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Langkah 3: Apakah Ada Utang atau Cicilan Aktif?</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Opsional — tambahkan jika Anda memiliki Paylater, Kartu Kredit, KTA, atau KPR yang masih berjalan.
                  </p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-right">
                  <p className="text-[11px] font-medium text-rose-800">Total Sisa Utang</p>
                  <p className="money text-sm font-extrabold text-rose-700">{formatRupiah(liveTotalLiabilities)}</p>
                </div>
              </div>

              {debts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <CreditCard className="mx-auto h-8 w-8 text-slate-400" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">Belum ada utang yang ditambahkan</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Jika Anda bebas utang, langsung klik tombol <strong>&ldquo;Saya Tidak Punya Utang&rdquo;</strong> di
                    bawah, atau tambahkan daftar cicilan Anda untuk dipetakan.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setDebts([
                        {
                          key: `debt-${Date.now()}`,
                          name: '',
                          isConsumptive: true,
                          totalPrincipal: '',
                          remainingBalance: '',
                          minimumMonthlyPay: '0',
                          annualInterestPct: '0',
                          interestType: 'FLAT',
                        },
                      ])
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Utang Aktif</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {debts.map((debt, index) => (
                    <div key={debt.key} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                          <CreditCard className="h-3.5 w-3.5 text-violet-600" />
                          Utang #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDebts((prev) => prev.filter((item) => item.key !== debt.key))}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">Nama Utang / Pinjaman</label>
                          <input
                            type="text"
                            maxLength={80}
                            value={debt.name}
                            onChange={(event) => {
                              const val = event.target.value;
                              setDebts((prev) =>
                                prev.map((item) => (item.key === debt.key ? { ...item, name: val } : item)),
                              );
                            }}
                            placeholder="Contoh: Paylater / Kartu Kredit"
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">Kategori Utang</label>
                          <select
                            value={debt.isConsumptive ? 'CONSUMPTIVE' : 'PRODUCTIVE'}
                            onChange={(event) => {
                              const isConsumptive = event.target.value === 'CONSUMPTIVE';
                              setDebts((prev) =>
                                prev.map((item) => (item.key === debt.key ? { ...item, isConsumptive } : item)),
                              );
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                          >
                            <option value="CONSUMPTIVE">Konsumtif (Paylater, Kartu Kredit, KTA)</option>
                            <option value="PRODUCTIVE">Produktif / Aset (KPR, Modal Usaha)</option>
                          </select>
                        </div>

                        <MoneyInput
                          label="Total Pokok Pinjaman Awal"
                          value={debt.totalPrincipal}
                          onChange={(val) =>
                            setDebts((prev) =>
                              prev.map((item) =>
                                item.key === debt.key
                                  ? {
                                      ...item,
                                      totalPrincipal: val,
                                      remainingBalance: item.remainingBalance || val,
                                    }
                                  : item,
                              ),
                            )
                          }
                          placeholder="Contoh: 2000000"
                        />

                        <MoneyInput
                          label="Sisa Pokok Utang Saat Ini"
                          value={debt.remainingBalance}
                          onChange={(val) =>
                            setDebts((prev) =>
                              prev.map((item) => (item.key === debt.key ? { ...item, remainingBalance: val } : item)),
                            )
                          }
                          placeholder="Contoh: 1500000"
                        />

                        <MoneyInput
                          label="Cicilan Minimum per Bulan"
                          value={debt.minimumMonthlyPay}
                          onChange={(val) =>
                            setDebts((prev) =>
                              prev.map((item) => (item.key === debt.key ? { ...item, minimumMonthlyPay: val } : item)),
                            )
                          }
                          placeholder="Contoh: 300000"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">Bunga / Tahun (%)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={debt.annualInterestPct}
                              onChange={(event) => {
                                const val = sanitizeMoneyInput(event.target.value);
                                setDebts((prev) =>
                                  prev.map((item) =>
                                    item.key === debt.key ? { ...item, annualInterestPct: val } : item,
                                  ),
                                );
                              }}
                              placeholder="0"
                              className="money w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                            />
                          </div>

                          <div>
                            <label className="mb-1.5 block text-xs font-medium text-slate-700">Tipe Bunga</label>
                            <select
                              value={debt.interestType}
                              onChange={(event) => {
                                const val = event.target.value as InterestType;
                                setDebts((prev) =>
                                  prev.map((item) => (item.key === debt.key ? { ...item, interestType: val } : item)),
                                );
                              }}
                              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                            >
                              <option value="FLAT">Flat</option>
                              <option value="EFFECTIVE">Efektif</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() =>
                      setDebts((prev) => [
                        ...prev,
                        {
                          key: `debt-${Date.now()}-${prev.length}`,
                          name: '',
                          isConsumptive: true,
                          totalPrincipal: '',
                          remainingBalance: '',
                          minimumMonthlyPay: '0',
                          annualInterestPct: '0',
                          interestType: 'FLAT',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-2.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100/70"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Utang Lainnya</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {errorMessage && (
            <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* Step Navigation Footer */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setStep((prev) => (prev === 3 ? 2 : 1));
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Kembali</span>
              </button>
            ) : (
              <span />
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={() => {
                  if (step === 1 && validateStep1()) setStep(2);
                  else if (step === 2 && validateStep2()) setStep(3);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600"
              >
                <span>Lanjut</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {debts.length === 0 ? (
                  <button
                    type="button"
                    disabled={onboardingMutation.isPending}
                    onClick={() => void submitOnboarding([])}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    <span>
                      {onboardingMutation.isPending
                        ? 'Menyimpan...'
                        : 'Saya Tidak Punya Utang — Selesaikan Onboarding'}
                    </span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={onboardingMutation.isPending}
                      onClick={() => {
                        setDebts([]);
                        void submitOnboarding([]);
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      Lewati Tanpa Utang
                    </button>
                    <button
                      type="button"
                      disabled={onboardingMutation.isPending}
                      onClick={() => void submitOnboarding(debts)}
                      className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      <span>
                        {onboardingMutation.isPending ? 'Menyimpan...' : 'Simpan & Lihat Level UPgrade Saya'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
