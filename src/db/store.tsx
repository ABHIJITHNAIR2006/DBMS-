import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { sqlClient } from './client';
import { IntrospectResult } from './worker/types';
import { DerivedStockInfo, SqlLogEntry, AppUser, Role, Permission, DatabaseState } from './types';
import { dbEngine } from './engine';
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

export interface DemoAccount {
  userId: string;
  username: string;
  name: string;
  role: string;
  dept: string;
  designation: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { userId: 'U01', username: 'suresh.pawar', name: 'Mr. Suresh Pawar', role: 'ADMIN', dept: 'D01', designation: 'Administrative Officer' },
  { userId: 'U02', username: 'amit.jadhav', name: 'Mr. Amit Jadhav', role: 'STORE_KEEPER', dept: 'D11', designation: 'Store Keeper' },
  { userId: 'U03', username: 'sunita.kulkarni', name: 'Dr. Sunita Kulkarni', role: 'DEPT_HEAD', dept: 'D02', designation: 'HOD Computer Engg' },
  { userId: 'U04', username: 'vivek.patil', name: 'Dr. Vivek Patil', role: 'DEPT_HEAD', dept: 'D03', designation: 'HOD IT' },
  { userId: 'U05', username: 'dattatray.kale', name: 'Mr. Dattatray Kale', role: 'ACCOUNTANT', dept: 'D08', designation: 'Accountant' },
  { userId: 'U06', username: 'shweta.mahajan', name: 'Mrs. Shweta Mahajan', role: 'AUDITOR', dept: 'D08', designation: 'Auditor' }
];

async function loadStateFromSql(): Promise<{ state: DatabaseState; derivedStock: DerivedStockInfo[] }> {
  try {
    const [itemsRes, pincodeRes, supRes, contRes, deptRes, batchRes, consRes, durRes, suppRes, issRes, viewStockRes] = await Promise.all([
      sqlClient.exec(`SELECT ItemID, ItemName, Category, UnitPrice FROM ITEM;`, [], false),
      sqlClient.exec(`SELECT Pincode, City FROM PINCODE_CITY;`, [], false),
      sqlClient.exec(`SELECT SupplierID, SupplierName, Street, Pincode FROM SUPPLIER;`, [], false),
      sqlClient.exec(`SELECT SupplierID, ContactNo FROM SUPPLIER_CONTACT;`, [], false),
      sqlClient.exec(`SELECT DeptID, DeptName FROM DEPARTMENT;`, [], false),
      sqlClient.exec(`SELECT ItemID, BatchNo, ExpiryDate FROM STOCK_BATCH;`, [], false),
      sqlClient.exec(`SELECT ItemID, ReorderLevel FROM CONSUMABLE_ITEM;`, [], false),
      sqlClient.exec(`SELECT ItemID, WarrantyPeriod FROM DURABLE_ITEM;`, [], false),
      sqlClient.exec(`SELECT PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost FROM SUPPLIES ORDER BY PurchaseDate DESC;`, [], false),
      sqlClient.exec(`SELECT IssueID, ItemID, DeptID, IssueDate, Quantity FROM ISSUED_TO ORDER BY IssueDate DESC;`, [], false),
      sqlClient.exec(`SELECT ItemID, ItemName, Category, UnitPrice, TotalPurchased, TotalIssued, StockQty, ReorderLevel, WarrantyPeriod, ItemType, Status FROM V_CURRENT_STOCK ORDER BY ItemName ASC;`, [], false)
    ]);

    const s: DatabaseState = {
      ITEM: itemsRes.rows.map(r => ({ ItemID: String(r[0]), ItemName: String(r[1]), Category: String(r[2]), UnitPrice: Number(r[3]) })),
      PINCODE_CITY: pincodeRes.rows.map(r => ({ Pincode: String(r[0]), City: String(r[1]) })),
      SUPPLIER: supRes.rows.map(r => ({ SupplierID: String(r[0]), SupplierName: String(r[1]), Street: String(r[2]), Pincode: String(r[3]) })),
      SUPPLIER_CONTACT: contRes.rows.map(r => ({ SupplierID: String(r[0]), ContactNo: String(r[1]) })),
      DEPARTMENT: deptRes.rows.map(r => ({ DeptID: String(r[0]), DeptName: String(r[1]) })),
      STOCK_BATCH: batchRes.rows.map(r => ({ ItemID: String(r[0]), BatchNo: String(r[1]), ExpiryDate: String(r[2]) })),
      CONSUMABLE_ITEM: consRes.rows.map(r => ({ ItemID: String(r[0]), ReorderLevel: Number(r[1]) })),
      DURABLE_ITEM: durRes.rows.map(r => ({ ItemID: String(r[0]), WarrantyPeriod: Number(r[1]) })),
      SUPPLIES: suppRes.rows.map(r => ({ PurchaseID: String(r[0]), ItemID: String(r[1]), SupplierID: String(r[2]), PurchaseDate: String(r[3]), Quantity: Number(r[4]), Cost: Number(r[5]) })),
      ISSUED_TO: issRes.rows.map(r => ({ IssueID: String(r[0]), ItemID: String(r[1]), DeptID: String(r[2]), IssueDate: String(r[3]), Quantity: Number(r[4]) }))
    };

    const ds: DerivedStockInfo[] = viewStockRes.rows.map(r => ({
      item: {
        ItemID: String(r[0]),
        ItemName: String(r[1]),
        Category: String(r[2]),
        UnitPrice: Number(r[3])
      },
      totalPurchased: Number(r[4] || 0),
      totalIssued: Number(r[5] || 0),
      currentStock: Number(r[6] || 0),
      reorderLevel: r[7] != null ? Number(r[7]) : undefined,
      warrantyPeriod: r[8] != null ? Number(r[8]) : undefined,
      itemType: r[9] as 'Consumable' | 'Durable',
      status: r[10] as 'In Stock' | 'Low Stock' | 'Out of Stock',
      batches: s.STOCK_BATCH.filter(b => b.ItemID === String(r[0]))
    }));

    return { state: s, derivedStock: ds };
  } catch (err) {
    console.warn('loadStateFromSql fallback to dbEngine', err);
    return { state: dbEngine.getState(), derivedStock: dbEngine.getAllDerivedStock() };
  }
}

