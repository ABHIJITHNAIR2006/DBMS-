import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { dbEngine } from './engine';
import { DatabaseState, DerivedStockInfo, SqlLogEntry } from './types';
import { getSqlLogs, subscribeSqlLogs, clearSqlLogs } from './sqlLog';
import confetti from 'canvas-confetti';

interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface StockChangeNotification {
  itemName: string;
  oldStock: number;
  newStock: number;
}

interface DBContextType {
  state: DatabaseState;
  derivedStock: DerivedStockInfo[];
  sqlLogs: readonly SqlLogEntry[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  fireConfetti: () => void;
  lastStockChange: StockChangeNotification | null;
  resetDemoData: () => void;
  clearLogs: () => void;
}

const DBContext = createContext<DBContextType | null>(null);

export const DBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DatabaseState>(() => dbEngine.getState());
  const [sqlLogs, setSqlLogs] = useState<readonly SqlLogEntry[]>(() => getSqlLogs());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [lastStockChange, setLastStockChange] = useState<StockChangeNotification | null>(null);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('claystock_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('claystock_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Subscribe to DB state mutations
  useEffect(() => {
    const unsubscribeDB = dbEngine.subscribe(newState => {
      setState(newState);
    });

    const unsubscribeLogs = subscribeSqlLogs((newLogs: readonly SqlLogEntry[]) => {
      setSqlLogs(newLogs);
    });

    return () => {
      unsubscribeDB();
      unsubscribeLogs();
    };
  }, []);

  const derivedStock = useMemo(() => {
    return dbEngine.getAllDerivedStock();
  }, [state]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    const dur = toast.duration ?? (toast.action ? 6000 : 4000);
    setTimeout(() => {
      dismissToast(id);
    }, dur);
  }, [dismissToast]);

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 45,
      spread: 60,
      origin: { y: 0.8 },
      colors: ['#7C83FF', '#5ED6B0', '#FFA987', '#FFD36B', '#FF8FB1']
    });
  }, []);

  const resetDemoData = useCallback(() => {
    dbEngine.resetToDefault();
    showToast({
      title: 'Demo Data Reset',
      description: 'All 10 relational tables restored to initial 3NF dataset.',
      type: 'info'
    });
  }, [showToast]);

  const clearLogs = useCallback(() => {
    clearSqlLogs();
    showToast({
      title: 'SQL Log Cleared',
      description: 'Session SQL history has been purged.',
      type: 'info'
    });
  }, [showToast]);

  return (
    <DBContext.Provider
      value={{
        state,
        derivedStock,
        sqlLogs,
        theme,
        toggleTheme,
        toasts,
        showToast,
        dismissToast,
        fireConfetti,
        lastStockChange,
        resetDemoData,
        clearLogs
      }}
    >
      {children}
    </DBContext.Provider>
  );
};

export function useDB() {
  const context = useContext(DBContext);
  if (!context) {
    throw new Error('useDB must be used within a DBProvider');
  }
  return context;
}
