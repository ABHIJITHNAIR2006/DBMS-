/**
 * 40+ Curated Queries covering the full breadth of Relational DBMS theory & SQL:
 * - Selection & Projection
 * - Joins (INNER, LEFT, CROSS, SELF-JOIN)
 * - GROUP BY, HAVING & Aggregation
 * - Subqueries (Scalar, IN, EXISTS, NOT EXISTS, Correlated)
 * - Set Operations (UNION, INTERSECT, EXCEPT)
 * - Window Functions (RANK, DENSE_RANK, ROW_NUMBER, LAG/LEAD, NTILE, Running Total)
 * - CTEs & Recursive CTEs (12-month calendar series, Manager hierarchy chain)
 * - Views & Security
 * - CASE & Temporal / Date manipulation
 * - SQLite JSON functions on AUDIT_LOG
 * - Relational Division (Double NOT EXISTS)
 */

export interface CuratedQuery {
  id: string;
  title: string;
  category: string;
  businessQuestion: string;
  sql: string;
  conceptTags: string[];
  relationalAlgebra: string;
  expectedInsight: string;
}

export const CURATED_QUERIES: CuratedQuery[] = [
  // --- 1. SELECTION & PROJECTION (3 queries) ---
  {
    id: 'Q01',
    title: 'High-Value Stationery Catalog',
    category: 'Selection & Projection',
    businessQuestion: 'Which stationery items have a unit price of ₹100 or more, and what are their categories?',
    sql: `SELECT ItemID, ItemName, Category, UnitPrice
FROM ITEM
WHERE UnitPrice >= 100.00
ORDER BY UnitPrice DESC;`,
    conceptTags: ['Selection (σ)', 'Projection (π)', 'Sorting (ORDER BY)'],
    relationalAlgebra: `π_{ItemID, ItemName, Category, UnitPrice}(σ_{UnitPrice ≥ 100}(ITEM))`,
    expectedInsight: 'Isolates capital and premium consumables (calculators, staplers, paper boxes) for targeted budget scrutiny.'
  },
  {
    id: 'Q02',
    title: 'Local Nashik Vendors Directory',
    category: 'Selection & Projection',
    businessQuestion: 'Which suppliers are situated in Nashik pincodes (pincodes starting with 422)?',
    sql: `SELECT s.SupplierID, s.SupplierName, s.Street, s.Pincode, p.City
FROM SUPPLIER s
JOIN PINCODE_CITY p ON s.Pincode = p.Pincode
WHERE s.Pincode LIKE '422%'
ORDER BY s.SupplierName ASC;`,
    conceptTags: ['Pattern Matching (LIKE)', 'Projection', 'Inner Join'],
    relationalAlgebra: `π_{SupplierID, SupplierName, Street, Pincode, City}(σ_{Pincode LIKE '422%'}(SUPPLIER ⨝ PINCODE_CITY))`,
    expectedInsight: 'Identifies local suppliers for rapid dispatch with zero inter-city transit lead times.'
  },
  {
    id: 'Q03',
    title: 'Urgent Consumables Below Reorder Threshold',
    category: 'Selection & Projection',
    businessQuestion: 'Which consumable items currently require urgent procurement due to stock at or below minimum threshold?',
    sql: `SELECT ItemID, ItemName, Category, StockQty, ReorderLevel, Status
FROM V_CURRENT_STOCK
WHERE ItemType = 'Consumable' AND StockQty <= ReorderLevel
ORDER BY StockQty ASC;`,
    conceptTags: ['View Querying', 'Selection', 'Compound Predicate (AND)'],
    relationalAlgebra: `π_{ItemID, ItemName, StockQty, ReorderLevel}(σ_{ItemType='Consumable' ∧ StockQty ≤ ReorderLevel}(V_CURRENT_STOCK))`,
    expectedInsight: 'Highlights stock-out risks to prevent teaching disruption.'
  },

  // --- 2. JOINS (6 queries: INNER, LEFT, CROSS, SELF-JOIN) ---
  {
    id: 'Q04',
    title: 'Detailed Purchase Ledger with Vendor & Address (INNER JOIN)',
    category: 'Joins',
    businessQuestion: 'Show complete procurement history linking each purchase to supplier name, street, city, and item details.',
    sql: `SELECT 
    sp.PurchaseID,
    sp.PurchaseDate,
    i.ItemName,
    i.Category,
    sp.Quantity,
    sp.Cost,
    s.SupplierName,
    pc.City
FROM SUPPLIES sp
INNER JOIN ITEM i ON sp.ItemID = i.ItemID
INNER JOIN SUPPLIER s ON sp.SupplierID = s.SupplierID
INNER JOIN PINCODE_CITY pc ON s.Pincode = pc.Pincode
ORDER BY sp.PurchaseDate DESC
LIMIT 50;`,
    conceptTags: ['Multi-Table Inner Join (⨝)', 'Foreign Key Traversal'],
    relationalAlgebra: `π_{PurchaseID, PurchaseDate, ItemName, Quantity, Cost, SupplierName, City}(SUPPLIES ⨝ ITEM ⨝ SUPPLIER ⨝ PINCODE_CITY)`,
    expectedInsight: 'Demonstrates 3NF decomposition traversal across four normalized tables.'
  },
  {
    id: 'Q05',
    title: 'All Items and Recent Issues (LEFT OUTER JOIN)',
    category: 'Joins',
    businessQuestion: 'List every catalog item and its latest issue date, including items that have never been issued.',
    sql: `SELECT 
    i.ItemID,
    i.ItemName,
    i.Category,
    MAX(t.IssueDate) AS LatestIssueDate,
    COUNT(t.IssueID) AS TimesIssued
FROM ITEM i
LEFT OUTER JOIN ISSUED_TO t ON i.ItemID = t.ItemID
GROUP BY i.ItemID, i.ItemName, i.Category
ORDER BY TimesIssued ASC, i.ItemName ASC;`,
    conceptTags: ['Left Outer Join (⟕)', 'Aggregate Null Handling'],
    relationalAlgebra: `γ_{ItemID, ItemName, Category; MAX(IssueDate)->LatestIssueDate, COUNT(IssueID)->TimesIssued}(ITEM ⟕ ISSUED_TO)`,
    expectedInsight: 'Pinpoints unissued or dormant stock where TimesIssued = 0 and LatestIssueDate IS NULL.'
  },
  {
    id: 'Q06',
    title: 'Employee-Manager Hierarchy (SELF JOIN)',
    category: 'Joins',
    businessQuestion: 'Display every institute staff member alongside their immediate reporting supervisor.',
    sql: `SELECT 
    e.EmpID AS StaffID,
    e.EmpName AS StaffName,
    e.Designation AS StaffDesignation,
    d.DeptName AS Department,
    COALESCE(m.EmpName, 'Top Administrator (Governing Body)') AS ReportsTo,
    COALESCE(m.Designation, 'Apex Role') AS ManagerDesignation
FROM EMPLOYEE e
INNER JOIN DEPARTMENT d ON e.DeptID = d.DeptID
LEFT OUTER JOIN EMPLOYEE m ON e.ManagerID = m.EmpID
ORDER BY d.DeptName, e.EmpName;`,
    conceptTags: ['Self-Join (ρ)', 'Unary Relationship', 'COALESCE'],
    relationalAlgebra: `π_{StaffName, Department, ManagerName}( (ρ_{e}(EMPLOYEE) ⨝ DEPARTMENT) ⟕_{e.ManagerID = m.EmpID} ρ_{m}(EMPLOYEE) )`,
    expectedInsight: 'Demonstrates recursive unary relationships modeled in a single table.'
  },
  {
    id: 'Q07',
    title: 'Department and Category Potential Matrix (CROSS JOIN)',
    category: 'Joins',
    businessQuestion: 'Generate the Cartesian product of all departments and stationery categories to audit missing allocations.',
    sql: `SELECT 
    d.DeptID,
    d.DeptName,
    c.Category,
    (SELECT COUNT(*) FROM ISSUED_TO t JOIN ITEM i ON t.ItemID = i.ItemID WHERE t.DeptID = d.DeptID AND i.Category = c.Category) AS ConsumptionCount
FROM DEPARTMENT d
CROSS JOIN (SELECT DISTINCT Category FROM ITEM) c
ORDER BY d.DeptName, c.Category;`,
    conceptTags: ['Cartesian Product (✕)', 'Cross Join', 'Correlated Subquery'],
    relationalAlgebra: `DEPARTMENT ✕ π_{Category}(ITEM)`,
    expectedInsight: 'Forms the baseline lattice for gap analysis and relational division.'
  },
  {
    id: 'Q08',
    title: 'Suppliers with Multiple Registered Phone Contacts (1NF Audit)',
    category: 'Joins',
    businessQuestion: 'List suppliers having 2 or more registered contact numbers from the 1NF decomposed contact relation.',
    sql: `SELECT 
    s.SupplierID,
    s.SupplierName,
    GROUP_CONCAT(sc.ContactNo, ' / ') AS PhoneNumbers,
    COUNT(sc.ContactNo) AS TotalContacts
FROM SUPPLIER s
INNER JOIN SUPPLIER_CONTACT sc ON s.SupplierID = sc.SupplierID
GROUP BY s.SupplierID, s.SupplierName
HAVING COUNT(sc.ContactNo) >= 2;`,
    conceptTags: ['1NF Decomposition', 'String Aggregation', 'HAVING'],
    relationalAlgebra: `σ_{TotalContacts ≥ 2}(γ_{SupplierID, SupplierName; GROUP_CONCAT(ContactNo), COUNT(ContactNo)->TotalContacts}(SUPPLIER ⨝ SUPPLIER_CONTACT))`,
    expectedInsight: 'Validates that multivalued phone attributes are stored without repeating groups.'
  },
  {
    id: 'Q09',
    title: 'Employee-Specific Requisition Issues Matching Department',
    category: 'Joins',
    businessQuestion: 'Show issues made to individual faculty members and verify department consistency.',
    sql: `SELECT 
    t.IssueID,
    t.IssueDate,
    e.EmpName,
    e.Designation,
    d.DeptName,
    i.ItemName,
    t.Quantity
FROM ISSUED_TO t
INNER JOIN EMPLOYEE e ON t.EmpID = e.EmpID
INNER JOIN DEPARTMENT d ON t.DeptID = d.DeptID
INNER JOIN ITEM i ON t.ItemID = i.ItemID
ORDER BY t.IssueDate DESC;`,
    conceptTags: ['Multi-Way Join', 'Integrity Cross-Check'],
    relationalAlgebra: `π_{IssueID, IssueDate, EmpName, DeptName, ItemName, Quantity}(ISSUED_TO ⨝ EMPLOYEE ⨝ DEPARTMENT ⨝ ITEM)`,
    expectedInsight: 'Demonstrates employee-level tracking added in the extended schema.'
  },

  // --- 3. GROUP BY, HAVING & AGGREGATES (5 queries) ---
  {
    id: 'Q10',
    title: 'Procurement Expenditure Summary by Supplier',
    category: 'Aggregation',
    businessQuestion: 'Calculate total purchase orders, units supplied, and total spend for every vendor.',
    sql: `SELECT 
    s.SupplierID,
    s.SupplierName,
    COUNT(sp.PurchaseID) AS OrderCount,
    SUM(sp.Quantity) AS TotalUnits,
    ROUND(SUM(sp.Cost), 2) AS TotalSpendINR,
    ROUND(AVG(sp.Cost / sp.Quantity), 2) AS OverallAvgUnitCost
FROM SUPPLIER s
JOIN SUPPLIES sp ON s.SupplierID = sp.SupplierID
GROUP BY s.SupplierID, s.SupplierName
ORDER BY TotalSpendINR DESC;`,
    conceptTags: ['GROUP BY', 'SUM', 'COUNT', 'AVG', 'Arithmetic Expressions'],
    relationalAlgebra: `γ_{SupplierID, SupplierName; COUNT(PurchaseID), SUM(Quantity), SUM(Cost)}(SUPPLIER ⨝ SUPPLIES)`,
    expectedInsight: 'Identifies tier-1 institutional vendors accounting for majority expenditure.'
  },
  {
    id: 'Q11',
    title: 'High-Consumption Departments (HAVING > 100 Units)',
    category: 'Aggregation',
    businessQuestion: 'Find departments whose cumulative issued stationery exceeds 100 units.',
    sql: `SELECT 
    d.DeptID,
    d.DeptName,
    COUNT(t.IssueID) AS IssueVoucherCount,
    SUM(t.Quantity) AS CumulativeUnitsIssued
FROM DEPARTMENT d
JOIN ISSUED_TO t ON d.DeptID = t.DeptID
GROUP BY d.DeptID, d.DeptName
HAVING SUM(t.Quantity) > 100
ORDER BY CumulativeUnitsIssued DESC;`,
    conceptTags: ['GROUP BY', 'HAVING Filter', 'Aggregate Predicate'],
    relationalAlgebra: `σ_{CumulativeUnitsIssued > 100}(γ_{DeptID, DeptName; COUNT(IssueID), SUM(Quantity)->CumulativeUnitsIssued}(DEPARTMENT ⨝ ISSUED_TO))`,
    expectedInsight: 'Differentiates heavy-volume academic wings (CS, Exam Cell) from light administrative units.'
  },
  {
    id: 'Q12',
    title: 'Stationery Catalog Stats by Category',
    category: 'Aggregation',
    businessQuestion: 'What is the minimum, maximum, and average unit price per item category?',
    sql: `SELECT 
    Category,
    COUNT(*) AS TotalSKUs,
    ROUND(MIN(UnitPrice), 2) AS MinPrice,
    ROUND(AVG(UnitPrice), 2) AS AvgPrice,
    ROUND(MAX(UnitPrice), 2) AS MaxPrice
FROM ITEM
GROUP BY Category
ORDER BY TotalSKUs DESC;`,
    conceptTags: ['Statistical Aggregation', 'MIN / MAX / AVG', 'GROUP BY'],
    relationalAlgebra: `γ_{Category; COUNT(*), MIN(UnitPrice), AVG(UnitPrice), MAX(UnitPrice)}(ITEM)`,
    expectedInsight: 'Categorizes product lines from cheap consumables (₹5 erasers) to expensive hardware (₹4,200 toner).'
  },
  {
    id: 'Q13',
    title: 'Monthly Procurement Expenditure Breakdown',
    category: 'Aggregation',
    businessQuestion: 'Aggregate procurement spending grouped by calendar month.',
    sql: `SELECT 
    strftime('%Y-%m', PurchaseDate) AS PurchaseMonth,
    COUNT(PurchaseID) AS OrdersPlaced,
    SUM(Quantity) AS TotalItemsBought,
    ROUND(SUM(Cost), 2) AS MonthlySpendINR
FROM SUPPLIES
GROUP BY strftime('%Y-%m', PurchaseDate)
ORDER BY PurchaseMonth ASC;`,
    conceptTags: ['Date Aggregation (strftime)', 'Time Series Grouping'],
    relationalAlgebra: `γ_{strftime(PurchaseDate); COUNT(PurchaseID), SUM(Quantity), SUM(Cost)}(SUPPLIES)`,
    expectedInsight: 'Illustrates budget cyclicality tied to academic terms.'
  },
  {
    id: 'Q14',
    title: 'Department Headcount vs Stationery Request Count',
    category: 'Aggregation',
    businessQuestion: 'Compare staff count with total requisition count across all departments.',
    sql: `SELECT 
    d.DeptID,
    d.DeptName,
    (SELECT COUNT(*) FROM EMPLOYEE e WHERE e.DeptID = d.DeptID) AS FacultyCount,
    COUNT(r.ReqID) AS TotalRequisitionsSubmitted
FROM DEPARTMENT d
LEFT JOIN REQUISITION r ON d.DeptID = r.DeptID
GROUP BY d.DeptID, d.DeptName
ORDER BY FacultyCount DESC;`,
    conceptTags: ['Correlated Scalar Subquery', 'GROUP BY', 'Left Join'],
    relationalAlgebra: `γ_{DeptID, DeptName; COUNT(ReqID)}(DEPARTMENT ⟕ REQUISITION)`,
    expectedInsight: 'Evaluates administrative efficiency and request frequency per employee.'
  },

  // --- 4. SUBQUERIES (6 queries: SCALAR, IN, EXISTS, NOT EXISTS, CORRELATED) ---
  {
    id: 'Q15',
    title: 'Items Priced Higher than Category Average (Correlated Subquery)',
    category: 'Subqueries',
    businessQuestion: 'Find items whose unit price exceeds the average price of their respective category.',
    sql: `SELECT 
    i.ItemID,
    i.ItemName,
    i.Category,
    i.UnitPrice,
    ROUND((SELECT AVG(i2.UnitPrice) FROM ITEM i2 WHERE i2.Category = i.Category), 2) AS CategoryAvgPrice
FROM ITEM i
WHERE i.UnitPrice > (
    SELECT AVG(i2.UnitPrice) 
    FROM ITEM i2 
    WHERE i2.Category = i.Category
)
ORDER BY i.Category, i.UnitPrice DESC;`,
    conceptTags: ['Correlated Subquery', 'Comparative Subquery', 'WHERE Filter'],
    relationalAlgebra: `σ_{UnitPrice > CategoryAvg}(ITEM ⨝ (γ_{Category; AVG(UnitPrice)->CategoryAvg}(ITEM)))`,
    expectedInsight: 'Highlights luxury or high-spec items within each category.'
  },
  {
    id: 'Q16',
    title: 'Items Never Issued (NOT EXISTS)',
    category: 'Subqueries',
    businessQuestion: 'Which items have never been issued to any department or employee?',
    sql: `SELECT 
    i.ItemID,
    i.ItemName,
    i.Category,
    i.UnitPrice
FROM ITEM i
WHERE NOT EXISTS (
    SELECT 1 
    FROM ISSUED_TO t 
    WHERE t.ItemID = i.ItemID
);`,
    conceptTags: ['NOT EXISTS', 'Correlated Subquery', 'Set Anti-Join'],
    relationalAlgebra: `ITEM ▷ ISSUED_TO`,
    expectedInsight: 'Directly detects zero-demand capital or dead stock.'
  },
  {
    id: 'Q17',
    title: 'Suppliers Providing High-Volume Consumables (IN Subquery)',
    category: 'Subqueries',
    businessQuestion: 'Find suppliers who have supplied items that have a reorder level greater than 50.',
    sql: `SELECT DISTINCT 
    s.SupplierID,
    s.SupplierName,
    s.Street
FROM SUPPLIER s
WHERE s.SupplierID IN (
    SELECT sp.SupplierID 
    FROM SUPPLIES sp 
    WHERE sp.ItemID IN (
        SELECT c.ItemID 
        FROM CONSUMABLE_ITEM c 
        WHERE c.ReorderLevel >= 50
    )
);`,
    conceptTags: ['Nested IN Subquery', 'DISTINCT Filter'],
    relationalAlgebra: `π_{SupplierID, SupplierName, Street}(SUPPLIER ⋉ (SUPPLIES ⋉ σ_{ReorderLevel ≥ 50}(CONSUMABLE_ITEM)))`,
    expectedInsight: 'Pinpoints primary suppliers of bulk everyday items (pens, reams, answer sheets).'
  },
  {
    id: 'Q18',
    title: 'Departments with Open Requisitions (EXISTS Subquery)',
    category: 'Subqueries',
    businessQuestion: 'Which departments currently have pending requisitions awaiting approval or fulfillment?',
    sql: `SELECT 
    d.DeptID,
    d.DeptName
FROM DEPARTMENT d
WHERE EXISTS (
    SELECT 1 
    FROM REQUISITION r 
    WHERE r.DeptID = d.DeptID 
      AND r.Status IN ('SUBMITTED', 'APPROVED')
);`,
    conceptTags: ['EXISTS Operator', 'Semi-Join (⋉)'],
    relationalAlgebra: `DEPARTMENT ⋉ σ_{Status ∈ {'SUBMITTED', 'APPROVED'}}(REQUISITION)`,
    expectedInsight: 'Enables store keepers to identify departments with queued demands.'
  },
  {
    id: 'Q19',
    title: 'Purchases Exceeding Institution Average Cost (Scalar Subquery)',
    category: 'Subqueries',
    businessQuestion: 'List purchase vouchers whose total value is strictly greater than the average purchase order cost.',
    sql: `SELECT 
    sp.PurchaseID,
    sp.PurchaseDate,
    sp.ItemID,
    sp.Quantity,
    sp.Cost,
    ROUND((SELECT AVG(Cost) FROM SUPPLIES), 2) AS BenchmarkAvgCost
FROM SUPPLIES sp
WHERE sp.Cost > (SELECT AVG(Cost) FROM SUPPLIES)
ORDER BY sp.Cost DESC;`,
    conceptTags: ['Scalar Subquery', 'Benchmark Comparison'],
    relationalAlgebra: `σ_{Cost > AVG_Cost}(SUPPLIES ✕ (γ_{; AVG(Cost)->AVG_Cost}(SUPPLIES)))`,
    expectedInsight: 'Filters the top-spend procurement batches subject to mandatory administrative signoff.'
  },
  {
    id: 'Q20',
    title: 'Employees Who Are Also Department Managers (Correlated Subquery)',
    category: 'Subqueries',
    businessQuestion: 'List staff members who manage at least one other colleague in the organizational chart.',
    sql: `SELECT 
    m.EmpID,
    m.EmpName,
    m.Designation,
    (SELECT COUNT(*) FROM EMPLOYEE sub WHERE sub.ManagerID = m.EmpID) AS SubordinatesCount
FROM EMPLOYEE m
WHERE EXISTS (
    SELECT 1 
    FROM EMPLOYEE e 
    WHERE e.ManagerID = m.EmpID
)
ORDER BY SubordinatesCount DESC;`,
    conceptTags: ['Self-Referential Subquery', 'EXISTS Semi-Join'],
    relationalAlgebra: `π_{EmpID, EmpName}(σ_{SubordinatesCount > 0}(EMPLOYEE))`,
    expectedInsight: 'Maps institutional chain of command for requisition routing.'
  },

  // --- 5. SET OPERATIONS (3 queries: UNION, INTERSECT, EXCEPT) ---
  {
    id: 'Q21',
    title: 'Unified Flow of Goods (UNION ALL Transaction Ledger)',
    category: 'Set Operations',
    businessQuestion: 'Produce a unified chronologically ordered stream of all material inward and outward events.',
    sql: `SELECT 
    PurchaseID AS TransactionRef,
    PurchaseDate AS EventDate,
    ItemID,
    Quantity AS QtyChange,
    'INWARD_PROCUREMENT' AS EventType,
    Cost AS MonetaryImpact
FROM SUPPLIES
UNION ALL
SELECT 
    IssueID AS TransactionRef,
    IssueDate AS EventDate,
    ItemID,
    -Quantity AS QtyChange,
    'OUTWARD_DISTRIBUTION' AS EventType,
    0 AS MonetaryImpact
FROM ISSUED_TO
ORDER BY EventDate DESC, TransactionRef DESC
LIMIT 50;`,
    conceptTags: ['UNION ALL', 'Set Theory', 'Polymorphic Feed'],
    relationalAlgebra: `π_{PurchaseID, PurchaseDate, ItemID, Quantity, 'IN'}(SUPPLIES) ∪ π_{IssueID, IssueDate, ItemID, -Quantity, 'OUT'}(ISSUED_TO)`,
    expectedInsight: 'Forms the foundational transaction stream underpinning double-entry stock ledgers.'
  },
  {
    id: 'Q22',
    title: 'Departments Active in Both Paper and Writing Supplies (INTERSECT)',
    category: 'Set Operations',
    businessQuestion: 'Which departments have drawn items from BOTH Paper & Notebooks AND Writing & Marking categories?',
    sql: `SELECT t.DeptID 
FROM ISSUED_TO t 
JOIN ITEM i ON t.ItemID = i.ItemID 
WHERE i.Category = 'Paper & Notebooks'
INTERSECT
SELECT t.DeptID 
FROM ISSUED_TO t 
JOIN ITEM i ON t.ItemID = i.ItemID 
WHERE i.Category = 'Writing & Marking';`,
    conceptTags: ['INTERSECT (∩)', 'Set Intersection', 'Relational Calculus'],
    relationalAlgebra: `π_{DeptID}(σ_{Category='Paper & Notebooks'}(ISSUED_TO ⨝ ITEM)) ∩ π_{DeptID}(σ_{Category='Writing & Marking'}(ISSUED_TO ⨝ ITEM))`,
    expectedInsight: 'Demonstrates intersection between distinct item category consumer sets.'
  },
  {
    id: 'Q23',
    title: 'Departments Consuming Stationery but Never Raising Online Requisitions (EXCEPT)',
    category: 'Set Operations',
    businessQuestion: 'Which departments have received stationery issues but have never submitted a digital requisition?',
    sql: `SELECT DISTINCT DeptID FROM ISSUED_TO
EXCEPT
SELECT DISTINCT DeptID FROM REQUISITION;`,
    conceptTags: ['EXCEPT / Set Difference (-)', 'Anti-Set Analysis'],
    relationalAlgebra: `π_{DeptID}(ISSUED_TO) - π_{DeptID}(REQUISITION)`,
    expectedInsight: 'Identifies departments still relying on legacy manual paper requisitions.'
  },

  // --- 6. WINDOW FUNCTIONS (6 queries: RANK, DENSE_RANK, ROW_NUMBER, LAG/LEAD, NTILE, Running Total) ---
  {
    id: 'Q24',
    title: 'Running Stock Balance per Item (Window SUM)',
    category: 'Window Functions',
    businessQuestion: 'Calculate the cumulative running stock balance for item I101 after every transaction.',
    sql: `SELECT 
    Ref,
    TxnDate,
    TxnType,
    Qty,
    RunningBalance
FROM V_STOCK_LEDGER
WHERE ItemID = 'I101'
ORDER BY TxnDate ASC, Ref ASC;`,
    conceptTags: ['SUM() OVER', 'ROWS BETWEEN UNBOUNDED PRECEDING', 'Running Balance'],
    relationalAlgebra: `Window Function: RunningBalance = SUM(Qty) OVER (PARTITION BY ItemID ORDER BY TxnDate)`,
    expectedInsight: 'Proves the append-only ledger architecture derives exact balances on the fly.'
  },
  {
    id: 'Q25',
    title: 'Vendor Procurement Ranking by Spend (RANK & DENSE_RANK)',
    category: 'Window Functions',
    businessQuestion: 'Rank all vendors by institutional procurement value, showing both RANK and DENSE_RANK.',
    sql: `SELECT 
    s.SupplierID,
    s.SupplierName,
    COALESCE(SUM(sp.Cost), 0) AS TotalSpend,
    RANK() OVER (ORDER BY COALESCE(SUM(sp.Cost), 0) DESC) AS SpendRank,
    DENSE_RANK() OVER (ORDER BY COALESCE(SUM(sp.Cost), 0) DESC) AS DenseRank
FROM SUPPLIER s
LEFT JOIN SUPPLIES sp ON s.SupplierID = sp.SupplierID
GROUP BY s.SupplierID, s.SupplierName
ORDER BY SpendRank ASC;`,
    conceptTags: ['RANK()', 'DENSE_RANK()', 'Tie Handling'],
    relationalAlgebra: `Window Function: RANK() OVER (ORDER BY TotalSpend DESC)`,
    expectedInsight: 'Demonstrates handling of duplicate rank positions and gap generation.'
  },
  {
    id: 'Q26',
    title: 'Most Recent Purchase Order per Item (ROW_NUMBER)',
    category: 'Window Functions',
    businessQuestion: 'Find the single most recent purchase order and unit price for every stationery item.',
    sql: `WITH RankedPurchases AS (
    SELECT 
        sp.ItemID,
        i.ItemName,
        sp.PurchaseID,
        sp.PurchaseDate,
        sp.Quantity,
        ROUND(sp.Cost / sp.Quantity, 2) AS ActualUnitCost,
        ROW_NUMBER() OVER (PARTITION BY sp.ItemID ORDER BY sp.PurchaseDate DESC, sp.PurchaseID DESC) AS rn
    FROM SUPPLIES sp
    JOIN ITEM i ON sp.ItemID = i.ItemID
)
SELECT ItemID, ItemName, PurchaseID, PurchaseDate, Quantity, ActualUnitCost
FROM RankedPurchases
WHERE rn = 1
ORDER BY ItemID ASC;`,
    conceptTags: ['ROW_NUMBER()', 'PARTITION BY', 'Top-1 Deduplication'],
    relationalAlgebra: `σ_{rn=1}(π_{...}(ROW_NUMBER() OVER (PARTITION BY ItemID ORDER BY PurchaseDate DESC)))`,
    expectedInsight: 'Extracts the latest market purchase price per SKU without heavy subqueries.'
  },
  {
    id: 'Q27',
    title: 'Month-over-Month Issue Growth (LAG Window Function)',
    category: 'Window Functions',
    businessQuestion: 'Compare each month\'s stationery issue volume against the preceding month to compute MoM delta.',
    sql: `WITH MonthlyIssues AS (
    SELECT 
        strftime('%Y-%m', IssueDate) AS MonthStr,
        SUM(Quantity) AS TotalQty
    FROM ISSUED_TO
    GROUP BY strftime('%Y-%m', IssueDate)
)
SELECT 
    MonthStr,
    TotalQty,
    LAG(TotalQty, 1) OVER (ORDER BY MonthStr ASC) AS PrevMonthQty,
    TotalQty - LAG(TotalQty, 1) OVER (ORDER BY MonthStr ASC) AS DeltaQty,
    ROUND((TotalQty - LAG(TotalQty, 1) OVER (ORDER BY MonthStr ASC)) * 100.0 / NULLIF(LAG(TotalQty, 1) OVER (ORDER BY MonthStr ASC), 0), 1) AS PctGrowth
FROM MonthlyIssues
ORDER BY MonthStr ASC;`,
    conceptTags: ['LAG() OVER', 'MoM Trend Analysis', 'NULLIF Division Guard'],
    relationalAlgebra: `Window Function: PrevQty = LAG(TotalQty, 1) OVER (ORDER BY MonthStr)`,
    expectedInsight: 'Reveals spikes during semester exams and procurement surges.'
  },
  {
    id: 'Q28',
    title: 'Department Expenditure Quartiles (NTILE(4))',
    category: 'Window Functions',
    businessQuestion: 'Divide departments into 4 spending quartiles (Top 25% down to Lowest 25%).',
    sql: `SELECT 
    d.DeptID,
    d.DeptName,
    COALESCE(SUM(t.Quantity * i.UnitPrice), 0) AS TotalIssuedValue,
    NTILE(4) OVER (ORDER BY COALESCE(SUM(t.Quantity * i.UnitPrice), 0) DESC) AS SpendQuartile
FROM DEPARTMENT d
LEFT JOIN ISSUED_TO t ON d.DeptID = t.DeptID
LEFT JOIN ITEM i ON t.ItemID = i.ItemID
GROUP BY d.DeptID, d.DeptName
ORDER BY SpendQuartile ASC, TotalIssuedValue DESC;`,
    conceptTags: ['NTILE(4)', 'Statistical Quartile Segmentation'],
    relationalAlgebra: `Window Function: NTILE(4) OVER (ORDER BY TotalValue DESC)`,
    expectedInsight: 'Segments departments into tier groups for institutional budgetary caps.'
  },
  {
    id: 'Q29',
    title: 'Cumulative Item Consumption Share (Window SUM Percentage)',
    category: 'Window Functions',
    businessQuestion: 'Show each item\'s issued quantity alongside its cumulative percentage of total consumption.',
    sql: `WITH ItemTotals AS (
    SELECT 
        t.ItemID,
        i.ItemName,
        SUM(t.Quantity) AS ItemIssuedQty
    FROM ISSUED_TO t
    JOIN ITEM i ON t.ItemID = i.ItemID
    GROUP BY t.ItemID, i.ItemName
)
SELECT 
    ItemID,
    ItemName,
    ItemIssuedQty,
    ROUND(ItemIssuedQty * 100.0 / SUM(ItemIssuedQty) OVER (), 2) AS PctOfTotalIssues,
    ROUND(SUM(ItemIssuedQty) OVER (ORDER BY ItemIssuedQty DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) * 100.0 / SUM(ItemIssuedQty) OVER (), 2) AS CumulativePct
FROM ItemTotals
ORDER BY ItemIssuedQty DESC;`,
    conceptTags: ['Unbounded Over Window', 'Pareto Curve Math', 'SUM() OVER ()'],
    relationalAlgebra: `Window Function: CumulativePct = CumulativeSUM / TotalSUM`,
    expectedInsight: 'Forms the mathematical basis for ABC Inventory Classification.'
  },

  // --- 7. CTEs & RECURSIVE CTEs (4 queries) ---
  {
    id: 'Q30',
    title: '12-Month Calendar Series with Zero-Fill (RECURSIVE CTE)',
    category: 'CTEs & Recursion',
    businessQuestion: 'Generate an unbroken 12-month calendar time series and zero-fill months with zero issues.',
    sql: `WITH RECURSIVE months(m) AS (
    SELECT date('now', 'start of month', '-11 months')
    UNION ALL
    SELECT date(m, '+1 month') 
    FROM months 
    WHERE m < date('now', 'start of month')
)
SELECT 
    strftime('%Y-%m', m) AS CalendarMonth,
    COALESCE(SUM(t.Quantity), 0) AS TotalQuantityIssued,
    COUNT(t.IssueID) AS VoucherCount
FROM months
LEFT JOIN ISSUED_TO t ON strftime('%Y-%m', t.IssueDate) = strftime('%Y-%m', m)
GROUP BY m
ORDER BY m ASC;`,
    conceptTags: ['WITH RECURSIVE', 'Zero-Fill Time Series', 'Outer Join with Calendar'],
    relationalAlgebra: `months(m) = {start} ∪ {m + 1 month}; months ⟕ ISSUED_TO`,
    expectedInsight: 'Eliminates chart gaps by ensuring months with zero activity still return 0.'
  },
  {
    id: 'Q31',
    title: 'Employee Approval Chain of Command (RECURSIVE CTE)',
    category: 'CTEs & Recursion',
    businessQuestion: 'Trace the administrative hierarchy upward from a lab assistant to the top officer.',
    sql: `WITH RECURSIVE HierarchyChain AS (
    -- Anchor member: start at specific staff member E008 (Mr. Prasad More)
    SELECT 
        EmpID,
        EmpName,
        Designation,
        ManagerID,
        1 AS HierarchyLevel,
        EmpName AS ReportingPath
    FROM EMPLOYEE
    WHERE EmpID = 'E008'
    
    UNION ALL
    
    -- Recursive member: traverse up ManagerID
    SELECT 
        m.EmpID,
        m.EmpName,
        m.Designation,
        m.ManagerID,
        hc.HierarchyLevel + 1,
        hc.ReportingPath || ' -> ' || m.EmpName
    FROM EMPLOYEE m
    JOIN HierarchyChain hc ON hc.ManagerID = m.EmpID
)
SELECT HierarchyLevel, EmpID, EmpName, Designation, ReportingPath
FROM HierarchyChain
ORDER BY HierarchyLevel ASC;`,
    conceptTags: ['Recursive Hierarchy Walk', 'Graph Traversal in SQL', 'Anchor & Recursive Members'],
    relationalAlgebra: `HierarchyChain = σ_{EmpID='E008'}(EMPLOYEE) ∪ (EMPLOYEE ⨝ HierarchyChain)`,
    expectedInsight: 'Visualizes requisition escalation paths through department heads to administration.'
  },
  {
    id: 'Q32',
    title: 'Modular Requisition Value Summary (Chained CTEs)',
    category: 'CTEs & Recursion',
    businessQuestion: 'Use chained CTEs to compute requisition header values, line counts, and department averages.',
    sql: `WITH ReqLineAgg AS (
    SELECT 
        rl.ReqID,
        COUNT(rl.LineNo) AS LineCount,
        SUM(rl.QtyRequested * i.UnitPrice) AS TotalRequestedValue
    FROM REQUISITION_LINE rl
    JOIN ITEM i ON rl.ItemID = i.ItemID
    GROUP BY rl.ReqID
),
DeptReqSummary AS (
    SELECT 
        r.DeptID,
        COUNT(r.ReqID) AS TotalTickets,
        AVG(rla.TotalRequestedValue) AS AvgTicketValue
    FROM REQUISITION r
    JOIN ReqLineAgg rla ON r.ReqID = rla.ReqID
    GROUP BY r.DeptID
)
SELECT 
    d.DeptName,
    drs.TotalTickets,
    ROUND(drs.AvgTicketValue, 2) AS AvgRequisitionValueINR
FROM DeptReqSummary drs
JOIN DEPARTMENT d ON drs.DeptID = d.DeptID
ORDER BY drs.AvgTicketValue DESC;`,
    conceptTags: ['Chained Common Table Expressions', 'Modular SQL Design'],
    relationalAlgebra: `DeptReqSummary = γ(ReqLineAgg ⨝ REQUISITION); DeptReqSummary ⨝ DEPARTMENT`,
    expectedInsight: 'Breaks down complex analytical queries into maintainable, readable pipelines.'
  },
  {
    id: 'Q33',
    title: 'Top-3 Items Consumed per Department (CTE + DENSE_RANK)',
    category: 'CTEs & Recursion',
    businessQuestion: 'Find the top 3 most demanded stationery items for every academic department.',
    sql: `WITH DeptItemConsumption AS (
    SELECT 
        t.DeptID,
        d.DeptName,
        t.ItemID,
        i.ItemName,
        SUM(t.Quantity) AS TotalQty,
        DENSE_RANK() OVER (PARTITION BY t.DeptID ORDER BY SUM(t.Quantity) DESC) AS RankInDept
    FROM ISSUED_TO t
    JOIN DEPARTMENT d ON t.DeptID = d.DeptID
    JOIN ITEM i ON t.ItemID = i.ItemID
    GROUP BY t.DeptID, d.DeptName, t.ItemID, i.ItemName
)
SELECT DeptName, RankInDept, ItemName, TotalQty
FROM DeptItemConsumption
WHERE RankInDept <= 3
ORDER BY DeptName, RankInDept;`,
    conceptTags: ['CTE with Window Ranking', 'Top-N per Group Pattern'],
    relationalAlgebra: `σ_{Rank ≤ 3}(DENSE_RANK() OVER (PARTITION BY DeptID ORDER BY TotalQty DESC))`,
    expectedInsight: 'Highlights department-specific preferences (e.g. Exam Cell uses Answer Booklets).'
  },

  // --- 8. VIEWS & SECURITY LAYERS (3 queries) ---
  {
    id: 'Q34',
    title: 'Consumable Stock Status via V_CURRENT_STOCK',
    category: 'Views & Security',
    businessQuestion: 'Query the master stock view to display derived stock quantities and reorder statuses.',
    sql: `SELECT ItemID, ItemName, Category, UnitPrice, StockQty, ReorderLevel, Status
FROM V_CURRENT_STOCK
ORDER BY StockQty ASC;`,
    conceptTags: ['Database Views', 'Virtual Tables', 'Derived Attribute Isolation'],
    relationalAlgebra: `V_CURRENT_STOCK (Virtual Table View)`,
    expectedInsight: 'Proves client queries treat derived stock exactly like a real table while never storing it.'
  },
  {
    id: 'Q35',
    title: 'Row-Level Security Emulation via V_MY_DEPT_ISSUES',
    category: 'Views & Security',
    businessQuestion: 'Simulate how a Department Head view is restricted to their own department issues.',
    sql: `SELECT IssueID, ItemID, ItemName, DeptID, EmpName, IssueDate, Quantity
FROM V_MY_DEPT_ISSUES
ORDER BY IssueDate DESC;`,
    conceptTags: ['Row-Level Security (RLS)', 'SESSION_CONTEXT', 'Security Views'],
    relationalAlgebra: `σ_{DeptID = SESSION_CONTEXT('dept') ∨ ROLE ∈ {'ADMIN','AUDITOR'}}(ISSUED_TO ⨝ ITEM ⨝ EMPLOYEE)`,
    expectedInsight: 'Shows role-based data shielding implemented at the view layer.'
  },
  {
    id: 'Q36',
    title: 'Optimal Supplier Procurement Recommendation via V_REORDER_WORKLIST',
    category: 'Views & Security',
    businessQuestion: 'Inspect the reorder worklist view with automated supplier cost optimization.',
    sql: `SELECT ItemID, ItemName, StockQty, ReorderLevel, SuggestedReorderQty, PreferredSupplierName, HistoricalAvgCost
FROM V_REORDER_WORKLIST
ORDER BY (SuggestedReorderQty * HistoricalAvgCost) DESC;`,
    conceptTags: ['Analytical View', 'Decision Support', 'Supplier Optimization'],
    relationalAlgebra: `V_REORDER_WORKLIST (Aggregated Procurement Suggestion View)`,
    expectedInsight: 'Automates replenishment planning using historical unit costs.'
  },

  // --- 9. CASE & TEMPORAL FUNCTIONS (3 queries) ---
  {
    id: 'Q37',
    title: 'Stationery Aging Analysis (Days Since Last Issue)',
    category: 'CASE & Dates',
    businessQuestion: 'Classify inventory items into Fresh, Normal, Slow Moving, or Dead Stock based on days since last issue.',
    sql: `SELECT 
    i.ItemID,
    i.ItemName,
    i.Category,
    MAX(t.IssueDate) AS LastIssueDate,
    CAST(julianday('now') - julianday(COALESCE(MAX(t.IssueDate), '2025-01-01')) AS INTEGER) AS DaysSinceLastIssue,
    CASE 
        WHEN MAX(t.IssueDate) IS NULL THEN 'DEAD STOCK (Never Issued)'
        WHEN (julianday('now') - julianday(MAX(t.IssueDate))) > 90 THEN 'SLOW MOVING (>90 Days)'
        WHEN (julianday('now') - julianday(MAX(t.IssueDate))) > 30 THEN 'NORMAL ACTIVE (30-90 Days)'
        ELSE 'FRESH ACTIVE (<30 Days)'
    END AS StockVelocityCategory
FROM ITEM i
LEFT JOIN ISSUED_TO t ON i.ItemID = t.ItemID
GROUP BY i.ItemID, i.ItemName, i.Category
ORDER BY DaysSinceLastIssue DESC;`,
    conceptTags: ['CASE Expression', 'julianday() Date Arithmetic', 'Stock Aging Classification'],
    relationalAlgebra: `γ(ITEM ⟕ ISSUED_TO) with CASE categorization`,
    expectedInsight: 'Provides actionable dead-stock alerts to clear shelf space and reduce holding cost.'
  },
  {
    id: 'Q38',
    title: 'Requisition Lifecycle Status Distribution',
    category: 'CASE & Dates',
    businessQuestion: 'Summarize requisitions with conditional aggregation into Completed, Pending, and Rejected counts.',
    sql: `SELECT 
    d.DeptName,
    COUNT(r.ReqID) AS TotalTickets,
    SUM(CASE WHEN r.Status IN ('FULFILLED', 'PARTIALLY_FULFILLED') THEN 1 ELSE 0 END) AS CompletedTickets,
    SUM(CASE WHEN r.Status IN ('SUBMITTED', 'APPROVED') THEN 1 ELSE 0 END) AS PendingTickets,
    SUM(CASE WHEN r.Status = 'REJECTED' THEN 1 ELSE 0 END) AS RejectedTickets
FROM DEPARTMENT d
LEFT JOIN REQUISITION r ON d.DeptID = r.DeptID
GROUP BY d.DeptName
ORDER BY TotalTickets DESC;`,
    conceptTags: ['Conditional Aggregation', 'SUM(CASE ...)', 'Pivot Reporting'],
    relationalAlgebra: `γ_{DeptName; SUM(CASE...)}(DEPARTMENT ⟕ REQUISITION)`,
    expectedInsight: 'Monitors departmental administrative turnaround and rejection rates.'
  },
  {
    id: 'Q39',
    title: 'Batch Expiry Urgency Radar',
    category: 'CASE & Dates',
    businessQuestion: 'List stock batches with days remaining until expiration and danger status.',
    sql: `SELECT 
    b.ItemID,
    i.ItemName,
    b.BatchNo,
    b.ExpiryDate,
    CAST(julianday(b.ExpiryDate) - julianday('now') AS INTEGER) AS DaysToExpiry,
    CASE 
        WHEN date(b.ExpiryDate) < date('now') THEN 'CRITICAL: ALREADY EXPIRED'
        WHEN date(b.ExpiryDate) <= date('now', '+30 days') THEN 'WARNING: EXPIRING SOON'
        ELSE 'SAFE'
    END AS ExpiryAlertLevel
FROM STOCK_BATCH b
JOIN ITEM i ON b.ItemID = i.ItemID
ORDER BY b.ExpiryDate ASC;`,
    conceptTags: ['Temporal Comparisons', 'Expiry Logic', 'CASE'],
    relationalAlgebra: `σ(STOCK_BATCH ⨝ ITEM) with CASE alerts`,
    expectedInsight: 'Prevents distribution of expired ink cartridges, correction fluid, and glues.'
  },

  // --- 10. JSON FUNCTIONS ON AUDIT_LOG (2 queries) ---
  {
    id: 'Q40',
    title: 'Audit Log Field Mutation Extraction (JSON Extract)',
    category: 'JSON & Audit',
    businessQuestion: 'Extract Old vs New unit prices and item names from JSON audit payloads.',
    sql: `SELECT 
    AuditID,
    TableName,
    RecordKey,
    Action,
    ChangedBy,
    ChangedAt,
    json_extract(OldValues, '$.UnitPrice') AS OldUnitPrice,
    json_extract(NewValues, '$.UnitPrice') AS NewUnitPrice,
    json_extract(NewValues, '$.ItemName') AS CurrentItemName
FROM AUDIT_LOG
WHERE TableName = 'ITEM' AND Action = 'UPDATE'
ORDER BY AuditID DESC;`,
    conceptTags: ['json_extract()', 'Audit Trail', 'Semi-Structured Data in SQL'],
    relationalAlgebra: `π_{AuditID, TableName, RecordKey, json_extract(...)}(σ_{TableName='ITEM' ∧ Action='UPDATE'}(AUDIT_LOG))`,
    expectedInsight: 'Demonstrates modern SQL JSON functions querying audit diffs without table alters.'
  },
  {
    id: 'Q41',
    title: 'Requisition Status Transitions in Audit Log',
    category: 'JSON & Audit',
    businessQuestion: 'Query JSON audit payloads for requisition status workflow transitions.',
    sql: `SELECT 
    AuditID,
    RecordKey AS ReqID,
    ChangedBy,
    ChangedAt,
    json_extract(OldValues, '$.Status') AS PriorStatus,
    json_extract(NewValues, '$.Status') AS UpdatedStatus
FROM AUDIT_LOG
WHERE TableName = 'REQUISITION' AND Action = 'UPDATE'
ORDER BY AuditID DESC;`,
    conceptTags: ['json_extract()', 'State Machine Auditing'],
    relationalAlgebra: `π_{AuditID, RecordKey, json_extract(Status)}(σ_{TableName='REQUISITION'}(AUDIT_LOG))`,
    expectedInsight: 'Guarantees compliance accountability for requisition approvals and cancellations.'
  },

  // --- 11. RELATIONAL DIVISION (1 query) ---
  {
    id: 'Q42',
    title: 'Departments Issued Items from EVERY Category (Relational Division)',
    category: 'Relational Division',
    businessQuestion: 'Which departments have been issued stationery items from EVERY distinct category (Relational Division: Departments ÷ Categories)?',
    sql: `-- Relational Division using Double NOT EXISTS:
-- Find departments D such that there does NOT exist a category C
-- for which there does NOT exist an issue record of an item in category C to department D.
SELECT d.DeptID, d.DeptName
FROM DEPARTMENT d
WHERE NOT EXISTS (
    SELECT c.Category
    FROM (SELECT DISTINCT Category FROM ITEM) c
    WHERE NOT EXISTS (
        SELECT 1
        FROM ISSUED_TO t
        JOIN ITEM i ON t.ItemID = i.ItemID
        WHERE t.DeptID = d.DeptID AND i.Category = c.Category
    )
);`,
    conceptTags: ['Relational Division (÷)', 'Double NOT EXISTS', 'Universal Quantification (∀)'],
    relationalAlgebra: `π_{DeptID, Category}(ISSUED_TO ⨝ ITEM) ÷ π_{Category}(ITEM)`,
    expectedInsight: 'Implements textbook relational division ∀c ∈ Category ∃t ∈ IssuedTo(t.Dept=d ∧ t.Category=c).'
  }
];