interface DBContextType {
  // Engine State
  isInitialized: boolean;
  initError: string | null;
  retryInit: () => void;
  introspectData: IntrospectResult | null;
  dbVersion: number;
  state: DatabaseState;
  derivedStock: DerivedStockInfo[];
  
  // Auth & Roles
  currentUser: DemoAccount;
  switchUser: (account: DemoAccount) => void;
  can: (resource: string, action: string) => boolean;
  permissions: { resource: string; action: string }[];

  // Live Metrics
  openAlertsCount: number;
  refreshMetrics: () => void;

  // Logging & UI
  sqlLogs: readonly SqlLogEntry[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
  fireConfetti: () => void;
  resetDemoData: () => Promise<void>;
  clearLogs: () => void;

  // Migration Dialog
  showMigrationDialog: boolean;
  resolveMigration: (importOld: boolean) => Promise<void>;
}

const DBContext = createContext<DBContextType | null>(null);

export const DBProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [introspectData, setIntrospectData] = useState<IntrospectResult | null>(null);
  const [dbVersion, setDbVersion] = useState(1);
  const [sqlLogs, setSqlLogs] = useState<readonly SqlLogEntry[]>(() => getSqlLogs());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [openAlertsCount, setOpenAlertsCount] = useState(0);
  const [permissions, setPermissions] = useState<{ resource: string; action: string }[]>([]);
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [state, setState] = useState<DatabaseState>(() => dbEngine.getState());
  const [derivedStock, setDerivedStock] = useState<DerivedStockInfo[]>(() => dbEngine.getAllDerivedStock());

