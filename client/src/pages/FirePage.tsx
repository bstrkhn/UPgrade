import {
  Award,
  Calculator,
  CheckCircle2,
  Flame,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { extractApiErrorMessage } from '../api/client';
import { useFireSimulation } from '../api/hooks/useAnalytics';
import { useUpdatePreferences } from '../api/hooks/useAuth';
import type { FireMilestoneCountdown, FireSimulationResult } from '../api/types';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { MoneyInput } from '../components/common/MoneyInput';
import { useToast } from '../context/ToastContext';
import {
  clampPercentBarWidth,
  compareMoney,
  finalizeMoneyInput,
  formatPercent,
  formatRupiah,
  isNegativeMoney,
  isValidNonNegativeMoney,
  isValidPositiveMoney,
  sanitizeMoneyInput,
} from '../utils/currency';
import { formatPeriodId } from '../utils/date';

function formatYearMonthId(ym: string | null): string {
  if (!ym) return '-';
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  return formatPeriodId({ year: Number(match[1]), month: Number(match[2]) });
}

function formatMilestoneCountdownText(ms: FireMilestoneCountdown): string {
  if (ms.alreadyReached) {
    return 'Target Tercapai!';
  }
  if (!ms.isReachableWithinHorizon || ms.years === null || ms.remainingMonths === null) {
    return 'Di atas horison proyeksi (tingkatkan setoran / return)';
  }
  const parts: string[] = [];
  if (ms.years > 0) parts.push(`${ms.years} Tahun`);
  if (ms.remainingMonths > 0) parts.push(`${ms.remainingMonths} Bulan`);
  const duration = parts.length > 0 ? parts.join(' ') : 'Kurang dari 1 Bulan';
  return `${duration} (${formatYearMonthId(ms.targetDate)})`;
}

export function FirePage() {
  const { showToast } = useToast();
  const fireSimMutation = useFireSimulation();
  const updatePrefsMutation = useUpdatePreferences();

  const [simResult, setSimResult] = useState<FireSimulationResult | null>(null);
  const [essentialBasis, setEssentialBasis] = useState('');
  const [currentPortfolio, setCurrentPortfolio] = useState('');
  const [monthlyContribution, setMonthlyContribution] = useState('');
  const [swrRatePct, setSwrRatePct] = useState('4.00');
  const [inflationRatePct, setInflationRatePct] = useState('4.50');
  const [expectedReturnRatePct, setExpectedReturnRatePct] = useState('10.00');
  const [formError, setFormError] = useState<string | null>(null);

  const initialLoadedRef = useRef(false);

  // Initial simulation load using user's actual database defaults
  useEffect(() => {
    if (initialLoadedRef.current) return;
    initialLoadedRef.current = true;

    fireSimMutation.mutate(
      {},
      {
        onSuccess: (data) => {
          setSimResult(data);
          setEssentialBasis(finalizeMoneyInput(data.inputsUsed.monthlyEssentialBasis));
          setCurrentPortfolio(finalizeMoneyInput(data.inputsUsed.currentInvestmentPortfolio));
          setMonthlyContribution(finalizeMoneyInput(data.inputsUsed.monthlyContribution));
          setSwrRatePct(finalizeMoneyInput(data.inputsUsed.swrRatePct));
          setInflationRatePct(finalizeMoneyInput(data.inputsUsed.inflationRatePct));
          setExpectedReturnRatePct(finalizeMoneyInput(data.inputsUsed.expectedReturnRatePct));
        },
      },
    );
  }, [fireSimMutation]);

  const handleRunProjection = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    const cleanEssential = finalizeMoneyInput(essentialBasis);
    const cleanPortfolio = finalizeMoneyInput(currentPortfolio || '0');
    const cleanContrib = finalizeMoneyInput(monthlyContribution || '0');
    const cleanSwr = finalizeMoneyInput(swrRatePct);
    const cleanInflation = finalizeMoneyInput(inflationRatePct || '0');
    const cleanReturn = finalizeMoneyInput(expectedReturnRatePct || '0');

    if (!isValidPositiveMoney(cleanEssential)) {
      setFormError('Pengeluaran pokok bulanan wajib lebih besar dari Rp0.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanPortfolio)) {
      setFormError('Portofolio investasi awal tidak valid.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanContrib)) {
      setFormError('Setoran investasi bulanan tidak valid.');
      return;
    }
    if (!isValidPositiveMoney(cleanSwr) || compareMoney(cleanSwr, '100') > 0) {
      setFormError('Safe Withdrawal Rate (SWR) harus lebih besar dari 0% dan maksimal 100%.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanInflation) || compareMoney(cleanInflation, '100') > 0) {
      setFormError('Asumsi inflasi harus di antara 0% hingga 100%.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanReturn) || compareMoney(cleanReturn, '100') > 0) {
      setFormError('Ekspektasi return investasi harus di antara 0% hingga 100%.');
      return;
    }

    try {
      const data = await fireSimMutation.mutateAsync({
        monthlyEssentialBasis: cleanEssential,
        currentInvestmentPortfolio: cleanPortfolio,
        monthlyContribution: cleanContrib,
        swrRatePct: cleanSwr,
        inflationRatePct: cleanInflation,
        expectedReturnRatePct: cleanReturn,
        maxYears: 40,
      });
      setSimResult(data);
    } catch (error) {
      setFormError(extractApiErrorMessage(error, 'Gagal menghitung proyeksi FIRE.'));
    }
  };

  const handleSaveAssumptionsToProfile = async () => {
    setFormError(null);
    const cleanSwr = finalizeMoneyInput(swrRatePct);
    const cleanInflation = finalizeMoneyInput(inflationRatePct || '0');
    const cleanReturn = finalizeMoneyInput(expectedReturnRatePct || '0');

    if (!isValidPositiveMoney(cleanSwr) || compareMoney(cleanSwr, '100') > 0) {
      setFormError('Safe Withdrawal Rate (SWR) harus lebih besar dari 0% dan maksimal 100%.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanInflation) || compareMoney(cleanInflation, '100') > 0) {
      setFormError('Asumsi inflasi harus di antara 0% hingga 100%.');
      return;
    }
    if (!isValidNonNegativeMoney(cleanReturn) || compareMoney(cleanReturn, '100') > 0) {
      setFormError('Ekspektasi return investasi harus di antara 0% hingga 100%.');
      return;
    }

    try {
      const response = await updatePrefsMutation.mutateAsync({
        swrRate: cleanSwr,
        inflationRate: cleanInflation,
        expectedReturnRate: cleanReturn,
      });
      showToast({
        variant: 'success',
        message: response.message || 'Asumsi SWR, Inflasi, dan Return berhasil disimpan ke profil Anda.',
      });
    } catch (error) {
      setFormError(extractApiErrorMessage(error, 'Gagal menyimpan asumsi ke profil.'));
    }
  };

  const projection = simResult?.projection;

  // Convert string money to Number ONLY at the Recharts data boundary
  const chartData = useMemo(() => {
    if (!projection) return [];
    return projection.yearlyProjection.map((pt) => ({
      label: `Thn ${pt.year} (${pt.calendarYear})`,
      TotalPortofolio: Number(pt.projectedPortfolio),
      TotalModalDisetor: Number(pt.totalContributed),
    }));
  }, [projection]);

  const l5TargetNum = projection ? Number(projection.level5Target) : 0;
  const fireTargetNum = projection ? Number(projection.fireNumber) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Kalkulator SWR &amp; Countdown FIRE (Level 5–7)
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Simulasikan waktu pencapaian Fleksibilitas (L5), Kebebasan Finansial Dasar (L6), dan Kekayaan Melimpah (L7)
            dengan penyesuaian inflasi riil (<em>Fisher Equation</em>)
          </p>
        </div>

        {simResult && (
          <span
            className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-xs font-semibold sm:self-auto ${
              simResult.dataSource === 'ONBOARDING_BASELINE'
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>
              Basis Pengeluaran: {simResult.dataSourceBadge} ({simResult.historyMonthsCount} bln histori)
            </span>
          </span>
        )}
      </div>

      {fireSimMutation.isError && !simResult && (
        <ErrorBanner
          message={extractApiErrorMessage(fireSimMutation.error, 'Gagal memuat proyeksi FIRE.')}
          onRetry={() => fireSimMutation.mutate({})}
        />
      )}

      {/* Countdown Summary Banner */}
      {projection && (
        <div className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 text-white shadow-md">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/25 px-3 py-0.5 text-xs font-semibold text-indigo-200">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>Countdown Kebebasan Finansial Dasar (Level 6 — FIRE Number)</span>
              </div>
              <h2 className="text-xl font-extrabold sm:text-2xl">
                {projection.milestones.level6Fire.alreadyReached
                  ? 'Selamat! Portofolio Anda Telah Mencapai Angka FIRE!'
                  : projection.milestones.level6Fire.isReachableWithinHorizon
                    ? `Estimasi Tercapai dalam ${formatMilestoneCountdownText(projection.milestones.level6Fire)}`
                    : 'Target FIRE Belum Tercapai dalam Horison 40 Tahun — Tingkatkan Setoran Bulanan'}
              </h2>
              <p className="text-xs text-slate-300">
                Target Angka FIRE:{' '}
                <strong className="money text-white">{formatRupiah(projection.fireNumber)}</strong> (Pengeluaran Pokok{' '}
                <span className="money">{formatRupiah(projection.annualEssential)}/thn</span> pada SWR{' '}
                <span className="money">{formatPercent(projection.swrRatePct)}</span>)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-right">
                <p className="text-[11px] text-indigo-200">Imbal Hasil Riil (Setelah Inflasi)</p>
                <p
                  className={`money mt-0.5 text-lg font-extrabold ${
                    isNegativeMoney(projection.realReturnRatePct) ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {formatPercent(projection.realReturnRatePct)} / tahun
                </p>
                <p className="text-[10px] text-slate-300">
                  Nominal {formatPercent(projection.nominalReturnRatePct)} vs Inflasi{' '}
                  {formatPercent(projection.inflationRatePct)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 Wealth Ladder Milestone Cards: L5, L6, L7 */}
      {projection && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              level: 5,
              title: 'Level 5: Fleksibilitas',
              subtitle: '12x Pengeluaran Pokok Bulanan',
              milestone: projection.milestones.level5,
              accentClass: 'border-indigo-200 bg-white',
              barClass: 'bg-indigo-600',
            },
            {
              level: 6,
              title: 'Level 6: Angka FIRE',
              subtitle: `100% Biaya Pokok via SWR ${formatPercent(projection.swrRatePct)}`,
              milestone: projection.milestones.level6Fire,
              accentClass: 'border-emerald-300 bg-emerald-50/20',
              barClass: 'bg-emerald-500',
            },
            {
              level: 7,
              title: 'Level 7: Kekayaan Melimpah',
              subtitle: '2x Angka FIRE (Abundant Wealth)',
              milestone: projection.milestones.level7Abundant,
              accentClass: 'border-violet-200 bg-white',
              barClass: 'bg-violet-600',
            },
          ].map((card) => {
            const barWidth = clampPercentBarWidth(card.milestone.progressPct);
            return (
              <div
                key={card.level}
                className={`flex flex-col justify-between rounded-2xl border p-5 shadow-2xs ${card.accentClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900">{card.title}</span>
                    {card.milestone.alreadyReached ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" />
                        Tercapai
                      </span>
                    ) : (
                      <span className="money rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                        {formatPercent(card.milestone.progressPct)}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">{card.subtitle}</p>

                  <p className="money mt-3 text-xl font-extrabold text-slate-900">
                    {formatRupiah(card.milestone.targetAmount)}
                  </p>

                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${card.barClass}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                  <span className="text-[11px] text-slate-400">Estimasi Waktu: </span>
                  <strong className="font-semibold text-slate-800">
                    {formatMilestoneCountdownText(card.milestone)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive Parameter Control Panel */}
      <form
        onSubmit={(event) => void handleRunProjection(event)}
        className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">Parameter Simulasi Interaktif</h2>
            <p className="text-xs text-slate-500">
              Ubah nominal investasi atau asumsi SWR/Inflasi/Return untuk menguji berbagai skenario kebebasan finansial
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MoneyInput
            id="fire-input-essential"
            label="Pengeluaran Pokok / Bulan"
            value={essentialBasis}
            onChange={setEssentialBasis}
            helperText="Biaya hidup wajib bulanan"
            required
          />

          <MoneyInput
            id="fire-input-portfolio"
            label="Portofolio Investasi Saat Ini"
            value={currentPortfolio}
            onChange={setCurrentPortfolio}
            helperText="Total saldo akun bertipe Investasi"
          />

          <MoneyInput
            id="fire-input-contribution"
            label="Setoran Investasi Rutin / Bulan"
            value={monthlyContribution}
            onChange={setMonthlyContribution}
            helperText="Kontribusi investasi bulanan"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* SWR */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fire-input-swr" className="text-xs font-bold text-slate-700">
                Safe Withdrawal Rate — SWR (%)
              </label>
              <span className="money text-xs font-extrabold text-indigo-600">{swrRatePct || '0'}%</span>
            </div>
            <input
              id="fire-input-swr"
              type="text"
              inputMode="decimal"
              value={swrRatePct}
              onChange={(event) => setSwrRatePct(sanitizeMoneyInput(event.target.value))}
              className="money mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600"
            />
            <input
              type="range"
              min="2"
              max="8"
              step="0.25"
              value={Number(swrRatePct) || 4}
              onChange={(event) => setSwrRatePct(event.target.value)}
              className="mt-2 w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">Standar Trinity Study: 4.00% (25x pengeluaran tahunan)</p>
          </div>

          {/* Inflation */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fire-input-inflation" className="text-xs font-bold text-slate-700">
                Asumsi Inflasi Tahunan (%)
              </label>
              <span className="money text-xs font-extrabold text-rose-600">{inflationRatePct || '0'}%</span>
            </div>
            <input
              id="fire-input-inflation"
              type="text"
              inputMode="decimal"
              value={inflationRatePct}
              onChange={(event) => setInflationRatePct(sanitizeMoneyInput(event.target.value))}
              className="money mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600"
            />
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={Number(inflationRatePct) || 4.5}
              onChange={(event) => setInflationRatePct(event.target.value)}
              className="mt-2 w-full accent-rose-600"
            />
            <p className="text-[11px] text-slate-500">Rata-rata historis Indonesia: 4.00% – 5.00%</p>
          </div>

          {/* Expected Return */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="fire-input-return" className="text-xs font-bold text-slate-700">
                Ekspektasi Return Investasi (%)
              </label>
              <span className="money text-xs font-extrabold text-emerald-600">{expectedReturnRatePct || '0'}%</span>
            </div>
            <input
              id="fire-input-return"
              type="text"
              inputMode="decimal"
              value={expectedReturnRatePct}
              onChange={(event) => setExpectedReturnRatePct(sanitizeMoneyInput(event.target.value))}
              className="money mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600"
            />
            <input
              type="range"
              min="2"
              max="20"
              step="0.5"
              value={Number(expectedReturnRatePct) || 10}
              onChange={(event) => setExpectedReturnRatePct(event.target.value)}
              className="mt-2 w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-500">Portofolio moderat-agresif: 8.00% – 12.00%</p>
          </div>
        </div>

        {formError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
            {formError}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={updatePrefsMutation.isPending}
            onClick={() => void handleSaveAssumptionsToProfile()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{updatePrefsMutation.isPending ? 'Menyimpan...' : 'Simpan Asumsi ke Profil'}</span>
          </button>

          <button
            type="submit"
            disabled={fireSimMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-indigo-600 disabled:opacity-50"
          >
            <Calculator className="h-3.5 w-3.5" />
            <span>{fireSimMutation.isPending ? 'Menghitung...' : 'Hitung Proyeksi FIRE'}</span>
          </button>
        </div>
      </form>

      {/* Recharts Compound Growth AreaChart */}
      {projection && chartData.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Kurva Proyeksi Pertumbuhan Portofolio Riil (Daya Beli Saat Ini)
              </h2>
              <p className="text-xs text-slate-500">
                Perbandingan nilai portofolio majemuk (setelah inflasi) terhadap total modal pokok yang disetor
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600">
              <TrendingUp className="h-4 w-4" />
              <span>Bunga Majemuk Riil {formatPercent(projection.realReturnRatePct)}/thn</span>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 14, right: 20, left: 12, bottom: 5 }}>
                <defs>
                  <linearGradient id="firePortfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fireContributedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  tickFormatter={(val: number) => formatRupiah(String(Math.round(val)))}
                  width={115}
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
                {l5TargetNum > 0 && (
                  <ReferenceLine
                    y={l5TargetNum}
                    stroke="#4f46e5"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Target L5 (12x Pokok)',
                      position: 'insideTopLeft',
                      fill: '#4f46e5',
                      fontSize: 11,
                    }}
                  />
                )}
                {fireTargetNum > 0 && (
                  <ReferenceLine
                    y={fireTargetNum}
                    stroke="#059669"
                    strokeDasharray="6 4"
                    label={{
                      value: 'Angka FIRE (L6)',
                      position: 'insideTopRight',
                      fill: '#059669',
                      fontSize: 11,
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="TotalPortofolio"
                  name="Total Portofolio (Daya Beli Riil)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#firePortfolioGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="TotalModalDisetor"
                  name="Total Modal Pokok Disetor"
                  stroke="#64748b"
                  strokeWidth={2}
                  fill="url(#fireContributedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>
                Seluruh angka grafik menggunakan nilai uang riil hari ini setelah dikurangi efek inflasi tahunan.
              </span>
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <Award className="h-3.5 w-3.5 text-emerald-600" />
              <span>Level 7 (2x FIRE): {formatRupiah(projection.abundantNumber)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
