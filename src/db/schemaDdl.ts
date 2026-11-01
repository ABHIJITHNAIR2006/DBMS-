/**
 * Schema DDL, Views, Triggers, and Indexes for ClayStock 21-Table Relational Schema
 * Engine: SQLite 3 (via sql.js in Web Worker)
 */

export const SCHEMA_DDL = `
-- ========================================================
-- PRAGMAS & CONFIGURATION
-- ========================================================
PRAGMA foreign_keys = ON;

-- ========================================================
-- CORE 10 TABLES (3NF / BCNF)
-- ========================================================

CREATE TABLE IF NOT EXISTS PINCODE_CITY (
    Pincode TEXT PRIMARY KEY CHECK(length(Pincode) = 6),
    City TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS SUPPLIER (
    SupplierID TEXT PRIMARY KEY,
    SupplierName TEXT NOT NULL,
    Street TEXT NOT NULL,
    Pincode TEXT NOT NULL,
    FOREIGN KEY (Pincode) REFERENCES PINCODE_CITY(Pincode) ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS SUPPLIER_CONTACT (
    SupplierID TEXT NOT NULL,
    ContactNo TEXT NOT NULL CHECK(length(ContactNo) >= 8),
    PRIMARY KEY (SupplierID, ContactNo),
    FOREIGN KEY (SupplierID) REFERENCES SUPPLIER(SupplierID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DEPARTMENT (
    DeptID TEXT PRIMARY KEY,
    DeptName TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ITEM (
    ItemID TEXT PRIMARY KEY,
    ItemName TEXT NOT NULL,
    Category TEXT NOT NULL,
    UnitPrice REAL NOT NULL CHECK(UnitPrice >= 0)
);

CREATE TABLE IF NOT EXISTS CONSUMABLE_ITEM (
    ItemID TEXT PRIMARY KEY,
    ReorderLevel INTEGER NOT NULL CHECK(ReorderLevel >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS DURABLE_ITEM (
    ItemID TEXT PRIMARY KEY,
    WarrantyPeriod INTEGER NOT NULL CHECK(WarrantyPeriod >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS STOCK_BATCH (
    ItemID TEXT NOT NULL,
    BatchNo TEXT NOT NULL,
    ExpiryDate TEXT NOT NULL,
    PRIMARY KEY (ItemID, BatchNo),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS SUPPLIES (
    PurchaseID TEXT PRIMARY KEY,
    ItemID TEXT NOT NULL,
    SupplierID TEXT NOT NULL,
    PurchaseDate TEXT NOT NULL,
    Quantity INTEGER NOT NULL CHECK(Quantity > 0),
    Cost REAL NOT NULL CHECK(Cost >= 0),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (SupplierID) REFERENCES SUPPLIER(SupplierID) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- ========================================================
-- EXTENSION TABLES (11 TABLES)
-- ========================================================

CREATE TABLE IF NOT EXISTS EMPLOYEE (
    EmpID TEXT PRIMARY KEY,
    EmpName TEXT NOT NULL,
    Designation TEXT NOT NULL,
    DeptID TEXT NOT NULL,
    ManagerID TEXT,
    Email TEXT UNIQUE,
    Phone TEXT,
    FOREIGN KEY (DeptID) REFERENCES DEPARTMENT(DeptID) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (ManagerID) REFERENCES EMPLOYEE(EmpID) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ROLE (
    RoleName TEXT PRIMARY KEY,
    Description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS PERMISSION (
    RoleName TEXT NOT NULL,
    Resource TEXT NOT NULL,
    Action TEXT NOT NULL CHECK(Action IN ('READ','CREATE','UPDATE','DELETE','APPROVE','FULFIL','EXPORT')),
    PRIMARY KEY (RoleName, Resource, Action),
    FOREIGN KEY (RoleName) REFERENCES ROLE(RoleName) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS APP_USER (
    UserID TEXT PRIMARY KEY,
    Username TEXT UNIQUE NOT NULL,
    PasswordHash TEXT NOT NULL,
    Salt TEXT NOT NULL,
    RoleName TEXT NOT NULL,
    EmpID TEXT UNIQUE,
    FOREIGN KEY (RoleName) REFERENCES ROLE(RoleName) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (EmpID) REFERENCES EMPLOYEE(EmpID) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS REQUISITION (
    ReqID TEXT PRIMARY KEY,
    DeptID TEXT NOT NULL,
    EmpID TEXT NOT NULL,
    ReqDate TEXT NOT NULL,
    Status TEXT NOT NULL CHECK(Status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','PARTIALLY_FULFILLED','FULFILLED')),
    ApprovedBy TEXT,
    Remarks TEXT,
    FOREIGN KEY (DeptID) REFERENCES DEPARTMENT(DeptID) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (EmpID) REFERENCES EMPLOYEE(EmpID) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (ApprovedBy) REFERENCES APP_USER(UserID) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS REQUISITION_LINE (
    ReqID TEXT NOT NULL,
    LineNo INTEGER NOT NULL,
    ItemID TEXT NOT NULL,
    QtyRequested INTEGER NOT NULL CHECK(QtyRequested > 0),
    QtyApproved INTEGER CHECK(QtyApproved IS NULL OR QtyApproved >= 0),
    PRIMARY KEY (ReqID, LineNo),
    FOREIGN KEY (ReqID) REFERENCES REQUISITION(ReqID) ON UPDATE CASCADE ON DELETE CASCADE,
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- Core table ISSUED_TO with EmpID and ReqID foreign keys
CREATE TABLE IF NOT EXISTS ISSUED_TO (
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

CREATE TABLE IF NOT EXISTS AUDIT_LOG (
    AuditID INTEGER PRIMARY KEY AUTOINCREMENT,
    TableName TEXT NOT NULL,
    RecordKey TEXT NOT NULL,
    Action TEXT NOT NULL CHECK(Action IN ('INSERT','UPDATE','DELETE')),
    OldValues TEXT,
    NewValues TEXT,
    ChangedBy TEXT,
    ChangedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ALERT (
    AlertID TEXT PRIMARY KEY,
    ItemID TEXT NOT NULL,
    AlertType TEXT NOT NULL CHECK(AlertType IN ('LOW_STOCK','OUT_OF_STOCK','EXPIRING','PRICE_VARIANCE')),
    Message TEXT NOT NULL,
    CreatedAt TEXT NOT NULL,
    ResolvedAt TEXT,
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PRICE_HISTORY (
    ItemID TEXT NOT NULL,
    ChangedAt TEXT NOT NULL,
    OldPrice REAL NOT NULL,
    NewPrice REAL NOT NULL,
    ChangedBy TEXT,
    PRIMARY KEY (ItemID, ChangedAt),
    FOREIGN KEY (ItemID) REFERENCES ITEM(ItemID) ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PROCEDURE_REGISTRY (
    ProcName TEXT PRIMARY KEY,
    ParamsJson TEXT NOT NULL,
    BodySql TEXT NOT NULL,
    Description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS SESSION_CONTEXT (
    Key TEXT PRIMARY KEY,
    Value TEXT
);
`;

