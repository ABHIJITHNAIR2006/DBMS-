import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import { WorkerRequest, WorkerResponse, QueryResult, IntrospectResult, IntrospectTable } from './types';
import { SCHEMA_DDL, VIEWS_DDL, TRIGGERS_DDL, INDEXES_DDL } from '../schemaDdl';
import { generateSeedSql } from '../seedData';

let SQL: SqlJsStatic | null = null;
let mainDb: Database | null = null;
const sandboxes = new Map<string, Database>();

// Ensure foreign keys pragma is active on the database instance
function configureDb(db: Database) {
  db.run('PRAGMA foreign_keys = ON;');
}

async function getSql(): Promise<SqlJsStatic> {
  if (SQL) return SQL;
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
  const cleanBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const wasmPath = `${cleanBase}sql-wasm.wasm`;
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      if (file.endsWith('.wasm')) {
        return wasmPath;
      }
      return file;
    }
  });
  return SQL;
}

function validateDatabase(db: Database): void {
  // 1. PRAGMA integrity_check
  const integrityRes = db.exec('PRAGMA integrity_check;');
  const integrity = integrityRes[0]?.values[0]?.[0];
  if (integrity !== 'ok') {
    throw new Error(`Database integrity check failed: ${integrity}`);
  }

  // 2. PRAGMA foreign_key_check
  const fkCheckRes = db.exec('PRAGMA foreign_key_check;');
  if (fkCheckRes.length > 0 && fkCheckRes[0].values.length > 0) {
    const fkErrors = fkCheckRes[0].values.length;
    throw new Error(`Database foreign key integrity check failed: ${fkErrors} foreign key violation(s) found.`);
  }

  // 3. Expected core tables exist - dynamically parsed from SCHEMA_DDL
  const tablesStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tableSet = new Set<string>();
  while (tablesStmt.step()) {
    tableSet.add(tablesStmt.get()[0] as string);
  }
  tablesStmt.free();

  const requiredTables: string[] = [];
  const tableRegex = /CREATE TABLE IF NOT EXISTS\s+(\w+)/gi;
  let match: RegExpExecArray | null;
  while ((match = tableRegex.exec(SCHEMA_DDL)) !== null) {
    requiredTables.push(match[1]);
  }

  for (const tbl of requiredTables) {
    if (!tableSet.has(tbl)) {
      throw new Error(`Database schema validation failed: missing required table '${tbl}'.`);
    }
  }

  // 4. Expected views exist - dynamically parsed from VIEWS_DDL
  const viewsStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='view';");
  const viewSet = new Set<string>();
  while (viewsStmt.step()) {
    viewSet.add(viewsStmt.get()[0] as string);
  }
  viewsStmt.free();

  const requiredViews: string[] = [];
  const viewRegex = /CREATE VIEW IF NOT EXISTS\s+(\w+)/gi;
  while ((match = viewRegex.exec(VIEWS_DDL)) !== null) {
    requiredViews.push(match[1]);
  }

  for (const vw of requiredViews) {
    if (!viewSet.has(vw)) {
      throw new Error(`Database schema validation failed: missing required view '${vw}'.`);
    }
  }

  // 5. Expected triggers exist - dynamically parsed from TRIGGERS_DDL
  const triggersStmt = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger';");
  const triggerSet = new Set<string>();
  while (triggersStmt.step()) {
    triggerSet.add(triggersStmt.get()[0] as string);
  }
  triggersStmt.free();

  const requiredTriggers: string[] = [];
  const triggerRegex = /CREATE TRIGGER IF NOT EXISTS\s+(\w+)/gi;
  while ((match = triggerRegex.exec(TRIGGERS_DDL)) !== null) {
    requiredTriggers.push(match[1]);
  }

  for (const trg of requiredTriggers) {
    if (!triggerSet.has(trg)) {
      throw new Error(`Database schema validation failed: missing required trigger '${trg}'.`);
    }
  }
}

