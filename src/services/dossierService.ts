/**
 * Project Dossier Export Service (Markdown & PDF)
 * Compiles a comprehensive DBMS Mini Project technical report
 */

import { SCHEMA_FDS } from '../db/fds';
import { CURATED_QUERIES } from '../db/curatedQueries';

export function generateDossierMarkdown(orgName: string): string {
  const tableNames = Object.keys(SCHEMA_FDS);

  return `# DBMS MINI PROJECT TECHNICAL DOSSIER
## Centralized Relational Stationery Management System (ClayStock)
**Institution:** ${orgName}  
**Academic Session:** 2025–2026  
**Database Engine:** SQLite 3 (Pure WebAssembly Worker RPC)  
**Schema Normalization:** 10 Core + 11 Extension Relations in 3NF / BCNF  

---

### 1. Problem Statement & System Objectives
Collegiate institutions require rigorous material tracking for consumables (paper, marker pens, answer booklets) and durable equipment (staplers, scientific calculators, network peripherals). Distributed procurement often leads to inventory drift, undetected over-expenditures, and stock-outs during university examination windows.

**Core Technical Objectives:**
1. **Zero Redundancy (3NF/BCNF):** Factor out transitive dependencies (e.g. \`Pincode -> City\` in \`SUPPLIER\`) and decompose multivalued phone numbers into 1NF relations.
2. **Derived Attribute Integrity:** \`StockQty\` is never stored in tables; it is dynamically computed through relational aggregation (\`SUM(Purchases) - SUM(Issues)\`) or views (\`V_CURRENT_STOCK\`).
3. **Database-Enforced Invariants:** Strict domain checks, total and disjoint specialization guards, stock-out triggers (\`trg_issue_check_stock\`), and audit trails (\`AUDIT_LOG\`).
4. **ACID Transactions with Savepoints:** Multi-line requisition fulfillment (\`sp_fulfil_requisition\`) using \`SAVEPOINT\` per line to achieve partial fulfillment with graceful shortfall handling.

---

### 2. Complete 21-Table Relational Schema
${tableNames.map(name => {
  const fd = SCHEMA_FDS[name];
  return `#### ${fd.tableName} (${fd.category} RELATION)
- **Attributes:** \`${fd.attributes.join(', ')}\`
- **Primary Key:** \`${fd.primaryKey.join(', ')}\`
- **Normal Form:** ${fd.normalFormAchieved}
- **Functional Dependencies:**
${fd.functionalDependencies.map(f => `  - \`{${f.lhs.join(', ')}}\` -> \`{${f.rhs.join(', ')}}\` (${f.description})`).join('\n')}
- **Theoretical Justification:** ${fd.normalFormExplanation}
`;
}).join('\n')}

---

### 3. Database Views & Virtual Layers
1. **\`V_CURRENT_STOCK\`**: Derives active on-hand quantities, threshold alerts, and specialization labels.
2. **\`V_STOCK_LEDGER\`**: Double-entry ledger combining purchases and issues with a running balance window function:
   \`\`\`sql
   SUM(Qty) OVER (PARTITION BY ItemID ORDER BY TxnDate, TxnType, Ref ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningBalance
   \`\`\`
3. **\`V_REORDER_WORKLIST\`**: Decision support view ranking historical vendor costs to suggest the optimal replenishment supplier.
4. **\`V_MY_DEPT_ISSUES\`**: Row-Level Security view restricting Department Heads to their own department's material vouchers using session context.

---

### 4. Integrity Triggers & Event-Driven Guards
1. **\`trg_issue_check_stock\`**: \`BEFORE INSERT ON ISSUED_TO\` aborts with \`INSUFFICIENT_STOCK\` if requested quantity exceeds derived inventory.
2. **\`trg_issue_emp_dept\`**: Aborts with \`EMPLOYEE_DEPT_MISMATCH\` if an employee is issued stationery assigned to another academic department.
3. **\`trg_disjoint_consumable\` & \`trg_disjoint_durable\`**: Enforce mutual exclusion for EER disjoint specialization.
4. **\`trg_price_variance\`**: Automatically flags purchases priced >15% above catalog unit prices by generating an \`ALERT\` row.
5. **Audit Triggers**: Intercept INSERT, UPDATE, DELETE on entities and log before/after JSON diffs, timestamps, and active session user into \`AUDIT_LOG\`.

---

### 5. Representative SQL Query Showcase (42 Curated Queries)
${CURATED_QUERIES.slice(0, 10).map(q => `#### Query ${q.id}: ${q.title}
- **Business Question:** ${q.businessQuestion}
- **Relational Algebra:** \`${q.relationalAlgebra}\`
- **SQL Implementation:**
\`\`\`sql
${q.sql}
\`\`\`
- **Expected Analytical Insight:** ${q.expectedInsight}
`).join('\n')}

---

### 6. DBMS Concept Coverage Matrix
- **ER & EER Modeling:** Total and disjoint specialization, weak entities (\`STOCK_BATCH\`, \`REQUISITION_LINE\`), identifying relationships.
- **Relational Model & Keys:** Composite keys, surrogate keys (\`PO1001\`, \`IS2001\`), self-referential foreign keys (\`EMPLOYEE.ManagerID\`).
- **Integrity Constraints:** Domain CHECK, NOT NULL, UNIQUE, ON DELETE CASCADE, ON DELETE RESTRICT.
- **Normalization:** 1NF (atomic contacts), 2NF (no partial key dependencies), 3NF (transitive dependency removal), BCNF.
- **SQL Breadth:** Recursive CTEs (12-month calendar zero-fill, employee command hierarchy), Window functions (\`RANK\`, \`DENSE_RANK\`, \`ROW_NUMBER\`, \`LAG\`, \`NTILE\`, running totals), Relational Division (Double \`NOT EXISTS\`).
- **Transactions & Concurrency:** Savepoint isolation in stored procedures, serializable execution in worker, simulation of lost-update anomaly vs append-only ledger.
`;
}

export function downloadDossierMarkdown(orgName: string): void {
  const md = generateDossierMarkdown(orgName);
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ClayStock_DBMS_Mini_Project_Dossier.md`;
  a.click();
  URL.revokeObjectURL(url);
}
