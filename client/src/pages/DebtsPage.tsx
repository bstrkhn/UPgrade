import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  CreditCard,
  Edit3,
  Flame,
  Plus,
  Sparkles,
  Trash2,
  TrendingDown,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { extractApiErrorMessage } from '../api/client';
import { useCreateDebt, useDebts, useDeleteDebt, useSimulateDebts, useUpdateDebt } from '../api/hooks/useDebts';
import type { DebtSimulationResult, InterestType, PublicDebt } from '../api/types';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Modal } from '../components/common/Modal';
import { MoneyInput } from '../components/common/MoneyInput';
import { useQuickAdd } from '../context/QuickAddContext';
import { useToast } from '../context/ToastContext';
import {
  calculatePercentage,
  clampPercentBarWidth,
  compareMoney,
  finalizeMoneyInput,
  formatPercent,
  formatRupiah,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  sanitizeMoneyInput,
  subtractMoney,
  sumMoney,
} from '../utils/currency';
import { formatPeriodId } from '../utils/date';

const EXTRA_PAYMENT_PRESETS = [
  { label: 'Tanpa Ekstra (Rp0)', value: '0' },
  { label: '+Rp100.000/bln', value: '100000' },
  { label: '+Rp500.000/bln', value: '500000' },
  { label: '+Rp1.000.000/bln', value: '1000000' },
] as const;

function formatYearMonthId(ym: string | null): string {
  if (!ym) return '-';
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  return formatPeriodId({ year: Number(match[1]), month: Number(match[2]) });
}

