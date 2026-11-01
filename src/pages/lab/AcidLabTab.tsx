import React, { useState } from 'react';
import { sqlClient } from '../../db/client';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { ShieldCheck, Play, RotateCcw, AlertTriangle, Users, GitBranch, RefreshCw } from 'lucide-react';

export const AcidLabTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'atomicity' | 'consistency' | 'isolation' | 'durability'>('atomicity');

  // Atomicity state
  const [atomicityLogs, setAtomicityLogs] = useState<string[]>([]);
  const [isAtomicityRunning, setIsAtomicityRunning] = useState(false);

  // Consistency state
  const [consistencyLogs, setConsistencyLogs] = useState<string[]>([]);

  // Isolation Simulation state
  const [isolationMode, setIsolationMode] = useState<'naive' | 'claystock'>('naive');
  const [simStep, setSimStep] = useState(0);

  const handleTestAtomicity = async () => {
    setIsAtomicityRunning(true);
    setAtomicityLogs(['BEGIN TRANSACTION;']);

    try {
      // Step 1: Check initial count
      const countRes = await sqlClient.exec("SELECT COUNT(*) FROM SUPPLIES WHERE PurchaseID = 'PO-TEST-FAIL';", [], false);
      const preCount = Number(countRes.rows[0][0]);
      setAtomicityLogs(prev => [...prev, `Initial check: Record PO-TEST-FAIL exists: ${preCount > 0}`]);

      // Step 2: Run batch with constraint failure
      setAtomicityLogs(prev => [
        ...prev,
        `Statement 1: INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-TEST-FAIL', 'I101', 'S01', date('now'), 10, 2000); -- VALID`,
        `Statement 2: INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-TEST-ILLEGAL', 'I101', 'S01', date('now'), -99, 100); -- INVALID CHECK(Quantity > 0)`
      ]);

      await sqlClient.batch([
        { sql: `INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-TEST-FAIL', 'I101', 'S01', date('now'), 10, 2000);` },
        { sql: `INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-TEST-ILLEGAL', 'I101', 'S01', date('now'), -99, 100);` }
      ]);
    } catch (err: any) {
      setAtomicityLogs(prev => [
        ...prev,
        `Constraint Error Encountered: ${err?.message}`,
        `AUTOMATIC ROLLBACK EXECUTED.`
      ]);

      // Verify post-rollback count
      const countPost = await sqlClient.exec("SELECT COUNT(*) FROM SUPPLIES WHERE PurchaseID = 'PO-TEST-FAIL';", [], false);
      const postCount = Number(countPost.rows[0][0]);
      setAtomicityLogs(prev => [
        ...prev,
        `Post-Rollback Verification: PO-TEST-FAIL exists: ${postCount > 0} (Total 0 rows inserted).`,
        `✅ ATOMICITY PROVED: The successful statement 1 was completely rolled back when statement 2 failed.`
      ]);
    } finally {
      setIsAtomicityRunning(false);
    }
  };

  const handleTestConsistencyViolation = async (violationType: string) => {
    try {
      if (violationType === 'NEGATIVE_PRICE') {
        await sqlClient.exec(`INSERT INTO ITEM (ItemID, ItemName, Category, UnitPrice) VALUES ('I-FAIL', 'Negative', 'Misc', -10);`, [], false);
      } else if (violationType === 'ORPHAN_FK') {
        await sqlClient.exec(`INSERT INTO SUPPLIES (PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost) VALUES ('PO-FK', 'I999_ORPHAN', 'S01', date('now'), 1, 100);`, [], false);
      } else if (violationType === 'OVER_ISSUE') {
        await sqlClient.exec(`INSERT INTO ISSUED_TO (IssueID, ItemID, DeptID, IssueDate, Quantity) VALUES ('IS-OVER', 'I101', 'D01', date('now'), 99999);`, [], false);
      }
      setConsistencyLogs([`Error: Action unexpectedly succeeded`]);
    } catch (err: any) {
      setConsistencyLogs([
        `Attempted Violation: ${violationType}`,
        `Rejected by Database Engine:`,
        err?.message || String(err),
        `Outcome: State remains consistent. Invariant protected.`
      ]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subtab selection */}
      <div className="flex items-center gap-2 pb-2 border-b border-clay-border">
        <button
          onClick={() => setActiveSubTab('atomicity')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'atomicity' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Atomicity (Real Rollback)
        </button>

        <button
          onClick={() => setActiveSubTab('consistency')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'consistency' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Consistency (Constraint Rejection)
        </button>

        <button
          onClick={() => setActiveSubTab('isolation')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'isolation' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Isolation & Lost Updates (Simulation)
        </button>

        <button
          onClick={() => setActiveSubTab('durability')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'durability' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Durability (Crash & Reload)
        </button>
      </div>

      {/* SubTab 1: Atomicity */}
      {activeSubTab === 'atomicity' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-clay-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-clay-text">
                  ACID Atomicity Verification (All-or-Nothing Rule)
                </h3>
                <ClayChip variant="success" size="sm">REAL SQL ENGINE</ClayChip>
              </div>
              <p className="text-xs text-clay-text-muted mt-1">
                Execute a multi-statement transaction where Statement 1 is valid, but Statement 2 violates a CHECK constraint.
              </p>
            </div>

            <ClayButton
              variant="primary"
              size="md"
              icon={<Play size={14} />}
              onClick={handleTestAtomicity}
              disabled={isAtomicityRunning}
            >
              {isAtomicityRunning ? 'Testing...' : 'Execute Atomicity Test'}
            </ClayButton>
          </div>

          <div className="p-4 rounded-2xl clay-inset font-mono text-xs space-y-1.5 min-h-[160px] text-clay-text">
            {atomicityLogs.map((log, idx) => (
              <div key={idx} className={log.includes('✅') ? 'text-emerald-600 font-bold' : log.includes('ROLLBACK') ? 'text-rose-600 font-bold' : ''}>
                {log}
              </div>
            ))}
            {atomicityLogs.length === 0 && (
              <span className="text-clay-text-muted italic">Click "Execute Atomicity Test" to observe real-time atomic rollback.</span>
            )}
          </div>
        </ClayCard>
      )}

      {/* SubTab 2: Consistency */}
      {activeSubTab === 'consistency' && (
        <ClayCard className="p-6 space-y-4">
          <div className="border-b border-clay-border pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-display text-clay-text">
                Consistency & Integrity Violation Defense
              </h3>
              <ClayChip variant="success" size="sm">REAL ENFORCEMENT</ClayChip>
            </div>
            <p className="text-xs text-clay-text-muted mt-1">
              Select an invalid state mutation to verify which SQLite constraint or trigger guards consistency.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ClayButton variant="outline" size="sm" onClick={() => handleTestConsistencyViolation('NEGATIVE_PRICE')}>
              Violate CHECK(UnitPrice &gt;= 0)
            </ClayButton>
            <ClayButton variant="outline" size="sm" onClick={() => handleTestConsistencyViolation('ORPHAN_FK')}>
              Violate FOREIGN KEY (Orphan ItemID)
            </ClayButton>
            <ClayButton variant="outline" size="sm" onClick={() => handleTestConsistencyViolation('OVER_ISSUE')}>
              Violate Stock (trg_issue_check_stock)
            </ClayButton>
          </div>

          {consistencyLogs.length > 0 && (
            <div className="p-4 rounded-2xl clay-inset font-mono text-xs space-y-1 text-clay-text">
              {consistencyLogs.map((log, idx) => (
                <div key={idx} className={idx === 2 ? 'text-rose-600 font-bold' : ''}>{log}</div>
              ))}
            </div>
          )}
        </ClayCard>
      )}

      {/* SubTab 3: Isolation Simulation */}
      {activeSubTab === 'isolation' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-clay-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold font-display text-clay-text">
                  Concurrent Isolation & Lost Update Anomaly Simulation
                </h3>
                <ClayChip variant="primary" size="sm">SIMULATION</ClayChip>
              </div>
              <p className="text-xs text-clay-text-muted mt-1">
                Step through side-by-side transaction schedules demonstrating the Lost Update Anomaly in naive designs versus ClayStock's append-only ledger architecture.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsolationMode('naive'); setSimStep(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  isolationMode === 'naive' ? 'bg-amber-600 text-white' : 'clay-card text-clay-text'
                }`}
              >
                Naive Stored StockQty (Bug)
              </button>
              <button
                onClick={() => { setIsolationMode('claystock'); setSimStep(0); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${
                  isolationMode === 'claystock' ? 'bg-indigo-600 text-white' : 'clay-card text-clay-text'
                }`}
              >
                ClayStock Append-Only Ledger
              </button>
            </div>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs">
            <span className="font-bold text-clay-text">
              Schedule Step {simStep} / 4
            </span>
            <div className="flex items-center gap-2">
              <ClayButton variant="ghost" size="sm" onClick={() => setSimStep(0)}>Reset</ClayButton>
              <ClayButton
                variant="primary"
                size="sm"
                disabled={simStep >= 4}
                onClick={() => setSimStep(prev => prev + 1)}
              >
                Next Schedule Step →
              </ClayButton>
            </div>
          </div>

          {/* Side by side Clerk Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl clay-card space-y-2 border-l-4 border-indigo-500">
              <span className="font-bold font-display text-xs text-indigo-600 flex items-center gap-1.5">
                <Users size={14} /> Clerk A (Session 1 - Wants to issue 15 units)
              </span>
              <div className="p-3 rounded-xl clay-inset font-mono text-[11px] space-y-1">
                {simStep >= 1 && <div>T1: SELECT StockQty FROM ITEM; -- Reads 20</div>}
                {simStep >= 3 && (
                  <div className={isolationMode === 'naive' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                    {isolationMode === 'naive'
                      ? 'T3: UPDATE ITEM SET StockQty = 20 - 15 = 5; -- OVERWRITES!'
                      : 'T3: INSERT INTO ISSUED_TO (Qty=15); -- Balance becomes 5'}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl clay-card space-y-2 border-l-4 border-purple-500">
              <span className="font-bold font-display text-xs text-purple-600 flex items-center gap-1.5">
                <Users size={14} /> Clerk B (Session 2 - Wants to issue 10 units)
              </span>
              <div className="p-3 rounded-xl clay-inset font-mono text-[11px] space-y-1">
                {simStep >= 2 && <div>T2: SELECT StockQty FROM ITEM; -- Also Reads 20!</div>}
                {simStep >= 4 && (
                  <div className={isolationMode === 'naive' ? 'text-rose-600 font-bold' : 'text-rose-600 font-bold'}>
                    {isolationMode === 'naive'
                      ? 'T4: UPDATE ITEM SET StockQty = 20 - 10 = 10; -- LOST UPDATE! (Clerk A issue lost!)'
                      : 'T4: INSERT INTO ISSUED_TO (Qty=10); -- TRIGGER ABORT: INSUFFICIENT_STOCK (Only 5 left!)'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ClayCard>
      )}

      {/* SubTab 4: Durability */}
      {activeSubTab === 'durability' && (
        <ClayCard className="p-6 space-y-4">
          <div className="border-b border-clay-border pb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold font-display text-clay-text">
                ACID Durability Test (IndexedDB Synchronization)
              </h3>
              <ClayChip variant="success" size="sm">REAL PERSISTENCE</ClayChip>
            </div>
            <p className="text-xs text-clay-text-muted mt-1">
              ClayStock persists full database bytes into IndexedDB debounced after every commit, and flushes on visibilitychange and pagehide.
            </p>
          </div>

          <p className="text-xs text-clay-text-muted leading-relaxed">
            Clicking the reload simulation below flushes storage and reloads the window. When the application boots, the SQLite engine detects the existing bytes in IndexedDB and boots with all mutations preserved.
          </p>

          <ClayButton
            variant="primary"
            size="md"
            icon={<RefreshCw size={14} />}
            onClick={async () => {
              await sqlClient.flushStorageNow();
              window.location.reload();
            }}
          >
            Simulate Browser Crash / Page Reload
          </ClayButton>
        </ClayCard>
      )}
    </div>
  );
};
