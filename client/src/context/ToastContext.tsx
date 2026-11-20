import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  undoTransactionId?: string;
}

export interface ShowToastOptions {
  variant?: ToastVariant;
  message: string;
  durationMs?: number;
}

export interface ShowUndoToastOptions {
  message: string;
  transactionId: string;
  durationMs?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ShowToastOptions) => void;
  showUndoToast: (options: ShowUndoToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [],
  );

  const showToast = useCallback(
    ({ variant = 'success', message, durationMs = 4500 }: ShowToastOptions) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: ToastItem = { id, variant, message, durationMs };
      setToasts((prev) => [...prev.slice(-4), item]);
      scheduleDismiss(id, durationMs);
    },
    [scheduleDismiss],
  );

  const showUndoToast = useCallback(
    ({ message, transactionId, durationMs = 7000 }: ShowUndoToastOptions) => {
      const id = `undo-${transactionId}-${Date.now()}`;
      const item: ToastItem = {
        id,
        variant: 'warning',
        message,
        durationMs,
        undoTransactionId: transactionId,
      };
      setToasts((prev) => [...prev.filter((t) => t.undoTransactionId !== transactionId).slice(-4), item]);
      scheduleDismiss(id, durationMs);
    },
    [scheduleDismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, showUndoToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast harus dipanggil di dalam ToastProvider.');
  }
  return context;
}
