import React, { useState } from 'react';
import { CURATED_QUERIES, CuratedQuery } from '../../db/curatedQueries';
import { sqlClient } from '../../db/client';
import { QueryResult } from '../../db/worker/types';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { BookOpen, Play, Search, Code, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

export const QueryLibraryTab: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeQuery, setActiveQuery] = useState<CuratedQuery | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(CURATED_QUERIES[0].id);

  const categories = [
    'ALL',
    'Selection & Projection',
    'Joins',
    'Aggregation',
    'Subqueries',
    'Set Operations',
    'Window Functions',
    'CTEs & Recursion',
    'Views & Security',
    'CASE & Dates',
    'JSON & Audit',
    'Relational Division'
  ];

  const handleRunCurated = async (q: CuratedQuery) => {
    setActiveQuery(q);
    setIsRunning(true);
    setQueryResult(null);
    try {
      const res = await sqlClient.exec(q.sql, []);
      setQueryResult(res);
    } catch (err: any) {
      alert(`Query failed: ${err?.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const filteredQueries = CURATED_QUERIES.filter(q => {
    if (selectedCategory !== 'ALL' && q.category !== selectedCategory) return false;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      const matchTitle = q.title.toLowerCase().includes(t);
      const matchQ = q.businessQuestion.toLowerCase().includes(t);
      const matchSql = q.sql.toLowerCase().includes(t);
      const matchTags = q.conceptTags.some(tag => tag.toLowerCase().includes(t));
      return matchTitle || matchQ || matchSql || matchTags;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <ClayCard className="p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 flex items-center gap-2 clay-inset px-3 py-2 rounded-xl">
            <Search size={14} className="text-clay-text-muted" />
            <input
              type="text"
              placeholder="Search 42 queries by concept, keyword, or relational operator..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent text-xs text-clay-text outline-none"
            />
          </div>

          <ClayChip variant="primary" size="md">
            {filteredQueries.length} of 42 Curated Queries
          </ClayChip>
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'clay-card text-clay-text hover:text-indigo-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </ClayCard>

      {/* Query List */}
      <div className="space-y-4">
        {filteredQueries.map(q => {
          const isExpanded = expandedId === q.id;
          return (
            <ClayCard key={q.id} className="p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300">
                    {q.id}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold font-display text-clay-text">
                      {q.title}
                    </h3>
                    <span className="text-[11px] text-clay-text-muted">{q.category}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <ClayButton
                    variant="primary"
                    size="sm"
                    icon={<Play size={12} />}
                    onClick={() => handleRunCurated(q)}
                  >
                    Run Query
                  </ClayButton>

                  <button
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="p-1.5 rounded-xl clay-card text-clay-text-muted hover:text-clay-text"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {/* Business Question */}
              <p className="text-xs text-clay-text font-medium bg-slate-50/60 dark:bg-slate-800/40 p-2.5 rounded-xl">
                💼 <span className="font-bold">Business Question:</span> {q.businessQuestion}
              </p>

              {/* Concept Tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {q.conceptTags.map((t, idx) => (
                  <ClayChip key={idx} variant="outline" size="sm">
                    {t}
                  </ClayChip>
                ))}
              </div>

              {/* Expanded Details: SQL, RA, Expected Insight */}
              {isExpanded && (
                <div className="space-y-3 pt-3 border-t border-clay-border animate-in fade-in">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-clay-text-muted block mb-1">
                      Relational Algebra Formal Expression (σ, π, ⨝, γ):
                    </span>
                    <div className="p-2.5 rounded-xl clay-inset font-mono text-xs text-indigo-600 dark:text-indigo-400 font-semibold overflow-x-auto">
                      {q.relationalAlgebra}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase text-clay-text-muted block mb-1">
                      SQL Source Code:
                    </span>
                    <pre className="p-3.5 rounded-xl clay-inset font-mono text-xs text-clay-text whitespace-pre-wrap overflow-x-auto leading-relaxed">
                      {q.sql}
                    </pre>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-bold">Academic Insight: </span>
                    {q.expectedInsight}
                  </div>
                </div>
              )}
            </ClayCard>
          );
        })}
      </div>

      {/* Floating Query Result Modal */}
      {activeQuery && queryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="clay-card p-6 max-w-4xl w-full space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-clay-border pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600">[{activeQuery.id}] Output</span>
                <h3 className="text-base font-bold font-display text-clay-text">{activeQuery.title}</h3>
              </div>
              <button
                onClick={() => setQueryResult(null)}
                className="text-xs font-bold text-clay-text-muted hover:text-clay-text p-2"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-clay-text-muted">
              <span>Executed in <strong>{queryResult.ms}ms</strong></span>
              <span><strong>{queryResult.rows.length}</strong> rows returned</span>
            </div>

            <div className="flex-1 overflow-auto border border-clay-border rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold sticky top-0">
                  <tr>
                    {queryResult.columns.map((c, idx) => (
                      <th key={idx} className="p-2.5 font-mono whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-clay-border">
                  {queryResult.rows.map((r, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {r.map((v, cIdx) => (
                        <td key={cIdx} className="p-2.5 font-mono truncate max-w-xs whitespace-nowrap">
                          {v !== null && v !== undefined ? String(v) : <span className="italic text-slate-400">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
