import { AlertTriangle, Award, CheckCircle2, Circle, ShieldCheck, TrendingUp } from 'lucide-react';
import type { EmergencyFundBadge, MilestoneAnalytics } from '../../api/types';
import { LEVEL_TITLES_ID } from '../../utils/constants';
import { clampPercentBarWidth, formatPercent, formatRupiah } from '../../utils/currency';

interface MilestoneCardProps {
  milestone: MilestoneAnalytics;
  dataSourceBadge: EmergencyFundBadge;
}

const ALL_LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;

export function MilestoneCard({ milestone, dataSourceBadge }: MilestoneCardProps) {
  const isRecovery = milestone.healthStatus === 'RECOVERY_MODE';
  const targetNextLevel = isRecovery ? milestone.highestLevel : Math.min(7, milestone.currentLevel + 1);
  const targetLevelInfo = LEVEL_TITLES_ID[targetNextLevel] ?? LEVEL_TITLES_ID[7]!;

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white shadow-2xs ${
        isRecovery ? 'border-amber-300' : 'border-slate-200'
      }`}
    >
      {/* Amber Recovery Mode Banner */}
      {isRecovery && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              Mode Pemulihan Aktif — Rekor tertinggi Anda tetap <strong>Level {milestone.highestLevel}</strong>. Fokus
              pada misi <strong>&ldquo;Isi Ulang Dana Darurat&rdquo;</strong> untuk memulihkan level Anda.
            </span>
          </div>
          <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-950">
            Rekor Aman: L{milestone.highestLevel}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl font-extrabold shadow-xs ${
                isRecovery ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-white'
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wider uppercase opacity-80">Level</span>
              <span className="text-xl leading-none">{milestone.currentLevel}</span>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold tracking-wide text-indigo-600 uppercase">
                  Roadmap Kebebasan Finansial • Level {milestone.currentLevel} / 7
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                  {dataSourceBadge}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-extrabold text-slate-900">{milestone.title}</h2>
              <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-slate-600">{milestone.tagline}</p>
            </div>
          </div>

          {/* 7-Level Visual Ladder */}
          <div className="flex flex-col items-start gap-1.5 lg:items-end">
            <div className="flex items-center gap-1.5">
              {ALL_LEVELS.map((lvl) => {
                const isCurrent = lvl === milestone.currentLevel;
                const isPassed = lvl < milestone.currentLevel;
                const isPeakRecord = isRecovery && lvl <= milestone.highestLevel && lvl > milestone.currentLevel;
                const lvlTitle = LEVEL_TITLES_ID[lvl]?.title ?? `Level ${lvl}`;

                return (
                  <div
                    key={lvl}
                    title={`Level ${lvl}: ${lvlTitle}`}
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold transition ${
                      isCurrent
                        ? isRecovery
                          ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-200'
                          : 'bg-indigo-600 text-white ring-2 ring-indigo-200'
                        : isPassed
                          ? 'bg-emerald-600 text-white'
                          : isPeakRecord
                            ? 'border border-amber-400 bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    L{lvl}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500">
              Target Angka FIRE:{' '}
              <strong className="money font-bold text-slate-800">{formatRupiah(milestone.fireNumber)}</strong>
            </p>
          </div>
        </div>

        {/* Next Level Requirements Checklist */}
        {milestone.nextLevelRequirements.length > 0 && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
                {isRecovery ? (
                  <>
                    <Award className="h-3.5 w-3.5 text-amber-600" />
                    <span>
                      Syarat Pulih ke Level {targetNextLevel} ({targetLevelInfo.title})
                    </span>
                  </>
                ) : milestone.currentLevel === 7 ? (
                  <>
                    <Award className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Status Puncak Level 7: {targetLevelInfo.title}</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
                    <span>
                      Syarat Naik ke Level {targetNextLevel} ({targetLevelInfo.title})
                    </span>
                  </>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {milestone.nextLevelRequirements.map((req) => {
                const barWidth = clampPercentBarWidth(req.progressPct);
                return (
                  <div
                    key={req.code}
                    className={`rounded-xl border p-3 ${
                      req.isMet ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {req.isMet ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span className="text-xs font-semibold text-slate-800">{req.label}</span>
                      </div>
                      <span
                        className={`money shrink-0 text-[11px] font-bold ${
                          req.isMet ? 'text-emerald-700' : 'text-slate-600'
                        }`}
                      >
                        {formatPercent(req.progressPct)}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Saat ini: <strong className="money text-slate-800">{req.currentDisplay}</strong>
                      </span>
                      <span>
                        Target: <strong className="money text-slate-800">{req.targetDisplay}</strong>
                      </span>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
                      <div
                        className={`h-full rounded-full transition-all ${
                          req.isMet ? 'bg-emerald-500' : isRecovery ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
