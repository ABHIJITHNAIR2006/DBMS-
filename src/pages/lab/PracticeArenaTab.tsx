import React, { useState } from 'react';
import { sqlClient } from '../../db/client';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { useDB } from '../../db/store';
import { Trophy, CheckCircle2, Play, Sparkles, HelpCircle, ArrowRight } from 'lucide-react';

interface Challenge {
  id: number;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  description: string;
  starterSql: string;
  referenceSql: string;
  hint: string;
}

const CHALLENGES: Challenge[] = [
  {
    id: 1,
    title: 'Find Items Never Issued',
    difficulty: 'Easy',
    description: 'Select ItemID and ItemName of items that have zero records in the ISSUED_TO table.',
    starterSql: 'SELECT ItemID, ItemName FROM ITEM WHERE ...',
    referenceSql: 'SELECT i.ItemID, i.ItemName FROM ITEM i WHERE NOT EXISTS (SELECT 1 FROM ISSUED_TO t WHERE t.ItemID = i.ItemID);',
    hint: 'Use NOT EXISTS or LEFT JOIN WHERE IssueID IS NULL.'
  },
  {
    id: 2,
    title: 'Top 3 Departments by Consumption Value',
    difficulty: 'Medium',
    description: 'Return DeptName and total value (Quantity * UnitPrice) of stationery issued, ordered descending, limit 3.',
    starterSql: 'SELECT d.DeptName, ...',
    referenceSql: `SELECT d.DeptName, SUM(t.Quantity * i.UnitPrice) AS TotalVal FROM DEPARTMENT d JOIN ISSUED_TO t ON d.DeptID = t.DeptID JOIN ITEM i ON t.ItemID = i.ItemID GROUP BY d.DeptName ORDER BY TotalVal DESC LIMIT 3;`,
    hint: 'Join DEPARTMENT, ISSUED_TO, and ITEM, then group by department.'
  },
  {
    id: 3,
    title: 'Items Below Average Category Price',
    difficulty: 'Medium',
    description: 'List ItemName and UnitPrice for items priced strictly below the average price of their own category.',
    starterSql: 'SELECT ItemName, UnitPrice FROM ITEM i WHERE ...',
    referenceSql: 'SELECT i.ItemName, i.UnitPrice FROM ITEM i WHERE i.UnitPrice < (SELECT AVG(i2.UnitPrice) FROM ITEM i2 WHERE i2.Category = i.Category);',
    hint: 'Correlated subquery: compute AVG(UnitPrice) for the current row category.'
  },
  {
    id: 4,
    title: 'Rank Suppliers by Procurement Spend in Nashik',
    difficulty: 'Hard',
    description: 'For suppliers in Nashik (Pincode starting with 422), return SupplierName, TotalSpend, and SpendRank using RANK() OVER.',
    starterSql: 'SELECT s.SupplierName, ...',
    referenceSql: `SELECT s.SupplierName, SUM(sp.Cost) AS TotalSpend, RANK() OVER (ORDER BY SUM(sp.Cost) DESC) AS SpendRank FROM SUPPLIER s JOIN SUPPLIES sp ON s.SupplierID = sp.SupplierID WHERE s.Pincode LIKE '422%' GROUP BY s.SupplierID, s.SupplierName;`,
    hint: 'Filter WHERE Pincode LIKE "422%" and use RANK() OVER (ORDER BY SUM(sp.Cost) DESC).'
  },
  {
    id: 5,
    title: 'Departments Consuming All Categories (Division)',
    difficulty: 'Hard',
    description: 'Find DeptName of departments that have been issued items from every single category.',
    starterSql: 'SELECT d.DeptName FROM DEPARTMENT d WHERE ...',
    referenceSql: `SELECT d.DeptName FROM DEPARTMENT d WHERE NOT EXISTS (SELECT c.Category FROM (SELECT DISTINCT Category FROM ITEM) c WHERE NOT EXISTS (SELECT 1 FROM ISSUED_TO t JOIN ITEM i ON t.ItemID = i.ItemID WHERE t.DeptID = d.DeptID AND i.Category = c.Category));`,
    hint: 'Textbook relational division using Double NOT EXISTS.'
  }
];

