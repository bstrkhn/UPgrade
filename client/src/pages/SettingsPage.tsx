import { Save, Settings, ShieldCheck, Sliders, User } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { extractApiErrorMessage } from '../api/client';
import { useMe, useUpdatePreferences } from '../api/hooks/useAuth';
import type { BudgetFramework } from '../api/types';
import { MoneyInput } from '../components/common/MoneyInput';
import { useToast } from '../context/ToastContext';
import {
  compareMoney,
  finalizeMoneyInput,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  sanitizeMoneyInput,
} from '../utils/currency';

export function SettingsPage() {
  const { data: user } = useMe();
  const updatePrefsMutation = useUpdatePreferences();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [baselineEssential, setBaselineEssential] = useState('');
  const [budgetFramework, setBudgetFramework] = useState<BudgetFramework>('ZERO_BASED');
  const [swrRate, setSwrRate] = useState('4.00');
  const [inflationRate, setInflationRate] = useState('4.50');
  const [expectedReturnRate, setExpectedReturnRate] = useState('10.00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setBaselineEssential(user.baselineEssential);
    setBudgetFramework(user.budgetFramework);
    setSwrRate(user.swrRate);
    setInflationRate(user.inflationRate);
    setExpectedReturnRate(user.expectedReturnRate);
  }, [user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage('Nama lengkap wajib diisi.');
      return;
    }

    const cleanBaseline = finalizeMoneyInput(baselineEssential);
    if (!isValidPositiveMoney(cleanBaseline)) {
      setErrorMessage('Estimasi pengeluaran pokok bulanan harus lebih besar dari Rp0.');
      return;
    }

    const cleanSwr = finalizeMoneyInput(swrRate);
    if (!isValidPositiveMoney(cleanSwr) || compareMoney(cleanSwr, '100') > 0) {
      setErrorMessage('Safe Withdrawal Rate (SWR) harus lebih besar dari 0% dan maksimal 100%.');
      return;
    }

    const cleanInflation = finalizeMoneyInput(inflationRate);
    if (!isValidNonNegativeMoney(cleanInflation) || compareMoney(cleanInflation, '100') > 0) {
      setErrorMessage('Asumsi inflasi tahunan harus di antara 0% hingga 100%.');
      return;
    }

    const cleanReturn = finalizeMoneyInput(expectedReturnRate);
    if (!isValidNonNegativeMoney(cleanReturn) || compareMoney(cleanReturn, '100') > 0) {
      setErrorMessage('Ekspektasi imbal hasil investasi harus di antara 0% hingga 100%.');
      return;
    }

    try {
      const response = await updatePrefsMutation.mutateAsync({
        name: name.trim(),
        baselineEssential: cleanBaseline,
        budgetFramework,
        swrRate: cleanSwr,
        inflationRate: cleanInflation,
        expectedReturnRate: cleanReturn,
      });
      showToast({
        variant: 'success',
        message: response.message || 'Pengaturan profil & parameter finansial berhasil disimpan.',
      });
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, 'Gagal menyimpan pengaturan.'));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Pengaturan &amp; Parameter Finansial</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Sesuaikan profil, kerangka anggaran, pengeluaran pokok dasar, serta asumsi makro untuk kalkulasi FIRE Anda
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-6">
        {/* Card 1: Profile */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Profil Pengguna</h2>
              <p className="text-xs text-slate-500">Identitas akun UPgrade Anda</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Lengkap<span className="ml-0.5 text-rose-500">*</span>
              </label>
              <input
                id="settings-name"
                type="text"
                maxLength={100}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="settings-email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Alamat Email (Terkunci)
              </label>
              <input
                id="settings-email"
                type="email"
                disabled
                value={user?.email ?? ''}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Card 2: Baseline & Budgeting Framework */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Pengeluaran Pokok &amp; Kerangka Anggaran</h2>
              <p className="text-xs text-slate-500">
                Digunakan sebagai patokan Dana Darurat &amp; FIRE saat data historis masih di bawah 3 bulan
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <MoneyInput
              id="settings-baseline"
              label="Estimasi Pengeluaran Pokok Bulanan (Baseline Essential)"
              value={baselineEssential}
              onChange={setBaselineEssential}
              helperText="Wajib lebih besar dari Rp0"
              required
            />

            <div>
              <p className="mb-2 block text-sm font-medium text-slate-700">Metode Penganggaran (Budget Framework)</p>
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
                  <p className="mt-1 text-xs text-slate-600">
                    Alokasikan setiap Rupiah pemasukan hingga sisa tak teralokasi menjadi Rp0.
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
                  <p className="mt-1 text-xs text-slate-600">
                    50% Kebutuhan Pokok, 30% Keinginan, dan 20% Tabungan / Pelunasan Utang.
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: SWR & Macro Assumptions */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="mb-4 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Sliders className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Asumsi Investasi &amp; Kebebasan Finansial (FIRE)</h2>
              <p className="text-xs text-slate-500">
                Parameter kustom untuk menghitung angka FIRE, proyeksi Latte Factor, dan imbal hasil riil
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="settings-swr" className="mb-1.5 block text-xs font-medium text-slate-700">
                Safe Withdrawal Rate — SWR (%)
              </label>
              <input
                id="settings-swr"
                type="text"
                inputMode="decimal"
                value={swrRate}
                onChange={(event) => setSwrRate(sanitizeMoneyInput(event.target.value))}
                className="money w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">Rekomendasi standar: 4.00%</p>
            </div>

            <div>
              <label htmlFor="settings-inflation" className="mb-1.5 block text-xs font-medium text-slate-700">
                Asumsi Inflasi Tahunan (%)
              </label>
              <input
                id="settings-inflation"
                type="text"
                inputMode="decimal"
                value={inflationRate}
                onChange={(event) => setInflationRate(sanitizeMoneyInput(event.target.value))}
                className="money w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">Rata-rata historis ID: 4.50%</p>
            </div>

            <div>
              <label htmlFor="settings-return" className="mb-1.5 block text-xs font-medium text-slate-700">
                Ekspektasi Return Investasi (%)
              </label>
              <input
                id="settings-return"
                type="text"
                inputMode="decimal"
                value={expectedReturnRate}
                onChange={(event) => setExpectedReturnRate(sanitizeMoneyInput(event.target.value))}
                className="money w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
              <p className="mt-1 text-[11px] text-slate-500">Rekomendasi moderat: 8%–10%</p>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            {errorMessage}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={updatePrefsMutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{updatePrefsMutation.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Settings className="h-3.5 w-3.5" />
        <span>Seluruh perubahan parameter akan langsung diterapkan pada perhitungan dashboard Anda.</span>
      </div>
    </div>
  );
}
