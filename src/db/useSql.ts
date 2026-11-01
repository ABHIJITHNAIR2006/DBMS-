import { useState, useEffect, useRef, useCallback } from 'react';
import { sqlClient } from './client';
import { QueryResult } from './worker/types';

interface UseSqlOptions {
  enabled?: boolean;
  debounceMs?: number;
}

interface UseSqlResult<T = any> {
  data: T[] | null;
  raw: QueryResult | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  dbVersion: number;
}

// Simple query cache per dbVersion to avoid redundant calls across components
const queryCache = new Map<string, { dbVersion: number; data: any[]; raw: QueryResult }>();

export function useSql<T = Record<string, any>>(
  sql: string,
  params: any[] = [],
  deps: any[] = [],
  options: UseSqlOptions = {}
): UseSqlResult<T> {
  const { enabled = true, debounceMs = 50 } = options;
  const [data, setData] = useState<T[] | null>(null);
  const [raw, setRaw] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(enabled && Boolean(sql.trim()));
  const [error, setError] = useState<Error | null>(null);
  const [dbVersion, setDbVersion] = useState(() => sqlClient.getDbVersion());

  const activeRequestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convert row arrays to objects using column headers
  const formatRows = useCallback((columns: string[], rows: any[][]): T[] => {
    return rows.map(row => {
      const obj: any = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj as T;
    });
  }, []);

  const runQuery = useCallback(async () => {
    if (!enabled || !sql.trim()) {
      setLoading(false);
      return;
    }

    const currentVersion = sqlClient.getDbVersion();
    const cacheKey = `${sql}__${JSON.stringify(params)}`;

    // Check cache
    const cached = queryCache.get(cacheKey);
    if (cached && cached.dbVersion === currentVersion) {
      setData(cached.data as T[]);
      setRaw(cached.raw);
      setLoading(false);
      setError(null);
      return;
    }

    const reqId = ++activeRequestId.current;
    setLoading(true);

    try {
      const qRes = await sqlClient.exec(sql, params, false);
      // Cancel stale response
      if (reqId !== activeRequestId.current) return;

      const formatted = formatRows(qRes.columns, qRes.rows);
      queryCache.set(cacheKey, {
        dbVersion: currentVersion,
        data: formatted,
        raw: qRes
      });

      setData(formatted);
      setRaw(qRes);
      setError(null);
    } catch (err: any) {
      if (reqId !== activeRequestId.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (reqId === activeRequestId.current) {
        setLoading(false);
      }
    }
  }, [sql, JSON.stringify(params), enabled, formatRows]);

  // Subscribe to DB Version mutations
  useEffect(() => {
    const unsub = sqlClient.subscribeVersion(newVer => {
      setDbVersion(newVer);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        runQuery();
      }, debounceMs);
    });
    return () => {
      unsub();
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [runQuery, debounceMs]);

  // Initial and dependencies change execution
  useEffect(() => {
    runQuery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runQuery, ...deps]);

  return {
    data,
    raw,
    loading,
    error,
    refetch: runQuery,
    dbVersion
  };
}