function migrateDatabase(db: Database): void {
  const masterCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('SUPPLIES', 'ISSUED_TO');");
  const existingTables = new Set(masterCheck[0]?.values.map(v => v[0] as string) || []);

  if (existingTables.has('SUPPLIES') || existingTables.has('ISSUED_TO')) {
    db.run('PRAGMA foreign_keys = OFF;');
    db.run('BEGIN TRANSACTION;');
    try {
      // Drop dependent views and triggers first so altering/dropping SUPPLIES and ISSUED_TO doesn't fail
      const deps = db.exec("SELECT type, name FROM sqlite_master WHERE type IN ('view','trigger') AND name NOT LIKE 'sqlite_%';");
      for (const row of deps[0]?.values || []) {
        db.run(`DROP ${String(row[0]).toUpperCase()} IF EXISTS "${String(row[1]).replace(/"/g, '""')}";`);
      }

      if (existingTables.has('SUPPLIES')) {
        db.run(`
          CREATE TABLE SUPPLIES_mig_v3 (
            PurchaseID TEXT PRIMARY KEY,
            ItemID TEXT NOT NULL,
            SupplierID TEXT NOT NULL,
            PurchaseDate TEXT NOT NULL,
            Quantity INTEGER NOT NULL CHECK(Quantity > 0),
            Cost REAL NOT NULL CHECK(Cost >= 0),
            FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE RESTRICT,
            FOREIGN KEY (SupplierID) REFERENCES SUPPLIER(SupplierID) ON UPDATE CASCADE ON DELETE RESTRICT
          );
          INSERT INTO SUPPLIES_mig_v3 (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost)
          SELECT PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost FROM SUPPLIES;
          DROP TABLE SUPPLIES;
          ALTER TABLE SUPPLIES_mig_v3 RENAME TO SUPPLIES;
        `);
      }

      if (existingTables.has('ISSUED_TO')) {
        db.run(`
          CREATE TABLE ISSUED_TO_mig_v3 (
            IssueID TEXT PRIMARY KEY,
            ItemID TEXT NOT NULL,
            DeptID TEXT NOT NULL,
            EmpID TEXT,
            ReqID TEXT,
            IssueDate TEXT NOT NULL,
            Quantity INTEGER NOT NULL CHECK(Quantity > 0),
            FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE RESTRICT,
            FOREIGN KEY (DeptID) REFERENCES DEPARTMENT(DeptID) ON UPDATE CASCADE ON DELETE RESTRICT,
            FOREIGN KEY (EmpID) REFERENCES EMPLOYEE(EmpID) ON UPDATE CASCADE ON DELETE RESTRICT,
            FOREIGN KEY (ReqID) REFERENCES REQUISITION(ReqID) ON UPDATE CASCADE ON DELETE SET NULL
          );
          INSERT INTO ISSUED_TO_mig_v3 (IssueID, ItemID, DeptID, EmpID, ReqID, IssueDate, Quantity)
          SELECT IssueID, ItemID, DeptID, EmpID, ReqID, IssueDate, Quantity FROM ISSUED_TO;
          DROP TABLE ISSUED_TO;
          ALTER TABLE ISSUED_TO_mig_v3 RENAME TO ISSUED_TO;
        `);
      }

      // Re-apply views, triggers, and indexes to rebuild triggers on new tables
      db.run(VIEWS_DDL);
      db.run(TRIGGERS_DDL);
      db.run(INDEXES_DDL);

      db.run('PRAGMA user_version = 3;');
      db.run('COMMIT;');
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    } finally {
      db.run('PRAGMA foreign_keys = ON;');
    }
  } else {
    db.run('PRAGMA user_version = 3;');
  }
}

function buildFreshDatabase(sqlInstance: SqlJsStatic): Database {
  const db = new sqlInstance.Database();
  db.run('PRAGMA foreign_keys = ON;');

  let currentStage = 'INIT';
  try {
    currentStage = 'BEGIN_TRANSACTION';
    db.run('BEGIN TRANSACTION;');

    currentStage = 'SCHEMA_DDL';
    db.run(SCHEMA_DDL);

    currentStage = 'VIEWS_DDL';
    db.run(VIEWS_DDL);

    currentStage = 'TRIGGERS_DDL';
    db.run(TRIGGERS_DDL);

    currentStage = 'INDEXES_DDL';
    db.run(INDEXES_DDL);

    currentStage = 'SEED_DATA';
    const seedSql = generateSeedSql();
    db.run(seedSql);

    currentStage = 'SET_VERSION';
    db.run('PRAGMA user_version = 3;');

    currentStage = 'COMMIT_TRANSACTION';
    db.run('COMMIT;');

    currentStage = 'VALIDATION';
    validateDatabase(db);

    return db;
  } catch (err: any) {
    try {
      db.run('ROLLBACK;');
    } catch {}
    try {
      db.close();
    } catch {}
    const stageErr = new Error(`Database initialization failed in stage [${currentStage}]: ${err?.message || String(err)}`);
    (stageErr as any).stage = currentStage;
    throw stageErr;
  }
}