export const VIEWS_DDL = `
-- ========================================================
-- VIEWS (DERIVED VALUES, ANALYTICS & SECURITY LAYERS)
-- ========================================================

-- 1. V_CURRENT_STOCK: Pure Derived Stock with Zero Stored Columns
CREATE VIEW IF NOT EXISTS V_CURRENT_STOCK AS
SELECT 
    i.ItemID,
    i.ItemName,
    i.Category,
    i.UnitPrice,
    COALESCE((SELECT SUM(Quantity) FROM SUPPLIES s WHERE s.ItemID = i.ItemID), 0) AS TotalPurchased,
    COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO t WHERE t.ItemID = i.ItemID), 0) AS TotalIssued,
    COALESCE((SELECT SUM(Quantity) FROM SUPPLIES s WHERE s.ItemID = i.ItemID), 0) 
    - COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO t WHERE t.ItemID = i.ItemID), 0) AS StockQty,
    c.ReorderLevel,
    d.WarrantyPeriod,
    CASE WHEN c.ItemID IS NOT NULL THEN 'Consumable' ELSE 'Durable' END AS ItemType,
    CASE 
        WHEN (COALESCE((SELECT SUM(Quantity) FROM SUPPLIES s WHERE s.ItemID = i.ItemID), 0) - COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO t WHERE t.ItemID = i.ItemID), 0)) <= 0 THEN 'Out of Stock'
        WHEN c.ItemID IS NOT NULL AND (COALESCE((SELECT SUM(Quantity) FROM SUPPLIES s WHERE s.ItemID = i.ItemID), 0) - COALESCE((SELECT SUM(Quantity) FROM ISSUED_TO t WHERE t.ItemID = i.ItemID), 0)) <= c.ReorderLevel THEN 'Low Stock'
        ELSE 'In Stock'
    END AS Status
FROM ITEM i
LEFT JOIN CONSUMABLE_ITEM c ON c.ItemID = i.ItemID
LEFT JOIN DURABLE_ITEM d ON d.ItemID = i.ItemID;

-- 2. V_STOCK_LEDGER: Running Balance Audit Trail using Window Functions
CREATE VIEW IF NOT EXISTS V_STOCK_LEDGER AS
WITH TxnFeed AS (
    SELECT 
        PurchaseID AS Ref,
        ItemID,
        PurchaseDate AS TxnDate,
        'PURCHASE' AS TxnType,
        Quantity AS Qty,
        Cost AS Value,
        SupplierID AS PartyID
    FROM SUPPLIES
    UNION ALL
    SELECT 
        IssueID AS Ref,
        ItemID,
        IssueDate AS TxnDate,
        'ISSUE' AS TxnType,
        -Quantity AS Qty,
        0 AS Value,
        DeptID AS PartyID
    FROM ISSUED_TO
)
SELECT 
    Ref,
    ItemID,
    TxnDate,
    TxnType,
    Qty,
    Value,
    PartyID,
    SUM(Qty) OVER (
        PARTITION BY ItemID 
        ORDER BY TxnDate ASC, TxnType DESC, Ref ASC 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS RunningBalance
FROM TxnFeed;

-- 3. V_LOW_STOCK: Consumables needing restock
CREATE VIEW IF NOT EXISTS V_LOW_STOCK AS
SELECT 
    ItemID,
    ItemName,
    Category,
    UnitPrice,
    StockQty,
    ReorderLevel,
    Status
FROM V_CURRENT_STOCK
WHERE ItemType = 'Consumable' AND StockQty <= ReorderLevel;

-- 4. V_EXPIRING_BATCHES: Batches expiring within 30 days or already expired
CREATE VIEW IF NOT EXISTS V_EXPIRING_BATCHES AS
SELECT 
    b.ItemID,
    i.ItemName,
    i.Category,
    b.BatchNo,
    b.ExpiryDate,
    CAST((julianday(b.ExpiryDate) - julianday('now')) AS INTEGER) AS DaysRemaining,
    CASE 
        WHEN date(b.ExpiryDate) < date('now') THEN 'EXPIRED'
        WHEN date(b.ExpiryDate) <= date('now', '+30 days') THEN 'EXPIRING_SOON'
        ELSE 'VALID'
    END AS ExpiryStatus
FROM STOCK_BATCH b
JOIN ITEM i ON b.ItemID = i.ItemID
WHERE date(b.ExpiryDate) <= date('now', '+30 days')
ORDER BY b.ExpiryDate ASC;

-- 5. V_DEPT_CONSUMPTION: Aggregated consumption and total value by department
CREATE VIEW IF NOT EXISTS V_DEPT_CONSUMPTION AS
SELECT 
    d.DeptID,
    d.DeptName,
    COUNT(t.IssueID) AS TotalIssueEvents,
    COALESCE(SUM(t.Quantity), 0) AS TotalQuantityIssued,
    COALESCE(SUM(t.Quantity * i.UnitPrice), 0) AS TotalIssuedValue,
    (SELECT COUNT(*) FROM EMPLOYEE e WHERE e.DeptID = d.DeptID) AS StaffCount
FROM DEPARTMENT d
LEFT JOIN ISSUED_TO t ON d.DeptID = t.DeptID
LEFT JOIN ITEM i ON t.ItemID = i.ItemID
GROUP BY d.DeptID, d.DeptName;

-- 6. V_SUPPLIER_SUMMARY: Procurement metrics and order counts
CREATE VIEW IF NOT EXISTS V_SUPPLIER_SUMMARY AS
SELECT 
    s.SupplierID,
    s.SupplierName,
    s.Street,
    s.Pincode,
    p.City,
    COUNT(sp.PurchaseID) AS TotalPurchaseOrders,
    COALESCE(SUM(sp.Quantity), 0) AS TotalUnitsSupplied,
    COALESCE(SUM(sp.Cost), 0) AS TotalSpend
FROM SUPPLIER s
JOIN PINCODE_CITY p ON s.Pincode = p.Pincode
LEFT JOIN SUPPLIES sp ON s.SupplierID = sp.SupplierID
GROUP BY s.SupplierID, s.SupplierName, s.Street, s.Pincode, p.City;

-- 7. V_ITEM_FULL: Comprehensive joined item view
CREATE VIEW IF NOT EXISTS V_ITEM_FULL AS
SELECT 
    cs.*,
    (SELECT GROUP_CONCAT(b.BatchNo || ' (exp ' || b.ExpiryDate || ')', ', ') FROM STOCK_BATCH b WHERE b.ItemID = cs.ItemID) AS BatchesSummary
FROM V_CURRENT_STOCK cs;

-- 8. V_REORDER_WORKLIST: Consumables below threshold with optimal supplier ranking
CREATE VIEW IF NOT EXISTS V_REORDER_WORKLIST AS
WITH RankedSuppliers AS (
    SELECT 
        ItemID,
        SupplierID,
        AVG(Cost * 1.0 / Quantity) AS AvgUnitCost,
        ROW_NUMBER() OVER(PARTITION BY ItemID ORDER BY AVG(Cost * 1.0 / Quantity) ASC) as RankNo
    FROM SUPPLIES
    GROUP BY ItemID, SupplierID
)
SELECT 
    cs.ItemID,
    cs.ItemName,
    cs.Category,
    cs.UnitPrice,
    cs.StockQty,
    cs.ReorderLevel,
    MAX((cs.ReorderLevel * 2) - cs.StockQty, 0) AS SuggestedReorderQty,
    rs.SupplierID AS PreferredSupplierID,
    sup.SupplierName AS PreferredSupplierName,
    ROUND(rs.AvgUnitCost, 2) AS HistoricalAvgCost
FROM V_CURRENT_STOCK cs
LEFT JOIN RankedSuppliers rs ON cs.ItemID = rs.ItemID AND rs.RankNo = 1
LEFT JOIN SUPPLIER sup ON rs.SupplierID = sup.SupplierID
WHERE cs.ItemType = 'Consumable' AND cs.StockQty <= cs.ReorderLevel;

-- 9. V_MY_DEPT_ISSUES: Row-Level Security Emulation via SESSION_CONTEXT
CREATE VIEW IF NOT EXISTS V_MY_DEPT_ISSUES AS
SELECT 
    t.IssueID,
    t.ItemID,
    i.ItemName,
    t.DeptID,
    t.EmpID,
    e.EmpName,
    t.IssueDate,
    t.Quantity
FROM ISSUED_TO t
JOIN ITEM i ON t.ItemID = i.ItemID
LEFT JOIN EMPLOYEE e ON t.EmpID = e.EmpID
WHERE t.DeptID = (SELECT Value FROM SESSION_CONTEXT WHERE Key = 'dept')
   OR (SELECT Value FROM SESSION_CONTEXT WHERE Key = 'role') IN ('ADMIN', 'STORE_KEEPER', 'AUDITOR');
`;

