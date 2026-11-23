import { AlertTriangle, CheckSquare, ListChecks, Lock, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HealthStatus, MilestoneMission } from '../../api/types';

const STORAGE_KEY_PREFIX = 'upgrade_completed_missions_v1';

interface LevelMissionsCardProps {
  userId: string;
  currentLevel: number;
  healthStatus: HealthStatus;
  missions: MilestoneMission[];
}

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}_${userId}`;
}

function readLocalCompletedIds(userId: string): Record<string, boolean> {
  if (!userId) return {};
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
}

export function LevelMissionsCard({ userId, currentLevel, healthStatus, missions }: LevelMissionsCardProps) {
  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>(() => readLocalCompletedIds(userId));

  // Re-sync local checklist state whenever the authenticated userId changes
  useEffect(() => {
    setLocalChecked(readLocalCompletedIds(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    try {
      window.localStorage.setItem(getStorageKey(userId), JSON.stringify(localChecked));
    } catch {
      // Ignore storage quota issues gracefully
    }
  }, [userId, localChecked]);

  const toggleMission = (missionId: string, serverCompleted: boolean) => {
    // Recovery mission cannot be manually checked off — it completes automatically when Emergency Fund is refilled.
    if (serverCompleted || missionId === 'RECOVERY_REFILL_EMERGENCY_FUND') return;
    setLocalChecked((prev) => ({
      ...prev,
      [missionId]: !prev[missionId],
    }));
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Misi Prioritas Level {currentLevel}</h3>
            <p className="text-xs text-slate-500">
              Checklist aksi nyata untuk menuntaskan tahap ini dan naik ke level berikutnya
            </p>
          </div>
        </div>
        {healthStatus === 'RECOVERY_MODE' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Fokus Pemulihan
          </span>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {missions.map((mission) => {
          const isRecoveryMission = mission.id === 'RECOVERY_REFILL_EMERGENCY_FUND';
          const isDone = mission.completed || (!isRecoveryMission && Boolean(localChecked[mission.id]));

          return (
            <li
              key={mission.id}
              onClick={() => toggleMission(mission.id, mission.completed)}
              className={`flex items-start justify-between gap-3 rounded-xl border p-3.5 transition ${
                isRecoveryMission
                  ? 'cursor-default border-amber-300 bg-amber-50/80'
                  : isDone
                    ? 'cursor-pointer border-emerald-200 bg-emerald-50/40'
                    : 'cursor-pointer border-slate-200 bg-slate-50/50 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  disabled={isRecoveryMission || mission.completed}
                  aria-label={`Tandai misi ${mission.title}`}
                  className={`mt-0.5 shrink-0 ${
                    isDone ? 'text-emerald-600' : isRecoveryMission ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {isRecoveryMission ? (
                    <Lock className="h-4 w-4" />
                  ) : isDone ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold ${
                        isDone ? 'text-slate-500 line-through' : 'text-slate-900'
                      }`}
                    >
                      {mission.title}
                    </span>
                    {isRecoveryMission ? (
                      <span className="rounded-full bg-amber-200/90 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                        Misi Pemulihan Utama • Otomatis selesai saat Dana Darurat terisi kembali
                      </span>
                    ) : mission.priority === 'HIGH' ? (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                        Prioritas Tinggi
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{mission.description}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