function initializeCleanDatabase(sqlInstance: SqlJsStatic, initialBytes?: Uint8Array): Database {
  if (!initialBytes) {
    return buildFreshDatabase(sqlInstance);
  }

  let db: Database | null = null;
  let currentStage = 'LOAD_BYTES';
  try {
    db = new sqlInstance.Database(initialBytes);
    currentStage = 'PRAGMAS';
    db.run('PRAGMA foreign_keys = ON;');

    currentStage = 'MIGRATION';
    const verRes = db.exec('PRAGMA user_version;');
    const userVer = Number(verRes[0]?.values[0]?.[0] || 0);
    if (userVer < 3) {
      migrateDatabase(db);
    }

    currentStage = 'VALIDATION';
    validateDatabase(db);
    return db;
  } catch (err: any) {
    if (db) {
      try { db.close(); } catch {}
    }
    const stageErr = new Error(`Failed to load existing database in stage [${currentStage}]: ${err?.message || String(err)}`);
    (stageErr as any).stage = currentStage;
    throw stageErr;
  }
}

function executeSingleSql(db: Database, sql: string, params: any[] = []): QueryResult {
  const start = performance.now();
  const trimmed = sql.trim();

  // If query is multiple statements or doesn't return rows (DDL/DML without returning)
  const isSelectLike = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(trimmed);

  if (!isSelectLike) {
    db.run(trimmed, params);
    const ms = Math.round((performance.now() - start) * 10) / 10;
    const rowsAffected = db.getRowsModified();
    return {
      columns: [],
      rows: [],
      rowsAffected,
      ms
    };
  }

  const stmt = db.prepare(trimmed, params);
  const columns = stmt.getColumnNames();
  const rows: any[][] = [];

  while (stmt.step()) {
    rows.push(stmt.get());
  }
  stmt.free();

  const ms = Math.round((performance.now() - start) * 10) / 10;
  return {
    columns,
    rows,
    rowsAffected: rows.length,
    ms
  };
}

function executeBatchSql(db: Database, statements: { sql: string; params?: any[] }[], atomic = true): { results: QueryResult[]; ms: number } {
  const start = performance.now();
  if (atomic) db.run('BEGIN TRANSACTION;');

  const results: QueryResult[] = [];
  try {
    for (const s of statements) {
      results.push(executeSingleSql(db, s.sql, s.params || []));
    }
    if (atomic) db.run('COMMIT;');
  } catch (err) {
    if (atomic) {
      try {
        db.run('ROLLBACK;');
      } catch {
        // Rollback attempt
      }
    }
    throw err;
  }

  const ms = Math.round((performance.now() - start) * 10) / 10;
  return { results, ms };
}

