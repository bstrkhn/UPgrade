import { AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import type { HealthStatus } from '../../api/types';
import { LEVEL_TITLES_ID } from '../../utils/constants';

export { LEVEL_TITLES_ID };

interface LevelBadgeProps {
  level: number;
  highestLevel?: number;
  healthStatus?: HealthStatus;
  dataSourceBadge?: 'Estimasi Awal' | 'Data Aktual';
  compact?: boolean;
}

export function LevelBadge({
  level,
  highestLevel,
  healthStatus = 'NORMAL',
  dataSourceBadge = 'Estimasi Awal',
  compact = false,
}: LevelBadgeProps) {
  const info = LEVEL_TITLES_ID[level] ?? LEVEL_TITLES_ID[1]!;
  const isRecovery = healthStatus === 'RECOVERY_MODE';

  if (compact) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800">
        <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
        <span>
          Level {level}: {info.title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center ${
        isRecovery
          ? 'border-amber-300 bg-amber-50/90 text-amber-950'
          : 'border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-slate-50 text-slate-900'
      }`}
    >
      <div className="flex items-start gap-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs ${
            isRecovery ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white'
          }`}
        >
          L{level}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold tracking-wide text-indigo-600 uppercase">
              Level UPgrade {level} dari 7
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              <ShieldCheck className="h-3 w-3 text-indigo-600" />
              {dataSourceBadge}
            </span>
            {isRecovery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950">
                <AlertTriangle className="h-3 w-3" />
                Mode Pemulihan (Rekor L{highestLevel ?? level})
              </span>
            )}
          </div>
          <h2 className="mt-1 text-base font-bold text-slate-900">{info.title}</h2>
          <p className="mt-0.5 text-xs text-slate-600">
            {isRecovery ? 'Misi Prioritas: Isi Ulang Dana Darurat agar kembali ke level tertinggi Anda.' : info.tagline}
          </p>
        </div>
      </div>
    </div>
  );
}
