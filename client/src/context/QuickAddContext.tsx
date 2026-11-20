import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { TransactionType } from '../api/types';

interface QuickAddContextValue {
  isOpen: boolean;
  initialTab: TransactionType;
  openQuickAdd: (tab?: TransactionType) => void;
  closeQuickAdd: () => void;
}

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

export function QuickAddProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialTab, setInitialTab] = useState<TransactionType>('EXPENSE');

  const openQuickAdd = useCallback((tab: TransactionType = 'EXPENSE') => {
    setInitialTab(tab);
    setIsOpen(true);
  }, []);

  const closeQuickAdd = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key !== 'N' && event.key !== 'n') return;
      if (isEditableElement(event.target) || isEditableElement(document.activeElement)) return;

      event.preventDefault();
      openQuickAdd('EXPENSE');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, openQuickAdd]);

  return (
    <QuickAddContext.Provider value={{ isOpen, initialTab, openQuickAdd, closeQuickAdd }}>
      {children}
    </QuickAddContext.Provider>
  );
}

export function useQuickAdd(): QuickAddContextValue {
  const context = useContext(QuickAddContext);
  if (!context) {
    throw new Error('useQuickAdd harus dipanggil di dalam QuickAddProvider.');
  }
  return context;
}
