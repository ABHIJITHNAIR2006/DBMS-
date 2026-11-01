import React, { useState, useRef, useTransition } from 'react';
import { sqlClient } from '../../db/client';
import { QueryResult } from '../../db/worker/types';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Play, Download, Sparkles, AlertCircle, History, Trash2, Box, Eye } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';

export const WorkbenchTab: React.FC = () => {
  const [sql, setSql] = useState<string>('SELECT * FROM V_CURRENT_STOCK ORDER BY StockQty ASC LIMIT 25;');
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [mode, setMode] = useState<'readonly' | 'sandbox'>('readonly');
  const [activeResultTab, setActiveResultTab] = useState<'results' | 'plan' | 'ai'>('results');

  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [explainResult, setExplainResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([
    'SELECT * FROM V_CURRENT_STOCK ORDER BY StockQty ASC LIMIT 25;',
    'SELECT * FROM V_STOCK_LEDGER WHERE ItemID = "I101" LIMIT 50;',
    'SELECT DeptID, SUM(Quantity) FROM ISSUED_TO GROUP BY DeptID;'
  ]);

  // AI Explanation
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Virtualization container
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: queryResult?.rows.length || 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 36,
    overscan: 10
  });

  const handleRunQuery = async () => {
    setIsRunning(true);
    setQueryError(null);
    setAiExplanation(null);

    const trimmed = sql.trim();
    if (!trimmed) {
      setIsRunning(false);
      return;
    }

    try {
      let res: QueryResult;
      let planRes: QueryResult | null = null;

      if (mode === 'sandbox' && sandboxId) {
        res = await sqlClient.execSandbox(sandboxId, trimmed);
        try {
          planRes = await sqlClient.execSandbox(sandboxId, `EXPLAIN QUERY PLAN ${trimmed}`);
        } catch {
          // not all queries support explain
        }
      } else {
        // Read-only main DB guard
        if (!/^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i.test(trimmed)) {
          throw new Error('Read-Only Main DB: Modifying statements (INSERT, UPDATE, DELETE, DROP, CREATE) are blocked on the main connection. Switch to "Sandbox (Writes Allowed)" mode above to test mutations safely.');
        }
        res = await sqlClient.exec(trimmed, []);
        try {
          planRes = await sqlClient.explain(trimmed);
        } catch {
          // not all queries support explain
        }
      }

      setQueryResult(res);
      setExplainResult(planRes);

      if (!queryHistory.includes(trimmed)) {
        setQueryHistory(prev => [trimmed, ...prev.slice(0, 9)]);
      }
    } catch (err: any) {
      setQueryError(err?.message || String(err));
      setQueryResult(null);
      setExplainResult(null);
    } finally {
      setIsRunning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunQuery();
    }
  };

  const handleCreateSandbox = async () => {
    try {
      const res = await sqlClient.createSandbox();
      setSandboxId(res.sandboxId);
      setMode('sandbox');
    } catch (err: any) {
      alert(`Could not create sandbox: ${err?.message}`);
    }
  };

  const handleDiscardSandbox = async () => {
    if (sandboxId) {
      await sqlClient.dropSandbox(sandboxId);
      setSandboxId(null);
    }
    setMode('readonly');
  };

  const handleExportCsv = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const csv = [
      queryResult.columns.join(','),
      ...queryResult.rows.map(r => r.map(c => JSON.stringify(c ?? '')).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExplainWithAi = async () => {
    setIsExplaining(true);
    try {
      const res = await fetch('/api/gemini/explain-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql,
          plan: explainResult?.rows || []
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Explain error');
      setAiExplanation(data.explanation);
      setActiveResultTab('ai');
    } catch (err: any) {
      setAiExplanation(`AI Explain unavailable: ${err?.message}`);
      setActiveResultTab('ai');
    } finally {
      setIsExplaining(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Banner & Sandbox Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl clay-card">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${mode === 'readonly' ? 'bg-indigo-500' : 'bg-amber-500 animate-pulse'}`} />
          <div>
            <span className="text-xs font-bold font-display text-clay-text flex items-center gap-2">
              Active Connection: {mode === 'readonly' ? 'Read-Only (Main Database)' : 'Disposable Sandbox (Writes Allowed)'}
              <ClayChip variant={mode === 'readonly' ? 'outline' : 'warning'} size="sm">
                {mode === 'readonly' ? 'PRAGMA query_only = ON' : 'EPHEMERAL CLONE'}
              </ClayChip>
            </span>
            <p className="text-[11px] text-clay-text-muted">
              {mode === 'readonly'
                ? 'Production connection protected against unintended mutation. Zero risk of data corruption.'
                : 'Isolated in-memory clone. Execute DML and DDL freely without altering persistent records.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'readonly' ? (
            <ClayButton variant="outline" size="sm" icon={<Box size={14} />} onClick={handleCreateSandbox}>
              Launch Sandbox
            </ClayButton>
          ) : (
            <ClayButton variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={handleDiscardSandbox}>
              Discard Sandbox
            </ClayButton>
          )}
        </div>
      </div>

      {/* SQL Editor Card */}
      <ClayCard className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold font-display text-clay-text">SQL Query Editor</span>
            <span className="text-[10px] text-clay-text-muted">(Press Ctrl+Enter to Run)</span>
          </div>

          <div className="flex items-center gap-2">
            <ClayButton
              variant="outline"
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={handleExplainWithAi}
              disabled={isExplaining || !sql.trim()}
            >
              {isExplaining ? 'Analyzing...' : 'AI Explain'}
            </ClayButton>

            <ClayButton
              variant="primary"
              size="sm"
              icon={<Play size={14} />}
              onClick={handleRunQuery}
              disabled={isRunning || !sql.trim()}
            >
              {isRunning ? 'Executing...' : 'Run Query'}
            </ClayButton>
          </div>
        </div>

        <textarea
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={5}
          className="w-full clay-inset p-3.5 rounded-2xl font-mono text-xs text-clay-text outline-none leading-relaxed resize-y focus:ring-2 focus:ring-indigo-500"
          placeholder="Enter SQL statement (e.g. SELECT * FROM V_CURRENT_STOCK;)"
        />

        {/* History Quick-Run Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1">
          <span className="text-[10px] font-bold text-clay-text-muted flex items-center gap-1 shrink-0">
            <History size={10} /> Recent:
          </span>
          {queryHistory.slice(0, 4).map((q, idx) => (
            <button
              key={idx}
              onClick={() => setSql(q)}
              className="text-[10px] font-mono px-2.5 py-1 rounded-xl clay-card text-clay-text hover:text-indigo-600 truncate max-w-[200px] shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      </ClayCard>

      {/* Error Card */}
      {queryError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-3">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">SQL Execution Exception:</span>
            <p className="font-mono text-[11px] break-all">{queryError}</p>
          </div>
        </div>
      )}

      {/* Results Workspace */}
      <ClayCard className="p-0 overflow-hidden space-y-0">
        {/* Results Header Tabs */}
        <div className="flex items-center justify-between p-3 border-b border-clay-border bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveResultTab('results')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeResultTab === 'results' ? 'bg-indigo-600 text-white shadow-sm' : 'text-clay-text hover:text-indigo-600'
              }`}
            >
              Results ({queryResult?.rows.length || 0})
            </button>

            <button
              onClick={() => setActiveResultTab('plan')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeResultTab === 'plan' ? 'bg-indigo-600 text-white shadow-sm' : 'text-clay-text hover:text-indigo-600'
              }`}
            >
              EXPLAIN Query Plan
            </button>

            {aiExplanation && (
              <button
                onClick={() => setActiveResultTab('ai')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  activeResultTab === 'ai' ? 'bg-indigo-600 text-white shadow-sm' : 'text-clay-text hover:text-indigo-600'
                }`}
              >
                AI Interpretation
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 text-xs">
            {queryResult && (
              <span className="text-[11px] font-mono text-clay-text-muted">
                Runtime: <strong>{queryResult.ms}ms</strong> • Rows: <strong>{queryResult.rows.length}</strong>
              </span>
            )}
            {queryResult && queryResult.rows.length > 0 && (
              <ClayButton variant="ghost" size="sm" icon={<Download size={12} />} onClick={handleExportCsv}>
                CSV
              </ClayButton>
            )}
          </div>
        </div>

        {/* Tab 1: Virtualized Results Grid */}
        {activeResultTab === 'results' && (
          <div
            ref={tableContainerRef}
            className="overflow-auto max-h-[450px] relative text-xs"
          >
            {queryResult && queryResult.columns.length > 0 ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold sticky top-0 z-10 border-b border-clay-border">
                  <tr>
                    {queryResult.columns.map((col, cIdx) => (
                      <th key={cIdx} className="p-3 whitespace-nowrap bg-slate-100 dark:bg-slate-800 font-mono">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryResult.rows.length === 0 ? (
                    <tr>
                      <td colSpan={queryResult.columns.length} className="p-8 text-center text-clay-text-muted italic">
                        Query returned zero rows.
                      </td>
                    </tr>
                  ) : (
                    queryResult.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-clay-border/50">
                        {row.map((val, cIdx) => (
                          <td key={cIdx} className="p-3 font-mono truncate max-w-xs whitespace-nowrap">
                            {val !== null && val !== undefined ? String(val) : <span className="italic text-slate-400">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="p-12 text-center text-clay-text-muted text-xs italic">
                {queryResult ? `Statement executed successfully (${queryResult.rowsAffected} rows affected)` : 'Run a query to view results'}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: EXPLAIN Plan Tree */}
        {activeResultTab === 'plan' && (
          <div className="p-6 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-clay-text-muted font-display">
              SQLite Optimizer Execution Tree
            </h4>

            {explainResult && explainResult.rows.length > 0 ? (
              <div className="p-4 rounded-2xl clay-inset space-y-2 font-mono text-xs">
                {explainResult.rows.map((r, idx) => {
                  const detail = String(r[3] || r[r.length - 1] || '');
                  const isScan = detail.includes('SCAN');
                  const isSearch = detail.includes('SEARCH') || detail.includes('USING INDEX');
                  const isCovering = detail.includes('COVERING INDEX');

                  return (
                    <div key={idx} className="flex items-center gap-3 py-1 border-b border-clay-border/30 last:border-0">
                      <span className="text-clay-text-muted">Node #{r[0]}</span>
                      <span className="flex-1 text-clay-text">{detail}</span>
                      {isCovering && <ClayChip variant="success" size="sm">COVERING INDEX</ClayChip>}
                      {isSearch && !isCovering && <ClayChip variant="primary" size="sm">SEARCH INDEX</ClayChip>}
                      {isScan && <ClayChip variant="warning" size="sm">FULL TABLE SCAN</ClayChip>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-clay-text-muted italic">
                Execution plan not available for this query type.
              </p>
            )}
          </div>
        )}

        {/* Tab 3: AI Explanation */}
        {activeResultTab === 'ai' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
              <Sparkles size={16} />
              <span>Gemini Academic Query & Optimizer Breakdown</span>
            </div>
            <div className="p-4 rounded-2xl clay-inset text-xs leading-relaxed text-clay-text whitespace-pre-wrap font-sans">
              {aiExplanation}
            </div>
          </div>
        )}
      </ClayCard>
    </div>
  );
};