export const TRIGGERS_DDL = `
-- ========================================================
-- TRIGGERS (INTEGRITY, DISJOINT CHECK, ALERTS, AUDIT)
-- ========================================================

-- Date validation triggers (format check and +1 day future-date guard)
CREATE TRIGGER IF NOT EXISTS trg_supplies_date_insert
BEFORE INSERT ON SUPPLIES
BEGIN
    SELECT RAISE(ABORT, 'INVALID_DATE')
    WHERE NEW.PurchaseDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
       OR date(NEW.PurchaseDate) IS NULL;
    SELECT RAISE(ABORT, 'FUTURE_DATE')
    WHERE date(NEW.PurchaseDate) > date('now', '+1 day');
END;

CREATE TRIGGER IF NOT EXISTS trg_supplies_date_update
BEFORE UPDATE OF PurchaseDate ON SUPPLIES
BEGIN
    SELECT RAISE(ABORT, 'INVALID_DATE')
    WHERE NEW.PurchaseDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
       OR date(NEW.PurchaseDate) IS NULL;
    SELECT RAISE(ABORT, 'FUTURE_DATE')
    WHERE date(NEW.PurchaseDate) > date('now', '+1 day');
END;

CREATE TRIGGER IF NOT EXISTS trg_issued_date_insert
BEFORE INSERT ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'INVALID_DATE')
    WHERE NEW.IssueDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
       OR date(NEW.IssueDate) IS NULL;
    SELECT RAISE(ABORT, 'FUTURE_DATE')
    WHERE date(NEW.IssueDate) > date('now', '+1 day');
END;

CREATE TRIGGER IF NOT EXISTS trg_issued_date_update
BEFORE UPDATE OF IssueDate ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'INVALID_DATE')
    WHERE NEW.IssueDate NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
       OR date(NEW.IssueDate) IS NULL;
    SELECT RAISE(ABORT, 'FUTURE_DATE')
    WHERE date(NEW.IssueDate) > date('now', '+1 day');
END;

-- 1. trg_issue_check_stock: Stock-out prevention
CREATE TRIGGER IF NOT EXISTS trg_issue_check_stock
BEFORE INSERT ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK')
    WHERE NEW.Quantity > (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = NEW.ItemID);
END;

-- 2. trg_issue_emp_dept: Department mismatch guard
CREATE TRIGGER IF NOT EXISTS trg_issue_emp_dept
BEFORE INSERT ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'EMPLOYEE_DEPT_MISMATCH')
    WHERE NEW.EmpID IS NOT NULL 
      AND (SELECT DeptID FROM EMPLOYEE WHERE EmpID = NEW.EmpID) != NEW.DeptID;
END;

-- 3. trg_issue_alert: Low/Out of Stock Alert generation
CREATE TRIGGER IF NOT EXISTS trg_issue_alert
AFTER INSERT ON ISSUED_TO
BEGIN
    -- Check if item has depleted to 0 or below reorder level
    INSERT INTO ALERT (AlertID, ItemID, AlertType, Message, CreatedAt, ResolvedAt)
    SELECT 
        'ALT-' || hex(randomblob(4)),
        NEW.ItemID,
        CASE 
            WHEN (cs.StockQty) <= 0 THEN 'OUT_OF_STOCK'
            ELSE 'LOW_STOCK'
        END,
        'Stock for ' || cs.ItemName || ' is critical (' || cs.StockQty || ' units left, threshold ' || COALESCE(cs.ReorderLevel, 0) || ')',
        datetime('now'),
        NULL
    FROM V_CURRENT_STOCK cs
    WHERE cs.ItemID = NEW.ItemID 
      AND cs.ItemType = 'Consumable'
      AND cs.StockQty <= cs.ReorderLevel
      AND NOT EXISTS (
          SELECT 1 FROM ALERT a 
          WHERE a.ItemID = NEW.ItemID AND a.ResolvedAt IS NULL AND a.AlertType IN ('LOW_STOCK', 'OUT_OF_STOCK')
      );
END;

-- 4. trg_purchase_resolve_alert: Resolve open stock alerts upon replenishment
CREATE TRIGGER IF NOT EXISTS trg_purchase_resolve_alert
AFTER INSERT ON SUPPLIES
BEGIN
    UPDATE ALERT
    SET ResolvedAt = datetime('now')
    WHERE ItemID = NEW.ItemID 
      AND ResolvedAt IS NULL 
      AND AlertType IN ('LOW_STOCK', 'OUT_OF_STOCK')
      AND (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = NEW.ItemID) > (
          SELECT COALESCE(ReorderLevel, 0) FROM CONSUMABLE_ITEM WHERE ItemID = NEW.ItemID
      );
END;

-- 5. trg_supplies_delete_guard: Invariant - stock can never become negative
CREATE TRIGGER IF NOT EXISTS trg_supplies_delete_guard
BEFORE DELETE ON SUPPLIES
BEGIN
    SELECT RAISE(ABORT, 'NEGATIVE_STOCK_GUARD')
    WHERE (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = OLD.ItemID) - OLD.Quantity < 0;
END;

-- 5b. Update guard on SUPPLIES
CREATE TRIGGER IF NOT EXISTS trg_supplies_update_guard
BEFORE UPDATE OF Quantity ON SUPPLIES
BEGIN
    SELECT RAISE(ABORT, 'NEGATIVE_STOCK_GUARD')
    WHERE (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = OLD.ItemID) - OLD.Quantity + NEW.Quantity < 0;
END;

-- 6. trg_price_history: Item Unit Price Mutation Audit
CREATE TRIGGER IF NOT EXISTS trg_price_history
AFTER UPDATE OF UnitPrice ON ITEM
WHEN OLD.UnitPrice != NEW.UnitPrice
BEGIN
    INSERT INTO PRICE_HISTORY (ItemID, ChangedAt, OldPrice, NewPrice, ChangedBy)
    VALUES (
        OLD.ItemID,
        datetime('now'),
        OLD.UnitPrice,
        NEW.UnitPrice,
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM')
    );
END;

-- 7. trg_price_variance: Alert if unit purchase cost exceeds catalog price by >15%
CREATE TRIGGER IF NOT EXISTS trg_price_variance
AFTER INSERT ON SUPPLIES
WHEN (NEW.Cost * 1.0 / NEW.Quantity) > (SELECT UnitPrice * 1.15 FROM ITEM WHERE ItemID = NEW.ItemID)
BEGIN
    INSERT INTO ALERT (AlertID, ItemID, AlertType, Message, CreatedAt, ResolvedAt)
    VALUES (
        'ALT-' || hex(randomblob(4)),
        NEW.ItemID,
        'PRICE_VARIANCE',
        'Purchase PO unit cost ' || ROUND(NEW.Cost * 1.0 / NEW.Quantity, 2) || ' is >15% higher than catalog price (' || (SELECT UnitPrice FROM ITEM WHERE ItemID = NEW.ItemID) || ')',
        datetime('now'),
        NULL
    );
END;

-- 8. trg_disjoint_consumable: EER Disjoint "d" Specialization enforcement
CREATE TRIGGER IF NOT EXISTS trg_disjoint_consumable
BEFORE INSERT ON CONSUMABLE_ITEM
BEGIN
    SELECT RAISE(ABORT, 'DISJOINT_VIOLATION')
    WHERE EXISTS (SELECT 1 FROM DURABLE_ITEM WHERE ItemID = NEW.ItemID);
END;

CREATE TRIGGER IF NOT EXISTS trg_disjoint_durable
BEFORE INSERT ON DURABLE_ITEM
BEGIN
    SELECT RAISE(ABORT, 'DISJOINT_VIOLATION')
    WHERE EXISTS (SELECT 1 FROM CONSUMABLE_ITEM WHERE ItemID = NEW.ItemID);
END;

-- 9. AUDIT TRIGGERS: Write JSON diffs to AUDIT_LOG
CREATE TRIGGER IF NOT EXISTS trg_audit_item_insert
AFTER INSERT ON ITEM
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'ITEM',
        NEW.ItemID,
        'INSERT',
        NULL,
        json_object('ItemID', NEW.ItemID, 'ItemName', NEW.ItemName, 'Category', NEW.Category, 'UnitPrice', NEW.UnitPrice),
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_item_update
AFTER UPDATE ON ITEM
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'ITEM',
        NEW.ItemID,
        'UPDATE',
        json_object('ItemID', OLD.ItemID, 'ItemName', OLD.ItemName, 'Category', OLD.Category, 'UnitPrice', OLD.UnitPrice),
        json_object('ItemID', NEW.ItemID, 'ItemName', NEW.ItemName, 'Category', NEW.Category, 'UnitPrice', NEW.UnitPrice),
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_item_delete
AFTER DELETE ON ITEM
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'ITEM',
        OLD.ItemID,
        'DELETE',
        json_object('ItemID', OLD.ItemID, 'ItemName', OLD.ItemName, 'Category', OLD.Category, 'UnitPrice', OLD.UnitPrice),
        NULL,
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_supplies_insert
AFTER INSERT ON SUPPLIES
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'SUPPLIES',
        NEW.PurchaseID,
        'INSERT',
        NULL,
        json_object('PurchaseID', NEW.PurchaseID, 'ItemID', NEW.ItemID, 'SupplierID', NEW.SupplierID, 'PurchaseDate', NEW.PurchaseDate, 'Quantity', NEW.Quantity, 'Cost', NEW.Cost),
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_issued_insert
AFTER INSERT ON ISSUED_TO
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'ISSUED_TO',
        NEW.IssueID,
        'INSERT',
        NULL,
        json_object('IssueID', NEW.IssueID, 'ItemID', NEW.ItemID, 'DeptID', NEW.DeptID, 'EmpID', NEW.EmpID, 'ReqID', NEW.ReqID, 'IssueDate', NEW.IssueDate, 'Quantity', NEW.Quantity),
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_requisition_status
AFTER UPDATE OF Status ON REQUISITION
WHEN OLD.Status != NEW.Status
BEGIN
    INSERT INTO AUDIT_LOG (TableName, RecordKey, Action, OldValues, NewValues, ChangedBy, ChangedAt)
    VALUES (
        'REQUISITION',
        NEW.ReqID,
        'UPDATE',
        json_object('ReqID', OLD.ReqID, 'Status', OLD.Status),
        json_object('ReqID', NEW.ReqID, 'Status', NEW.Status, 'ApprovedBy', NEW.ApprovedBy),
        COALESCE((SELECT Value FROM SESSION_CONTEXT WHERE Key = 'user'), 'SYSTEM'),
        datetime('now')
    );
END;
`;

