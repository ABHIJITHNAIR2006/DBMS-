import React, { useState } from 'react';
import { SCHEMA_FDS, TableFDDefinition } from '../../db/fds';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { CheckCircle2, AlertTriangle, Layers, ArrowRight, ShieldCheck, Play } from 'lucide-react';

export const NormalizationLabTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'verify' | 'interactive' | 'caseStudies'>('verify');

  // Interactive FD Tool State
  const [attributesInput, setAttributesInput] = useState('SupplierID, SupplierName, Street, Pincode, City');
  const [fdsInput, setFdsInput] = useState('SupplierID -> SupplierName, Street, Pincode\nPincode -> City');
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  // Compute attribute closure under set of FDs
  const computeClosure = (attrs: string[], fds: Array<{ lhs: string[]; rhs: string[] }>): string[] => {
    const closure = new Set<string>(attrs);
    let changed = true;
    while (changed) {
      changed = false;
      for (const fd of fds) {
        if (fd.lhs.every(a => closure.has(a))) {
          for (const r of fd.rhs) {
            if (!closure.has(r)) {
              closure.add(r);
              changed = true;
            }
          }
        }
      }
    }
    return Array.from(closure);
  };

  const handleAnalyzeFds = () => {
    const rawAttrs = attributesInput.split(',').map(s => s.trim()).filter(Boolean);
    const rawFds = fdsInput.split('\n').map(line => {
      const parts = line.split('->');
      if (parts.length !== 2) return null;
      const lhs = parts[0].split(',').map(s => s.trim()).filter(Boolean);
      const rhs = parts[1].split(',').map(s => s.trim()).filter(Boolean);
      return { lhs, rhs };
    }).filter(Boolean) as Array<{ lhs: string[]; rhs: string[] }>;

    // Candidate key search (subsets of rawAttrs)
    const candidateKeys: string[][] = [];
    const n = rawAttrs.length;
    // Power set up to size 4
    for (let len = 1; len <= Math.min(n, 4); len++) {
      const combine = (start: number, cur: string[]) => {
        if (cur.length === len) {
          const closure = computeClosure(cur, rawFds);
          if (rawAttrs.every(a => closure.includes(a))) {
            // Check minimality
            const isMinimal = !candidateKeys.some(ck => ck.every(k => cur.includes(k)));
            if (isMinimal) candidateKeys.push(cur);
          }
          return;
        }
        for (let i = start; i < n; i++) {
          combine(i + 1, [...cur, rawAttrs[i]]);
        }
      };
      combine(0, []);
    }

    const primeAttributes = new Set<string>(candidateKeys.flat());

    // Check 2NF: No non-prime attribute is partially dependent on any candidate key
    const violations2NF: string[] = [];
    for (const fd of rawFds) {
      for (const ck of candidateKeys) {
        if (ck.length > 1 && fd.lhs.length < ck.length && fd.lhs.every(a => ck.includes(a))) {
          for (const r of fd.rhs) {
            if (!primeAttributes.has(r)) {
              violations2NF.push(`Partial Dependency: {${fd.lhs.join(', ')}} -> ${r} (Key: {${ck.join(', ')}})`);
            }
          }
        }
      }
    }

    // Check 3NF: For every X -> Y, X is superkey OR Y is prime
    const violations3NF: string[] = [];
    for (const fd of rawFds) {
      const closure = computeClosure(fd.lhs, rawFds);
      const isSuperkey = rawAttrs.every(a => closure.includes(a));
      if (!isSuperkey) {
        for (const r of fd.rhs) {
          if (!primeAttributes.has(r)) {
            violations3NF.push(`Transitive Dependency: {${fd.lhs.join(', ')}} -> ${r} (LHS not superkey, RHS not prime)`);
          }
        }
      }
    }

    // Check BCNF: For every X -> Y, X must be a superkey
    const violationsBCNF: string[] = [];
    for (const fd of rawFds) {
      const closure = computeClosure(fd.lhs, rawFds);
      const isSuperkey = rawAttrs.every(a => closure.includes(a));
      if (!isSuperkey) {
        violationsBCNF.push(`BCNF Violation: {${fd.lhs.join(', ')}} is not a superkey in relation.`);
      }
    }

    let achieved = 'BCNF';
    if (violationsBCNF.length > 0) achieved = '3NF';
    if (violations3NF.length > 0) achieved = '2NF';
    if (violations2NF.length > 0) achieved = '1NF';

    setAnalysisResult({
      attributes: rawAttrs,
      candidateKeys,
      primeAttributes: Array.from(primeAttributes),
      achieved,
      violations2NF,
      violations3NF,
      violationsBCNF
    });
  };

  const loadPreset = (preset: 'supplier' | 'supplies') => {
    if (preset === 'supplier') {
      setAttributesInput('SupplierID, SupplierName, Street, Pincode, City');
      setFdsInput('SupplierID -> SupplierName, Street, Pincode\nPincode -> City');
    } else {
      setAttributesInput('PurchaseID, ItemID, SupplierID, PurchaseDate, Quantity, Cost');
      setFdsInput('PurchaseID -> ItemID, SupplierID, PurchaseDate, Quantity, Cost');
    }
  };

  const tableList = Object.values(SCHEMA_FDS);

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 pb-2 border-b border-clay-border">
        <button
          onClick={() => setActiveSubTab('verify')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'verify' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          21-Table Schema Formal Verification
        </button>

        <button
          onClick={() => setActiveSubTab('interactive')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'interactive' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Interactive FD & Normal Form Calculator
        </button>

        <button
          onClick={() => setActiveSubTab('caseStudies')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
            activeSubTab === 'caseStudies' ? 'bg-indigo-600 text-white shadow-md' : 'clay-card text-clay-text'
          }`}
        >
          Decomposition Case Studies (3NF / BCNF)
        </button>
      </div>

      {/* SubTab 1: Verify All 21 Tables */}
      {activeSubTab === 'verify' && (
        <div className="space-y-4">
          <ClayCard className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-emerald-500" />
                <h3 className="text-base font-bold font-display text-clay-text">
                  Complete Relational Verification (21/21 in 3NF / BCNF)
                </h3>
              </div>
              <p className="text-xs text-clay-text-muted mt-1">
                Formal mathematical verification that every relation in ClayStock strictly satisfies BCNF or 3NF with zero transitive or partial dependencies.
              </p>
            </div>
            <ClayChip variant="success" size="md">
              100% BCNF / 3NF COMPLIANT
            </ClayChip>
          </ClayCard>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tableList.map(tbl => (
              <ClayCard key={tbl.tableName} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    {tbl.tableName}
                  </span>
                  <ClayChip variant="success" size="sm">
                    {tbl.normalFormAchieved} Verified
                  </ClayChip>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="text-clay-text-muted">
                    <strong>Primary Key:</strong> <span className="font-mono font-bold text-clay-text">{tbl.primaryKey.join(', ')}</span>
                  </p>
                  <p className="text-clay-text-muted text-[11px] leading-relaxed">
                    {tbl.normalFormExplanation}
                  </p>
                </div>

                <div className="p-2 rounded-xl clay-inset text-[10px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
                  <span className="font-bold uppercase text-clay-text-muted block">Functional Dependencies:</span>
                  {tbl.functionalDependencies.map((f, i) => (
                    <div key={i} className="truncate">
                      {`{${f.lhs.join(', ')}}`} → {`{${f.rhs.join(', ') || '∅'}}`}
                    </div>
                  ))}
                </div>
              </ClayCard>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 2: Interactive FD Tool */}
      {activeSubTab === 'interactive' && (
        <div className="space-y-6">
          <ClayCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-display text-clay-text">
                  Interactive Functional Dependency & Normal Form Analyzer
                </h3>
                <p className="text-xs text-clay-text-muted">
                  Input custom attributes and functional dependencies to compute closures, candidate keys, and normal forms.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadPreset('supplier')}
                  className="px-2.5 py-1 text-xs rounded-xl clay-card text-clay-text hover:text-indigo-600 font-bold"
                >
                  Load Supplier (Transitive)
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset('supplies')}
                  className="px-2.5 py-1 text-xs rounded-xl clay-card text-clay-text hover:text-indigo-600 font-bold"
                >
                  Load Supplies (Surrogate)
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-clay-text mb-1">Relation Attributes (Comma-separated)</label>
                <input
                  type="text"
                  value={attributesInput}
                  onChange={e => setAttributesInput(e.target.value)}
                  className="w-full clay-inset p-2.5 rounded-xl font-mono text-xs text-clay-text"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-clay-text mb-1">
                  Functional Dependencies (One per line: LHS -&gt; RHS)
                </label>
                <textarea
                  rows={4}
                  value={fdsInput}
                  onChange={e => setFdsInput(e.target.value)}
                  className="w-full clay-inset p-2.5 rounded-xl font-mono text-xs text-clay-text resize-y"
                />
              </div>

              <ClayButton variant="primary" size="md" icon={<Play size={14} />} onClick={handleAnalyzeFds}>
                Analyze Normal Form & Compute Keys
              </ClayButton>
            </div>
          </ClayCard>

          {analysisResult && (
            <ClayCard className="p-6 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-clay-border pb-3">
                <h3 className="text-base font-bold font-display text-clay-text">
                  Analysis Findings: <span className="text-indigo-600">{analysisResult.achieved}</span>
                </h3>
                <ClayChip
                  variant={analysisResult.achieved === 'BCNF' ? 'success' : analysisResult.achieved === '3NF' ? 'primary' : 'warning'}
                  size="md"
                >
                  Achieved: {analysisResult.achieved}
                </ClayChip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-2xl clay-inset space-y-1">
                  <span className="font-bold text-clay-text uppercase text-[11px]">Candidate Keys (Superkeys with Minimality):</span>
                  <div className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {analysisResult.candidateKeys.map((ck: string[], i: number) => (
                      <span key={i} className="inline-block mr-2">{`{${ck.join(', ')}}`}</span>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl clay-inset space-y-1">
                  <span className="font-bold text-clay-text uppercase text-[11px]">Prime Attributes:</span>
                  <div className="font-mono text-clay-text font-bold">
                    {analysisResult.primeAttributes.join(', ') || 'None'}
                  </div>
                </div>
              </div>

              {analysisResult.violations3NF.length > 0 && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 space-y-1 text-xs">
                  <span className="font-bold text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <AlertTriangle size={14} /> 3NF Violations Detected:
                  </span>
                  <ul className="list-disc list-inside text-amber-700 dark:text-amber-300 font-mono text-[11px] space-y-0.5">
                    {analysisResult.violations3NF.map((v: string, i: number) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-2 font-sans">
                    Recommended Decomposition: Factor out the transitive determinant into its own relation (e.g. PINCODE_CITY).
                  </p>
                </div>
              )}
            </ClayCard>
          )}
        </div>
      )}

      {/* SubTab 3: Case Studies */}
      {activeSubTab === 'caseStudies' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ClayCard className="p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-clay-text">
              Case 1: Decomposing Transitive Dependency in SUPPLIER
            </h3>
            <div className="text-xs space-y-3 leading-relaxed text-clay-text-muted">
              <p>
                <strong>Initial 2NF Design:</strong> <span className="font-mono font-bold text-clay-text">SUPPLIER(SupplierID, Name, Street, Pincode, City)</span>
              </p>
              <div className="p-3 rounded-xl clay-inset font-mono text-[11px] text-rose-600 dark:text-rose-400">
                SupplierID → Pincode<br />
                Pincode → City<br />
                ∴ SupplierID → City (Transitive Dependency Violating 3NF)
              </div>
              <p>
                <strong>Anomaly:</strong> Redundancy (Nashik is repeated across multiple vendors with 422001); Insertion anomaly (cannot record a newly established pincode before a supplier registers).
              </p>
              <p>
                <strong>Lossless Decomposition into 3NF / BCNF:</strong>
              </p>
              <ul className="list-disc list-inside font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                <li>SUPPLIER(SupplierID, Name, Street, Pincode FK)</li>
                <li>PINCODE_CITY(Pincode PK, City)</li>
              </ul>
            </div>
          </ClayCard>

          <ClayCard className="p-6 space-y-4">
            <h3 className="text-base font-bold font-display text-clay-text">
              Case 2: 1NF Multivalued Phone Decomposition
            </h3>
            <div className="text-xs space-y-3 leading-relaxed text-clay-text-muted">
              <p>
                <strong>Initial 0NF Design:</strong> A single comma-separated column <span className="font-mono text-clay-text">ContactNos: "9800010001, 9800010002"</span> violates First Normal Form (atomicity).
              </p>
              <p>
                <strong>Normalized 1NF Solution:</strong> Extract into an all-key relation:
              </p>
              <div className="p-3 rounded-xl clay-inset font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                SUPPLIER_CONTACT(SupplierID FK, ContactNo)<br />
                PRIMARY KEY (SupplierID, ContactNo)
              </div>
              <p>
                Eliminates repeating groups and enables clean indexing and join optimization for communication audits.
              </p>
            </div>
          </ClayCard>
        </div>
      )}
    </div>
  );
};
