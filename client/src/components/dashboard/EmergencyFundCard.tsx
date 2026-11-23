import { ArrowLeftRight, CheckCircle2, Shield, ShieldCheck } from 'lucide-react';
import type { EmergencyFundAnalytics } from '../../api/types';
import { useQuickAdd } from '../../context/QuickAddContext';
import { clampPercentBarWidth, compareMoney, formatPercent, formatRupiah } from '../../utils/currency';

interface EmergencyFundCardProps {
  emergencyFund: EmergencyFundAnalytics;
}

export function EmergencyFundCard({ emergencyFund }: EmergencyFundCardProps) {
  const { openQuickAdd } = useQuickAdd();

  const barWidth = clampPercentBarWidth(emergencyFund.progressPct);
  const isTargetMet = compareMoney(emergencyFund.shortfallToActiveTarget, '0') === 0;
  const isBaseline = emergencyFund.dataSource === 'ONBOARDING_BASELINE';

  const badgeLabel = isBaseline
    ? `Estimasi Awal (${emergencyFund.historyMonthsCount}/3 bln data)`
    : `Data Aktual (rata-rata ${emergencyFund.historyMonthsCount} bln)`;

  const tiers = [
    {
      months: 1,
      label: '1 Bulan (Ruang Bernapas)',
      target: emergencyFund.target1Month,
      isReached:
        compareMoney(emergencyFund.target1Month, '0') > 0 &&
        compareMoney(emergencyFund.currentBalance, emergencyFund.target1Month) >= 0,
    },
    {
      months: 3,
      label: '3 Bulan (Stabilitas L4)',
      target: emergencyFund.target3Months,
      isReached:
        compareMoney(emergencyFund.target3Months, '0') > 0 &&
        compareMoney(emergencyFund.currentBalance, emergencyFund.target3Months) >= 0,
    },
    {
      months: 6,
      label: '6 Bulan (Bantalan Ideal)',
      target: emergencyFund.target6Months,
      isReached:
        compareMoney(emergencyFund.target6Months, '0') > 0 &&
        compareMoney(emergencyFund.currentBalance, emergencyFund.target6Months) >= 0,
    },
  ];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Tracker Dana Darurat Dinamis</h3>
              <p className="text-xs text-slate-500">
                Basis pengeluaran pokok:{' '}
                <strong className="money font-semibold text-slate-700">
                  {formatRupiah(emergencyFund.monthlyBasis)}/bln
                </strong>
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              isBaseline
                ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>{badgeLabel}</span>
          </span>
        </div>

        {/* Balance vs Active Target */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">Saldo Akun Dana Darurat</p>
            <p className="money mt-0.5 text-2xl font-extrabold text-slate-900">
              {formatRupiah(emergencyFund.currentBalance)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">
              Target Tahap Ini ({emergencyFund.activeTargetMonths}x Pokok)
            </p>
            <p className="money mt-0.5 text-sm font-bold text-slate-800">
              {formatRupiah(emergencyFund.activeTargetAmount)}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">
              Tercover <strong className="money text-slate-900">{emergencyFund.monthsCovered.replace('.', ',')}</strong>{' '}
              bulan biaya hidup pokok
            </span>
            <span className="money font-bold text-emerald-600">{formatPercent(emergencyFund.progressPct)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {isTargetMet ? (
              <span className="font-semibold text-emerald-700">
                Target {emergencyFund.activeTargetMonths} bulan Dana Darurat tahap ini telah terpenuhi!
              </span>
            ) : (
              <span>
                Kurang{' '}
                <strong className="money font-semibold text-slate-800">
                  {formatRupiah(emergencyFund.shortfallToActiveTarget)}
                </strong>{' '}
                lagi untuk mencapai target {emergencyFund.activeTargetMonths} bulan.
              </span>
            )}
          </p>
        </div>

        {/* 1M / 3M / 6M Milestone Tiers */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {tiers.map((tier) => (
            <div
              key={tier.months}
              className={`rounded-xl border p-2.5 ${
                tier.isReached
                  ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                  : 'border-slate-200 bg-slate-50/70 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold">{tier.months} Bulan</span>
                {tier.isReached && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              </div>
              <p className="money mt-1 truncate text-xs font-extrabold">{formatRupiah(tier.target)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5">
        <span className="text-[11px] text-slate-400">
          {isBaseline
            ? 'Otomatis beralih ke Data Aktual setelah 3 bulan histori.'
            : 'Dihitung otomatis dari rata-rata pengeluaran pokok aktual.'}
        </span>
        <button
          type="button"
          onClick={() => openQuickAdd('TRANSFER')}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-emerald-700"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>+ Isi Dana Darurat</span>
        </button>
      </div>
    </div>
  );
}