function runIntrospection(db: Database): IntrospectResult {
  // Query all user tables
  const tablesStmt = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%' 
    ORDER BY name;
  `);
  const tableNames: string[] = [];
  while (tablesStmt.step()) {
    tableNames.push(tablesStmt.get()[0] as string);
  }
  tablesStmt.free();

  const tables: IntrospectTable[] = [];

  for (const name of tableNames) {
    // Columns
    const colsStmt = db.prepare(`PRAGMA table_info("${name}");`);
    const columns: any[] = [];
    while (colsStmt.step()) {
      const row = colsStmt.getAsObject();
      columns.push({
        cid: row.cid,
        name: row.name,
        type: row.type,
        notnull: row.notnull,
        dflt_value: row.dflt_value,
        pk: row.pk
      });
    }
    colsStmt.free();

    // FKs
    const fkStmt = db.prepare(`PRAGMA foreign_key_list("${name}");`);
    const fks: any[] = [];
    while (fkStmt.step()) {
      const row = fkStmt.getAsObject();
      fks.push({
        id: row.id,
        seq: row.seq,
        table: row.table,
        from: row.from,
        to: row.to,
        on_update: row.on_update,
        on_delete: row.on_delete
      });
    }
    fkStmt.free();

    // Indexes
    const idxStmt = db.prepare(`PRAGMA index_list("${name}");`);
    const indexes: any[] = [];
    while (idxStmt.step()) {
      const row = idxStmt.getAsObject();
      indexes.push({
        name: row.name,
        tbl_name: name,
        unique: Boolean(row.unique)
      });
    }
    idxStmt.free();

    // Row count
    let rowCount = 0;
    try {
      const cntRes = db.exec(`SELECT COUNT(*) AS c FROM "${name}";`);
      if (cntRes.length > 0 && cntRes[0].values.length > 0) {
        rowCount = Number(cntRes[0].values[0][0]);
      }
    } catch {
      rowCount = 0;
    }

    tables.push({ name, columns, fks, indexes, rowCount });
  }

  // Views
  const viewsStmt = db.prepare(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='view' ORDER BY name;
  `);
  const views: any[] = [];
  while (viewsStmt.step()) {
    const row = viewsStmt.getAsObject();
    views.push({ name: row.name, sql: row.sql });
  }
  viewsStmt.free();

  // Triggers
  const trgStmt = db.prepare(`
    SELECT name, tbl_name, sql FROM sqlite_master 
    WHERE type='trigger' ORDER BY name;
  `);
  const triggers: any[] = [];
  while (trgStmt.step()) {
    const row = trgStmt.getAsObject();
    triggers.push({ name: row.name, tbl_name: row.tbl_name, sql: row.sql });
  }
  trgStmt.free();

  // Master indexes list
  const masterIdxStmt = db.prepare(`
    SELECT name, tbl_name, sql FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name;
  `);
  const masterIndexes: any[] = [];
  while (masterIdxStmt.step()) {
    const row = masterIdxStmt.getAsObject();
    masterIndexes.push({ name: row.name, tbl_name: row.tbl_name, unique: false, sql: row.sql });
  }
  masterIdxStmt.free();

  // User version
  let userVersion = 2;
  try {
    const uv = db.exec('PRAGMA user_version;');
    if (uv.length > 0 && uv[0].values.length > 0) {
      userVersion = Number(uv[0].values[0][0]);
    }
  } catch {
    // default
  }

  return {
    tables,
    views,
    triggers,
    indexes: masterIndexes,
    userVersion,
    dbSizeBytes: 0,
    tablesCount: tables.length,
    viewsCount: views.length,
    triggersCount: triggers.length,
    indexesCount: masterIndexes.length,
    totalRows: tables.reduce((acc, t) => acc + t.rowCount, 0),
    sizeBytes: 147456
  };
}

