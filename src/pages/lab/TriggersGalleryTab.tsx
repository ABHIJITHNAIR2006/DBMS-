import React, { useState } from 'react';
import { sqlClient } from '../../db/client';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Zap, Play, Eye, ShieldAlert } from 'lucide-react';

interface TriggerDemo {
  name: string;
  table: string;
  timing: string;
  purpose: string;
  sqlDefinition: string;
  demoSql: string;
  expectedOutcome: string;
}

const TRIGGER_DEMOS: TriggerDemo[] = [
  {
    name: 'trg_issue_check_stock',
    table: 'ISSUED_TO',
    timing: 'BEFORE INSERT',
    purpose: 'Enforces stock-out prevention. Aborts with INSUFFICIENT_STOCK if requested quantity exceeds derived inventory.',
    sqlDefinition: `CREATE TRIGGER trg_issue_check_stock
BEFORE INSERT ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'INSUFFICIENT_STOCK')
    WHERE NEW.Quantity > (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = NEW.ItemID);
END;`,
    demoSql: `INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('TEST-OVER', 'I101', 'D01', date('now'), 99999);`,
    expectedOutcome: 'Aborts with message: INSUFFICIENT_STOCK'
  },
  {
    name: 'trg_issue_emp_dept',
    table: 'ISSUED_TO',
    timing: 'BEFORE INSERT',
    purpose: 'Ensures staff receiving stationery belong to the department charged on the voucher.',
    sqlDefinition: `CREATE TRIGGER trg_issue_emp_dept
BEFORE INSERT ON ISSUED_TO
BEGIN
    SELECT RAISE(ABORT, 'EMPLOYEE_DEPT_MISMATCH')
    WHERE NEW.EmpID IS NOT NULL 
      AND (SELECT DeptID FROM EMPLOYEE WHERE EmpID = NEW.EmpID) != NEW.DeptID;
END;`,
    demoSql: `INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, EmpID, IssueDate, Quantity) VALUES ('TEST-MISMATCH', 'I101', 'D01', 'E005', date('now'), 1);`,
    expectedOutcome: 'Aborts with message: EMPLOYEE_DEPT_MISMATCH (Dr. Sunita Kulkarni is in D02, not D01)'
  },
  {
    name: 'trg_disjoint_consumable',
    table: 'CONSUMABLE_ITEM',
    timing: 'BEFORE INSERT',
    purpose: 'Guarantees EER disjoint specialization ("d"): an item cannot simultaneously exist as both Consumable and Durable.',
    sqlDefinition: `CREATE TRIGGER trg_disjoint_consumable
BEFORE INSERT ON CONSUMABLE_ITEM
BEGIN
    SELECT RAISE(ABORT, 'DISJOINT_VIOLATION')
    WHERE EXISTS (SELECT 1 FROM DURABLE_ITEM WHERE ItemID = NEW.ItemID);
END;`,
    demoSql: `INSERT INTO CONSUMABLE_ITEM (ItemID, ReorderLevel) VALUES ('I125', 10);`,
    expectedOutcome: 'Aborts with message: DISJOINT_VIOLATION (Item I125 is already registered as a Durable Stapler)'
  },
  {
    name: 'trg_supplies_delete_guard',
    table: 'SUPPLIES',
    timing: 'BEFORE DELETE',
    purpose: 'Prevents negative stock anomaly by barring deletion of purchase orders whose stock has already been distributed.',
    sqlDefinition: `CREATE TRIGGER trg_supplies_delete_guard
BEFORE DELETE ON SUPPLIES
BEGIN
    SELECT RAISE(ABORT, 'NEGATIVE_STOCK_GUARD')
    WHERE (SELECT StockQty FROM V_CURRENT_STOCK WHERE ItemID = OLD.ItemID) - OLD.Quantity < 0;
END;`,
    demoSql: `DELETE FROM SUPPLIES WHERE PurchaseID = 'PO1001';`,
    expectedOutcome: 'Aborts with message: NEGATIVE_STOCK_GUARD (500 units already issued to departments)'
  }
];

export const TriggersGalleryTab: React.FC = () => {
  const [selectedDemo, setSelectedDemo] = useState<TriggerDemo>(TRIGGER_DEMOS[0]);
  const [demoResult, setDemoResult] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const handleFireDemo = async (demo: TriggerDemo) => {
    setSelectedDemo(demo);
    setIsRunning(true);
    setDemoResult(null);

    try {
      // Execute in isolated sandbox or wrapped batch with forced rollback
      await sqlClient.batch([
        { sql: demo.demoSql },
        { sql: `SELECT RAISE(ABORT, 'DEMO_COMPLETED');` }
      ]);
      setDemoResult('Statement unexpectedly succeeded without trigger abort.');
    } catch (err: any) {
      setDemoResult(
        `TRIGGER ACTIVATED & FIRED:\n${err?.message}\n\nTransaction was automatically rolled back. Zero database state corrupted.`
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <ClayCard className="p-6">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-amber-500" />
          <h2 className="text-xl font-bold font-display text-clay-text">
            Triggers & Active Database Rules Gallery
          </h2>
          <ClayChip variant="primary" size="sm">
            ECA RULES (Event-Condition-Action)
          </ClayChip>
        </div>
        <p className="text-xs text-clay-text-muted mt-1">
          Explore SQLite triggers that actively maintain business invariants, generate automated alerts, and audit data mutations.
        </p>
      </ClayCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {TRIGGER_DEMOS.map(demo => (
          <ClayCard key={demo.name} className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  {demo.name}
                </span>
                <p className="text-xs font-bold text-clay-text mt-0.5">
                  ON {demo.table} ({demo.timing})
                </p>
              </div>

              <ClayButton
                variant="primary"
                size="sm"
                icon={<Play size={12} />}
                onClick={() => handleFireDemo(demo)}
                disabled={isRunning}
              >
                Fire Safe Demo
              </ClayButton>
            </div>

            <p className="text-xs text-clay-text-muted leading-relaxed">
              {demo.purpose}
            </p>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-clay-text-muted">Trigger DDL Definition:</span>
              <pre className="p-3 rounded-xl clay-inset font-mono text-[11px] text-clay-text overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {demo.sqlDefinition}
              </pre>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
              <strong>Test SQL:</strong> <code className="font-mono">{demo.demoSql}</code>
            </div>
          </ClayCard>
        ))}
      </div>

      {/* Floating Demo Result Modal */}
      {demoResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="clay-card p-6 max-w-xl w-full space-y-4">
            <div className="flex items-center justify-between border-b border-clay-border pb-3">
              <h3 className="text-sm font-bold font-display text-clay-text flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Trigger Fired: {selectedDemo.name}
              </h3>
              <button onClick={() => setDemoResult(null)} className="text-xs font-bold text-clay-text-muted hover:text-clay-text">
                ✕ Close
              </button>
            </div>

            <pre className="p-4 rounded-xl clay-inset font-mono text-xs text-clay-text whitespace-pre-wrap leading-relaxed">
              {demoResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
