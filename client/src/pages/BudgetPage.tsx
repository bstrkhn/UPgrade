import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  PieChart,
  RotateCcw,
  Save,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { extractApiErrorMessage } from '../api/client';
import { useUpdatePreferences } from '../api/hooks/useAuth';
import { useBudgetOverview, useUpsertBudgets } from '../api/hooks/useBudgets';
import type { BudgetCategoryRow, BudgetFramework, ZeroBasedStatus } from '../api/types';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { MoneyInput } from '../components/common/MoneyInput';
import { useToast } from '../context/ToastContext';
import {
  allocateProportionalShare,
  calculatePercentage,
  clampPercentBarWidth,
  compareMoney,
  finalizeMoneyInput,
  formatPercent,
  formatRupiah,
  isValidNonNegativeMoney,
  subtractMoney,
  sumMoney,
} from '../utils/currency';
import { formatPeriodId, getCurrentWibPeriod, isSamePeriod, shiftPeriod, type Period } from '../utils/date';

export function BudgetPage() {
  const { showToast } = useToast();
  const currentWibPeriod = useMemo(() => getCurrentWibPeriod(), []);
  const [period, setPeriod] = useState<Period>(currentWibPeriod);

  const overviewQuery = useBudgetOverview(period.year, period.month);
  const upsertBudgetsMutation = useUpsertBudgets();
  const updatePrefsMutation = useUpdatePreferences();

  const [draftAllocations, setDraftAllocations] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const lastSyncedPeriodKeyRef = useRef<string>('');

  const overview = overviewQuery.data;
  const categories = useMemo(() => overview?.categories ?? [], [overview?.categories]);

  const getCleanDraft = (categoryId: string, fallback = '0'): string => {
    const raw = draftAllocations[categoryId];
    if (raw === undefined || raw === '') return '0';
    const finalized = finalizeMoneyInput(raw);
    return isValidNonNegativeMoney(finalized) ? finalized : fallback;
  };

  const isDirty = useMemo(() => {
    if (Object.keys(draftAllocations).length === 0) return false;
    for (const row of categories) {
      const currentDraft = getCleanDraft(row.categoryId, row.allocated);
      if (compareMoney(currentDraft, row.allocated) !== 0) {
        return true;
      }
    }
    return false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, draftAllocations]);

  // Sync draft allocations when period changes or when draft is clean (preserve unsaved user edits during background refetch)
  useEffect(() => {
    if (!overview) return;
    const periodKey = `${overview.period.year}-${overview.period.month}`;
    const isNewPeriod = lastSyncedPeriodKeyRef.current !== periodKey;
    if (!isNewPeriod && isDirty) {
      return;
    }
    const nextDraft: Record<string, string> = {};
    for (const row of overview.categories) {
      nextDraft[row.categoryId] = compareMoney(row.allocated, '0') === 0 ? '0' : finalizeMoneyInput(row.allocated);
    }
    lastSyncedPeriodKeyRef.current = periodKey;
    setDraftAllocations(nextDraft);
    if (isNewPeriod) {
      setFormError(null);
    }
  }, [overview, isDirty]);

  const essentialRows = useMemo(
    () => categories.filter((cat) => cat.expenseClass === 'ESSENTIAL'),
    [categories],
  );
  const discretionaryRows = useMemo(
    () => categories.filter((cat) => cat.expenseClass === 'DISCRETIONARY'),
    [categories],
  );

  const liveEssentialAllocated = useMemo(
    () => sumMoney(essentialRows.map((row) => getCleanDraft(row.categoryId, row.allocated))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [essentialRows, draftAllocations],
  );

  const liveDiscretionaryAllocated = useMemo(
    () => sumMoney(discretionaryRows.map((row) => getCleanDraft(row.categoryId, row.allocated))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [discretionaryRows, draftAllocations],
  );

  const liveTotalAllocated = useMemo(
    () => sumMoney([liveEssentialAllocated, liveDiscretionaryAllocated]),
    [liveEssentialAllocated, liveDiscretionaryAllocated],
  );

  const totalIncome = overview?.cashFlow.totalIncome ?? '0.00';
  const liveUnallocated = useMemo(
    () => subtractMoney(totalIncome, liveTotalAllocated),
    [totalIncome, liveTotalAllocated],
  );

  const liveZeroBasedStatus: ZeroBasedStatus = useMemo(() => {
    if (compareMoney(totalIncome, '0') === 0 && compareMoney(liveTotalAllocated, '0') === 0) {
      return 'NO_INCOME';
    }
    const cmp = compareMoney(liveUnallocated, '0');
    if (cmp === 0) return 'BALANCED';
    if (cmp > 0) return 'UNDER_ALLOCATED';
    return 'OVER_ALLOCATED';
  }, [totalIncome, liveTotalAllocated, liveUnallocated]);

  const handleFrameworkSwitch = async (nextFramework: BudgetFramework) => {
    if (!overview || overview.budgetFramework === nextFramework || updatePrefsMutation.isPending) return;
    try {
      await updatePrefsMutation.mutateAsync({ budgetFramework: nextFramework });
      showToast({
        variant: 'success',
        message:
          nextFramework === 'ZERO_BASED'
            ? 'Metode anggaran diubah ke Zero-Based Budgeting.'
            : 'Metode anggaran diubah ke Aturan 50 / 30 / 20.',
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal mengubah metode anggaran.'),
      });
    }
  };

  const handleAutoAllocate5030 = () => {
    if (compareMoney(totalIncome, '0') <= 0) {
      showToast({
        variant: 'warning',
        message: 'Catat pemasukan bulan ini terlebih dahulu agar alokasi otomatis 50/30 dapat dihitung.',
      });
      return;
    }

    const perEssential = allocateProportionalShare(totalIncome, '0.50', essentialRows.length);
    const perDiscretionary = allocateProportionalShare(totalIncome, '0.30', discretionaryRows.length);

    const nextDraft: Record<string, string> = {};
    for (const row of essentialRows) {
      nextDraft[row.categoryId] = perEssential;
    }
    for (const row of discretionaryRows) {
      nextDraft[row.categoryId] = perDiscretionary;
    }
    setDraftAllocations(nextDraft);
    showToast({
      variant: 'success',
      message: 'Draf alokasi 50% Kebutuhan & 30% Keinginan diterapkan. Klik "Simpan Anggaran Bulan Ini" untuk menyimpan.',
    });
  };

  const handleResetDraft = () => {
    if (!overview) return;
    const nextDraft: Record<string, string> = {};
    for (const row of overview.categories) {
      nextDraft[row.categoryId] = compareMoney(row.allocated, '0') === 0 ? '0' : finalizeMoneyInput(row.allocated);
    }
    setDraftAllocations(nextDraft);
    setFormError(null);
  };

  const handleSaveBudgets = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    if (categories.length === 0) return;

    const items: Array<{ categoryId: string; allocated: string }> = [];
    for (const row of categories) {
      const clean = finalizeMoneyInput(draftAllocations[row.categoryId] || '0');
      if (!isValidNonNegativeMoney(clean)) {
        setFormError(`Nominal alokasi untuk kategori "${row.categoryName}" tidak valid.`);
        return;
      }
      items.push({ categoryId: row.categoryId, allocated: clean });
    }

    try {
      const response = await upsertBudgetsMutation.mutateAsync({
        year: period.year,
        month: period.month,
        payload: { items },
      });
      const syncedDraft: Record<string, string> = {};
      for (const row of response.data.categories) {
        syncedDraft[row.categoryId] =
          compareMoney(row.allocated, '0') === 0 ? '0' : finalizeMoneyInput(row.allocated);
      }
      setDraftAllocations(syncedDraft);
      showToast({
        variant: 'success',
        message: response.message || `Anggaran periode ${formatPeriodId(period)} berhasil disimpan.`,
      });
    } catch (error) {
      setFormError(extractApiErrorMessage(error, 'Gagal menyimpan alokasi anggaran.'));
    }
  };

  const renderCategoryRow = (row: BudgetCategoryRow) => {
    const rawDraft = draftAllocations[row.categoryId] ?? '0';
    const cleanAllocated = getCleanDraft(row.categoryId, row.allocated);
    const isBudgeted = compareMoney(cleanAllocated, '0') > 0;
    const liveRemaining = subtractMoney(cleanAllocated, row.spent);
    const isOverBudget = isBudgeted && compareMoney(row.spent, cleanAllocated) > 0;
    const liveUtilizationPct = isBudgeted ? calculatePercentage(row.spent, cleanAllocated) : '0.00';
    const barWidth = clampPercentBarWidth(liveUtilizationPct);
    const isNearLimit = isBudgeted && !isOverBudget && compareMoney(liveUtilizationPct, '80') >= 0;

    return (
      <div
        key={row.categoryId}
        className={`rounded-2xl border bg-white p-4 transition ${
          isOverBudget
            ? 'border-rose-300 bg-rose-50/20'
            : isBudgeted
              ? 'border-slate-200 hover:border-slate-300'
              : 'border-slate-200/80 bg-white/80'
        }`}
      >
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-sm font-bold text-slate-900">{row.categoryName}</h4>
              {!isBudgeted ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  Belum dianggarkan
                </span>
              ) : isOverBudget ? (
                <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                  Melebihi Budget ({formatPercent(liveUtilizationPct)})
                </span>
              ) : (
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                    isNearLimit
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  }`}
                >
                  Terpakai {formatPercent(liveUtilizationPct)}
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>
                Realisasi Terpakai:{' '}
                <strong className="money font-semibold text-slate-800">{formatRupiah(row.spent)}</strong>
              </span>
              {isBudgeted && (
                <span>
                  {isOverBudget ? 'Terlampaui:' : 'Sisa Budget:'}{' '}
                  <strong
                    className={`money font-semibold ${
                      isOverBudget ? 'text-rose-600' : isNearLimit ? 'text-amber-700' : 'text-emerald-600'
                    }`}
                  >
                    {formatRupiah(liveRemaining)}
                  </strong>
                </span>
              )}
            </div>
          </div>

          <div className="w-full sm:w-56">
            <MoneyInput
              id={`budget-input-${row.categoryId}`}
              value={rawDraft}
              onChange={(val) =>
                setDraftAllocations((prev) => ({
                  ...prev,
                  [row.categoryId]: val,
                }))
              }
              placeholder="0"
            />
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              !isBudgeted
                ? 'bg-slate-300'
                : isOverBudget
                  ? 'bg-rose-500'
                  : isNearLimit
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    );
  };

  const activeFramework = overview?.budgetFramework ?? 'ZERO_BASED';

  return (
    <div className="space-y-6">
      {/* Top Header: Title, Period Switcher & Framework Switcher */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Perencanaan Anggaran Bulanan</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Atur batas pengeluaran kategori pada periode{' '}
            <strong className="font-semibold text-slate-700">{formatPeriodId(period)}</strong> dan pantau sisa anggaran
            secara langsung
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Framework Quick Switcher */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => void handleFrameworkSwitch('ZERO_BASED')}
              disabled={updatePrefsMutation.isPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFramework === 'ZERO_BASED'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Zero-Based
            </button>
            <button
              type="button"
              onClick={() => void handleFrameworkSwitch('RULE_50_30_20')}
              disabled={updatePrefsMutation.isPending}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeFramework === 'RULE_50_30_20'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Aturan 50/30/20
            </button>
          </div>

          {/* Month/Year Period Switcher */}
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

      {overviewQuery.isError && (
        <ErrorBanner
          message={extractApiErrorMessage(overviewQuery.error, 'Gagal memuat data anggaran bulanan.')}
          onRetry={() => void overviewQuery.refetch()}
        />
      )}

      {/* Dynamic Summary Panel */}
      {overviewQuery.isLoading ? (
        <div className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      ) : activeFramework === 'ZERO_BASED' ? (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">Total Pemasukan Bulan Ini</p>
              <p className="money mt-1 text-xl font-extrabold text-emerald-600">{formatRupiah(totalIncome)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <p className="text-xs font-medium text-slate-500">Total Teralokasi ke Kategori</p>
              <p className="money mt-1 text-xl font-extrabold text-slate-900">{formatRupiah(liveTotalAllocated)}</p>
            </div>
            <div
              className={`rounded-xl border p-4 ${
                liveZeroBasedStatus === 'BALANCED'
                  ? 'border-emerald-200 bg-emerald-50'
                  : liveZeroBasedStatus === 'UNDER_ALLOCATED'
                    ? 'border-amber-200 bg-amber-50'
                    : liveZeroBasedStatus === 'OVER_ALLOCATED'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-slate-200 bg-slate-50'
              }`}
            >
              <p className="text-xs font-semibold text-slate-700">Sisa Tak Teralokasi</p>
              <p
                className={`money mt-1 text-xl font-extrabold ${
                  liveZeroBasedStatus === 'BALANCED'
                    ? 'text-emerald-700'
                    : liveZeroBasedStatus === 'UNDER_ALLOCATED'
                      ? 'text-amber-800'
                      : liveZeroBasedStatus === 'OVER_ALLOCATED'
                        ? 'text-rose-700'
                        : 'text-slate-800'
                }`}
              >
                {formatRupiah(liveUnallocated)}
              </p>
            </div>
          </div>

          {/* Zero-Based Status Banner */}
          <div
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-xs font-medium ${
              liveZeroBasedStatus === 'BALANCED'
                ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                : liveZeroBasedStatus === 'UNDER_ALLOCATED'
                  ? 'border-amber-200 bg-amber-50/80 text-amber-950'
                  : liveZeroBasedStatus === 'OVER_ALLOCATED'
                    ? 'border-rose-200 bg-rose-50/80 text-rose-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {liveZeroBasedStatus === 'BALANCED' ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  <strong>Anggaran Seimbang (Sisa Tak Teralokasi = Rp0)!</strong> Setiap Rupiah pemasukan Anda telah
                  memiliki tugas yang jelas.
                </span>
              </>
            ) : liveZeroBasedStatus === 'UNDER_ALLOCATED' ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  Masih ada <strong className="money">{formatRupiah(liveUnallocated)}</strong> yang belum dialokasikan.
                  Tambahkan ke pos Kebutuhan atau sisihkan ke tabungan hingga sisa menjadi <strong>Rp0</strong>.
                </span>
              </>
            ) : liveZeroBasedStatus === 'OVER_ALLOCATED' ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Total alokasi melebihi pemasukan bulan ini sebesar{' '}
                  <strong className="money">{formatRupiah(subtractMoney(liveTotalAllocated, totalIncome))}</strong>.
                  Kurangi beberapa kategori agar anggaran tidak defisit.
                </span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-600" />
                <span>
                  Belum ada pemasukan tercatat pada periode ini. Anda tetap dapat menyusun rencana anggaran kategori di
                  bawah.
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        /* RULE_50_30_20 Comparison Cards */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* 50% Needs */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-indigo-600 uppercase">
                50% Kebutuhan Pokok
              </span>
              <span className="money rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                Aktual {formatPercent(overview?.rule503020.needs.actualPctOfIncome ?? '0')}
              </span>
            </div>
            <p className="money mt-2 text-lg font-extrabold text-slate-900">
              Terpakai {formatRupiah(overview?.rule503020.needs.spent ?? '0')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Patokan 50% Pemasukan:{' '}
              <strong className="money text-slate-700">
                {formatRupiah(overview?.rule503020.needs.targetAmount ?? '0')}
              </strong>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Draf Alokasi:{' '}
              <strong className="money text-indigo-700">{formatRupiah(liveEssentialAllocated)}</strong>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{
                  width: `${clampPercentBarWidth(
                    calculatePercentage(
                      overview?.rule503020.needs.spent ?? '0',
                      overview?.rule503020.needs.targetAmount ?? '0',
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 30% Wants */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-rose-600 uppercase">30% Keinginan</span>
              <span className="money rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                Aktual {formatPercent(overview?.rule503020.wants.actualPctOfIncome ?? '0')}
              </span>
            </div>
            <p className="money mt-2 text-lg font-extrabold text-slate-900">
              Terpakai {formatRupiah(overview?.rule503020.wants.spent ?? '0')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Batas 30% Pemasukan:{' '}
              <strong className="money text-slate-700">
                {formatRupiah(overview?.rule503020.wants.targetAmount ?? '0')}
              </strong>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Draf Alokasi:{' '}
              <strong className="money text-rose-700">{formatRupiah(liveDiscretionaryAllocated)}</strong>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-rose-500 transition-all"
                style={{
                  width: `${clampPercentBarWidth(
                    calculatePercentage(
                      overview?.rule503020.wants.spent ?? '0',
                      overview?.rule503020.wants.targetAmount ?? '0',
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* 20% Savings & Debt Repayment */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-emerald-600 uppercase">
                20% Tabungan &amp; Utang
              </span>
              <span className="money rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                Aktual {formatPercent(overview?.rule503020.savings.actualPctOfIncome ?? '0')}
              </span>
            </div>
            <p className="money mt-2 text-lg font-extrabold text-emerald-600">
              Surplus {formatRupiah(overview?.rule503020.savings.actualSavings ?? '0')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Target Minimal 20%:{' '}
              <strong className="money text-slate-700">
                {formatRupiah(overview?.rule503020.savings.targetAmount ?? '0')}
              </strong>
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cicilan Utang Bulan Ini:{' '}
              <strong className="money text-violet-700">
                {formatRupiah(overview?.rule503020.savings.debtPaymentTotal ?? '0')}
              </strong>
            </p>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${clampPercentBarWidth(
                    calculatePercentage(
                      overview?.rule503020.savings.actualSavings ?? '0',
                      overview?.rule503020.savings.targetAmount ?? '0',
                    ),
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-2xs">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <PieChart className="h-4 w-4 text-indigo-600" />
          <span>
            Masukkan batas anggaran per kategori. Kategori dengan alokasi <strong>Rp0</strong> berstatus{' '}
            <em>Belum dianggarkan</em>.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAutoAllocate5030}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"
          >
            <Wand2 className="h-3.5 w-3.5" />
            <span>Isi Otomatis Proporsi 50/30</span>
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleResetDraft}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Urungkan Perubahan</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Allocation Form */}
      {overviewQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-6 w-6" />}
          title="Belum ada kategori pengeluaran"
          description="Tambahkan kategori Kebutuhan Pokok atau Keinginan di halaman Akun & Kategori terlebih dahulu."
        />
      ) : (
        <form onSubmit={(event) => void handleSaveBudgets(event)} className="space-y-8">
          {/* Group 1: ESSENTIAL */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">1. Kategori Kebutuhan Pokok (Essential)</h2>
                <p className="text-xs text-slate-500">
                  Biaya hidup wajib bulanan yang menjadi fondasi perhitungan Dana Darurat &amp; FIRE
                </p>
              </div>
              <span className="money rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                Total Alokasi Pokok: {formatRupiah(liveEssentialAllocated)}
              </span>
            </div>
            <div className="space-y-3">{essentialRows.map(renderCategoryRow)}</div>
          </section>

          {/* Group 2: DISCRETIONARY */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">2. Kategori Keinginan (Discretionary)</h2>
                <p className="text-xs text-slate-500">
                  Gaya hidup, jajan, dan hiburan yang dipantau oleh sistem audit Latte Factor
                </p>
              </div>
              <span className="money rounded-xl border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">
                Total Alokasi Keinginan: {formatRupiah(liveDiscretionaryAllocated)}
              </span>
            </div>
            <div className="space-y-3">{discretionaryRows.map(renderCategoryRow)}</div>
          </section>

          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
              {formError}
            </div>
          )}

          {/* Sticky Save Bar (with pr-20 on mobile so Mobile FAB never overlaps Save button) */}
          <div className="sticky bottom-16 z-10 flex flex-col items-stretch justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 py-4 pr-20 pl-5 shadow-lg backdrop-blur-xs sm:flex-row sm:items-center lg:bottom-4 lg:pr-5">
            <div className="text-xs">
              {isDirty ? (
                <span className="font-semibold text-amber-700">
                  • Ada perubahan alokasi anggaran yang belum disimpan
                </span>
              ) : (
                <span className="text-slate-500">
                  Seluruh alokasi anggaran periode {formatPeriodId(period)} sudah tersimpan
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={upsertBudgetsMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>
                {upsertBudgetsMutation.isPending
                  ? 'Menyimpan Anggaran...'
                  : `Simpan Anggaran ${formatPeriodId(period)}`}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