function formatDurationMonthsId(months: number | null): string {
  if (months === null) return '-';
  if (months === 0) return '0 bulan (Lunas)';
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} bulan`;
  if (rem === 0) return `${years} tahun`;
  return `${years} tahun ${rem} bulan`;
}

export function DebtsPage() {
  const { openQuickAdd } = useQuickAdd();
  const { showToast } = useToast();

  const debtsQuery = useDebts();
  const createDebtMutation = useCreateDebt();
  const updateDebtMutation = useUpdateDebt();
  const deleteDebtMutation = useDeleteDebt();
  const simulateMutation = useSimulateDebts();

  // Simulator controls
  const [extraPayment, setExtraPayment] = useState('0');
  const [simulationResult, setSimulationResult] = useState<DebtSimulationResult | null>(null);

  // Create Debt Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createIsConsumptive, setCreateIsConsumptive] = useState(true);
  const [createPrincipal, setCreatePrincipal] = useState('');
  const [createRemaining, setCreateRemaining] = useState('');
  const [createRemainingTouched, setCreateRemainingTouched] = useState(false);
  const [createMinPay, setCreateMinPay] = useState('');
  const [createRate, setCreateRate] = useState('0');
  const [createInterestType, setCreateInterestType] = useState<InterestType>('EFFECTIVE');
  const [createDueDay, setCreateDueDay] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Debt Modal State
  const [editingDebt, setEditingDebt] = useState<PublicDebt | null>(null);
  const [editName, setEditName] = useState('');
  const [editIsConsumptive, setEditIsConsumptive] = useState(true);
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editRemaining, setEditRemaining] = useState('');
  const [editMinPay, setEditMinPay] = useState('');
  const [editRate, setEditRate] = useState('0');
  const [editInterestType, setEditInterestType] = useState<InterestType>('EFFECTIVE');
  const [editDueDay, setEditDueDay] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const debts = useMemo(() => debtsQuery.data ?? [], [debtsQuery.data]);
  const activeDebts = useMemo(() => debts.filter((d) => !d.isPaidOff), [debts]);
  const paidOffDebts = useMemo(() => debts.filter((d) => d.isPaidOff), [debts]);

  const totalActiveRemaining = useMemo(
    () => sumMoney(activeDebts.map((d) => d.remainingBalance)),
    [activeDebts],
  );
  const totalConsumptiveRemaining = useMemo(
    () => sumMoney(activeDebts.filter((d) => d.isConsumptive).map((d) => d.remainingBalance)),
    [activeDebts],
  );
  const totalMinimumMonthly = useMemo(
    () => sumMoney(activeDebts.map((d) => d.minimumMonthlyPay)),
    [activeDebts],
  );

  // Run initial simulation automatically when active debts change
  useEffect(() => {
    if (activeDebts.length === 0) {
      setSimulationResult(null);
      return;
    }
    const cleanExtra = finalizeMoneyInput(extraPayment || '0');
    const safeExtra = isValidNonNegativeMoney(cleanExtra) ? cleanExtra : '0';
    simulateMutation.mutate(
      { extraMonthlyPayment: safeExtra },
      {
        onSuccess: (data) => {
          setSimulationResult(data);
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDebts.length, totalActiveRemaining, totalMinimumMonthly]);

  const handleRunSimulation = async (overrideExtra?: string) => {
    const raw = overrideExtra !== undefined ? overrideExtra : extraPayment;
    const cleanExtra = finalizeMoneyInput(raw || '0');
    if (!isValidNonNegativeMoney(cleanExtra)) {
      showToast({ variant: 'error', message: 'Nominal pembayaran ekstra bulanan tidak valid.' });
      return;
    }
    try {
      const data = await simulateMutation.mutateAsync({ extraMonthlyPayment: cleanExtra });
      setSimulationResult(data);
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal menghitung simulasi pelunasan utang.'),
      });
    }
  };

  const openCreateModal = () => {
    setCreateName('');
    setCreateIsConsumptive(true);
    setCreatePrincipal('');
    setCreateRemaining('');
    setCreateRemainingTouched(false);
    setCreateMinPay('');
    setCreateRate('0');
    setCreateInterestType('EFFECTIVE');
    setCreateDueDay('');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const openEditModal = (debt: PublicDebt) => {
    setEditingDebt(debt);
    setEditName(debt.name);
    setEditIsConsumptive(debt.isConsumptive);
    setEditPrincipal(finalizeMoneyInput(debt.totalPrincipal));
    setEditRemaining(finalizeMoneyInput(debt.remainingBalance));
    setEditMinPay(finalizeMoneyInput(debt.minimumMonthlyPay));
    setEditRate(finalizeMoneyInput(debt.annualInterestPct));
    setEditInterestType(debt.interestType);
    setEditDueDay(debt.dueDateDay ? String(debt.dueDateDay) : '');
    setEditError(null);
  };

  const handleCreateDebt = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);

    if (!createName.trim()) {
      setCreateError('Nama utang wajib diisi.');
      return;
    }
    const cleanPrincipal = finalizeMoneyInput(createPrincipal);
    const cleanRemaining = finalizeMoneyInput(createRemaining || createPrincipal);
    const cleanMinPay = finalizeMoneyInput(createMinPay || '0');
    const cleanRate = finalizeMoneyInput(createRate || '0');

    if (!isValidPositiveMoney(cleanPrincipal)) {
      setCreateError('Total pokok pinjaman awal harus lebih besar dari Rp0.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanRemaining)) {
      setCreateError('Sisa pokok utang tidak valid.');
      return;
    }
    if (compareMoney(cleanRemaining, cleanPrincipal) > 0) {
      setCreateError('Sisa pokok utang tidak boleh melebihi total pokok pinjaman awal.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanMinPay)) {
      setCreateError('Cicilan minimum bulanan tidak valid.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanRate) || compareMoney(cleanRate, '100') > 0) {
      setCreateError('Bunga tahunan harus di antara 0% hingga 100%.');
      return;
    }

    let dueDateDay: number | null = null;
    if (createDueDay.trim()) {
      const parsedDay = Number(createDueDay.trim());
      if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        setCreateError('Tanggal jatuh tempo harus berupa angka bulat antara 1 hingga 31.');
        return;
      }
      dueDateDay = parsedDay;
    }

    try {
      const response = await createDebtMutation.mutateAsync({
        name: createName.trim(),
        isConsumptive: createIsConsumptive,
        totalPrincipal: cleanPrincipal,
        remainingBalance: cleanRemaining,
        minimumMonthlyPay: cleanMinPay,
        annualInterestPct: cleanRate,
        interestType: createInterestType,
        dueDateDay,
      });
      showToast({
        variant: 'success',
        message: response.message || `Utang "${response.data.debt.name}" berhasil ditambahkan.`,
      });
      setIsCreateOpen(false);
    } catch (error) {
      setCreateError(extractApiErrorMessage(error, 'Gagal menyimpan data utang.'));
    }
  };

  const handleUpdateDebt = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingDebt) return;
    setEditError(null);

    if (!editName.trim()) {
      setEditError('Nama utang wajib diisi.');
      return;
    }
    const cleanPrincipal = finalizeMoneyInput(editPrincipal);
    const cleanRemaining = finalizeMoneyInput(editRemaining);
    const cleanMinPay = finalizeMoneyInput(editMinPay || '0');
    const cleanRate = finalizeMoneyInput(editRate || '0');

    if (!isValidPositiveMoney(cleanPrincipal)) {
      setEditError('Total pokok pinjaman harus lebih besar dari Rp0.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanRemaining)) {
      setEditError('Sisa pokok utang tidak valid.');
      return;
    }
    if (compareMoney(cleanRemaining, cleanPrincipal) > 0) {
      setEditError('Sisa pokok utang tidak boleh melebihi total pokok pinjaman.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanMinPay)) {
      setEditError('Cicilan minimum bulanan tidak valid.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanRate) || compareMoney(cleanRate, '100') > 0) {
      setEditError('Bunga tahunan harus di antara 0% hingga 100%.');
      return;
    }

    let dueDateDay: number | null = null;
    if (editDueDay.trim()) {
      const parsedDay = Number(editDueDay.trim());
      if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) {
        setEditError('Tanggal jatuh tempo harus berupa angka bulat antara 1 hingga 31.');
        return;
      }
      dueDateDay = parsedDay;
    }

    const remainingChanged = compareMoney(cleanRemaining, editingDebt.remainingBalance) !== 0;

    try {
      const response = await updateDebtMutation.mutateAsync({
        id: editingDebt.id,
        payload: {
          name: editName.trim(),
          isConsumptive: editIsConsumptive,
          totalPrincipal: cleanPrincipal,
          ...(remainingChanged ? { remainingBalance: cleanRemaining } : {}),
          minimumMonthlyPay: cleanMinPay,
          annualInterestPct: cleanRate,
          interestType: editInterestType,
          dueDateDay,
        },
      });
      showToast({
        variant: 'success',
        message: response.message || `Data utang "${response.data.debt.name}" berhasil diperbarui.`,
      });
      setEditingDebt(null);
    } catch (error) {
      setEditError(extractApiErrorMessage(error, 'Gagal memperbarui data utang.'));
    }
  };

  const handleDeleteDebt = async (debt: PublicDebt) => {
    if (deleteDebtMutation.isPending) return;
    try {
      const response = await deleteDebtMutation.mutateAsync(debt.id);
      showToast({
        variant: 'success',
        message: response.message || `Utang "${debt.name}" berhasil dihapus.`,
      });
    } catch (error) {
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Utang tidak dapat dihapus.'),
      });
    }
  };

  // Merge Snowball and Avalanche monthly schedule points for Recharts LineChart (Number conversion ONLY at chart boundary)
  const chartData = useMemo(() => {
    if (!simulationResult) return [];
    const snowSchedule = simulationResult.snowball.schedule;
    const avaSchedule = simulationResult.avalanche.schedule;
    const maxLen = Math.max(snowSchedule.length, avaSchedule.length);
    if (maxLen === 0) return [];

    const initialTotal = Number(simulationResult.totalRemainingBalance);
    const points: Array<{
      label: string;
      Snowball: number;
      Avalanche: number;
    }> = [
      {
        label: 'Awal',
        Snowball: initialTotal,
        Avalanche: initialTotal,
      },
    ];

    for (let i = 0; i < maxLen; i += 1) {
      const snowPt = snowSchedule[i];
      const avaPt = avaSchedule[i];
      const monthNum = snowPt?.month ?? avaPt?.month ?? i + 1;
      points.push({
        label: `Bln ${monthNum}`,
        Snowball: snowPt ? Number(snowPt.totalRemainingBalance) : 0,
        Avalanche: avaPt ? Number(avaPt.totalRemainingBalance) : 0,
      });
    }

    return points;
  }, [simulationResult]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Debt Destroyer &amp; Manajemen Utang
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Kelola kewajiban cicilan dan bandingkan strategi pelunasan <strong>Snowball</strong> vs{' '}
            <strong>Avalanche</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activeDebts.length > 0 && (
            <button
              type="button"
              onClick={() => openQuickAdd('DEBT_PAYMENT')}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-violet-700"
            >
              <CreditCard className="h-4 w-4" />
              <span>Bayar Cicilan</span>
            </button>
          )}
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-600"
          >
            <Plus className="h-4 w-4" />
            <span>Tambah Utang</span>
          </button>
        </div>
      </div>

      {debtsQuery.isError && (
        <ErrorBanner
          message={extractApiErrorMessage(debtsQuery.error, 'Gagal memuat daftar utang.')}
          onRetry={() => void debtsQuery.refetch()}
        />
      )}

      {/* 3 Debt KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Total Sisa Utang Aktif</p>
          <p className="money mt-2 text-2xl font-extrabold text-rose-600">{formatRupiah(totalActiveRemaining)}</p>
          <p className="mt-1 text-xs text-slate-500">{activeDebts.length} pinjaman aktif berjalan</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Utang Konsumtif (Syarat L4)</p>
            {compareMoney(totalConsumptiveRemaining, '0') === 0 ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                Bebas Konsumtif!
              </span>
            ) : (
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                Prioritas Lunas
              </span>
            )}
          </div>
          <p
            className={`money mt-2 text-2xl font-extrabold ${
              compareMoney(totalConsumptiveRemaining, '0') === 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatRupiah(totalConsumptiveRemaining)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {compareMoney(totalConsumptiveRemaining, '0') === 0
              ? 'Syarat bebas utang konsumtif Level 4 terpenuhi'
              : 'Lunasi hingga Rp0 untuk membuka Level 4'}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Total Cicilan Minimum / Bulan</p>
          <p className="money mt-2 text-2xl font-extrabold text-violet-700">{formatRupiah(totalMinimumMonthly)}</p>
          <p className="mt-1 text-xs text-slate-500">Kewajiban minimum bulanan sebelum pembayaran ekstra</p>
        </div>
      </div>

      {/* Active Debts List */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">Daftar Utang &amp; Cicilan Aktif</h2>

        {debtsQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {[1, 2].map((item) => (
              <div key={item} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />
            ))}
          </div>
        ) : activeDebts.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-6 w-6 text-emerald-600" />}
            title="Selamat! Anda Tidak Memiliki Utang Aktif"
            description="Pertahankan kondisi bebas utang konsumtif dan fokuskan arus kas Anda pada Dana Darurat serta investasi FIRE."
            action={
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                + Catat Data Utang (Jika Ada)
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {activeDebts.map((debt) => {
              const paidPrincipal = subtractMoney(debt.totalPrincipal, debt.remainingBalance);
              const paidPct = calculatePercentage(paidPrincipal, debt.totalPrincipal);
              const barWidth = clampPercentBarWidth(paidPct);

              return (
                <div
                  key={debt.id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs transition hover:border-slate-300"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-bold text-slate-900">{debt.name}</h3>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                              debt.isConsumptive
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-indigo-200 bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {debt.isConsumptive ? 'Konsumtif' : 'Produktif'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Bunga <strong className="money">{formatPercent(debt.annualInterestPct)}/thn</strong> (
                          {debt.interestType === 'FLAT' ? 'Flat' : 'Efektif'})
                          {debt.dueDateDay && (
                            <span className="ml-2 inline-flex items-center gap-1 text-slate-500">
                              • <Calendar className="h-3 w-3" /> Jatuh tempo tgl {debt.dueDateDay}
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(debt)}
                          title="Ubah utang"
                          aria-label={`Ubah utang ${debt.name}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteDebt(debt)}
                          disabled={deleteDebtMutation.isPending}
                          title="Hapus utang (hanya jika belum ada riwayat pembayaran)"
                          aria-label={`Hapus utang ${debt.name}`}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-baseline justify-between">
                      <div>
                        <p className="text-[11px] text-slate-400">Sisa Pokok Utang</p>
                        <p className="money text-xl font-extrabold text-rose-600">
                          {formatRupiah(debt.remainingBalance)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-400">Dari Total Pinjaman</p>
                        <p className="money text-xs font-bold text-slate-700">{formatRupiah(debt.totalPrincipal)}</p>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Progres Pelunasan Pokok</span>
                        <span className="money font-bold text-emerald-600">{formatPercent(paidPct)}</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
                    <span className="text-xs text-slate-500">
                      Cicilan min:{' '}
                      <strong className="money font-bold text-slate-800">
                        {formatRupiah(debt.minimumMonthlyPay)}/bln
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => openQuickAdd('DEBT_PAYMENT')}
                      className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 transition hover:bg-violet-100"
                    >
                      Bayar Cicilan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Interactive Snowball vs Avalanche Simulator */}
      {activeDebts.length > 0 && (
        <section className="space-y-4 rounded-3xl border border-indigo-200/80 bg-white p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Flame className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Simulator Debt Destroyer: Snowball vs Avalanche
                </h2>
                <p className="text-xs text-slate-500">
                  Simulasikan efek <em>rollover</em> (menggulirkan cicilan utang yang sudah lunas ke utang berikutnya)
                  ditambah alokasi ekstra bulanan
                </p>
              </div>
            </div>
          </div>

          {/* Extra Monthly Payment Control Bar */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-12">
              <div className="md:col-span-5">
                <MoneyInput
                  id="debt-sim-extra"
                  label="Tambahan Pembayaran Ekstra per Bulan (Di Atas Cicilan Minimum)"
                  value={extraPayment}
                  onChange={setExtraPayment}
                  placeholder="0"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 md:col-span-5">
                {EXTRA_PAYMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      setExtraPayment(preset.value);
                      void handleRunSimulation(preset.value);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      compareMoney(finalizeMoneyInput(extraPayment || '0'), preset.value) === 0
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="md:col-span-2">
                <button
                  type="button"
                  disabled={simulateMutation.isPending}
                  onClick={() => void handleRunSimulation()}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50"
                >
                  <Zap className="h-3.5 w-3.5" />
                  <span>{simulateMutation.isPending ? 'Menghitung...' : 'Simulasikan'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Simulation Output */}
          {simulationResult && (
            <div className="space-y-5">
              {!simulationResult.snowball.isPayable || !simulationResult.avalanche.isPayable ? (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Peringatan: Pembayaran Bulanan Belum Mencukupi</p>
                    <p className="mt-0.5 leading-relaxed">
                      {simulationResult.avalanche.unpayableReason ??
                        simulationResult.snowball.unpayableReason ??
                        'Tambahkan pembayaran ekstra bulanan agar pokok utang dapat berkurang.'}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Recommendation Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-5 py-3.5 text-xs text-emerald-950">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>
                        {simulationResult.comparison.recommendedStrategy === 'AVALANCHE' ? (
                          <>
                            <strong>Rekomendasi Matematis: Metode Debt Avalanche</strong> menghemat total bunga sebesar{' '}
                            <strong className="money text-emerald-700">
                              {formatRupiah(simulationResult.comparison.interestSavedByAvalanche)}
                            </strong>
                            {simulationResult.comparison.monthsSavedByAvalanche > 0 && (
                              <>
                                {' '}
                                dan lunas <strong>{simulationResult.comparison.monthsSavedByAvalanche} bulan</strong>{' '}
                                lebih cepat dibanding Snowball!
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            Kedua strategi melunasi seluruh utang dalam{' '}
                            <strong>{formatDurationMonthsId(simulationResult.avalanche.monthsToDebtFree)}</strong>{' '}
                            dengan total bunga yang setara. Pilih <strong>Snowball</strong> untuk kemenangan psikologis
                            cepat!
                          </>
                        )}
                      </span>
                    </div>
                    <span className="money font-bold text-emerald-800">
                      Total Anggaran Pelunasan:{' '}
                      {formatRupiah(
                        sumMoney([simulationResult.totalMinimumMonthlyPay, simulationResult.extraMonthlyPayment]),
                      )}
                      /bln
                    </span>
                  </div>

                  {/* Side-by-Side Strategy Comparison Cards */}
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {[
                      {
                        title: 'Debt Avalanche (Bunga Tertinggi Dulu)',
                        subtitle: 'Secara matematis meminimalkan total bunga yang terbuang',
                        badge:
                          simulationResult.comparison.recommendedStrategy === 'AVALANCHE'
                            ? 'Paling Hemat Bunga'
                            : 'Strategi Matematis',
                        accentClass: 'border-emerald-300 bg-emerald-50/30',
                        badgeClass: 'bg-emerald-100 text-emerald-800',
                        data: simulationResult.avalanche,
                      },
                      {
                        title: 'Debt Snowball (Saldo Terkecil Dulu)',
                        subtitle: 'Melunasi jumlah akun utang kecil lebih cepat untuk motivasi psikologis',
                        badge: 'Kemenangan Cepat',
                        accentClass: 'border-indigo-200 bg-indigo-50/20',
                        badgeClass: 'bg-indigo-100 text-indigo-800',
                        data: simulationResult.snowball,
                      },
                    ].map((card) => (
                      <div key={card.data.strategy} className={`rounded-2xl border p-5 ${card.accentClass}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-slate-900">{card.title}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">{card.subtitle}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${card.badgeClass}`}>
                            {card.badge}
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5">
                          <div>
                            <p className="text-[11px] text-slate-400">Estimasi Bebas Utang</p>
                            <p className="mt-0.5 text-sm font-extrabold text-slate-900">
                              {formatYearMonthId(card.data.debtFreeDate)}
                            </p>
                            <p className="text-[11px] font-medium text-indigo-600">
                              ({formatDurationMonthsId(card.data.monthsToDebtFree)})
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] text-slate-400">Total Bunga Dibayar</p>
                            <p className="money mt-0.5 text-sm font-extrabold text-rose-600">
                              {formatRupiah(card.data.totalInterestPaid)}
                            </p>
                            <p className="money text-[11px] text-slate-500">
                              Total keluar: {formatRupiah(card.data.totalAmountPaid)}
                            </p>
                          </div>
                        </div>

                        {/* Payoff Order */}
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-bold text-slate-700">Urutan Pelunasan:</p>
                          <ol className="space-y-1.5">
                            {card.data.payoffOrder.map((stepItem, idx) => (
                              <li
                                key={stepItem.debtId}
                                className="flex items-center justify-between rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-xs"
                              >
                                <span className="font-semibold text-slate-800">
                                  {idx + 1}. {stepItem.name}
                                </span>
                                <span className="text-slate-500">
                                  Lunas bln ke-<strong>{stepItem.paidOffMonth}</strong> (
                                  {formatYearMonthId(stepItem.paidOffDate)})
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Recharts Balance Trajectory LineChart */}
                  {chartData.length > 1 && (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900">
                            Kurva Penurunan Saldo Utang: Snowball vs Avalanche
                          </h3>
                          <p className="text-xs text-slate-500">
                            Perbandingan sisa pokok seluruh utang dari bulan ke bulan hingga mencapai Rp0
                          </p>
                        </div>
                        <TrendingDown className="h-5 w-5 text-emerald-600" />
                      </div>

                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData} margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#64748b' }}
                              tickFormatter={(val: number) => formatRupiah(String(Math.round(val)))}
                              width={105}
                            />
                            <Tooltip
                              formatter={(value) => [
                                formatRupiah(String(Math.round(Number(value ?? 0)))),
                                '',
                              ]}
                              contentStyle={{
                                borderRadius: '12px',
                                borderColor: '#e2e8f0',
                                fontSize: '12px',
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Line
                              type="monotone"
                              dataKey="Avalanche"
                              name="Debt Avalanche (Hemat Bunga)"
                              stroke="#10b981"
                              strokeWidth={2.5}
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="Snowball"
                              name="Debt Snowball (Saldo Terkecil)"
                              stroke="#4f46e5"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* Paid-Off Debts Archive */}
      {paidOffDebts.length > 0 && (
        <section className="space-y-3 border-t border-slate-200 pt-6">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">Arsip Utang yang Sudah Lunas ({paidOffDebts.length})</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paidOffDebts.map((debt) => (
              <div
                key={debt.id}
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900">{debt.name}</p>
                  <p className="money text-xs text-slate-500">
                    Pokok Awal: {formatRupiah(debt.totalPrincipal)} • Lunas Rp0
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                  Lunas
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create Debt Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Tambah Data Utang / Cicilan"
        subtitle="Masukkan rincian pinjaman untuk dipantau dan disimulasikan di Debt Destroyer."
      >
        <form onSubmit={(event) => void handleCreateDebt(event)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="debt-create-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Utang<span className="ml-0.5 text-rose-500">*</span>
              </label>
              <input
                id="debt-create-name"
                type="text"
                maxLength={80}
                required
                autoFocus
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                placeholder="Contoh: Kartu Kredit / Paylater"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="debt-create-kind" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kategori Utang
              </label>
              <select
                id="debt-create-kind"
                value={createIsConsumptive ? 'CONSUMPTIVE' : 'PRODUCTIVE'}
                onChange={(event) => setCreateIsConsumptive(event.target.value === 'CONSUMPTIVE')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="CONSUMPTIVE">Konsumtif (Paylater, Kartu Kredit, KTA)</option>
                <option value="PRODUCTIVE">Produktif / Aset (KPR, Modal Usaha)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput
              id="debt-create-principal"
              label="Total Pokok Pinjaman Awal"
              value={createPrincipal}
              onChange={(val) => {
                setCreatePrincipal(val);
                if (!createRemainingTouched) {
                  setCreateRemaining(val);
                }
              }}
              placeholder="Contoh: 5000000"
              required
            />

            <MoneyInput
              id="debt-create-remaining"
              label="Sisa Pokok Utang Saat Ini"
              value={createRemaining}
              onChange={(val) => {
                setCreateRemaining(val);
                setCreateRemainingTouched(true);
              }}
              placeholder="Contoh: 3500000"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyInput
              id="debt-create-minpay"
              label="Cicilan Minimum / Bln"
              value={createMinPay}
              onChange={setCreateMinPay}
              placeholder="Contoh: 350000"
              required
            />

            <div>
              <label htmlFor="debt-create-rate" className="mb-1.5 block text-sm font-medium text-slate-700">
                Bunga / Tahun (%)
              </label>
              <input
                id="debt-create-rate"
                type="text"
                inputMode="decimal"
                value={createRate}
                onChange={(event) => setCreateRate(sanitizeMoneyInput(event.target.value))}
                placeholder="0"
                className="money w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="debt-create-inttype" className="mb-1.5 block text-sm font-medium text-slate-700">
                Perhitungan Bunga
              </label>
              <select
                id="debt-create-inttype"
                value={createInterestType}
                onChange={(event) => setCreateInterestType(event.target.value as InterestType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="EFFECTIVE">Efektif (Dari Sisa Pokok)</option>
                <option value="FLAT">Flat (Dari Pokok Awal)</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="debt-create-dueday" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tanggal Jatuh Tempo Bulanan (Opsional, 1–31)
            </label>
            <input
              id="debt-create-dueday"
              type="number"
              min={1}
              max={31}
              value={createDueDay}
              onChange={(event) => setCreateDueDay(event.target.value)}
              placeholder="Contoh: 15"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {createError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {createError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={createDebtMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {createDebtMutation.isPending ? 'Menyimpan...' : 'Simpan Utang'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Debt Modal */}
      <Modal
        isOpen={Boolean(editingDebt)}
        onClose={() => setEditingDebt(null)}
        title="Ubah Rincian Utang"
        subtitle="Sisa utang yang sudah memiliki riwayat transaksi pembayaran hanya dapat diubah melalui transaksi Bayar Utang."
      >
        <form onSubmit={(event) => void handleUpdateDebt(event)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="debt-edit-name" className="mb-1.5 block text-sm font-medium text-slate-700">
                Nama Utang<span className="ml-0.5 text-rose-500">*</span>
              </label>
              <input
                id="debt-edit-name"
                type="text"
                maxLength={80}
                required
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="debt-edit-kind" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kategori Utang
              </label>
              <select
                id="debt-edit-kind"
                value={editIsConsumptive ? 'CONSUMPTIVE' : 'PRODUCTIVE'}
                onChange={(event) => setEditIsConsumptive(event.target.value === 'CONSUMPTIVE')}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="CONSUMPTIVE">Konsumtif (Paylater, Kartu Kredit, KTA)</option>
                <option value="PRODUCTIVE">Produktif / Aset (KPR, Modal Usaha)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput
              id="debt-edit-principal"
              label="Total Pokok Pinjaman Awal"
              value={editPrincipal}
              onChange={setEditPrincipal}
              required
            />

            <MoneyInput
              id="debt-edit-remaining"
              label="Sisa Pokok Utang"
              value={editRemaining}
              onChange={setEditRemaining}
              helperText="Terkunci otomatis jika sudah ada pembayaran"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MoneyInput
              id="debt-edit-minpay"
              label="Cicilan Minimum / Bln"
              value={editMinPay}
              onChange={setEditMinPay}
              required
            />

            <div>
              <label htmlFor="debt-edit-rate" className="mb-1.5 block text-sm font-medium text-slate-700">
                Bunga / Tahun (%)
              </label>
              <input
                id="debt-edit-rate"
                type="text"
                inputMode="decimal"
                value={editRate}
                onChange={(event) => setEditRate(sanitizeMoneyInput(event.target.value))}
                className="money w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div>
              <label htmlFor="debt-edit-inttype" className="mb-1.5 block text-sm font-medium text-slate-700">
                Perhitungan Bunga
              </label>
              <select
                id="debt-edit-inttype"
                value={editInterestType}
                onChange={(event) => setEditInterestType(event.target.value as InterestType)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="EFFECTIVE">Efektif</option>
                <option value="FLAT">Flat</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="debt-edit-dueday" className="mb-1.5 block text-sm font-medium text-slate-700">
              Tanggal Jatuh Tempo Bulanan (1–31)
            </label>
            <input
              id="debt-edit-dueday"
              type="number"
              min={1}
              max={31}
              value={editDueDay}
              onChange={(event) => setEditDueDay(event.target.value)}
              placeholder="Kosongkan jika tidak ada"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {editError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {editError}
            </div>
          )}

          <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setEditingDebt(null)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updateDebtMutation.isPending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-50"
            >
              {updateDebtMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
