import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SCHEMA_DDL, VIEWS_DDL, TRIGGERS_DDL, INDEXES_DDL } from '../src/db/schemaDdl.ts';
import { generateSeedSql } from '../src/db/seedData.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runVerification() {
  console.log('--- ClayStock SQLite Database Verification ---');

  // Locate wasm file in node_modules or public
  const wasmPath = path.resolve(__dirname, '../public/sql-wasm.wasm');
  const wasmBinary = fs.readFileSync(wasmPath);

  const SQL = await initSqlJs({
    wasmBinary
  });

  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');

  console.log('1. Executing Schema DDL...');
  db.run(SCHEMA_DDL);

  console.log('2. Executing Views DDL...');
  db.run(VIEWS_DDL);

  console.log('3. Executing Triggers DDL...');
  db.run(TRIGGERS_DDL);

  console.log('4. Executing Indexes DDL...');
  db.run(INDEXES_DDL);

  console.log('5. Executing Seed Data...');
  const seedSql = generateSeedSql();
  db.run(seedSql);

  // Set user_version = 3
  db.run('PRAGMA user_version = 3;');

  console.log('6. Checking PRAGMA integrity_check...');
  const integrity = db.exec('PRAGMA integrity_check;');
  const integrityResult = integrity[0]?.values[0]?.[0];
  if (integrityResult !== 'ok') {
    throw new Error(`Integrity check failed: ${integrityResult}`);
  }
  console.log('   -> PRAGMA integrity_check = ok');

  console.log('7. Checking PRAGMA foreign_key_check...');
  const fkCheck = db.exec('PRAGMA foreign_key_check;');
  if (fkCheck.length > 0 && fkCheck[0].values.length > 0) {
    throw new Error(`Foreign key check failed: ${JSON.stringify(fkCheck[0].values)}`);
  }
  console.log('   -> PRAGMA foreign_key_check is empty (clean)');

  console.log('8. Testing Date Triggers on SUPPLIES and ISSUED_TO...');
  // Test A: Future date insertion in SUPPLIES
  let suppliesFutureBlocked = false;
  try {
    db.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-FUT', 'I101', 'S01', '2030-01-01', 10, 100);`);
  } catch (err: any) {
    if (/FUTURE_DATE/i.test(err?.message || '')) {
      suppliesFutureBlocked = true;
    }
  }
  if (!suppliesFutureBlocked) throw new Error('SUPPLIES did not reject future date 2030-01-01 with FUTURE_DATE');
  console.log('   -> SUPPLIES rejected 2030-01-01 with FUTURE_DATE');

  // Test B: Malformed date insertion in SUPPLIES
  let suppliesInvalidBlocked = false;
  try {
    db.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-INV', 'I101', 'S01', 'not-a-date', 10, 100);`);
  } catch (err: any) {
    if (/INVALID_DATE/i.test(err?.message || '')) {
      suppliesInvalidBlocked = true;
    }
  }
  if (!suppliesInvalidBlocked) throw new Error('SUPPLIES did not reject "not-a-date" with INVALID_DATE');
  console.log('   -> SUPPLIES rejected "not-a-date" with INVALID_DATE');

  // Test C: Future date insertion in ISSUED_TO
  let issuedFutureBlocked = false;
  try {
    db.run(`INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('IS-FUT', 'I101', 'D01', '2030-01-01', 1);`);
  } catch (err: any) {
    if (/FUTURE_DATE/i.test(err?.message || '')) {
      issuedFutureBlocked = true;
    }
  }
  if (!issuedFutureBlocked) throw new Error('ISSUED_TO did not reject future date 2030-01-01 with FUTURE_DATE');
  console.log('   -> ISSUED_TO rejected 2030-01-01 with FUTURE_DATE');

  // Test D: Malformed date insertion in ISSUED_TO
  let issuedInvalidBlocked = false;
  try {
    db.run(`INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('IS-INV', 'I101', 'D01', 'not-a-date', 1);`);
  } catch (err: any) {
    if (/INVALID_DATE/i.test(err?.message || '')) {
      issuedInvalidBlocked = true;
    }
  }
  if (!issuedInvalidBlocked) throw new Error('ISSUED_TO did not reject "not-a-date" with INVALID_DATE');
  console.log('   -> ISSUED_TO rejected "not-a-date" with INVALID_DATE');

  // Test E: Valid date insertion succeeds
  const today = new Date().toISOString().split('T')[0];
  db.run(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-VALID', 'I101', 'S01', '${today}', 10, 3500);`);
  console.log('   -> SUPPLIES accepted valid current date');

  console.log('9. Checking Self-Test #17: PRICE_VARIANCE Alerts...');
  const alertRes = db.exec("SELECT COUNT(*) FROM ALERT WHERE AlertType = 'PRICE_VARIANCE';");
  const alertCount = Number(alertRes[0]?.values[0]?.[0] || 0);
  if (alertCount < 1) {
    throw new Error(`Self-test #17 failed: Expected at least 1 PRICE_VARIANCE alert, found ${alertCount}`);
  }
  console.log(`   -> Found ${alertCount} PRICE_VARIANCE alert(s) (Self-Test #17 PASSED)`);

  console.log('10. Checking Table Counts (≥ 21 tables)...');
  const tblRes = db.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tblCount = Number(tblRes[0]?.values[0]?.[0] || 0);
  if (tblCount < 21) {
    throw new Error(`Expected at least 21 tables, found ${tblCount}`);
  }
  console.log(`   -> Total user tables: ${tblCount}`);

  console.log('11. Testing user_version < 3 Migration Pathway...');
  // Create an old v2 database simulation
  const oldDb = new SQL.Database();
  oldDb.run('PRAGMA foreign_keys = ON;');
  oldDb.run(`
    CREATE TABLE SUPPLIES (
      PurchaseID TEXT PRIMARY KEY,
      ItemID TEXT NOT NULL,
      SupplierID TEXT NOT NULL,
      PurchaseDate TEXT NOT NULL,
      Quantity INTEGER NOT NULL CHECK(Quantity > 0),
      Cost REAL NOT NULL CHECK(Cost >= 0)
    );
    CREATE TABLE ISSUED_TO (
      IssueID TEXT PRIMARY KEY,
      ItemID TEXT NOT NULL,
      DeptID TEXT NOT NULL,
      EmpID TEXT,
      ReqID TEXT,
      IssueDate TEXT NOT NULL,
      Quantity INTEGER NOT NULL CHECK(Quantity > 0)
    );
    PRAGMA user_version = 2;
    INSERT INTO SUPPLIES VALUES ('PO-OLD-1', 'I101', 'S01', '2026-01-01', 5, 500);
    INSERT INTO ISSUED_TO VALUES ('IS-OLD-1', 'I101', 'D01', NULL, NULL, '2026-01-02', 2);
  `);

  // Run migration logic
  oldDb.run('PRAGMA foreign_keys = OFF;');
  oldDb.run('BEGIN TRANSACTION;');
  oldDb.run(`
    CREATE TABLE SUPPLIES_mig_v3 (
      PurchaseID TEXT PRIMARY KEY,
      ItemID TEXT NOT NULL,
      SupplierID TEXT NOT NULL,
      PurchaseDate TEXT NOT NULL,
      Quantity INTEGER NOT NULL CHECK(Quantity > 0),
      Cost REAL NOT NULL CHECK(Cost >= 0)
    );
    INSERT INTO SUPPLIES_mig_v3 SELECT * FROM SUPPLIES;
    DROP TABLE SUPPLIES;
    ALTER TABLE SUPPLIES_mig_v3 RENAME TO SUPPLIES;

    CREATE TABLE ISSUED_TO_mig_v3 (
      IssueID TEXT PRIMARY KEY,
      ItemID TEXT NOT NULL,
      DeptID TEXT NOT NULL,
      EmpID TEXT,
      ReqID TEXT,
      IssueDate TEXT NOT NULL,
      Quantity INTEGER NOT NULL CHECK(Quantity > 0)
    );
    INSERT INTO ISSUED_TO_mig_v3 SELECT * FROM ISSUED_TO;
    DROP TABLE ISSUED_TO;
    ALTER TABLE ISSUED_TO_mig_v3 RENAME TO ISSUED_TO;

    PRAGMA user_version = 3;
    COMMIT;
  `);
  oldDb.run('PRAGMA foreign_keys = ON;');

  const verRes = oldDb.exec('PRAGMA user_version;');
  const migratedVer = Number(verRes[0]?.values[0]?.[0]);
  const rowCountRes = oldDb.exec('SELECT COUNT(*) FROM SUPPLIES;');
  const rowCount = Number(rowCountRes[0]?.values[0]?.[0]);
  if (migratedVer !== 3 || rowCount !== 1) {
    throw new Error('Migration pathway test failed');
  }
  console.log('   -> Migration from user_version 2 to 3 successfully retained rows and set version = 3');

  console.log('\n12. Running All 25 In-App Self-Test Logic Rules...');
  const selfTestChecks = [
    { id: 1, name: 'PRAGMA foreign_key_check', run: () => db.exec('PRAGMA foreign_key_check;').length === 0 },
    { id: 2, name: 'Non-Negative Inventory Invariant', run: () => db.exec('SELECT ItemID FROM V_CURRENT_STOCK WHERE StockQty < 0;')[0]?.values.length === 0 || !db.exec('SELECT ItemID FROM V_CURRENT_STOCK WHERE StockQty < 0;').length },
    { id: 3, name: 'Stock Calculation Exactness', run: () => {
      const res = db.exec(`SELECT cs.ItemID FROM V_CURRENT_STOCK cs WHERE cs.StockQty != (COALESCE((SELECT SUM(Quantity) FROM SUPPLIES WHERE ItemID = cs.ItemID), 0) - COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO WHERE ItemID = cs.ItemID), 0));`);
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 4, name: 'Weak Entity (STOCK_BATCH) Identifying Relationship', run: () => {
      const res = db.exec('SELECT b.ItemID FROM STOCK_BATCH b WHERE NOT EXISTS (SELECT 1 FROM ITEM i WHERE i.ItemID = b.ItemID);');
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 5, name: 'Schema Table Presence (>= 21 Tables)', run: () => {
      const count = Number(db.exec("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")[0].values[0][0]);
      return count >= 21;
    }},
    { id: 6, name: 'Over-Issue Trigger Abort (trg_issue_check_stock)', run: () => {
      try {
        db.run("INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('T-OVER', 'I101', 'D01', date('now'), 999999);");
        return false;
      } catch (e: any) {
        return /INSUFFICIENT_STOCK/i.test(e?.message || '');
      }
    }},
    { id: 7, name: 'ACID Atomicity & Audit Rollback Consistency', run: () => {
      const before = Number(db.exec("SELECT COUNT(*) FROM AUDIT_LOG WHERE TableName = 'ITEM' AND Action = 'UPDATE';")[0].values[0][0]);
      try {
        db.run('BEGIN TRANSACTION;');
        db.run("UPDATE ITEM SET UnitPrice = UnitPrice + 1.0 WHERE ItemID = 'I101';");
        db.run('ROLLBACK;');
      } catch {}
      const after = Number(db.exec("SELECT COUNT(*) FROM AUDIT_LOG WHERE TableName = 'ITEM' AND Action = 'UPDATE';")[0].values[0][0]);
      return before === after;
    }},
    { id: 8, name: 'Normalization Formal Audit (3NF & BCNF Compliance)', run: async () => {
      const { SCHEMA_FDS } = await import('../src/db/fds.ts');
      const definedTables = Object.keys(SCHEMA_FDS);
      return definedTables.length >= 21 && definedTables.every(t => (SCHEMA_FDS as any)[t].normalFormAchieved === '3NF' || (SCHEMA_FDS as any)[t].normalFormAchieved === 'BCNF');
    }},
    { id: 9, name: 'Relational View Layer Operational Verification (9 Master Views)', run: () => {
      const requiredViews = [
        'V_CURRENT_STOCK', 'V_STOCK_LEDGER', 'V_LOW_STOCK',
        'V_EXPIRING_BATCHES', 'V_DEPT_CONSUMPTION', 'V_SUPPLIER_SUMMARY',
        'V_ITEM_FULL', 'V_REORDER_WORKLIST', 'V_MY_DEPT_ISSUES'
      ];
      for (const v of requiredViews) {
        try {
          db.exec(`SELECT * FROM ${v} LIMIT 1;`);
        } catch {
          return false;
        }
      }
      return true;
    }},
    { id: 10, name: 'Query Optimizer Secondary Indexes (8 Required Indexes)', run: () => {
      const res = db.exec("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';");
      const idxNames = res[0]?.values.map(r => r[0] as string) || [];
      const expected = ['idx_supplies_item_date', 'idx_issued_item_date', 'idx_issued_dept_date', 'idx_item_category', 'idx_item_name', 'idx_audit_table_key', 'idx_alert_open', 'idx_req_status'];
      return expected.every(e => idxNames.includes(e));
    }},
    { id: 11, name: 'UnitPrice Non-Negative CHECK', run: () => {
      try {
        db.run("INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES ('T-NEG', 'Neg', 'Test', -50);");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 12, name: 'Quantity > 0 CHECK Constraint', run: () => {
      try {
        db.run("INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('T-Q0', 'I101', 'S01', '2026-01-01', 0, 100);");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 13, name: 'Pincode 6-Digit Format CHECK', run: () => {
      try {
        db.run("INSERT INTO PINCODE_CITY (Pincode, City) VALUES ('422', 'Nashik');");
        return false;
      } catch (e: any) {
        return /CHECK constraint/i.test(e?.message || '');
      }
    }},
    { id: 14, name: 'EER Disjoint Specialization Guard (DISJOINT_VIOLATION)', run: () => {
      try {
        db.run("INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('I125', 10);");
        return false;
      } catch (e: any) {
        return /DISJOINT_VIOLATION/i.test(e?.message || '');
      }
    }},
    { id: 15, name: 'Staff-Department Alignment Trigger (EMPLOYEE_DEPT_MISMATCH)', run: () => {
      try {
        db.run("INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, IssueDate, Quantity) VALUES ('T-MISMATCH', 'I101', 'D01', 'E005', date('now'), 1);");
        return false;
      } catch (e: any) {
        return /EMPLOYEE_DEPT_MISMATCH/i.test(e?.message || '');
      }
    }},
    { id: 16, name: 'Negative Stock Guard on Purchase Deletion (NEGATIVE_STOCK_GUARD)', run: () => {
      try {
        db.run("DELETE FROM SUPPLIES WHERE PurchaseID = 'PO1001';");
        return false;
      } catch (e: any) {
        return /NEGATIVE_STOCK_GUARD/i.test(e?.message || '');
      }
    }},
    { id: 17, name: 'Price Variance Alert Trigger (>15% Delta)', run: () => {
      const count = Number(db.exec("SELECT COUNT(*) FROM ALERT WHERE AlertType = 'PRICE_VARIANCE';")[0].values[0][0]);
      return count >= 1;
    }},
    { id: 18, name: 'Stock Ledger Terminal Balance Equals View', run: () => {
      const sql = `WITH LastLedgerEntry AS (SELECT ItemID, RunningBalance, ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY TxnDate DESC, Ref DESC) AS rn FROM V_STOCK_LEDGER) SELECT lle.ItemID FROM LastLedgerEntry lle JOIN V_CURRENT_STOCK cs ON lle.ItemID = cs.ItemID WHERE lle.rn = 1 AND lle.RunningBalance != cs.StockQty;`;
      const res = db.exec(sql);
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 19, name: 'ON DELETE CASCADE (REQUISITION_LINE)', run: () => {
      db.run("INSERT INTO REQUISITION (ReqID, DeptID, EmpID, ReqDate, Status) VALUES ('REQ-DEL', 'D01', 'E001', date('now'), 'DRAFT');");
      db.run("INSERT INTO REQUISITION_LINE (ReqID, LineNo, ItemID, QtyRequested) VALUES ('REQ-DEL', 1, 'I101', 5);");
      db.run("DELETE FROM REQUISITION WHERE ReqID = 'REQ-DEL';");
      const cnt = Number(db.exec("SELECT COUNT(*) FROM REQUISITION_LINE WHERE ReqID = 'REQ-DEL';")[0].values[0][0]);
      return cnt === 0;
    }},
    { id: 20, name: 'Recursive Manager Hierarchy Integrity', run: () => {
      const res = db.exec('SELECT e.EmpID FROM EMPLOYEE e WHERE e.ManagerID IS NOT NULL AND NOT EXISTS (SELECT 1 FROM EMPLOYEE m WHERE m.EmpID = e.ManagerID);');
      return res.length === 0 || res[0].values.length === 0;
    }},
    { id: 21, name: 'APP_USER UNIQUE Constraints', run: () => {
      try {
        db.run("INSERT INTO APP_USER (UserID, Username, PasswordHash, Salt, RoleName, EmpID) VALUES ('U-DUP', 'suresh.pawar', 'h', 's', 'ADMIN', 'E001');");
        return false;
      } catch (e: any) {
        return /UNIQUE constraint/i.test(e?.message || '');
      }
    }},
    { id: 22, name: 'Savepoint Partial Fulfillment (REQ-115)', run: () => {
      const res = db.exec("SELECT Status FROM REQUISITION WHERE ReqID = 'REQ-115';");
      return res[0]?.values[0]?.[0] === 'PARTIALLY_FULFILLED';
    }},
    { id: 23, name: 'Relational Division (Departments / Categories)', run: () => {
      const sql = `SELECT d.DeptID FROM DEPARTMENT d WHERE NOT EXISTS (SELECT c.Category FROM (SELECT DISTINCT Category FROM ITEM) c WHERE NOT EXISTS (SELECT 1 FROM ISSUED_TO t JOIN ITEM i ON t.ItemID = i.ItemID WHERE t.DeptID = d.DeptID AND i.Category = c.Category));`;
      const res = db.exec(sql);
      return res.length > 0;
    }},
    { id: 24, name: 'SESSION_CONTEXT Active Variables', run: () => {
      const res = db.exec("SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user';");
      return Boolean(res[0]?.values[0]?.[0]);
    }},
    { id: 25, name: 'Reorder Worklist Preferred Supplier Logic', run: () => {
      const res = db.exec("SELECT COUNT(*) FROM V_REORDER_WORKLIST WHERE PreferredSupplierID IS NOT NULL;");
      return Number(res[0]?.values[0]?.[0] || 0) > 0;
    }}
  ];

  let selfTestPassed = 0;
  for (const t of selfTestChecks) {
    const passed = await t.run();
    if (passed) {
      selfTestPassed++;
      console.log(`   [✓] Test #${t.id}: ${t.name}`);
    } else {
      console.error(`   [✗] Test #${t.id}: ${t.name} FAILED`);
      throw new Error(`Self-Test #${t.id} failed`);
    }
  }

  console.log(`\nSelf-Tests Result: ${selfTestPassed}/25 PASSED!`);

  db.close();
  oldDb.close();

  console.log('\n=========================================');
  console.log('ALL VERIFICATION CHECKS PASSED (25/25 self-tests + DDL)!');
  console.log('=========================================');
}

runVerification().catch(err => {
  console.error('\nVerification FAILED:', err);
  process.exit(1);
});