export const INDEXES_DDL = `
-- ========================================================
-- INDEXES & QUERY OPTIMIZER METRICS
-- ========================================================

-- Serves date-range item purchases and stock ledger joins
CREATE INDEX IF NOT EXISTS idx_supplies_item_date ON SUPPLIES(ItemID, PurchaseDate);

-- Serves consumption reports and stock ledger running balances
CREATE INDEX IF NOT EXISTS idx_issued_item_date ON ISSUED_TO(ItemID, IssueDate);

-- Serves departmental usage analytics and employee joins
CREATE INDEX IF NOT EXISTS idx_issued_dept_date ON ISSUED_TO(DeptID, IssueDate);

-- Serves category filtering on catalog browsing and valuation
CREATE INDEX IF NOT EXISTS idx_item_category ON ITEM(Category);

-- Case-insensitive item search
CREATE INDEX IF NOT EXISTS idx_item_name ON ITEM(ItemName COLLATE NOCASE);

-- Accelerates audit log history lookup by table and entity key
CREATE INDEX IF NOT EXISTS idx_audit_table_key ON AUDIT_LOG(TableName, RecordKey);

-- Partial index: fast access to open/unresolved system alerts
CREATE INDEX IF NOT EXISTS idx_alert_open ON ALERT(ItemID) WHERE ResolvedAt IS NULL;

-- Accelerates requisition kanban board and status workflows
CREATE INDEX IF NOT EXISTS idx_req_status ON REQUISITION(Status);
`;