// Emulated Stored Procedures
function runStoredProcedure(db: Database, name: string, args: any): { ok: boolean; result?: any; code?: string; message?: string } {
  // Set session context first
  if (args.user) db.run(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('user', ?);`, [args.user]);
  if (args.role) db.run(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('role', ?);`, [args.role]);
  if (args.dept) db.run(`INSERT OR REPLACE INTO SESSION_CONTEXT (Key, Value) VALUES ('dept', ?);`, [args.dept]);

  // Check role permission
  if (args.role && args.resource && args.action) {
    const permStmt = db.prepare('SELECT 1 FROM PERMISSION WHERE RoleName = ? AND Resource = ? AND Action = ?;');
    permStmt.bind([args.role, args.resource, args.action]);
    const hasPerm = permStmt.step();
    permStmt.free();
    if (!hasPerm) {
      return {
        ok: false,
        code: 'PERMISSION_DENIED',
        message: `Role '${args.role}' is not granted '${args.action}' on resource '${args.resource}'. Action aborted.`
      };
    }
  }

  switch (name) {
    case 'sp_add_item': {
      db.run('BEGIN TRANSACTION;');
      try {
        const { itemId, itemName, category, unitPrice, type, reorderLevel, warrantyPeriod, batches } = args;
        db.run('INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES (?, ?, ?, ?);', [
          itemId,
          itemName,
          category,
          unitPrice
        ]);
        if (type === 'Consumable') {
          db.run('INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES (?, ?);', [itemId, reorderLevel || 20]);
        } else {
          db.run('INSERT INTO DURABLE_ITEM (ItemID, WarrantyPeriod) VALUES (?, ?);', [itemId, warrantyPeriod || 12]);
        }
        if (batches && Array.isArray(batches)) {
          for (const b of batches) {
            if (b.batchNo && b.expiryDate) {
              db.run('INSERT INTO STOCK_BATCH (ItemID, BatchNo, ExpiryDate) VALUES (?, ?, ?);', [
                itemId,
                b.batchNo,
                b.expiryDate
              ]);
            }
          }
        }
        db.run('COMMIT;');
        return { ok: true, result: { itemId } };
      } catch (err: any) {
        db.run('ROLLBACK;');
        return { ok: false, code: 'ADD_ITEM_FAILED', message: err?.message || String(err) };
      }
    }

    case 'sp_record_purchase': {
      db.run('BEGIN TRANSACTION;');
      try {
        const { purchaseId, itemId, supplierId, purchaseDate, quantity, cost } = args;
        db.run('INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES (?, ?, ?, ?, ?, ?);', [
          purchaseId,
          itemId,
          supplierId,
          purchaseDate,
          quantity,
          cost
        ]);
        db.run('COMMIT;');
        return { ok: true, result: { purchaseId } };
      } catch (err: any) {
        db.run('ROLLBACK;');
        return { ok: false, code: 'RECORD_PURCHASE_FAILED', message: err?.message || String(err) };
      }
    }

    case 'sp_issue_item': {
      db.run('BEGIN TRANSACTION;');
      try {
        const { issueId, itemId, deptId, empId, reqId, issueDate, quantity } = args;
        db.run('INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, ReqID, IssueDate, Quantity) VALUES (?, ?, ?, ?, ?, ?, ?);', [
          issueId,
          itemId,
          deptId,
          empId || null,
          reqId || null,
          issueDate,
          quantity
        ]);
        db.run('COMMIT;');
        return { ok: true, result: { issueId } };
      } catch (err: any) {
        db.run('ROLLBACK;');
        return { ok: false, code: 'RECORD_ISSUE_FAILED', message: err?.message || String(err) };
      }
    }

    case 'sp_submit_requisition': {
      db.run('BEGIN TRANSACTION;');
      try {
        const { reqId, deptId, empId, reqDate, remarks, lines } = args;
        db.run('INSERT INTO REQUISITION (ReqID, DeptID, EmpID, ReqDate, Status, ApprovedBy, Remarks) VALUES (?, ?, ?, ?, ?, NULL, ?);', [
          reqId,
          deptId,
          empId,
          reqDate,
          'SUBMITTED',
          remarks || ''
        ]);
        let lineNo = 1;
        for (const l of lines) {
          db.run('INSERT INTO REQUISITION_LINE (ReqID, LineNo, ItemID, QtyRequested, QtyApproved) VALUES (?, ?, ?, ?, NULL);', [
            reqId,
            lineNo++,
            l.itemId,
            l.qtyRequested
          ]);
        }
        db.run('COMMIT;');
        return { ok: true, result: { reqId } };
      } catch (err: any) {
        db.run('ROLLBACK;');
        return { ok: false, code: 'SUBMIT_REQ_FAILED', message: err?.message || String(err) };
      }
    }

    case 'sp_approve_requisition': {
      db.run('BEGIN TRANSACTION;');
      try {
        const { reqId, approvedBy, status, lineApprovals } = args;
        db.run('UPDATE REQUISITION SET Status = ?, ApprovedBy = ? WHERE ReqID = ?;', [status, approvedBy, reqId]);
        if (lineApprovals && Array.isArray(lineApprovals)) {
          for (const la of lineApprovals) {
            db.run('UPDATE REQUISITION_LINE SET QtyApproved = ? WHERE ReqID = ? AND LineNo = ?;', [
              la.qtyApproved,
              reqId,
              la.lineNo
            ]);
          }
        }
        db.run('COMMIT;');
        return { ok: true, result: { reqId, status } };
      } catch (err: any) {
        db.run('ROLLBACK;');
        return { ok: false, code: 'APPROVE_REQ_FAILED', message: err?.message || String(err) };
      }
    }

    // sp_fulfil_requisition with SAVEPOINT per line as required by D2!
    case 'sp_fulfil_requisition': {
      const timeline: string[] = ['BEGIN TRANSACTION;'];
      db.run('BEGIN TRANSACTION;');
      try {
        const { reqId } = args;
        const reqStmt = db.prepare('SELECT DeptID, EmpID FROM REQUISITION WHERE ReqID = ?;');
        reqStmt.bind([reqId]);
        if (!reqStmt.step()) {
          reqStmt.free();
          throw new Error(`Requisition '${reqId}' not found`);
        }
        const reqRow = reqStmt.get();
        const deptId = reqRow[0] as string;
        const empId = reqRow[1] as string;
        reqStmt.free();

        const linesStmt = db.prepare(`
          SELECT LineNo, ItemID, COALESCE(QtyApproved, QtyRequested) AS Qty
          FROM REQUISITION_LINE WHERE ReqID = ? ORDER BY LineNo;
        `);
        linesStmt.bind([reqId]);
        const lines: [number, string, number][] = [];
        while (linesStmt.step()) {
          const r = linesStmt.get();
          lines.push([r[0] as number, r[1] as string, r[2] as number]);
        }
        linesStmt.free();

        if (lines.length === 0) {
          throw new Error('No requisition lines found to fulfil');
        }

        let successfulLines = 0;
        let shortfalls = 0;
        const today = new Date().toISOString().split('T')[0];

        for (const line of lines) {
          const lineNo = line[0] as number;
          const itemId = line[1] as string;
          const qty = line[2] as number;
          const spName = `sp_line_${lineNo}`;

          timeline.push(`SAVEPOINT ${spName};`);
          db.run(`SAVEPOINT ${spName};`);

          try {
            // Generate next IssueID
            const maxIssueRes = db.exec("SELECT COALESCE(MAX(CAST(substr(IssueID, 3) AS INTEGER)), 2000) FROM ISSUED_TO;");
            const nextIssueSeq = Number(maxIssueRes[0].values[0][0]) + 1;
            const newIssueId = `IS${nextIssueSeq}`;

            // Attempt INSERT ON ISSUED_TO (triggers trg_issue_check_stock)
            db.run(
              `INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, ReqID, IssueDate, Quantity) VALUES (?, ?, ?, ?, ?, ?, ?);`,
              [newIssueId, itemId, deptId, empId, reqId, today, qty]
            );

            timeline.push(`INSERT INTO ISSUED_TO (${newIssueId}, ${itemId}, qty: ${qty}) -- OK`);
            timeline.push(`RELEASE SAVEPOINT ${spName};`);
            db.run(`RELEASE SAVEPOINT ${spName};`);
            successfulLines++;
          } catch (lineErr: any) {
            // Trigger abort or constraint violation: rollback to savepoint!
            timeline.push(`ROLLBACK TO SAVEPOINT ${spName}; -- Shortfall: ${lineErr?.message || 'INSUFFICIENT_STOCK'}`);
            db.run(`ROLLBACK TO SAVEPOINT ${spName};`);
            shortfalls++;
          }
        }

        let finalStatus = 'FULFILLED';
        if (shortfalls > 0 && successfulLines > 0) {
          finalStatus = 'PARTIALLY_FULFILLED';
        } else if (shortfalls > 0 && successfulLines === 0) {
          finalStatus = 'APPROVED'; // Could not fulfil any line
        }

        db.run(`UPDATE REQUISITION SET Status = ? WHERE ReqID = ?;`, [finalStatus, reqId]);
        timeline.push(`UPDATE REQUISITION SET Status = '${finalStatus}' WHERE ReqID = '${reqId}';`);
        timeline.push('COMMIT;');
        db.run('COMMIT;');

        return {
          ok: true,
          result: {
            reqId,
            status: finalStatus,
            successfulLines,
            shortfalls,
            timeline
          }
        };
      } catch (err: any) {
        db.run('ROLLBACK;');
        timeline.push('ROLLBACK; -- Transaction aborted');
        return {
          ok: false,
          code: 'FULFIL_REQ_FAILED',
          message: err?.message || String(err),
          result: { timeline }
        };
      }
    }

    default:
      return { ok: false, code: 'UNKNOWN_PROCEDURE', message: `Procedure '${name}' not registered.` };
  }
}