export const PracticeArenaTab: React.FC = () => {
  const { fireConfetti, showToast } = useDB();
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge>(CHALLENGES[0]);
  const [userSql, setUserSql] = useState<string>(CHALLENGES[0].starterSql);
  const [solvedIds, setSolvedIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('claystock_solved_challenges') || '[]');
    } catch {
      return [];
    }
  });

  const [feedback, setFeedback] = useState<{ status: 'PASS' | 'FAIL' | 'ERROR'; message: string } | null>(null);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [isGrading, setIsGrading] = useState(false);

  const handleSelect = (c: Challenge) => {
    setSelectedChallenge(c);
    setUserSql(c.starterSql);
    setFeedback(null);
    setActiveHint(null);
  };

  const handleGrade = async () => {
    setIsGrading(true);
    setFeedback(null);

    try {
      // 1. Run User Query
      const userRes = await sqlClient.exec(userSql, [], false);

      // 2. Run Reference Query
      const refRes = await sqlClient.exec(selectedChallenge.referenceSql, [], false);

      // Compare columns count
      if (userRes.columns.length !== refRes.columns.length) {
        setFeedback({
          status: 'FAIL',
          message: `Column count mismatch: Expected ${refRes.columns.length} columns (${refRes.columns.join(', ')}), but got ${userRes.columns.length} (${userRes.columns.join(', ')}).`
        });
        return;
      }

      // Compare row counts
      if (userRes.rows.length !== refRes.rows.length) {
        setFeedback({
          status: 'FAIL',
          message: `Row count mismatch: Expected ${refRes.rows.length} rows, but your query returned ${userRes.rows.length} rows.`
        });
        return;
      }

      // Compare content sets (order-insensitive stringified set comparison)
      const refSet = new Set(refRes.rows.map(r => r.join('__||__')));
      const userSet = new Set(userRes.rows.map(r => r.join('__||__')));

      let matches = true;
      for (const item of refSet) {
        if (!userSet.has(item)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        setFeedback({
          status: 'PASS',
          message: 'Excellent! Your SQL query returned identical relational tuples.'
        });
        fireConfetti();
        if (!solvedIds.includes(selectedChallenge.id)) {
          const next = [...solvedIds, selectedChallenge.id];
          setSolvedIds(next);
          localStorage.setItem('claystock_solved_challenges', JSON.stringify(next));
        }
      } else {
        setFeedback({
          status: 'FAIL',
          message: 'Result tuples do not match the expected relation. Check your WHERE predicates or joins.'
        });
      }
    } catch (err: any) {
      setFeedback({
        status: 'ERROR',
        message: err?.message || 'SQL execution exception'
      });
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <ClayCard className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />
            <h2 className="text-xl font-bold font-display text-clay-text">
              SQL Practice Arena & Auto-Grader
            </h2>
            <ClayChip variant="success" size="sm">
              {solvedIds.length} / {CHALLENGES.length} Solved
            </ClayChip>
          </div>
          <p className="text-xs text-clay-text-muted mt-1">
            Test your relational algebra and SQL skills against authoritative reference queries with instant set-theoretic diffing.
          </p>
        </div>
      </ClayCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Challenge Selector */}
        <div className="lg:col-span-1 space-y-3">
          <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted px-1 block">
            Available Challenges
          </span>

          {CHALLENGES.map(c => {
            const isSolved = solvedIds.includes(c.id);
            const isSelected = selectedChallenge.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c)}
                className={`w-full p-3.5 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'clay-card text-clay-text hover:text-indigo-600'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold">#{c.id}</span>
                    <span className="text-xs font-bold font-display">{c.title}</span>
                  </div>
                  <span className={`text-[10px] uppercase font-bold mt-1 block ${
                    isSelected ? 'text-white/80' : 'text-clay-text-muted'
                  }`}>
                    {c.difficulty}
                  </span>
                </div>

                {isSolved && <CheckCircle2 size={16} className={isSelected ? 'text-white' : 'text-emerald-500'} />}
              </button>
            );
          })}
        </div>

        {/* Challenge Work Area */}
        <div className="lg:col-span-2 space-y-4">
          <ClayCard className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-clay-border pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-indigo-600">Challenge #{selectedChallenge.id}</span>
                <h3 className="text-base font-bold font-display text-clay-text">{selectedChallenge.title}</h3>
              </div>
              <ClayChip
                variant={selectedChallenge.difficulty === 'Easy' ? 'success' : selectedChallenge.difficulty === 'Medium' ? 'primary' : 'warning'}
                size="sm"
              >
                {selectedChallenge.difficulty}
              </ClayChip>
            </div>

            <p className="text-xs text-clay-text leading-relaxed">
              {selectedChallenge.description}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-clay-text">Your SQL Solution:</label>
                <button
                  type="button"
                  onClick={() => setActiveHint(selectedChallenge.hint)}
                  className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1"
                >
                  <HelpCircle size={12} /> Need a Hint?
                </button>
              </div>

              <textarea
                rows={5}
                value={userSql}
                onChange={e => setUserSql(e.target.value)}
                className="w-full clay-inset p-3.5 rounded-2xl font-mono text-xs text-clay-text outline-none resize-y"
              />
            </div>

            {activeHint && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
                <strong>Hint:</strong> {activeHint}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <ClayButton
                variant="primary"
                size="md"
                icon={<Play size={14} />}
                onClick={handleGrade}
                disabled={isGrading}
              >
                {isGrading ? 'Comparing Results...' : 'Submit & Auto-Grade'}
              </ClayButton>
            </div>
          </ClayCard>

          {/* Feedback Card */}
          {feedback && (
            <ClayCard className={`p-5 ${
              feedback.status === 'PASS'
                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30'
                : 'border-rose-400 bg-rose-50/40 dark:bg-rose-950/30'
            }`}>
              <div className="flex items-start gap-3">
                {feedback.status === 'PASS' ? (
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Trophy size={20} className="text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="text-xs font-bold font-display text-clay-text">
                    {feedback.status === 'PASS' ? 'Challenge Passed! 🎉' : 'Grading Mismatch'}
                  </h4>
                  <p className="text-xs text-clay-text-muted leading-relaxed">
                    {feedback.message}
                  </p>
                </div>
              </div>
            </ClayCard>
          )}
        </div>
      </div>
    </div>
  );
};
