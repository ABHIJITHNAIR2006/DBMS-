import { SqlLogEntry } from './types';

const SQL_LOG_STORAGE_KEY = 'claystock_sql_logs_v1';
const MAX_LOGS = 150;

type LogListener = (logs: readonly SqlLogEntry[]) => void;
const listeners: Set<LogListener> = new Set();
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function getInitialLogs(): SqlLogEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SQL_LOG_STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error reading SQL logs from localStorage', e);
  }
  return [
    {
      id: 'log-init-0',
      timestamp: new Date().toLocaleTimeString(),
      query: `-- System Boot: Relational Schema Loaded (10 Tables in 3NF)
SELECT table_name, table_schema 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;`,
      type: 'SELECT',
      status: 'SUCCESS',
      executionTimeMs: 1.2,
      rowsAffected: 10
    }
  ];
}

let logsCache: SqlLogEntry[] = getInitialLogs();

// Flush to localStorage immediately
export function flushSqlLogsNow() {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SQL_LOG_STORAGE_KEY, JSON.stringify(logsCache.slice(0, MAX_LOGS)));
    }
  } catch (e) {
    console.error('Failed saving SQL logs', e);
  }
}

// 2b: Debounced persistence (400ms)
function scheduleSaveLogs() {
  if (saveTimeout !== null) {
    clearTimeout(saveTimeout);
  }
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    flushSqlLogsNow();
  }, 400);
}

// Attach pagehide and visibilitychange handlers to guarantee no data loss on close
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushSqlLogsNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushSqlLogsNow();
    }
  });
}

// 2c: Stop notifying with array copies, pass the immutable logsCache reference
function notify() {
  listeners.forEach(fn => fn(logsCache));
}

export function appendSqlLog(entry: Omit<SqlLogEntry, 'id' | 'timestamp'>): SqlLogEntry {
  const newEntry: SqlLogEntry = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  };

  // Create new array reference only on change
  logsCache = [newEntry, ...logsCache].slice(0, MAX_LOGS);
  scheduleSaveLogs();
  notify();
  return newEntry;
}

// Return the stable logsCache reference for useSyncExternalStore
export function getSqlLogs(): readonly SqlLogEntry[] {
  return logsCache;
}

export function clearSqlLogs() {
  logsCache = [];
  flushSqlLogsNow();
  notify();
}

export function subscribeSqlLogs(listener: LogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