// Generate 50,000 synthetic rows into sandbox for the Index & Optimizer Lab (E4)
function populateLargeBenchSandbox(db: Database) {
  // Create tables WITHOUT secondary indexes
  db.run(`
    CREATE TABLE IF NOT EXISTS BENCH_SUPPLIES (
      PurchaseID INTEGER PRIMARY KEY,
      ItemID TEXT,
      SupplierID TEXT,
      PurchaseDate TEXT,
      Quantity INTEGER,
      Cost REAL
    );
    CREATE TABLE IF NOT EXISTS BENCH_ISSUED_TO (
      IssueID INTEGER PRIMARY KEY,
      ItemID TEXT,
      DeptID TEXT,
      IssueDate TEXT,
      Quantity INTEGER
    );
  `);

  // Fast recursive CTE bulk insert for 50,000 transactions
  db.run(`
    WITH RECURSIVE cnt(x) AS (
      SELECT 1
      UNION ALL
      SELECT x + 1 FROM cnt WHERE x < 50000
    )
    INSERT INTO BENCH_ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity)
    SELECT 
      x,
      'I' || (101 + (x % 46)),
      'D' || substr('0' || (1 + (x % 11)), -2, 2),
      date('now', '-' || (x % 365) || ' days'),
      1 + (x % 20)
    FROM cnt;
  `);
}

