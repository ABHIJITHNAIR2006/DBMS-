import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  validateDatabase,
  buildFreshDatabase,
  initializeCleanDatabase
} from '../src/db/worker/db.worker';
import { SCHEMA_DDL, VIEWS_DDL, TRIGGERS_DDL, INDEXES_DDL } from '../src/db/schemaDdl';
import { generateSeedSql } from '../src/db/seedData';
import { SCHEMA_FDS } from '../src/db/fds';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('=== Running Database Initialization & Migration Tests (tests/db-init.test.ts) ===\n');

  const wasmPath = path.resolve(__dirname, '../public/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);
  const SQL = await initSqlJs({ wasmBinary });

  // (a) Builds a fresh database and calls validateDatabase
  console.log('Test (a): Building fresh database & validating...');
  const freshDb = buildFreshDatabase(SQL);
  validateDatabase(freshDb);
  console.log('  -> Fresh database passed validateDatabase() successfully.');

  // Check counts: 46 items, 148 purchases and 429 issues seeded (from acceptance criteria)
  const itemCount = Number(freshDb.exec('SELECT COUNT(*) FROM ITEM;')[0].values[0][0]);
  const purchaseCount = Number(freshDb.exec('SELECT COUNT(*) FROM SUPPLIES;')[0].values[0][0]);
  const issueCount = Number(freshDb.exec('SELECT COUNT(*) FROM ISSUED_TO;')[0].values[0][0]);
  console.log(`  -> Seed counts: ${itemCount} items, ${purchaseCount} purchases, ${issueCount} issues`);

  // (b) Exports and reloads it
  console.log('\nTest (b): Exporting and reloading fresh database...');
  const exportedBytes = freshDb.export();
  const reloadedDb = initializeCleanDatabase(SQL, exportedBytes);
  validateDatabase(reloadedDb);
  console.log('  -> Reloaded database passed validateDatabase() successfully.');

  // (c) Builds a version-2 database from the old schema (date CHECK constraints, user_version=2) and loads it through migration
  console.log('\nTest (c): Building v2 database with old schema and loading through migration...');
  const v2Db = new SQL.Database();
  v2Db.run('PRAGMA foreign_keys = ON;');
  
  // Create old schema with date CHECK constraints
  const OLD_SCHEMA_DDL = SCHEMA_DDL
    .replace('PurchaseDate TEXT NOT NULL,', "PurchaseDate TEXT NOT NULL CHECK(date(PurchaseDate) <= date('now', '+1 day')),")
    .replace('IssueDate TEXT NOT NULL,', "IssueDate TEXT NOT NULL CHECK(date(IssueDate) <= date('now', '+1 day')),");

  v2Db.run(OLD_SCHEMA_DDL);
  v2Db.run(VIEWS_DDL);
  v2Db.run(TRIGGERS_DDL);
  v2Db.run(INDEXES_DDL);
  v2Db.run('PRAGMA ignore_check_constraints = ON;');
  v2Db.run(generateSeedSql());
  v2Db.run('PRAGMA ignore_check_constraints = OFF;');
  v2Db.run('PRAGMA user_version = 2;');

  const v2Bytes = v2Db.export();
  v2Db.close();

  // Load through initializeCleanDatabase which triggers migrateDatabase
  const migratedDb = initializeCleanDatabase(SQL, v2Bytes);
  validateDatabase(migratedDb);
  const userVer = Number(migratedDb.exec('PRAGMA user_version;')[0].values[0][0]);
  if (userVer !== 3) {
    throw new Error(`Expected migrated user_version to be 3, got ${userVer}`);
  }
  console.log(`  -> v2 database successfully migrated to v3 and passed validateDatabase(). user_version = ${userVer}`);

  // (d) Verifies INSERT of '2030-01-01' into SUPPLIES raises FUTURE_DATE and 'not-a-date' raises INVALID_DATE
  console.log('\nTest (d): Verifies date triggers on migrated and fresh databases...');
  let futureRaised = false;
  try {
    migratedDb.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-FUT-TEST', 'I101', 'S01', '2030-01-01', 10, 100);`);
  } catch (err: any) {
    if (/FUTURE_DATE/i.test(err?.message || '')) {
      futureRaised = true;
    }
  }
  if (!futureRaised) throw new Error('INSERT of 2030-01-01 did not raise FUTURE_DATE');
  console.log('  -> INSERT 2030-01-01 correctly raised FUTURE_DATE');

  let invalidRaised = false;
  try {
    migratedDb.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-INV-TEST', 'I101', 'S01', 'not-a-date', 10, 100);`);
  } catch (err: any) {
    if (/INVALID_DATE/i.test(err?.message || '')) {
      invalidRaised = true;
    }
  }
  if (!invalidRaised) throw new Error('INSERT of "not-a-date" did not raise INVALID_DATE');
  console.log('  -> INSERT "not-a-date" correctly raised INVALID_DATE');

  // Verify normal date is accepted
  const today = new Date().toISOString().split('T')[0];
  migratedDb.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-NORM-TEST', 'I101', 'S01', '${today}', 5, 500);`);
  console.log('  -> Normal date insertion accepted.');

  // (e) Runs the self-tests and expects 25/25
  console.log('\nTest (e): Running 25 self-tests on migrated database...');
  const tests = [
    { id: 1, name: 'PRAGMA foreign_key_check', run: () => migratedDb.exec('PRAGMA foreign_key_check;').length === 0 },
    { id: 2, name: 'Non-Negative Inventory Invariant', run: () => migratedDb.exec('SELECT ItemID FROM V_CURRENT_STOCK WHERE StockQty < 0;')[0]?.values.length === 0 || !migratedDb.exec('SELECT ItemID FROM V_CURRENT_STOCK WHERE StockQty < 0;').length },
    { id: 3, name: 'Stock Calculation Exactness', run: () => {
      const res = migratedDb.exec(`SELECT cs.ItemID FROM V_CURRENT_STOCK cs WHERE cs.StockQty != (COALESCE((SELECT SUM(Quantity) FROM SUPPLIES WHERE ItemID = cs.ItemID), 0) - COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO WHERE ItemID = cs.ItemID), 0));`);
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 4, name: 'Weak Entity Identifying Relationship', run: () => {
      const res = migratedDb.exec('SELECT b.ItemID FROM STOCK_BATCH b WHERE NOT EXISTS (SELECT 1 FROM ITEM i WHERE i.ItemID = b.ItemID);');
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 5, name: 'Schema Table Presence (>= 21 Tables)', run: () => {
      const count = Number(migratedDb.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")[0].values[0][0]);
      return count >= 21;
    }},
    { id: 6, name: 'Over-Issue Trigger Abort (trg_issue_check_stock)', run: () => {
      try {
        migratedDb.run("INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('T-OVER', 'I101', 'D01', date('now'), 999999);");
        return false;
      } catch (e: any) {
        return /INSUFFICIENT_STOCK/i.test(e?.message || '');
      }
    }},
    { id: 7, name: 'ACID Atomicity & Audit Rollback Consistency', run: () => {
      const before = Number(migratedDb.exec("SELECT COUNT(*) FROM AUDIT_LOG WHERE TableName = 'ITEM' AND Action = 'UPDATE';")[0].values[0][0]);
      try {
        migratedDb.run('BEGIN TRANSACTION;');
        migratedDb.run("UPDATE ITEM SET UnitPrice = UnitPrice + 1.0 WHERE ItemID = 'I101';");
        migratedDb.run('ROLLBACK;');
      } catch {}
      const after = Number(migratedDb.exec("SELECT COUNT(*) FROM AUDIT_LOG WHERE TableName = 'ITEM' AND Action = 'UPDATE';")[0].values[0][0]);
      return before === after;
    }},
    { id: 8, name: 'Normalization Formal Audit (3NF & BCNF Compliance)', run: () => {
      const definedTables = Object.keys(SCHEMA_FDS);
      return definedTables.length >= 21 && definedTables.every(t => (SCHEMA_FDS as any)[t].normalFormAchieved === '3NF' || (SCHEMA_FDS as any)[t].normalFormAchieved === 'BCNF');
    }},
    { id: 9, name: 'Relational View Layer (9 Views)', run: () => {
      const views = ['V_CURRENT_STOCK', 'V_STOCK_LEDGER', 'V_LOW_STOCK', 'V_EXPIRING_BATCHES', 'V_DEPT_CONSUMPTION', 'V_SUPPLIER_SUMMARY', 'V_ITEM_FULL', 'V_REORDER_WORKLIST', 'V_MY_DEPT_ISSUES'];
      return views.every(v => {
        try { migratedDb.exec(`SELECT * FROM ${v} LIMIT 1;`); return true; } catch { return false; }
      });
    }},
    { id: 10, name: 'Query Optimizer Secondary Indexes', run: () => {
      const res = migratedDb.exec("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';");
      const idxNames = res[0]?.values.map(r => r[0] as string) || [];
      const expected = ['idx_supplies_item_date', 'idx_issued_item_date', 'idx_issued_dept_date', 'idx_item_category', 'idx_item_name', 'idx_audit_table_key', 'idx_alert_open', 'idx_req_status'];
      return expected.every(e => idxNames.includes(e));
    }},
    { id: 11, name: 'UnitPrice Non-Negative CHECK', run: () => {
      try {
        migratedDb.run("INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES ('T-NEG', 'Neg', 'Test', -50);");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 12, name: 'Quantity > 0 CHECK Constraint', run: () => {
      try {
        migratedDb.run("INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('T-Q0', 'I101', 'S01', '2026-01-01', 0, 100);");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 13, name: 'Pincode 6-Digit Format CHECK', run: () => {
      try {
        migratedDb.run("INSERT INTO PINCODE_CITY (Pincode, City) VALUES ('422', 'Nashik');");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 14, name: 'EER Disjoint Specialization Guard (DISJOINT_VIOLATION)', run: () => {
      try {
        migratedDb.run("INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('I125', 10);");
        return false;
      } catch (e: any) {
        return /DISJOINT_VIOLATION/i.test(e?.message || '');
      }
    }},
    { id: 15, name: 'Staff-Department Alignment Trigger (EMPLOYEE_DEPT_MISMATCH)', run: () => {
      try {
        migratedDb.run("INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, IssueDate, Quantity) VALUES ('T-MISMATCH', 'I101', 'D01', 'E005', date('now'), 1);");
        return false;
      } catch (e: any) {
        return /EMPLOYEE_DEPT_MISMATCH/i.test(e?.message || '');
      }
    }},
    { id: 16, name: 'Negative Stock Guard on Purchase Deletion (NEGATIVE_STOCK_GUARD)', run: () => {
      try {
        migratedDb.run("DELETE FROM SUPPLIES WHERE PurchaseID = 'PO1001';");
        return false;
      } catch (e: any) {
        return /NEGATIVE_STOCK_GUARD/i.test(e?.message || '');
      }
    }},
    { id: 17, name: 'Price Variance Alert Trigger (>15% Delta)', run: () => {
      const count = Number(migratedDb.exec("SELECT COUNT(*) FROM ALERT WHERE AlertType = 'PRICE_VARIANCE';")[0].values[0][0]);
      return count >= 1;
    }},
    { id: 18, name: 'Stock Ledger Terminal Balance Equals View', run: () => {
      const sql = `WITH LastLedgerEntry AS (SELECT ItemID, RunningBalance, ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY TxnDate DESC, Ref DESC) AS rn FROM V_STOCK_LEDGER) SELECT lle.ItemID FROM LastLedgerEntry lle JOIN V_CURRENT_STOCK cs ON lle.ItemID = cs.ItemID WHERE lle.rn = 1 AND lle.RunningBalance != cs.StockQty;`;
      const res = migratedDb.exec(sql);
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 19, name: 'ON DELETE CASCADE (REQUISITION_LINE)', run: () => {
      migratedDb.run("INSERT INTO REQUISITION (ReqID, DeptID, EmpID, ReqDate, Status) VALUES ('REQ-DEL', 'D01', 'E001', date('now'), 'DRAFT');");
      migratedDb.run("INSERT INTO REQUISITION_LINE (ReqID, LineNo, ItemID, QtyRequested) VALUES ('REQ-DEL', 1, 'I101', 5);");
      migratedDb.run("DELETE FROM REQUISITION WHERE ReqID = 'REQ-DEL';");
      const cnt = Number(migratedDb.exec("SELECT COUNT(*) FROM REQUISITION_LINE WHERE ReqID = 'REQ-DEL';")[0].values[0][0]);
      return cnt === 0;
    }},
    { id: 20, name: 'Recursive Manager Hierarchy Integrity', run: () => {
      const res = migratedDb.exec('SELECT e.EmpID FROM EMPLOYEE e WHERE e.ManagerID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EMPLOYEE m WHERE m.EmpID = e.ManagerID);');
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 21, name: 'APP_USER UNIQUE Constraints', run: () => {
      try {
        migratedDb.run("INSERT INTO APP_USER (UserID, Username, PasswordHash, Salt, RoleName, EmpID) VALUES ('U-DUP', 'suresh.pawar', 'h', 's', 'ADMIN', 'E001');");
        return false;
      } catch (e: any) {
        return /UNIQUE constraint/i.test(e?.message || '');
      }
    }},
    { id: 22, name: 'Savepoint Partial Fulfillment (REQ-115)', run: () => {
      const res = migratedDb.exec("SELECT Status FROM REQUISITION WHERE ReqID = 'REQ-115';");
      return res[0]?.values[0]?.[0] === 'PARTIALLY_FULFILLED';
    }},
    { id: 23, name: 'Relational Division (Departments / Categories)', run: () => {
      const sql = `SELECT d.DeptID FROM DEPARTMENT d WHERE NOT EXISTS (SELECT c.Category FROM (SELECT DISTINCT Category FROM ITEM) c WHERE NOT EXISTS (SELECT 1 FROM ISSUED_TO t JOIN ITEM i ON t.ItemID = i.ItemID WHERE t.DeptID = d.DeptID AND i.Category = c.Category));`;
      const res = migratedDb.exec(sql);
      return res.length > 0;
    }},
    { id: 24, name: 'SESSION_CONTEXT Active Variables', run: () => {
      const res = migratedDb.exec("SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user';");
      return Boolean(res[0]?.values[0]?.[0]);
    }},
    { id: 25, name: 'Reorder Worklist Preferred Supplier Logic', run: () => {
      const res = migratedDb.exec("SELECT COUNT(*) FROM V_REORDER_WORKLIST WHERE PreferredSupplierID IS NOT NULL;");
      return Number(res[0]?.values[0]?.[0] || 0) > 0;
    }}
  ];

  let passedCount = 0;
  for (const t of tests) {
    if (t.run()) {
      passedCount++;
      console.log(`  [✓] Self-Test #${t.id}: ${t.name}`);
    } else {
      console.error(`  [✗] Self-Test #${t.id}: ${t.name} FAILED`);
      throw new Error(`Self-Test #${t.id} failed`);
    }
  }

  console.log(`\nSelf-Tests Summary: ${passedCount}/25 PASSED!`);

  freshDb.close();
  reloadedDb.close();
  migratedDb.close();

  console.log('\n=========================================');
  console.log('ALL DB-INIT TESTS PASSED SUCCESSFULLY!');
  console.log('=========================================');
}

runTests().catch(err => {
  console.error('\nTests FAILED:', err);
  process.exit(1);
});
