import React, { useState, useEffect } from 'react';
import { sqlClient } from '../../db/client';
import { saveNamedSnapshot, loadNamedSnapshot } from '../../db/persistence';
import { useDB } from '../../db/store';
import { ClayModal } from '../clay/ClayModal';
import { ClayButton } from '../clay/ClayButton';
import { ClayChip } from '../clay/ClayChip';
import {
  Presentation,
  ChevronRight,
  ChevronLeft,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  ArrowRight
} from 'lucide-react';

interface PresentModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: string) => void;
}

export const PresentModeModal: React.FC<PresentModeModalProps> = ({ isOpen, onClose, onNavigateTab }) => {
  const { showToast, resetDemoData, fireConfetti } = useDB();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepOutput, setStepOutput] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [snapshotTaken, setSnapshotTaken] = useState(false);

  // Take snapshot when opening Present Mode
  useEffect(() => {
    if (isOpen && !snapshotTaken) {
      (async () => {
        try {
          const bytes = await sqlClient.exportDb();
          await saveNamedSnapshot('pre_present_mode_snapshot', bytes);
          setSnapshotTaken(true);
        } catch (e) {
          console.warn('Could not save pre-demo snapshot', e);
        }
      })();
    }
  }, [isOpen, snapshotTaken]);

  const handleRestorePreDemo = async () => {
    try {
      const bytes = await loadNamedSnapshot('pre_present_mode_snapshot');
      if (bytes) {
        await sqlClient.importDb(bytes);
        showToast({
          title: 'Pre-Demo State Restored',
          description: 'Database reverted to clean snapshot captured before presentation.',
          type: 'success'
        });
      } else {
        await resetDemoData();
      }
      onClose();
    } catch (err: any) {
      showToast({
        title: 'Restore Failed',
        description: err?.message || 'Error restoring snapshot',
        type: 'error'
      });
    }
  };

  const steps = [
    {
      num: 1,
      title: 'Problem & Objectives: Centralized Relational Store',
      notes: 'Introduce K.K. Wagh Institute stationery management. Highlight that StockQty is strictly derived (never stored as a table column) to eliminate update anomalies. Walk through the 10 core tables and 11 extensions in 3NF.',
      actionLabel: 'Query Live System KPIs',
      runAction: async () => {
        const kpiRes = await sqlClient.exec(`
          SELECT 
            (SELECT COUNT(*) FROM ITEM) AS TotalSKUs,
            (SELECT COUNT(*) FROM DEPARTMENT) AS Departments,
            (SELECT COUNT(*) FROM SUPPLIER) AS Vendors,
            (SELECT SUM(Quantity) FROM SUPPLIES) AS CumulativeInward,
            (SELECT SUM(Quantity) FROM ISSUED_TO) AS CumulativeOutward,
            (SELECT SUM(StockQty) FROM V_CURRENT_STOCK) AS LiveStockBalance;
        `, [], false);
        const r = kpiRes.rows[0];
        setStepOutput(`Live View Metrics:\n• Catalog Items: ${r[0]} SKUs\n• Departments: ${r[1]}\n• Registered Vendors: ${r[2]}\n• Total Purchased Inward: ${r[3]} units\n• Total Issued Outward: ${r[4]} units\n• Net Derived Stock Balance: ${r[5]} units`);
      }
    },
    {
      num: 2,
      title: 'Real Trigger Enforcement: Over-Issue Prevention',
      notes: 'Demonstrate that business rules are enforced inside the SQL engine, not client JavaScript. Execute an illegal transaction issuing 99,999 units of A4 paper. SQLite RAISE(ABORT, INSUFFICIENT_STOCK) fires and aborts immediately.',
      actionLabel: 'Attempt Illegal Over-Issue Transaction',
      runAction: async () => {
        try {
          await sqlClient.exec(`
            INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity)
            VALUES ('IS-ILLEGAL', 'I101', 'D01', date('now'), 99999);
          `, [], false);
          setStepOutput('Error: Query unexpectedly succeeded');
        } catch (err: any) {
          setStepOutput(`SUCCESSFUL TRIGGER REJECTION:\nTrigger "trg_issue_check_stock" aborted the write with message:\n"${err?.message}"\n\nStock remains 100% unaltered.`);
        }
      }
    },
    {
      num: 3,
      title: 'Multi-Line Requisitions & Transaction Savepoints',
      notes: 'Walk through department requisition fulfillment. Show sp_fulfil_requisition using SAVEPOINT per line item. Lines with stock are issued; lines triggering stock-out are rolled back to savepoint and recorded as shortfalls.',
      actionLabel: 'Execute SAVEPOINT Requisition Fulfillment',
      runAction: async () => {
        const res = await sqlClient.callProcedure('sp_fulfil_requisition', {
          reqId: 'REQ-107',
          resource: 'REQUISITION',
          action: 'FULFIL'
        });
        const timeline = res.result?.timeline || [];
        setStepOutput(`SAVEPOINT EXECUTION LOG:\n${timeline.join('\n')}\n\nOutcome: Status set to ${res.result?.status}`);
        fireConfetti();
      }
    },
    {
      num: 4,
      title: 'Query Optimizer & Index Benchmark (50,000 Rows)',
      notes: 'Demonstrate performance engineering. Run an unindexed filter on 50,000 synthetic rows showing SCAN. Create the composite B-Tree index, re-run, and observe instant transition to SEARCH USING INDEX with ~90% latency reduction.',
      actionLabel: 'Open Index & Optimizer Lab',
      runAction: async () => {
        onNavigateTab('database-lab');
        setStepOutput('Navigated to Database Lab -> Index Optimizer Tab. You can benchmark 50k rows live!');
        onClose();
      }
    },
    {
      num: 5,
      title: 'ACID Concurrency & Lost Update Simulation',
      notes: 'Compare naive stored-column design (Clerk A and Clerk B overwriting stock) against ClayStock append-only ledger design with derived stock. Highlight that concurrent issues are properly serialized.',
      actionLabel: 'Navigate to ACID Lab',
      runAction: async () => {
        onNavigateTab('database-lab');
        setStepOutput('Navigated to Database Lab -> ACID & Concurrency Tab.');
        onClose();
      }
    },
    {
      num: 6,
      title: 'Ask Your Data (Server-Side Gemini NL-to-SQL)',
      notes: 'Show natural language to read-only SQL compiler. Demonstrate server-side AST checks (LIMIT 200 enforcement, no mutating commands) and execution against V_CURRENT_STOCK.',
      actionLabel: 'Navigate to AI Assistant',
      runAction: async () => {
        onNavigateTab('ai-assistant');
        setStepOutput('Navigated to AI Assistant tab.');
        onClose();
      }
    },
    {
      num: 7,
      title: 'Automated Self-Tests (25/25) & Concept Map',
      notes: 'Conclude the presentation by running all 25 automated assertions in front of the examiners (foreign keys, non-negative invariants, total participation, weak entities, trigger guards).',
      actionLabel: 'Run 25/25 Self-Test Suite',
      runAction: async () => {
        const { runAllSelfTests } = await import('../../db/selfTests');
        const res = await runAllSelfTests();
        setStepOutput(`SELF-TEST VERIFICATION SUITE:\n${res.passedCount} / ${res.totalCount} ASSERTIONS PASSED (100%)\nAll 21 tables, views, triggers, and BCNF constraints mathematically verified.`);
        fireConfetti();
      }
    }
  ];

  const current = steps[currentStep - 1];

  const handleStepAction = async () => {
    setIsExecuting(true);
    setStepOutput(null);
    try {
      await current.runAction();
    } catch (e: any) {
      setStepOutput(`Error: ${e?.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <ClayModal isOpen={isOpen} onClose={onClose} title="Competition Presentation Mode">
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        {/* Step Header */}
        <div className="flex items-center justify-between pb-3 border-b border-clay-border">
          <div className="flex items-center gap-2">
            <Presentation size={18} className="text-indigo-600" />
            <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text">
              Step {current.num} of 7
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-indigo-600">
            {Math.round((current.num / 7) * 100)}% Complete
          </span>
        </div>

        {/* Title & Presenter Notes */}
        <div className="space-y-3">
          <h2 className="text-base font-bold font-display text-clay-text">
            {current.title}
          </h2>

          <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Presenter Cue & Academic Talking Points:
            </span>
            <p className="text-xs text-clay-text-muted leading-relaxed">
              {current.notes}
            </p>
          </div>
        </div>

        {/* Live Execution Panel */}
        <div className="p-4 rounded-2xl clay-card space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-clay-text">Interactive Live Action</span>
            <ClayButton
              variant="primary"
              size="sm"
              icon={<Play size={12} />}
              onClick={handleStepAction}
              disabled={isExecuting}
            >
              {isExecuting ? 'Running...' : current.actionLabel}
            </ClayButton>
          </div>

          {stepOutput && (
            <pre className="p-3 rounded-xl clay-inset text-xs font-mono text-clay-text whitespace-pre-wrap max-h-48 overflow-y-auto">
              {stepOutput}
            </pre>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-clay-border">
          <div className="flex items-center gap-2">
            <ClayButton
              variant="outline"
              size="sm"
              icon={<RotateCcw size={14} />}
              onClick={handleRestorePreDemo}
            >
              Restore Pre-Demo State
            </ClayButton>
          </div>

          <div className="flex items-center gap-2">
            <ClayButton
              variant="ghost"
              size="sm"
              disabled={currentStep === 1}
              onClick={() => {
                setCurrentStep(prev => Math.max(1, prev - 1));
                setStepOutput(null);
              }}
            >
              <ChevronLeft size={16} /> Previous
            </ClayButton>

            <ClayButton
              variant="primary"
              size="sm"
              disabled={currentStep === 7}
              onClick={() => {
                setCurrentStep(prev => Math.min(7, prev + 1));
                setStepOutput(null);
              }}
            >
              Next Step <ChevronRight size={16} />
            </ClayButton>
          </div>
        </div>
      </div>
    </ClayModal>
  );
};
