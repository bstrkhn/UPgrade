import { AlertTriangle, CheckCircle2, RotateCcw, X, XCircle } from 'lucide-react';
import { extractApiErrorMessage } from '../../api/client';
import { useRestoreTransaction } from '../../api/hooks/useTransactions';
import { useToast, type ToastItem } from '../../context/ToastContext';

function UndoToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const { showToast } = useToast();
  const restoreMutation = useRestoreTransaction();

  const handleUndo = async () => {
    if (!item.undoTransactionId || restoreMutation.isPending) return;
    try {
      const result = await restoreMutation.mutateAsync(item.undoTransactionId);
      onDismiss(item.id);
      showToast({
        variant: 'success',
        message: result.message || 'Transaksi berhasil dipulihkan.',
      });
      for (const warning of result.meta?.warnings ?? []) {
        showToast({ variant: 'warning', message: warning, durationMs: 6000 });
      }
    } catch (error) {
      onDismiss(item.id);
      showToast({
        variant: 'error',
        message: extractApiErrorMessage(error, 'Gagal memulihkan transaksi.'),
      });
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900 text-white shadow-xl"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <RotateCcw className="h-4 w-4 shrink-0 text-amber-400" />
          <span>{item.message}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleUndo()}
            disabled={restoreMutation.isPending}
            className="rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
          >
            {restoreMutation.isPending ? 'Memulihkan...' : 'Urungkan'}
          </button>
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            aria-label="Tutup notifikasi"
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="h-1 w-full bg-slate-800">
        <div
          className="h-full origin-left bg-amber-400"
          style={{
            animationName: 'countdown',
            animationDuration: `${item.durationMs}ms`,
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
          }}
        />
      </div>
    </div>
  );
}

function StandardToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const styles =
    item.variant === 'success'
      ? {
          container: 'border-emerald-200 bg-emerald-50 text-emerald-950',
          icon: <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />,
        }
      : item.variant === 'warning'
        ? {
            container: 'border-amber-200 bg-amber-50 text-amber-950',
            icon: <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />,
          }
        : {
            container: 'border-rose-200 bg-rose-50 text-rose-950',
            icon: <XCircle className="h-5 w-5 shrink-0 text-rose-600" />,
          };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-toast-in pointer-events-auto flex items-start justify-between gap-3 rounded-xl border px-4 py-3 shadow-lg ${styles.container}`}
    >
      <div className="flex items-start gap-2.5 text-sm font-medium">
        {styles.icon}
        <span className="leading-snug">{item.message}</span>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        aria-label="Tutup notifikasi"
        className="rounded-lg p-1 text-current/60 transition hover:bg-black/5 hover:text-current"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-label="Notifikasi"
      className="pointer-events-none fixed right-4 bottom-20 z-50 flex w-full max-w-md flex-col gap-2.5 sm:bottom-6"
    >
      {toasts.map((item) =>
        item.undoTransactionId ? (
          <UndoToastCard key={item.id} item={item} onDismiss={dismissToast} />
        ) : (
          <StandardToastCard key={item.id} item={item} onDismiss={dismissToast} />
        ),
      )}
    </div>
  );
}
