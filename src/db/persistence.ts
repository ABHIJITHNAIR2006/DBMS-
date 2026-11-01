/**
 * IndexedDB Persistence Layer for SQLite Database Bytes & Snapshots
 */

const IDB_NAME = 'claystock_sqlite_db';
const IDB_VERSION = 1;
const STORE_DATA = 'sqlite_data';
const STORE_SNAPSHOTS = 'snapshots';
const MAIN_DB_KEY = 'main_database_bytes';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB not supported'));
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DATA)) {
        db.createObjectStore(STORE_DATA);
      }
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadDatabaseBytes(): Promise<Uint8Array | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db!.transaction(STORE_DATA, 'readonly');
      const store = tx.objectStore(STORE_DATA);
      const req = store.get(MAIN_DB_KEY);
      req.onsuccess = () => {
        if (req.result && req.result instanceof Uint8Array) {
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => {
        db?.close();
      };
      tx.onerror = () => {
        db?.close();
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    console.warn('[IndexedDB] Could not load database bytes', err);
    return null;
  }
}

export async function saveDatabaseBytes(bytes: Uint8Array): Promise<boolean> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<boolean>((resolve, reject) => {
      const tx = db!.transaction(STORE_DATA, 'readwrite');
      const store = tx.objectStore(STORE_DATA);
      store.put(bytes, MAIN_DB_KEY);
      tx.oncomplete = () => {
        db?.close();
        resolve(true);
      };
      tx.onerror = () => {
        db?.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db?.close();
        reject(tx.error || new Error('Transaction aborted'));
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    console.error('[IndexedDB] Error saving database bytes', err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('claystock-toast', {
          detail: {
            title: 'Storage Save Error',
            description: 'Failed to persist SQLite database snapshot to IndexedDB.',
            type: 'error'
          }
        })
      );
    }
    return false;
  }
}

export async function deleteDatabaseBytes(): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_DATA, 'readwrite');
      const store = tx.objectStore(STORE_DATA);
      store.delete(MAIN_DB_KEY);
      tx.oncomplete = () => {
        db?.close();
        resolve();
      };
      tx.onerror = () => {
        db?.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db?.close();
        reject(tx.error || new Error('Transaction aborted'));
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    console.warn('[IndexedDB] Error deleting database bytes', err);
  }
}

export interface DbSnapshotMeta {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

export async function saveNamedSnapshot(name: string, bytes: Uint8Array): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const data = {
        name,
        createdAt: new Date().toISOString(),
        bytes
      };
      store.put(data, name);
      tx.oncomplete = () => {
        db?.close();
        resolve();
      };
      tx.onerror = () => {
        db?.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db?.close();
        reject(tx.error || new Error('Transaction aborted'));
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    throw err;
  }
}

export async function loadNamedSnapshot(name: string): Promise<Uint8Array | null> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db!.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.get(name);
      req.onsuccess = () => {
        if (req.result && req.result.bytes) {
          resolve(req.result.bytes);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => {
        db?.close();
      };
      tx.onerror = () => {
        db?.close();
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    throw err;
  }
}

export async function listSnapshots(): Promise<DbSnapshotMeta[]> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<DbSnapshotMeta[]>((resolve, reject) => {
      const tx = db!.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.openCursor();
      const list: DbSnapshotMeta[] = [];
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          const val = cursor.value;
          list.push({
            name: cursor.key as string,
            createdAt: val.createdAt,
            sizeBytes: val.bytes ? val.bytes.byteLength : 0
          });
          cursor.continue();
        } else {
          resolve(list);
        }
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => {
        db?.close();
      };
      tx.onerror = () => {
        db?.close();
      };
    });
  } catch {
    if (db) {
      try { db.close(); } catch {}
    }
    return [];
  }
}

export async function deleteSnapshot(name: string): Promise<void> {
  let db: IDBDatabase | null = null;
  try {
    db = await openIdb();
    return await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      store.delete(name);
      tx.oncomplete = () => {
        db?.close();
        resolve();
      };
      tx.onerror = () => {
        db?.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db?.close();
        reject(tx.error || new Error('Transaction aborted'));
      };
    });
  } catch (err) {
    if (db) {
      try { db.close(); } catch {}
    }
    throw err;
  }
}
