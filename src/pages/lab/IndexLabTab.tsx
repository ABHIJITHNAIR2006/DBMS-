import React, { useState, useEffect } from 'react';
import { sqlClient } from '../../db/client';
import { QueryResult } from '../../db/worker/types';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Zap, Play, Box, CheckCircle2, TrendingDown, AlertTriangle, Layers } from 'lucide-react';

export const IndexLabTab: React.FC = () => {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [indexCreated, setIndexCreated] = useState(false);

  // Timings and plans
  const [scanTimeMs, setScanTimeMs] = useState<number | null>(null);
  const [scanPlan, setScanPlan] = useState<string | null>(null);
  const [searchTimeMs, setSearchTimeMs] = useState<number | null>(null);
  const [searchPlan, setSearchPlan] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // Advanced experiments
  const [colOrderResult, setColOrderResult] = useState<string | null>(null);
  const [partialIdxResult, setPartialIdxResult] = useState<string | null>(null);
  const [funcOnColResult, setFuncOnColResult] = useState<string | null>(null);

  // Clean up sandbox on unmount
  useEffect(() => {
    return () => {
      if (sandboxId) {
        sqlClient.dropSandbox(sandboxId);
      }
    };
  }, [sandboxId]);

  const handleGenerateSandbox = async () => {
    setIsGenerating(true);
    try {
      const res = await sqlClient.seedLargeBench();
      setSandboxId(res.sandboxId);
      setIndexCreated(false);
      setScanTimeMs(null);
      setScanPlan(null);
      setSearchTimeMs(null);
      setSearchPlan(null);
    } catch (err: any) {
      alert(`Could not generate benchmark sandbox: ${err?.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const benchmarkQuery = `SELECT ItemID, SUM(Quantity) FROM BENCH_ISSUED_TO WHERE ItemID = 'I105' AND IssueDate >= '2025-06-01' GROUP BY ItemID;`;

  const handleRunUnindexed = async () => {
    if (!sandboxId) return;
    setIsBenchmarking(true);
    try {
      const planRes = await sqlClient.execSandbox(sandboxId, `EXPLAIN QUERY PLAN ${benchmarkQuery}`);
      const queryRes = await sqlClient.execSandbox(sandboxId, benchmarkQuery);
      setScanTimeMs(queryRes.ms);
      setScanPlan(planRes.rows.map(r => r[3] || r[r.length - 1]).join(' -> '));
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleCreateIndex = async () => {
    if (!sandboxId) return;
    try {
      await sqlClient.execSandbox(
        sandboxId,
        `CREATE INDEX idx_bench_item_date ON BENCH_ISSUED_TO(ItemID, IssueDate);`
      );
      setIndexCreated(true);
    } catch (err: any) {
      alert(`Index creation error: ${err?.message}`);
    }
  };

  const handleRunIndexed = async () => {
    if (!sandboxId) return;
    setIsBenchmarking(true);
    try {
      const planRes = await sqlClient.execSandbox(sandboxId, `EXPLAIN QUERY PLAN ${benchmarkQuery}`);
      const queryRes = await sqlClient.execSandbox(sandboxId, benchmarkQuery);
      setSearchTimeMs(queryRes.ms);
      setSearchPlan(planRes.rows.map(r => r[3] || r[r.length - 1]).join(' -> '));
    } finally {
      setIsBenchmarking(false);
    }
  };

  const handleTestColOrder = async () => {
    if (!sandboxId) return;
    // Leading ItemID vs Leading IssueDate
    const planA = await sqlClient.execSandbox(
      sandboxId,
      `EXPLAIN QUERY PLAN SELECT * FROM BENCH_ISSUED_TO WHERE ItemID = 'I105';`
    );
    const planB = await sqlClient.execSandbox(
      sandboxId,
      `EXPLAIN QUERY PLAN SELECT * FROM BENCH_ISSUED_TO WHERE IssueDate = '2025-06-01';`
    );
    setColOrderResult(
      `Composite Index on (ItemID, IssueDate):\n• Filter on ItemID (leading col): ${planA.rows.map(r => r[3]).join(' ')}\n• Filter on IssueDate (trailing col): ${planB.rows.map(r => r[3]).join(' ')} (Notice index cannot be used as a primary search tree for non-prefix attributes!)`
    );
  };

  const handleTestFuncOnCol = async () => {
    if (!sandboxId) return;
    const plan = await sqlClient.execSandbox(
      sandboxId,
      `EXPLAIN QUERY PLAN SELECT * FROM BENCH_ISSUED_TO WHERE UPPER(ItemID) = 'I105';`
    );
    setFuncOnColResult(
      `Query: WHERE UPPER(ItemID) = 'I105'\nPlan: ${plan.rows.map(r => r[3]).join(' ')}\nReason: Wrapping ItemID in UPPER() prevents B-Tree traversal because the stored index values are not transformed. An expression index is required instead.`
    );
  };

  const pctImprovement = scanTimeMs && searchTimeMs ? Math.round(((scanTimeMs - searchTimeMs) / scanTimeMs) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <ClayCard className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold font-display text-clay-text">
              Index & Query Optimizer Performance Lab
            </h2>
            <ClayChip variant="primary" size="md">
              50,000 ROW BENCHMARK
            </ClayChip>
          </div>
          <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">
            Generate 50,000 synthetic transaction records into a disposable sandbox to empirically observe Full Table SCAN vs B-Tree Index SEARCH.
          </p>
        </div>

        <div>
          {!sandboxId ? (
            <ClayButton
              variant="primary"
              size="md"
              icon={<Zap size={16} />}
              onClick={handleGenerateSandbox}
              disabled={isGenerating}
            >
              {isGenerating ? 'Generating 50,000 Rows...' : 'Generate 50,000 Rows Sandbox'}
            </ClayButton>
          ) : (
            <div className="flex items-center gap-2">
              <ClayChip variant="warning" size="md">
                Sandbox Active (50k Rows)
              </ClayChip>
              <ClayButton variant="ghost" size="sm" onClick={() => { sqlClient.dropSandbox(sandboxId); setSandboxId(null); }}>
                Destroy Sandbox
              </ClayButton>
            </div>
          )}
        </div>
      </ClayCard>

      {/* Guided 3-Step Benchmark Flow */}
      {sandboxId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
          {/* Step 1: Unindexed SCAN */}
          <ClayCard className={`p-5 space-y-3 ${scanTimeMs ? 'border-amber-400' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-amber-600">STEP 1</span>
              {scanTimeMs && <ClayChip variant="warning" size="sm">{scanTimeMs} ms</ClayChip>}
            </div>

            <h3 className="text-sm font-bold font-display text-clay-text">
              Run Unindexed Query
            </h3>
            <p className="text-xs text-clay-text-muted">
              Table has zero secondary indexes. The SQLite query planner is forced to execute a sequential scan over all 50,000 rows.
            </p>

            <ClayButton
              variant="outline"
              size="sm"
              icon={<Play size={12} />}
              onClick={handleRunUnindexed}
              disabled={isBenchmarking}
              className="w-full"
            >
              Run Full Scan
            </ClayButton>

            {scanPlan && (
              <div className="p-2.5 rounded-xl clay-inset font-mono text-[11px] text-amber-700 dark:text-amber-300">
                Plan: {scanPlan}
              </div>
            )}
          </ClayCard>

          {/* Step 2: Create B-Tree Index */}
          <ClayCard className={`p-5 space-y-3 ${indexCreated ? 'border-indigo-500' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-indigo-600">STEP 2</span>
              {indexCreated && <ClayChip variant="success" size="sm">Active</ClayChip>}
            </div>

            <h3 className="text-sm font-bold font-display text-clay-text">
              Build B-Tree Composite Index
            </h3>
            <p className="text-xs text-clay-text-muted">
              Execute <span className="font-mono text-[11px] font-bold">CREATE INDEX idx(ItemID, IssueDate)</span> to generate an ordered B-Tree index structure.
            </p>

            <ClayButton
              variant="primary"
              size="sm"
              icon={<Layers size={12} />}
              onClick={handleCreateIndex}
              disabled={indexCreated || !scanTimeMs}
              className="w-full"
            >
              {indexCreated ? 'Index Created' : 'Create B-Tree Index'}
            </ClayButton>

            {indexCreated && (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                ✓ Index idx_bench_item_date constructed
              </div>
            )}
          </ClayCard>

          {/* Step 3: Indexed SEARCH */}
          <ClayCard className={`p-5 space-y-3 ${searchTimeMs ? 'border-emerald-500' : ''}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-emerald-600">STEP 3</span>
              {searchTimeMs && <ClayChip variant="success" size="sm">{searchTimeMs} ms</ClayChip>}
            </div>

            <h3 className="text-sm font-bold font-display text-clay-text">
              Re-Run with Index Search
            </h3>
            <p className="text-xs text-clay-text-muted">
              Observe transition to SEARCH USING INDEX with logarithmic O(log N) branch traversal.
            </p>

            <ClayButton
              variant="primary"
              size="sm"
              icon={<Play size={12} />}
              onClick={handleRunIndexed}
              disabled={isBenchmarking || !indexCreated}
              className="w-full"
            >
              Run Indexed Search
            </ClayButton>

            {searchPlan && (
              <div className="p-2.5 rounded-xl clay-inset font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                Plan: {searchPlan}
              </div>
            )}
          </ClayCard>
        </div>
      )}

      {/* Comparison Chart & Metrics */}
      {scanTimeMs !== null && searchTimeMs !== null && (
        <ClayCard className="p-6 space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text flex items-center gap-2">
                <TrendingDown size={18} className="text-emerald-500" />
                Empirical Performance Acceleration: {pctImprovement}% Faster
              </h3>
              <p className="text-xs text-clay-text-muted">
                Sequential SCAN ({scanTimeMs}ms) vs B-Tree SEARCH ({searchTimeMs}ms) over 50,000 tuples.
              </p>
            </div>
            <ClayChip variant="success" size="md">
              {pctImprovement}% Reduction
            </ClayChip>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-bold text-clay-text mb-1">
                <span>Before: Full Table Scan (SCAN BENCH_ISSUED_TO)</span>
                <span>{scanTimeMs} ms</span>
              </div>
              <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-clay-text mb-1">
                <span>After: B-Tree Index Search (SEARCH USING INDEX)</span>
                <span>{searchTimeMs} ms</span>
              </div>
              <div className="w-full h-4 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${Math.max(4, Math.round((searchTimeMs / scanTimeMs) * 100))}%` }}
                />
              </div>
            </div>
          </div>
        </ClayCard>
      )}

      {/* Advanced Indexing Experiments */}
      {sandboxId && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          {/* Experiment 1: Prefix Rule */}
          <ClayCard className="p-5 space-y-3">
            <h3 className="text-sm font-bold font-display text-clay-text">
              Prefix Rule: Column Order in Composite Indexes
            </h3>
            <p className="text-xs text-clay-text-muted">
              An index on <span className="font-mono font-bold">(ItemID, IssueDate)</span> can accelerate filters on ItemID alone, but NOT on IssueDate alone.
            </p>
            <ClayButton variant="outline" size="sm" onClick={handleTestColOrder}>
              Demonstrate Column Order Effect
            </ClayButton>
            {colOrderResult && (
              <pre className="p-3 rounded-xl clay-inset font-mono text-[11px] text-clay-text whitespace-pre-wrap">
                {colOrderResult}
              </pre>
            )}
          </ClayCard>

          {/* Experiment 2: Functions on Columns */}
          <ClayCard className="p-5 space-y-3">
            <h3 className="text-sm font-bold font-display text-clay-text">
              Index Invalidation: Functions on Indexed Columns
            </h3>
            <p className="text-xs text-clay-text-muted">
              Applying a SQL function like <span className="font-mono font-bold">UPPER(ItemID)</span> causes the optimizer to bypass B-Tree index traversal.
            </p>
            <ClayButton variant="outline" size="sm" onClick={handleTestFuncOnCol}>
              Demonstrate Function Bypassing Index
            </ClayButton>
            {funcOnColResult && (
              <pre className="p-3 rounded-xl clay-inset font-mono text-[11px] text-clay-text whitespace-pre-wrap">
                {funcOnColResult}
              </pre>
            )}
          </ClayCard>
        </div>
      )}
    </div>
  );
};
