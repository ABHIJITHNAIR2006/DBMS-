import React from 'react';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Map, ExternalLink } from 'lucide-react';

interface ConceptEntry {
  topic: string;
  category: string;
  whereItAppears: string;
  technicalArtifact: string;
  targetTab: string;
}

const CONCEPTS: ConceptEntry[] = [
  { topic: 'EER Modeling & Specialization', category: 'Modeling', whereItAppears: 'Schema Browser (EER Tab)', technicalArtifact: 'CONSUMABLE_ITEM & DURABLE_ITEM disjoint ("d") specialization', targetTab: 'schema' },
  { topic: 'Weak Entity & Identifying Relationship', category: 'Modeling', whereItAppears: 'Schema Browser & DDL', technicalArtifact: 'STOCK_BATCH(ItemID, BatchNo) & REQUISITION_LINE(ReqID, LineNo)', targetTab: 'schema' },
  { topic: 'Multivalued Attribute Decomp', category: 'Normalization', whereItAppears: 'Normalization Lab', technicalArtifact: 'SUPPLIER_CONTACT(SupplierID, ContactNo) in 1NF', targetTab: 'normalization' },
  { topic: 'Transitive Dependency Elimination', category: 'Normalization', whereItAppears: 'Normalization Lab & DDL', technicalArtifact: 'PINCODE_CITY factoring out SupplierID -> Pincode -> City (3NF)', targetTab: 'normalization' },
  { topic: 'Formal BCNF Schema Verification', category: 'Normalization', whereItAppears: 'Normalization Lab (Audit)', technicalArtifact: 'Mathematical verification of 21 relations against src/db/fds.ts', targetTab: 'normalization' },
  { topic: 'Derived Attributes (Zero Redundancy)', category: 'Integrity', whereItAppears: 'Current Stock & Views', technicalArtifact: 'StockQty never stored; computed as SUM(Purchases) - SUM(Issues)', targetTab: 'workbench' },
  { topic: 'ECA Active Database Triggers', category: 'Triggers', whereItAppears: 'Triggers Gallery & Lab', technicalArtifact: 'trg_issue_check_stock, trg_price_variance, trg_disjoint_consumable', targetTab: 'triggers' },
  { topic: 'Transaction Savepoints (TCL)', category: 'Transactions', whereItAppears: 'Requisitions Workflow', technicalArtifact: 'sp_fulfil_requisition with SAVEPOINT per line for shortfall recovery', targetTab: 'acid' },
  { topic: 'ACID Atomicity & Rollback', category: 'Transactions', whereItAppears: 'ACID Lab (Atomicity)', technicalArtifact: 'Multi-statement transaction rolling back upon constraint violation', targetTab: 'acid' },
  { topic: 'Lost Update Anomaly Simulation', category: 'Concurrency', whereItAppears: 'ACID Lab (Isolation)', technicalArtifact: 'Clerk A & Clerk B side-by-side schedule vs append-only ledger', targetTab: 'acid' },
  { topic: 'B-Tree Query Optimization (EXPLAIN)', category: 'Optimization', whereItAppears: 'Index & Optimizer Lab', technicalArtifact: '50,000-row benchmark demonstrating SCAN to SEARCH transition', targetTab: 'indexlab' },
  { topic: 'Self-Join & Hierarchy Traversal', category: 'SQL Depth', whereItAppears: 'Query Library (Q06)', technicalArtifact: 'EMPLOYEE self-join on ManagerID with reporting chain', targetTab: 'library' },
  { topic: 'Recursive CTEs (Calendar Series)', category: 'SQL Depth', whereItAppears: 'Query Library (Q30)', technicalArtifact: 'WITH RECURSIVE months(m) for zero-filled 12-month series', targetTab: 'library' },
  { topic: 'Window Functions (Running Totals)', category: 'SQL Depth', whereItAppears: 'Stock Ledger View', technicalArtifact: 'SUM(Qty) OVER (PARTITION BY ItemID ROWS UNBOUNDED PRECEDING)', targetTab: 'library' },
  { topic: 'Relational Division (Double NOT EXISTS)', category: 'Relational Theory', whereItAppears: 'Query Library (Q42)', technicalArtifact: 'Departments that have drawn items from EVERY category', targetTab: 'library' },
  { topic: 'Role-Based Access Control (DCL)', category: 'Security', whereItAppears: 'Permission Matrix', technicalArtifact: 'Emulated GRANT/REVOKE mapping to 3NF PERMISSION relation', targetTab: 'schema' },
  { topic: 'Immutable Event Auditing', category: 'Compliance', whereItAppears: 'Audit Trail Page', technicalArtifact: 'AUDIT_LOG with json_object() before/after diffs & compensating undo', targetTab: 'workbench' },
  { topic: 'Database Backup & Recovery', category: 'Administration', whereItAppears: 'Backup & Restore Lab', technicalArtifact: 'Binary .sqlite download/upload, full SQL dump, and IDB snapshots', targetTab: 'backup' }
];

export const ConceptMapTab: React.FC<{ onNavigateSubTab: (tab: string) => void }> = ({ onNavigateSubTab }) => {
  return (
    <div className="space-y-6">
      <ClayCard className="p-6">
        <div className="flex items-center gap-2">
          <Map size={20} className="text-indigo-600" />
          <h2 className="text-xl font-bold font-display text-clay-text">
            DBMS Syllabus & Curriculum Concept Coverage Matrix
          </h2>
          <ClayChip variant="primary" size="sm">
            EXAMINER CHEAT SHEET
          </ClayChip>
        </div>
        <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">
          A comprehensive mapping demonstrating where every fundamental and advanced DBMS concept is implemented, enforced, and demonstrable in ClayStock.
        </p>
      </ClayCard>

      <ClayCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold border-b border-clay-border">
              <tr>
                <th className="p-3.5">Topic / Concept</th>
                <th className="p-3.5">Curriculum Domain</th>
                <th className="p-3.5">Where It Appears</th>
                <th className="p-3.5">Technical Relational Artifact</th>
                <th className="p-3.5 text-right">Interactive Lab Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clay-border">
              {CONCEPTS.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-bold text-clay-text">{c.topic}</td>
                  <td className="p-3.5">
                    <ClayChip variant="outline" size="sm">{c.category}</ClayChip>
                  </td>
                  <td className="p-3.5 text-clay-text font-medium">{c.whereItAppears}</td>
                  <td className="p-3.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                    {c.technicalArtifact}
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => onNavigateSubTab(c.targetTab)}
                      className="px-2.5 py-1 rounded-xl clay-card text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>Show Me</span>
                      <ExternalLink size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
};