  // Active session
  const [currentUser, setCurrentUser] = useState<DemoAccount>(DEMO_ACCOUNTS[0]);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('claystock_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('claystock_theme', theme);
    } catch {
      // storage blocked
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const refreshPermissionsAndAlerts = useCallback(async (role: string) => {
    try {
      // Fetch permissions for current role
      const permRes = await sqlClient.exec(
        `SELECT Resource, Action FROM PERMISSION WHERE RoleName = ?;`,
        [role],
        false
      );
      const perms = permRes.rows.map(r => ({ resource: r[0] as string, action: r[1] as string }));
      setPermissions(perms);

      // Fetch open alerts count
      const alertRes = await sqlClient.exec(
        `SELECT COUNT(*) FROM ALERT WHERE ResolvedAt IS NULL;`,
        [],
        false
      );
      if (alertRes.rows.length > 0 && alertRes.rows[0].length > 0) {
        setOpenAlertsCount(Number(alertRes.rows[0][0]));
      }
    } catch (err) {
      console.warn('Could not refresh permissions/alerts', err);
    }
  }, []);

  const initEngine = useCallback(async (resetStorage = false) => {
    setInitError(null);
    try {
      // Check for legacy localStorage data
      const legacyStorage = typeof localStorage !== 'undefined' ? localStorage.getItem('claystock_relational_db_v1') : null;
      const intro = await sqlClient.retryInit({ resetStorage });
      setIntrospectData(intro);
      setIsInitialized(true);
      await refreshPermissionsAndAlerts(currentUser.role);

      const { state: s, derivedStock: ds } = await loadStateFromSql();
      setState(s);
      setDerivedStock(ds);
      dbEngine.syncFromSql(s, ds);

      if (legacyStorage && !localStorage.getItem('claystock_migration_handled')) {
        setShowMigrationDialog(true);
      }
    } catch (err: any) {
      console.error('Failed to initialize SQLite Worker engine:', err);
      setInitError(err?.message || 'Failed to initialize SQLite WebAssembly engine.');
    }
  }, [currentUser.role, refreshPermissionsAndAlerts]);

  useEffect(() => {
    initEngine(false);
  }, [initEngine]);

  // Subscribe to DB Version updates from worker client
  useEffect(() => {
    const unsubVersion = sqlClient.subscribeVersion(async newVer => {
      setDbVersion(newVer);
      const intro = await sqlClient.introspect();
      setIntrospectData(intro);
      refreshPermissionsAndAlerts(currentUser.role);

      const { state: s, derivedStock: ds } = await loadStateFromSql();
      setState(s);
      setDerivedStock(ds);
      dbEngine.syncFromSql(s, ds);
    });

    const unsubLogs = subscribeSqlLogs(newLogs => {
      setSqlLogs(newLogs);
    });

    return () => {
      unsubVersion();
      unsubLogs();
    };
  }, [currentUser.role, refreshPermissionsAndAlerts]);

  const switchUser = useCallback((account: DemoAccount) => {
    setCurrentUser(account);
    sqlClient.setSessionUser(account.username, account.role, account.dept);
    refreshPermissionsAndAlerts(account.role);
    showToast({
      title: `Switched Role: ${account.role}`,
      description: `Logged in as ${account.name} (${account.designation}, Dept: ${account.dept})`,
      type: 'info'
    });
  }, [refreshPermissionsAndAlerts]);

  const can = useCallback((resource: string, action: string): boolean => {
    if (currentUser.role === 'ADMIN') return true;
    return permissions.some(p => p.resource === resource && p.action === action);
  }, [currentUser.role, permissions]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { ...toast, id };
    setToasts(prev => [...prev, newToast]);

    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 4500);

    return () => clearTimeout(timer);
  }, []);

  const fireConfetti = useCallback(() => {
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#10b981']
      });
    } catch {
      // Confetti blocked
    }
  }, []);

  useEffect(() => {
    const handleToastEvent = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom?.detail) {
        showToast(custom.detail);
      }
    };
    window.addEventListener('claystock-toast', handleToastEvent);
    return () => window.removeEventListener('claystock-toast', handleToastEvent);
  }, [showToast]);

  const resetDemoData = useCallback(async () => {
    try {
      const intro = await sqlClient.resetToSeed();
      setIntrospectData(intro);
      const { state: s, derivedStock: ds } = await loadStateFromSql();
      setState(s);
      setDerivedStock(ds);
      dbEngine.syncFromSql(s, ds);
      await refreshPermissionsAndAlerts(currentUser.role);
      showToast({
        title: 'Database Reset to Deterministic Seed',
        description: 'All 21 tables restored to pristine demonstration dataset (K.K. Wagh Institute).',
        type: 'success'
      });
      fireConfetti();
    } catch (err: any) {
      showToast({
        title: 'Reset Failed',
        description: err?.message || 'Error executing database seed reset',
        type: 'error'
      });
    }
  }, [showToast, fireConfetti, currentUser.role, refreshPermissionsAndAlerts]);

  const resolveMigration = useCallback(async (importOld: boolean) => {
    setShowMigrationDialog(false);
    localStorage.setItem('claystock_migration_handled', 'true');

    if (importOld) {
      try {
        const raw = localStorage.getItem('claystock_relational_db_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          // Insert items
          if (Array.isArray(parsed.ITEM)) {
            for (const item of parsed.ITEM) {
              await sqlClient.exec(
                `INSERT OR REPLACE INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES (?, ?, ?, ?);`,
                [item.ItemID, item.ItemName, item.Category, item.UnitPrice],
                false
              );
            }
          }
          showToast({
            title: 'Legacy Data Imported',
            description: 'Core tables migrated from previous session into SQLite engine.',
            type: 'success'
          });
        }
      } catch (err) {
        showToast({
          title: 'Migration Error',
          description: 'Could not parse previous data; using standard demo dataset.',
          type: 'warning'
        });
      }
    } else {
      showToast({
        title: 'Fresh Demo Dataset Active',
        description: 'Using realistic 21-table normalized dataset.',
        type: 'info'
      });
    }
  }, [showToast]);

  const contextValue = useMemo<DBContextType>(() => ({
    isInitialized,
    initError,
    retryInit: initEngine,
    introspectData,
    dbVersion,
    state,
    derivedStock,
    currentUser,
    switchUser,
    can,
    permissions,
    openAlertsCount,
    refreshMetrics: () => refreshPermissionsAndAlerts(currentUser.role),
    sqlLogs,
    theme,
    toggleTheme,
    toasts,
    showToast,
    dismissToast,
    fireConfetti,
    resetDemoData,
    clearLogs: clearSqlLogs,
    showMigrationDialog,
    resolveMigration
  }), [
    isInitialized,
    initError,
    initEngine,
    introspectData,
    dbVersion,
    state,
    derivedStock,
    currentUser,
    switchUser,
    can,
    permissions,
    openAlertsCount,
    refreshPermissionsAndAlerts,
    sqlLogs,
    theme,
    toggleTheme,
    toasts,
    showToast,
    dismissToast,
    fireConfetti,
    resetDemoData,
    showMigrationDialog,
    resolveMigration
  ]);

  if (initError) {
    return (
      <div className="min-h-screen bg-clay-bg flex items-center justify-center p-6">
        <div className="clay-card p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400 text-3xl font-bold">
            !
          </div>
          <h2 className="text-xl font-display font-bold text-clay-text">
            SQLite Engine Failed to Load
          </h2>
          <p className="text-xs text-clay-text-muted leading-relaxed">
            The Web Worker was unable to initialize the SQLite WebAssembly database.
          </p>
          <div className="p-3 clay-inset text-[11px] font-mono text-rose-600 dark:text-rose-400 break-all text-left max-h-36 overflow-y-auto">
            {initError}
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(initError).catch(() => {});
                  }
                }}
                className="py-2.5 px-3 rounded-2xl clay-card text-clay-text font-medium text-xs hover:bg-clay-surface-hover transition-colors"
              >
                Copy Error
              </button>
              <button
                onClick={() => initEngine(false)}
                className="flex-1 py-2.5 px-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-md hover:bg-indigo-700 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={() => initEngine(true)}
                className="py-2.5 px-3 rounded-2xl bg-rose-600 text-white font-bold text-xs shadow-md hover:bg-rose-700 transition-colors"
                title="Deletes stored IndexedDB bytes and reinitializes from clean seed"
              >
                Reset to seed
              </button>
            </div>
            <button
              onClick={async () => {
                try {
                  const { loadDatabaseBytes } = await import('./persistence');
                  const bytes = await loadDatabaseBytes();
                  if (!bytes || bytes.byteLength === 0) {
                    alert('No saved database bytes found in browser storage.');
                    return;
                  }
                  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/x-sqlite3' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `claystock-broken-db-${Date.now()}.sqlite`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                } catch (e) {
                  console.error('Failed to export broken database', e);
                }
              }}
              className="w-full py-2 px-3 rounded-2xl clay-card text-clay-text-muted hover:text-clay-text font-medium text-xs hover:bg-clay-surface-hover transition-colors flex items-center justify-center gap-1.5"
            >
              Download broken DB for inspection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DBContext.Provider value={contextValue}>
      {children}
      {/* Migration Modal */}
      {showMigrationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="clay-card p-6 max-w-lg w-full space-y-4">
            <h3 className="text-lg font-display font-bold text-clay-text">
              Import Previous Session Data?
            </h3>
            <p className="text-xs text-clay-text-muted leading-relaxed">
              We detected previous data in your browser storage. Would you like to import your previous records into the new SQLite relational engine, or start fresh with the realistic 21-table competition dataset?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => resolveMigration(false)}
                className="px-4 py-2 text-xs font-bold rounded-2xl clay-card text-clay-text hover:bg-clay-surface-hover"
              >
                Use New Demo Dataset (Recommended)
              </button>
              <button
                onClick={() => resolveMigration(true)}
                className="px-4 py-2 text-xs font-bold rounded-2xl bg-indigo-600 text-white shadow-md hover:bg-indigo-700"
              >
                Import Previous Data
              </button>
            </div>
          </div>
        </div>
      )}
    </DBContext.Provider>
  );
};

export const useDB = (): DBContextType => {
  const ctx = useContext(DBContext);
  if (!ctx) throw new Error('useDB must be used within DBProvider');
  return ctx;
};
