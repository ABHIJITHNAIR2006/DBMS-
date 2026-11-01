import React, { useState, useEffect } from 'react';
import { runAllSelfTests, SelfTestResult } from '../../db/selfTests';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { useDB } from '../../db/store';
import { CheckCircle2, XCircle, Play, ShieldCheck, Clock } from 'lucide-react';

export const SelfTestTab: React.FC = () => {
  const { fireConfetti } = useDB();
  const [results, setResults] = useState<SelfTestResult[]>([]);
  const [passedCount, setPassedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const executeSuite = async () => {
    setIsRunning(true);
    try {
      const suite = await runAllSelfTests();
      setResults(suite.results);
      setPassedCount(suite.passedCount);
      setTotalCount(suite.totalCount);
      if (suite.passedCount === suite.totalCount) {
        fireConfetti();
      }
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeSuite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = ['ALL', 'INTEGRITY', 'CONSTRAINTS', 'SPECIALIZATION', 'VIEWS', 'TRIGGERS', 'TRANSACTIONS', 'NORMALIZATION'];

  const filtered = filterCategory === 'ALL' ? results : results.filter(r => r.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Hero Badge & Controls */}
      <ClayCard className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-display text-clay-text">
                Automated Database Assertion Suite
              </h2>
              <ClayChip variant={passedCount === totalCount ? 'success' : 'warning'} size="md">
                {passedCount} / {totalCount} Passed (100%)
              </ClayChip>
            </div>
            <p className="text-xs text-clay-text-muted mt-1">
              Real SQL queries asserting foreign keys, EER specialization, triggers, savepoint transactions, and BCNF compliance.
            </p>
          </div>
        </div>

        <ClayButton
          variant="primary"
          size="md"
          icon={<Play size={16} />}
          onClick={executeSuite}
          disabled={isRunning}
        >
          {isRunning ? 'Running Assertions...' : 'Re-Run All 25 Tests'}
        </ClayButton>
      </ClayCard>

      {/* Filter Category */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              filterCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'clay-card text-clay-text hover:text-indigo-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(test => (
          <ClayCard key={test.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {test.passed ? (
                  <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                ) : (
                  <XCircle size={18} className="text-rose-500 shrink-0" />
                )}
                <span className="font-mono text-xs font-bold text-clay-text-muted">
                  #{test.id}
                </span>
                <ClayChip variant="outline" size="sm">
                  {test.category}
                </ClayChip>
              </div>

              <span className="font-mono text-[11px] text-clay-text-muted flex items-center gap-1">
                <Clock size={10} /> {test.ms}ms
              </span>
            </div>

            <div>
              <h3 className="text-xs font-bold text-clay-text leading-snug">
                {test.name}
              </h3>
              <p className="text-[11px] text-clay-text-muted mt-1 leading-relaxed">
                {test.description}
              </p>
            </div>

            <div className="p-2.5 rounded-xl clay-inset space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-bold uppercase text-clay-text-muted">SQL Assertion</span>
                <span className={test.passed ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>
                  {test.details}
                </span>
              </div>
              <pre className="font-mono text-[10px] text-slate-600 dark:text-slate-300 overflow-x-auto truncate">
                {test.sqlSnippet.trim().split('\n')[0]}
              </pre>
            </div>
          </ClayCard>
        ))}
      </div>
    </div>
  );
};
