/**
 * Typed RPC Client for SQLite Worker & IndexedDB Synchronization
 * Runs all SQL off the main thread in a dedicated Web Worker.
 */

import { WorkerRequest, WorkerResponse, QueryResult, IntrospectResult } from './worker/types';
import { loadDatabaseBytes, saveDatabaseBytes } from './persistence';
import { appendSqlLog } from './sqlLog';

type VersionListener = (version: number) => void;

class SqliteClient {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (err: any) => void;
      timeoutId: ReturnType<typeof setTimeout>;
      startTime: number;
      action: string;
    }
  >();
  private isInitialized = false;
  private initPromise: Promise<IntrospectResult> | null = null;
  private dbVersion = 1;
  private versionListeners = new Set<VersionListener>();
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private currentUser = 'suresh.pawar';
  private currentRole = 'ADMIN';
  private currentDept = 'D01';
  private latestIntrospection: IntrospectResult | null = null;

  constructor() {
    this.setupAutoFlush();
  }

  public getCurrentUser() {
    return this.currentUser;
  }

  public getCurrentRole() {
    return this.currentRole;
  }

  public getCurrentDept() {
    return this.currentDept;
  }

  public setSessionUser(user: string, role: string, dept: string) {
    this.currentUser = user;
    this.currentRole = role;
    this.currentDept = dept;
    // Notify worker session context
    this.exec(
      `INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('user', ?), ('role', ?), ('dept', ?);`,
      [user, role, dept],
      false
    ).catch(() => {});
  }

  public getDbVersion(): number {
    return this.dbVersion;
  }

  public subscribeVersion(listener: VersionListener): () => void {
    this.versionListeners.add(listener);
    return () => {
      this.versionListeners.delete(listener);
    };
  }

  private incrementVersion() {
    this.dbVersion++;
    this.versionListeners.forEach(fn => fn(this.dbVersion));
    this.scheduleDebouncedSave();
  }

  public async init(): Promise<IntrospectResult> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        this.spawnWorker();

        // Check IndexedDB for existing database
        const existingBytes = await loadDatabaseBytes();
        const intro = await this.sendRequest<IntrospectResult>('init', {
          bytes: existingBytes || undefined
        });
        this.isInitialized = true;
        this.latestIntrospection = intro;
        return intro;
      } catch (err) {
        this.isInitialized = false;
        this.initPromise = null;
        if (this.worker) {
          try {
            this.worker.terminate();
          } catch {}
          this.worker = null;
        }
        throw err;
      }
    })();

    return this.initPromise;
  }

  public async retryInit(options: { resetStorage?: boolean } = {}): Promise<IntrospectResult> {
    if (options.resetStorage) {
      const { deleteDatabaseBytes } = await import('./persistence');
      await deleteDatabaseBytes();
    }
    this.isInitialized = false;
    this.initPromise = null;
    return this.init();
  }

  private spawnWorker() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new Worker(new URL('./worker/db.worker.ts', import.meta.url), {
      type: 'module'
    });

    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, ok, data, error, code } = e.data;
      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      clearTimeout(pending.timeoutId);
      this.pendingRequests.delete(id);

      if (ok) {
        pending.resolve(data);
      } else {
        const err: any = new Error(error || 'Worker operation failed');
        err.code = code;
        pending.reject(err);
      }
    };

    this.worker.onerror = (err) => {
      console.error('[SQLite Worker Error]', err);
      const errorObj: any = new Error(err.message || 'SQLite Worker unhandled error');
      errorObj.code = 'WORKER_ERROR';
      this.pendingRequests.forEach(({ reject, timeoutId }) => {
        clearTimeout(timeoutId);
        reject(errorObj);
      });
      this.pendingRequests.clear();
    };
  }

  private sendRequest<T = any>(action: WorkerRequest['action'], payload?: any, sandboxId?: string, timeoutMs = 15000): Promise<T> {
    if (!this.worker) {
      this.spawnWorker();
    }

    const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = performance.now();

    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        const err: any = new Error(`SQLite query timed out after ${timeoutMs}ms`);
        err.code = 'SQLITE_TIMEOUT';

        // Terminate and respawn worker on runaway query timeout
        if (this.worker) {
          try {
            this.worker.terminate();
          } catch {}
          this.worker = null;
        }

        this.pendingRequests.forEach(({ reject: r, timeoutId: tid }) => {
          clearTimeout(tid);
          r(err);
        });
        this.pendingRequests.clear();

        this.isInitialized = false;
        this.initPromise = null;
        this.spawnWorker();
        this.init().catch(reinitErr => {
          console.error('[SQLite Client] Worker restart after timeout failed', reinitErr);
        });

        reject(err);
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeoutId,
        startTime,
        action
      });

      const reqMsg: WorkerRequest = { id, action, payload, sandboxId };
      this.worker!.postMessage(reqMsg);
    });
  }

  public async exec(sql: string, params: any[] = [], logToHistory = true): Promise<QueryResult> {
    await this.init();
    const start = performance.now();
    const trimmed = sql.trim();
    const stripped = trimmed.replace(/^(\s*(--[^\n]*\n|\/\*[\s\S]*?\*\/|\s+))+/g, '').trim();

    const isWithMutating = /^WITH\b/i.test(stripped) && /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\b/i.test(stripped);
    const isDirectMutating = /^(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|SAVEPOINT|RELEASE|ROLLBACK)\b/i.test(stripped) ||
      /^PRAGMA\s+[a-zA-Z0-9_]+\s*=/i.test(stripped) ||
      /^PRAGMA\s+(incremental_vacuum|shrink_memory|optimize)\b/i.test(stripped);
    const isMutating = isDirectMutating || isWithMutating;

    try {
      const result = await this.sendRequest<QueryResult>('exec', { sql: trimmed, params });
      const ms = Math.round(performance.now() - start);

      if (logToHistory) {
        let type: any = 'SELECT';
        if (/^(INSERT|REPLACE)\b/i.test(stripped) || (/^WITH\b/i.test(stripped) && /\bINSERT\b/i.test(stripped))) {
          type = 'INSERT';
        } else if (/^UPDATE\b/i.test(stripped) || (/^WITH\b/i.test(stripped) && /\bUPDATE\b/i.test(stripped))) {
          type = 'UPDATE';
        } else if (/^DELETE\b/i.test(stripped) || (/^WITH\b/i.test(stripped) && /\bDELETE\b/i.test(stripped))) {
          type = 'DELETE';
        } else if (/^(CREATE|DROP|ALTER)\b/i.test(stripped)) {
          type = 'DDL';
        } else if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(stripped)) {
          type = 'TRANSACTION';
        }

        appendSqlLog({
          type,
          status: 'SUCCESS',
          query: trimmed,
          params: params.length > 0 ? params : undefined,
          user: this.currentUser,
          executionTimeMs: ms,
          rowsAffected: result.rowsAffected
        });
      }

      if (isMutating) {
        this.incrementVersion();
      }

      return result;
    } catch (err: any) {
      const ms = Math.round(performance.now() - start);
      if (logToHistory) {
        appendSqlLog({
          type: 'TRANSACTION',
          status: 'ERROR',
          query: trimmed,
          params: params.length > 0 ? params : undefined,
          user: this.currentUser,
          executionTimeMs: ms,
          errorMessage: err?.message || String(err)
        });
      }
      throw err;
    }
  }

  public async batch(statements: { sql: string; params?: any[] }[], options: { atomic?: boolean } = {}): Promise<{ results: QueryResult[]; ms: number }> {
    await this.init();
    const start = performance.now();
    try {
      const res = await this.sendRequest<{ results: QueryResult[]; ms: number }>('batch', {
        statements,
        atomic: options.atomic !== false
      });
      const ms = Math.round(performance.now() - start);

      appendSqlLog({
        type: 'TRANSACTION',
        status: 'SUCCESS',
        query: `BEGIN TRANSACTION;\n${statements.map(s => s.sql).join('\n')}\nCOMMIT;`,
        user: this.currentUser,
        executionTimeMs: ms,
        rowsAffected: statements.length
      });

      this.incrementVersion();
      return res;
    } catch (err: any) {
      const ms = Math.round(performance.now() - start);
      appendSqlLog({
        type: 'TRANSACTION',
        status: 'ERROR',
        query: `BEGIN TRANSACTION;\n${statements.map(s => s.sql).join('\n')}\n-- FAILED: ${err?.message}\nROLLBACK;`,
        user: this.currentUser,
        executionTimeMs: ms,
        errorMessage: err?.message || String(err)
      });
      throw err;
    }
  }

  public async explain(sql: string): Promise<QueryResult> {
    await this.init();
    return this.sendRequest<QueryResult>('explain', { sql });
  }

  public async introspect(): Promise<IntrospectResult> {
    await this.init();
    const intro = await this.sendRequest<IntrospectResult>('introspect');
    this.latestIntrospection = intro;
    return intro;
  }

  public getCachedIntrospect(): IntrospectResult | null {
    return this.latestIntrospection;
  }

  public async exportDb(): Promise<Uint8Array> {
    await this.init();
    return this.sendRequest<Uint8Array>('exportDb');
  }

  public async importDb(bytes: Uint8Array): Promise<IntrospectResult> {
    await this.init();
    // Auto-create snapshot user can undo before importing
    try {
      if (this.isInitialized) {
        const currentBytes = await this.exportDb();
        const { saveNamedSnapshot } = await import('./persistence');
        await saveNamedSnapshot(`pre_import_${Date.now()}`, currentBytes);
      }
    } catch (snapErr) {
      console.warn('[SQLite Client] Could not save pre-import snapshot', snapErr);
    }

    const intro = await this.sendRequest<IntrospectResult>('importDb', { bytes });
    this.latestIntrospection = intro;
    await saveDatabaseBytes(bytes);
    this.incrementVersion();
    return intro;
  }

  public async resetToSeed(): Promise<IntrospectResult> {
    await this.init();
    // Auto-create snapshot user can undo before reset
    try {
      if (this.isInitialized) {
        const currentBytes = await this.exportDb();
        const { saveNamedSnapshot } = await import('./persistence');
        await saveNamedSnapshot(`pre_reset_${Date.now()}`, currentBytes);
      }
    } catch (snapErr) {
      console.warn('[SQLite Client] Could not save pre-reset snapshot', snapErr);
    }

    const intro = await this.sendRequest<IntrospectResult>('resetToSeed');
    this.latestIntrospection = intro;
    // Export and save fresh seed
    const bytes = await this.exportDb();
    await saveDatabaseBytes(bytes);
    this.incrementVersion();
    return intro;
  }

  public async createSandbox(): Promise<{ sandboxId: string }> {
    await this.init();
    return this.sendRequest<{ sandboxId: string }>('createSandbox');
  }

  public async dropSandbox(sandboxId: string): Promise<{ ok: boolean }> {
    return this.sendRequest<{ ok: boolean }>('dropSandbox', { sandboxId }, sandboxId);
  }

  public async execSandbox(sandboxId: string, sql: string, params: any[] = []): Promise<QueryResult> {
    return this.sendRequest<QueryResult>('execSandbox', { sql, params }, sandboxId);
  }

  public async seedLargeBench(): Promise<{ sandboxId: string }> {
    await this.init();
    return this.sendRequest<{ sandboxId: string }>('seedLargeBench');
  }

  public async callProcedure<T = any>(
    name: string,
    args: any = {}
  ): Promise<{ ok: boolean; result?: T; code?: string; message?: string }> {
    await this.init();
    const enrichedArgs = {
      user: this.currentUser,
      role: this.currentRole,
      dept: this.currentDept,
      ...args
    };

    try {
      const res = await this.sendRequest<T>('callProcedure', { name, args: enrichedArgs });
      return { ok: true, result: res };
    } catch (err: any) {
      return {
        ok: false,
        code: err?.code || 'PROCEDURE_FAILED',
        message: err?.message || String(err)
      };
    } finally {
      this.incrementVersion();
    }
  }

  // 1-second debounced persistence to IndexedDB
  private scheduleDebouncedSave() {
    if (!this.isInitialized) return;
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      this.saveTimeout = null;
      await this.flushStorageNow();
    }, 1000);
  }

  public async flushStorageNow() {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    // Block autosave/flush while the database is not in a valid initialized state
    if (!this.isInitialized || !this.worker) {
      return;
    }
    try {
      const bytes = await this.exportDb();
      if (bytes && bytes.byteLength > 0) {
        await saveDatabaseBytes(bytes);
      }
    } catch (e) {
      console.warn('[SQLite Client] Flush to IndexedDB error', e);
    }
  }

  private setupAutoFlush() {
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => this.flushStorageNow());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushStorageNow();
        }
      });
    }
  }

  // Hard cancel runaway query
  public async cancelRunawayQuery() {
    console.warn('[SQLite Client] Terminating and restarting worker on manual cancel.');
    try {
      if (this.isInitialized) {
        await this.flushStorageNow();
      }
    } catch (flushErr) {
      console.warn('[SQLite Client] Could not flush state prior to cancel', flushErr);
    }

    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }

    this.pendingRequests.forEach(({ reject, timeoutId }) => {
      clearTimeout(timeoutId);
      const err: any = new Error('Query was cancelled.');
      err.code = 'SQLITE_CANCELLED';
      reject(err);
    });
    this.pendingRequests.clear();

    this.isInitialized = false;
    this.initPromise = null;
    this.spawnWorker();
    await this.init();
  }
}

export const sqlClient = new SqliteClient();