// Global Message Handler
if (typeof self !== 'undefined' && typeof (self as any).postMessage === 'function') {
  self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
    const req = e.data;
    if (!req || !req.id) return;

    try {
      const sqlInstance = await getSql();

      switch (req.action) {
        case 'init': {
          const initialBytes: Uint8Array | undefined = req.payload?.bytes;
          mainDb = initializeCleanDatabase(sqlInstance, initialBytes);
          const intro = runIntrospection(mainDb);
          const res: WorkerResponse = { id: req.id, ok: true, data: intro };
          self.postMessage(res);
          break;
        }

        case 'exec': {
          if (!mainDb) throw new Error('Database not initialized');
          const { sql, params } = req.payload || {};
          const qRes = executeSingleSql(mainDb, sql, params);
          self.postMessage({ id: req.id, ok: true, data: qRes });
          break;
        }

        case 'batch': {
          if (!mainDb) throw new Error('Database not initialized');
          const { statements, atomic } = req.payload || {};
          const bRes = executeBatchSql(mainDb, statements || [], atomic !== false);
          self.postMessage({ id: req.id, ok: true, data: bRes });
          break;
        }

        case 'explain': {
          if (!mainDb) throw new Error('Database not initialized');
          const { sql } = req.payload || {};
          const planRes = executeSingleSql(mainDb, `EXPLAIN QUERY PLAN ${sql}`);
          self.postMessage({ id: req.id, ok: true, data: planRes });
          break;
        }

        case 'exportDb': {
          if (!mainDb) throw new Error('Database not initialized');
          const bytes = mainDb.export();
          // CRITICAL A3: export() closes and reopens DB and resets pragmas!
          configureDb(mainDb);
          self.postMessage({ id: req.id, ok: true, data: bytes });
          break;
        }

        case 'importDb': {
          const { bytes } = req.payload || {};
          if (!bytes || !(bytes instanceof Uint8Array)) throw new Error('No valid bytes provided for import');

          // Validate SQLite magic header: "SQLite format 3\0"
          const expectedHeader = [83, 113, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0];
          if (bytes.length < 16) {
            throw new Error('Import rejected: File size too small to be a valid SQLite database.');
          }
          for (let i = 0; i < expectedHeader.length; i++) {
            if (bytes[i] !== expectedHeader[i]) {
              throw new Error('Import rejected: Invalid SQLite database file header (expected "SQLite format 3\\0").');
            }
          }

          let candidateDb: Database | null = null;
          try {
            candidateDb = new sqlInstance.Database(bytes);
            candidateDb.run('PRAGMA foreign_keys = ON;');
            const verRes = candidateDb.exec('PRAGMA user_version;');
            const userVer = Number(verRes[0]?.values[0]?.[0] || 0);
            if (userVer < 3) {
              migrateDatabase(candidateDb);
            }
            validateDatabase(candidateDb);
          } catch (validationErr: any) {
            if (candidateDb) {
              try { candidateDb.close(); } catch {}
            }
            throw new Error(`Import rejected - validation failed: ${validationErr?.message || String(validationErr)}`);
          }

          // On successful validation only, close old mainDb and swap
          if (mainDb) {
            try { mainDb.close(); } catch {}
          }
          mainDb = candidateDb;
          const intro = runIntrospection(mainDb);
          self.postMessage({ id: req.id, ok: true, data: intro });
          break;
        }

        case 'resetToSeed': {
          let newDb: Database | null = null;
          try {
            newDb = buildFreshDatabase(sqlInstance);
          } catch (seedErr: any) {
            if (newDb) {
              try { newDb.close(); } catch {}
            }
            throw seedErr;
          }

          if (mainDb) {
            try { mainDb.close(); } catch {}
          }
          mainDb = newDb;
          const intro = runIntrospection(mainDb);
          self.postMessage({ id: req.id, ok: true, data: intro });
          break;
        }

        case 'introspect': {
          if (!mainDb) throw new Error('Database not initialized');
          const intro = runIntrospection(mainDb);
          self.postMessage({ id: req.id, ok: true, data: intro });
          break;
        }

        case 'createSandbox': {
          if (!mainDb) throw new Error('Database not initialized');
          const sId = `sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          // Clone main DB bytes for disposable experimentation
          const bytes = mainDb.export();
          configureDb(mainDb);
          const sDb = new sqlInstance.Database(bytes);
          configureDb(sDb);
          sandboxes.set(sId, sDb);
          self.postMessage({ id: req.id, ok: true, data: { sandboxId: sId } });
          break;
        }

        case 'dropSandbox': {
          const sId = req.sandboxId || req.payload?.sandboxId;
          if (sId && sandboxes.has(sId)) {
            const sDb = sandboxes.get(sId)!;
            sDb.close();
            sandboxes.delete(sId);
          }
          self.postMessage({ id: req.id, ok: true, data: { ok: true } });
          break;
        }

        case 'execSandbox': {
          const sId = req.sandboxId || req.payload?.sandboxId;
          const sDb = sId ? sandboxes.get(sId) : null;
          if (!sDb) throw new Error(`Sandbox '${sId}' does not exist`);
          const { sql, params } = req.payload || {};
          const qRes = executeSingleSql(sDb, sql, params);
          self.postMessage({ id: req.id, ok: true, data: qRes });
          break;
        }

        case 'seedLargeBench': {
          const sId = `bench_${Date.now()}`;
          const bDb = new sqlInstance.Database();
          configureDb(bDb);
          populateLargeBenchSandbox(bDb);
          sandboxes.set(sId, bDb);
          self.postMessage({ id: req.id, ok: true, data: { sandboxId: sId } });
          break;
        }

        case 'callProcedure': {
          if (!mainDb) throw new Error('Database not initialized');
          const { name, args } = req.payload || {};
          const pRes = runStoredProcedure(mainDb, name, args || {});
          self.postMessage({ id: req.id, ok: pRes.ok, data: pRes.result, code: pRes.code, error: pRes.message });
          break;
        }

        default:
          self.postMessage({ id: req.id, ok: false, error: `Unknown worker action: ${req.action}` });
      }
    } catch (err: any) {
      self.postMessage({
        id: req.id,
        ok: false,
        error: err?.message || String(err),
        code: err?.code || 'SQLITE_ERROR'
      });
    }
  };
}

export {
  validateDatabase,
  migrateDatabase,
  buildFreshDatabase,
  initializeCleanDatabase,
  configureDb,
  getSql
};
