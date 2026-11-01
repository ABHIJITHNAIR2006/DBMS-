import React, { useState } from 'react';
import { CURATED_QUERIES, CuratedQuery } from '../../db/curatedQueries';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Sparkles, Terminal, GitBranch } from 'lucide-react';

export const RelationalAlgebraTab: React.FC = () => {
  const [selectedQuery, setSelectedQuery] = useState<CuratedQuery>(CURATED_QUERIES[0]);
  const [customSql, setCustomSql] = useState('');
  const [aiAlgebra, setAiAlgebra] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateAiAlgebra = async () => {
    if (!customSql.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/explain-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: `Translate this SQL into formal Relational Algebra mathematical notation (using σ, π, ⨝, γ, ∪, -, ÷):\n${customSql}`
        })
      });
      const json = await res.json();
      setAiAlgebra(json.explanation);
    } catch (err: any) {
      setAiAlgebra(`Error generating Relational Algebra: ${err?.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <ClayCard className="p-6">
        <h2 className="text-xl font-bold font-display text-clay-text">
          Relational Algebra Operator Expressions
        </h2>
        <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">
          Translates declarative SQL queries into procedural Relational Algebra operations: Selection (σ), Projection (π), Natural Join (⨝), Aggregation (γ), Set Difference (-), and Relational Division (÷).
        </p>
      </ClayCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Curated RA Selector */}
        <div className="lg:col-span-1 space-y-2 max-h-[500px] overflow-y-auto pr-1">
          <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted px-1 block">
            Select Curated Query
          </span>
          {CURATED_QUERIES.slice(0, 15).map(q => {
            const isSelected = selectedQuery.id === q.id;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQuery(q)}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left text-xs transition-all cursor-pointer ${
                  isSelected ? 'bg-indigo-600 text-white shadow-md font-bold' : 'clay-card text-clay-text hover:text-indigo-600'
                }`}
              >
                <div className="truncate">
                  <span className="font-mono mr-1">[{q.id}]</span>
                  <span>{q.title}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Tree & RA Representation */}
        <div className="lg:col-span-2 space-y-4">
          <ClayCard className="p-6 space-y-4">
            <div>
              <span className="font-mono text-xs font-bold text-indigo-600">[{selectedQuery.id}] Formal Relational Expression</span>
              <h3 className="text-base font-bold font-display text-clay-text mt-0.5">{selectedQuery.title}</h3>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">
                Mathematical Operator Expression:
              </span>
              <div className="font-mono text-sm text-indigo-950 dark:text-indigo-200 font-bold overflow-x-auto py-1">
                {selectedQuery.relationalAlgebra}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold text-clay-text-muted">Target SQL Formulation:</span>
              <pre className="p-3.5 rounded-xl clay-inset font-mono text-xs text-clay-text whitespace-pre-wrap leading-relaxed">
                {selectedQuery.sql}
              </pre>
            </div>
          </ClayCard>

          {/* AI Relational Algebra Generator */}
          <ClayCard className="p-6 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              <h3 className="text-sm font-bold font-display text-clay-text">
                Generate Relational Algebra for Custom SQL
              </h3>
            </div>
            <textarea
              rows={3}
              placeholder="Enter custom SQL query to convert to Relational Algebra..."
              value={customSql}
              onChange={e => setCustomSql(e.target.value)}
              className="w-full clay-inset p-3 rounded-xl font-mono text-xs text-clay-text outline-none resize-y"
            />
            <ClayButton
              variant="primary"
              size="sm"
              onClick={handleGenerateAiAlgebra}
              disabled={isGenerating || !customSql.trim()}
            >
              {isGenerating ? 'Computing Algebra...' : 'Generate Relational Algebra'}
            </ClayButton>

            {aiAlgebra && (
              <div className="p-3 rounded-xl clay-inset font-mono text-xs text-clay-text whitespace-pre-wrap mt-2">
                {aiAlgebra}
              </div>
            )}
          </ClayCard>
        </div>
      </div>
    </div>
  );
};
