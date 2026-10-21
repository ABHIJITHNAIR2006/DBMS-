import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  GitBranch,
  Layers,
  Terminal,
  Play,
  Copy,
  Trash2,
  Sparkles,
  CheckCircle2,
  FileText,
  Key,
  Link as LinkIcon,
  HelpCircle,
  Code2
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayModal } from '../components/clay/ClayModal';
import { DATABASE_TABLES, NORMALIZATION_AUDIT, TableMeta } from '../db/schema';
import { PRESET_SQL_QUERIES, PresetQuery } from '../db/queries';
import { useDB } from '../db/store';
import { geminiService } from '../services/gemini';

export const DatabaseLabPage: React.FC = () => {
  const { state, sqlLogs, clearLogs, showToast, theme } = useDB();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'schema' | 'er' | 'normalization' | 'sqllog' | 'playground' | 'about'>('schema');

  // Schema Tab Selected Table
  const [selectedTable, setSelectedTable] = useState<TableMeta>(DATABASE_TABLES['ITEM']);

  // Playground Selected Query
  const [selectedQuery, setSelectedQuery] = useState<PresetQuery>(PRESET_SQL_QUERIES[0]);
  const [queryResult, setQueryResult] = useState<{ columns: string[]; rows: (string | number)[][] } | null>(() =>
    PRESET_SQL_QUERIES[0].execute()
  );

  // Normalization Stepper
  const [normStep, setNormStep] = useState<1 | 2 | 3>(1);

  // SQL Log explanation modal
  const [sqlToExplain, setSqlToExplain] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Editable Student details for Project Cover
  const [studentName, setStudentName] = useState(() => {
    try {
      return localStorage.getItem('claystock_student_name') || '[Student Name]';
    } catch {
      return '[Student Name]';
    }
  });
  const [studentClass, setStudentClass] = useState(() => {
    try {
      return localStorage.getItem('claystock_student_class') || '[Class]';
    } catch {
      return '[Class]';
    }
  });
  const [studentRoll, setStudentRoll] = useState(() => {
    try {
      return localStorage.getItem('claystock_student_roll') || '[Roll No]';
    } catch {
      return '[Roll No]';
    }
  });

  const handleSaveStudentDetails = () => {
    try {
      localStorage.setItem('claystock_student_name', studentName);
      localStorage.setItem('claystock_student_class', studentClass);
      localStorage.setItem('claystock_student_roll', studentRoll);
    } catch {
      // storage blocked
    }
    showToast({ title: 'Saved', description: 'Academic submission details updated.', type: 'success' });
  };

  // Run Playground Query
  const handleRunQuery = (q: PresetQuery) => {
    setSelectedQuery(q);
    const res = q.execute();
    setQueryResult(res);
  };

  // Explain SQL via Gemini
  const handleExplainSql = async (sql: string) => {
    setSqlToExplain(sql);
    setIsExplaining(true);
    setExplanation(null);

    try {
      const answer = await geminiService.askDatabaseAssistant({
        message: 'Explain this SQL query for DBMS viva',
        contextType: 'EXPLAIN_SQL',
        sqlToExplain: sql
      });
      setExplanation(answer);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI explanation failed';
      setExplanation(`Could not retrieve AI explanation: ${msg}. Review relational algebra and joins directly.`);
    } finally {
      setIsExplaining(false);
    }
  };

  // Copy query to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast({ title: 'Copied to Clipboard', type: 'info' });
      })
      .catch(() => {
        showToast({ title: 'Copy Failed', description: 'Clipboard access denied.', type: 'warning' });
      });
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Database Laboratory & Viva Center
            </h1>
            <ClayChip label="10 Tables • 3NF" variant="periwinkle" />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Complete architectural reference for examiners: Normalized 3NF Schema, EER Diagram, Anomaly Fixes, Live SQL Log, and Query Playground
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="clay-card-flat p-1.5 flex flex-wrap gap-1.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 overflow-x-auto">
        {[
          { id: 'schema', label: '1. Relational Schema', icon: Database },
          { id: 'er', label: '2. ER / EER Diagram', icon: GitBranch },
          { id: 'normalization', label: '3. 3NF Normalization', icon: Layers },
          { id: 'sqllog', label: '4. Live SQL Log', icon: Terminal },
          { id: 'playground', label: '5. SQL Playground', icon: Play },
          { id: 'about', label: '6. About This Project', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-clay-text-muted hover:text-clay-text hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* =========================================================================
          TAB 1: RELATIONAL SCHEMA (10 TABLES CARDS WITH RELATIONSHIPS)
         ========================================================================= */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {Object.values(DATABASE_TABLES).map(tbl => {
              const isSelected = selectedTable.name === tbl.name;
              const rowCount = (state[tbl.name as keyof typeof state] as unknown[])?.length || 0;

              return (
                <ClayCard
                  key={tbl.name}
                  flat
                  onClick={() => setSelectedTable(tbl)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40'
                      : 'hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400">
                      {tbl.name}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-clay-text-muted">
                      {rowCount} rows
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-clay-text-muted block truncate">
                    {tbl.category}
                  </span>
                  <div className="mt-2 text-[11px] text-clay-text-muted flex items-center gap-1">
                    <Key size={11} className="text-amber-500 shrink-0" />
                    <span className="truncate">PK: {tbl.pk.join(', ')}</span>
                  </div>
                </ClayCard>
              );
            })}
          </div>

          {/* Table Inspector */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ClayCard className="lg:col-span-2 p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold font-display text-clay-text">
                      Table: {selectedTable.name}
                    </h3>
                    <ClayChip label={selectedTable.category} variant="periwinkle" />
                  </div>
                  <p className="text-xs text-clay-text-muted mt-1">{selectedTable.description}</p>
                </div>
                <button
                  onClick={() => handleCopy(selectedTable.ddl)}
                  className="clay-card-flat px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy size={13} /> Copy DDL
                </button>
              </div>

              {/* DDL Code Block */}
              <div>
                <span className="text-xs font-bold font-mono text-clay-text-muted uppercase">
                  Data Definition Language (CREATE TABLE):
                </span>
                <pre className="mt-1.5 p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-700">
                  {selectedTable.ddl}
                </pre>
              </div>

              {/* Live Tuples Preview */}
              <div>
                <span className="text-xs font-bold font-mono text-clay-text-muted uppercase">
                  First 5 Live Records in In-Browser Database:
                </span>
                <div className="mt-1.5 overflow-x-auto rounded-2xl border border-clay-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text-muted font-mono uppercase text-[10px]">
                      <tr>
                        {Object.keys(
                          ((state[selectedTable.name as keyof typeof state] as unknown[])?.[0] as object) || {}
                        ).map(k => (
                          <th key={k} className="py-2 px-3">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-clay-border font-mono text-clay-text">
                      {((state[selectedTable.name as keyof typeof state] as unknown[]) || [])
                        .slice(0, 5)
                        .map((row: unknown, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                            {Object.values(row as object).map((v, idx) => (
                              <td key={idx} className="py-2 px-3 truncate max-w-[160px]">
                                {String(v)}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </ClayCard>

            {/* Constraints & Dependencies Card */}
            <ClayCard className="p-6 space-y-4">
              <h4 className="font-display font-bold text-base text-clay-text flex items-center gap-2">
                <Key className="text-amber-500" size={18} />
                <span>Keys & Referential Constraints</span>
              </h4>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 block mb-0.5">
                    Primary Key:
                  </span>
                  <span className="font-mono">{selectedTable.pk.join(', ')}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border">
                  <span className="font-bold text-clay-text block mb-0.5">Candidate Keys:</span>
                  <span className="font-mono text-clay-text-muted">{selectedTable.candidateKeys.join(', ')}</span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border">
                  <span className="font-bold text-clay-text block mb-0.5">Functional Dependencies:</span>
                  <div className="font-mono text-clay-text-muted space-y-0.5">
                    {selectedTable.fds.map((fd, i) => (
                      <div key={i}>{fd}</div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border">
                  <span className="font-bold text-clay-text block mb-1">Foreign Key Constraints:</span>
                  {selectedTable.fks.length === 0 ? (
                    <span className="text-clay-text-muted">None (Independent Entity)</span>
                  ) : (
                    <div className="space-y-1">
                      {selectedTable.fks.map((fk, i) => (
                        <div key={i} className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                          {fk.column} → {fk.refTable}({fk.refColumn}) [ON DELETE {fk.onDelete}]
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </ClayCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: ER / EER DIAGRAM (SVG With Strong, Weak, Multivalued, Is-A, Derived)
         ========================================================================= */}
      {activeTab === 'er' && (
        <ClayCard className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold font-display text-clay-text">
                Chen & EER Conceptual Diagram (Stationery Relational Schema)
              </h3>
              <p className="text-xs text-clay-text-muted">
                Drawn to standard database notation: Strong & Weak Entities, Specialization, Multivalued & Derived attributes
              </p>
            </div>
            <ClayChip label="Chen & EER Notation" variant="mint" />
          </div>

          {/* SVG Diagram Canvas */}
          <div className="w-full overflow-x-auto p-4 rounded-3xl bg-slate-50 dark:bg-slate-900 border border-clay-border">
            <svg
              viewBox="0 0 1050 720"
              className="w-full min-w-[900px] h-auto select-none font-sans"
            >
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#7C83FF" />
                </marker>
              </defs>

              {/* Grid Background Lines (Subtle) */}
              <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.04" />
              </pattern>
              <rect width="1050" height="720" fill="url(#smallGrid)" />

              {/* ==========================================
                  1. ITEM STRONG ENTITY (Center Top)
                 ========================================== */}
              <g transform="translate(420, 100)">
                {/* Entity Rectangle */}
                <rect x="0" y="0" width="160" height="60" rx="14" fill="#7C83FF" fillOpacity="0.15" stroke="#7C83FF" strokeWidth="2.5" />
                <text x="80" y="36" textAnchor="middle" fontWeight="bold" fontSize="16" fill="currentColor">ITEM</text>

                {/* Attributes */}
                {/* ItemID (PK - Underlined) */}
                <ellipse cx="-40" cy="-40" rx="45" ry="22" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.8" />
                <text x="-40" y="-36" textAnchor="middle" fontSize="12" fontWeight="bold" textDecoration="underline" fill="#1F1B3D">ItemID (PK)</text>
                <line x1="20" y1="5" x2="-10" y2="-25" stroke="#7C83FF" strokeWidth="1.5" />

                {/* ItemName */}
                <ellipse cx="60" cy="-55" rx="45" ry="22" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.8" />
                <text x="60" y="-51" textAnchor="middle" fontSize="12" fill="#1F1B3D">ItemName</text>
                <line x1="70" y1="0" x2="60" y2="-33" stroke="#7C83FF" strokeWidth="1.5" />

                {/* Category */}
                <ellipse cx="160" cy="-40" rx="45" ry="22" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.8" />
                <text x="160" y="-36" textAnchor="middle" fontSize="12" fill="#1F1B3D">Category</text>
                <line x1="140" y1="5" x2="150" y2="-18" stroke="#7C83FF" strokeWidth="1.5" />

                {/* UnitPrice */}
                <ellipse cx="230" cy="30" rx="45" ry="22" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.8" />
                <text x="230" y="34" textAnchor="middle" fontSize="12" fill="#1F1B3D">UnitPrice</text>
                <line x1="160" y1="30" x2="185" y2="30" stroke="#7C83FF" strokeWidth="1.5" />

                {/* DERIVED StockQty (Dashed Ellipse!) */}
                <ellipse cx="-70" cy="30" rx="55" ry="24" fill="#5ED6B0" fillOpacity="0.2" stroke="#2DBE95" strokeWidth="2" strokeDasharray="4 3" />
                <text x="-70" y="34" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#0E5E48">StockQty (Deriv)</text>
                <line x1="0" y1="30" x2="-15" y2="30" stroke="#2DBE95" strokeWidth="1.5" strokeDasharray="4 3" />
              </g>

              {/* ==========================================
                  2. WEAK ENTITY: STOCK_BATCH & IDENTIFYING REL HAS_BATCH
                 ========================================== */}
              <g transform="translate(770, 90)">
                {/* Identifying Relationship: Double Diamond */}
                <g transform="translate(0, 20)">
                  <polygon points="40,0 80,25 40,50 0,25" fill="#FFA987" fillOpacity="0.15" stroke="#FFA987" strokeWidth="2" />
                  <polygon points="40,5 72,25 40,45 8,25" fill="none" stroke="#FFA987" strokeWidth="1.5" />
                  <text x="40" y="29" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">HAS_BATCH</text>
                </g>
                <line x1="-190" y1="35" x2="0" y2="45" stroke="#7C83FF" strokeWidth="1.8" />

                {/* Weak Entity: Double Rectangle */}
                <g transform="translate(130, 10)">
                  <rect x="0" y="0" width="130" height="55" rx="10" fill="#FFA987" fillOpacity="0.15" stroke="#FFA987" strokeWidth="2.5" />
                  <rect x="6" y="6" width="118" height="43" rx="6" fill="none" stroke="#FFA987" strokeWidth="1.5" />
                  <text x="65" y="32" textAnchor="middle" fontWeight="bold" fontSize="13" fill="currentColor">STOCK_BATCH</text>
                </g>
                <line x1="80" y1="45" x2="130" y2="37" stroke="#FFA987" strokeWidth="1.8" />

                {/* Weak Entity Discriminator (Partial Key): BatchNo (Dashed Underline) */}
                <ellipse cx="195" cy="115" rx="45" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#FFA987" strokeWidth="1.5" />
                <text x="195" y="119" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1F1B3D">BatchNo (PK*)</text>
                <line x1="195" y1="65" x2="195" y2="95" stroke="#FFA987" strokeWidth="1.5" />

                {/* ExpiryDate */}
                <ellipse cx="105" cy="115" rx="42" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#FFA987" strokeWidth="1.5" />
                <text x="105" y="119" textAnchor="middle" fontSize="11" fill="#1F1B3D">ExpiryDate</text>
                <line x1="140" y1="65" x2="120" y2="95" stroke="#FFA987" strokeWidth="1.5" />
              </g>

              {/* ==========================================
                  3. EER SPECIALIZATION: CONSUMABLE vs DURABLE (Disjoint "d")
                 ========================================== */}
              <g transform="translate(435, 230)">
                <line x1="65" y1="-70" x2="65" y2="0" stroke="#7C83FF" strokeWidth="2.5" />
                {/* Disjoint Circle "d" */}
                <circle cx="65" cy="20" r="18" fill="#F8F4FF" stroke="#7C83FF" strokeWidth="2.5" />
                <text x="65" y="26" textAnchor="middle" fontSize="15" fontWeight="extrabold" fill="#5E69F6">d</text>

                {/* Left Branch: Consumable Item */}
                <line x1="47" y1="20" x2="-80" y2="60" stroke="#7C83FF" strokeWidth="2" />
                <rect x="-160" y="60" width="150" height="48" rx="10" fill="#FFD36B" fillOpacity="0.2" stroke="#F5BC38" strokeWidth="2" />
                <text x="-85" y="89" textAnchor="middle" fontSize="13" fontWeight="bold" fill="currentColor">CONSUMABLE</text>
                {/* ReorderLevel attribute */}
                <ellipse cx="-85" cy="140" rx="48" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#F5BC38" strokeWidth="1.5" />
                <text x="-85" y="144" textAnchor="middle" fontSize="11" fill="#1F1B3D">ReorderLevel</text>
                <line x1="-85" y1="108" x2="-85" y2="120" stroke="#F5BC38" strokeWidth="1.5" />

                {/* Right Branch: Durable Item */}
                <line x1="83" y1="20" x2="190" y2="60" stroke="#7C83FF" strokeWidth="2" />
                <rect x="120" y="60" width="140" height="48" rx="10" fill="#66A6FF" fillOpacity="0.2" stroke="#3E8BFF" strokeWidth="2" />
                <text x="190" y="89" textAnchor="middle" fontSize="13" fontWeight="bold" fill="currentColor">DURABLE</text>
                {/* WarrantyPeriod attribute */}
                <ellipse cx="190" cy="140" rx="50" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#3E8BFF" strokeWidth="1.5" />
                <text x="190" y="144" textAnchor="middle" fontSize="11" fill="#1F1B3D">WarrantyPeriod</text>
                <line x1="190" y1="108" x2="190" y2="120" stroke="#3E8BFF" strokeWidth="1.5" />
              </g>

              {/* ==========================================
                  4. SUPPLIER ENTITY & 3NF DECOMPOSITION
                 ========================================== */}
              <g transform="translate(60, 480)">
                {/* SUPPLIER Rectangle */}
                <rect x="0" y="0" width="140" height="55" rx="12" fill="#5ED6B0" fillOpacity="0.15" stroke="#2DBE95" strokeWidth="2.5" />
                <text x="70" y="33" textAnchor="middle" fontWeight="bold" fontSize="15" fill="currentColor">SUPPLIER</text>

                {/* SupplierID (PK) */}
                <ellipse cx="-20" cy="-40" rx="42" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#2DBE95" strokeWidth="1.5" />
                <text x="-20" y="-36" textAnchor="middle" fontSize="11" fontWeight="bold" textDecoration="underline" fill="#1F1B3D">SupplierID (PK)</text>
                <line x1="20" y1="5" x2="-5" y2="-20" stroke="#2DBE95" strokeWidth="1.5" />

                {/* SupplierName */}
                <ellipse cx="70" cy="-50" rx="48" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#2DBE95" strokeWidth="1.5" />
                <text x="70" y="-46" textAnchor="middle" fontSize="11" fill="#1F1B3D">SupplierName</text>
                <line x1="70" y1="0" x2="70" y2="-30" stroke="#2DBE95" strokeWidth="1.5" />

                {/* Street */}
                <ellipse cx="-20" cy="90" rx="36" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#2DBE95" strokeWidth="1.5" />
                <text x="-20" y="94" textAnchor="middle" fontSize="11" fill="#1F1B3D">Street</text>
                <line x1="20" y1="50" x2="-5" y2="75" stroke="#2DBE95" strokeWidth="1.5" />

                {/* Multivalued Attribute: ContactNo (Double Ellipse) */}
                <ellipse cx="170" cy="-40" rx="48" ry="22" fill="#FFFFFF" fillOpacity="0.9" stroke="#2DBE95" strokeWidth="2" />
                <ellipse cx="170" cy="-40" rx="42" ry="17" fill="none" stroke="#2DBE95" strokeWidth="1.5" />
                <text x="170" y="-36" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1F1B3D">ContactNo</text>
                <line x1="120" y1="5" x2="145" y2="-20" stroke="#2DBE95" strokeWidth="1.5" />

                {/* PINCODE_CITY (3NF Decomposed Table) */}
                <rect x="50" y="110" width="130" height="45" rx="8" fill="#5ED6B0" fillOpacity="0.25" stroke="#2DBE95" strokeWidth="2" strokeDasharray="3 3" />
                <text x="115" y="138" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor">PINCODE_CITY (3NF)</text>
                <line x1="70" y1="55" x2="100" y2="110" stroke="#2DBE95" strokeWidth="2" strokeDasharray="4 2" />
              </g>

              {/* ==========================================
                  5. SUPPLIES RELATIONSHIP (M:N with Attributes)
                 ========================================== */}
              <g transform="translate(260, 310)">
                {/* Diamond */}
                <polygon points="50,0 100,30 50,60 0,30" fill="#7C83FF" fillOpacity="0.2" stroke="#7C83FF" strokeWidth="2.5" />
                <text x="50" y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">SUPPLIES</text>

                {/* Relationship Attributes */}
                {/* PurchaseID (Surrogate Key) */}
                <ellipse cx="-40" cy="15" rx="46" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="-40" y="19" textAnchor="middle" fontSize="10" fontWeight="bold" textDecoration="underline" fill="#1F1B3D">PurchaseID (PK)</text>
                <line x1="0" y1="25" x2="-10" y2="20" stroke="#7C83FF" strokeWidth="1.2" />

                {/* PurchaseDate */}
                <ellipse cx="30" cy="-35" rx="44" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="30" y="-31" textAnchor="middle" fontSize="10" fill="#1F1B3D">PurchaseDate</text>
                <line x1="40" y1="0" x2="35" y2="-17" stroke="#7C83FF" strokeWidth="1.2" />

                {/* Quantity */}
                <ellipse cx="130" cy="-25" rx="35" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="130" y="-21" textAnchor="middle" fontSize="10" fill="#1F1B3D">Quantity</text>
                <line x1="85" y1="10" x2="110" y2="-10" stroke="#7C83FF" strokeWidth="1.2" />

                {/* Cost */}
                <ellipse cx="140" cy="40" rx="30" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="140" y="44" textAnchor="middle" fontSize="10" fill="#1F1B3D">Cost</text>
                <line x1="95" y1="35" x2="112" y2="40" stroke="#7C83FF" strokeWidth="1.2" />

                {/* Connecting lines */}
                {/* To Supplier */}
                <line x1="20" y1="55" x2="-120" y2="170" stroke="#2DBE95" strokeWidth="2" />
                <text x="-60" y="110" fontSize="11" fontWeight="bold" fill="currentColor">M</text>

                {/* To Item */}
                <line x1="70" y1="0" x2="160" y2="-150" stroke="#7C83FF" strokeWidth="2" />
                <text x="120" y="-80" fontSize="11" fontWeight="bold" fill="currentColor">N</text>
              </g>

              {/* ==========================================
                  6. DEPARTMENT STRONG ENTITY (Bottom Right)
                 ========================================== */}
              <g transform="translate(800, 480)">
                <rect x="0" y="0" width="150" height="55" rx="12" fill="#FFA987" fillOpacity="0.15" stroke="#FA7952" strokeWidth="2.5" />
                <text x="75" y="33" textAnchor="middle" fontWeight="bold" fontSize="15" fill="currentColor">DEPARTMENT</text>

                {/* DeptID (PK) */}
                <ellipse cx="20" cy="-40" rx="38" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#FA7952" strokeWidth="1.5" />
                <text x="20" y="-36" textAnchor="middle" fontSize="11" fontWeight="bold" textDecoration="underline" fill="#1F1B3D">DeptID (PK)</text>
                <line x1="40" y1="0" x2="25" y2="-20" stroke="#FA7952" strokeWidth="1.5" />

                {/* DeptName */}
                <ellipse cx="120" cy="-40" rx="42" ry="20" fill="#FFFFFF" fillOpacity="0.9" stroke="#FA7952" strokeWidth="1.5" />
                <text x="120" y="-36" textAnchor="middle" fontSize="11" fill="#1F1B3D">DeptName</text>
                <line x1="90" y1="0" x2="110" y2="-20" stroke="#FA7952" strokeWidth="1.5" />
              </g>

              {/* ==========================================
                  7. ISSUED_TO RELATIONSHIP (M:N with Attributes)
                 ========================================== */}
              <g transform="translate(680, 310)">
                {/* Diamond */}
                <polygon points="50,0 100,30 50,60 0,30" fill="#FFA987" fillOpacity="0.2" stroke="#FA7952" strokeWidth="2.5" />
                <text x="50" y="34" textAnchor="middle" fontSize="12" fontWeight="bold" fill="currentColor">ISSUED_TO</text>

                {/* IssueID (Surrogate Key) */}
                <ellipse cx="-40" cy="15" rx="42" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#FA7952" strokeWidth="1.5" />
                <text x="-40" y="19" textAnchor="middle" fontSize="10" fontWeight="bold" textDecoration="underline" fill="#1F1B3D">IssueID (PK)</text>
                <line x1="0" y1="25" x2="-10" y2="20" stroke="#FA7952" strokeWidth="1.2" />

                {/* IssueDate */}
                <ellipse cx="30" cy="-35" rx="40" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#FA7952" strokeWidth="1.5" />
                <text x="30" y="-31" textAnchor="middle" fontSize="10" fill="#1F1B3D">IssueDate</text>
                <line x1="40" y1="0" x2="35" y2="-17" stroke="#FA7952" strokeWidth="1.2" />

                {/* Quantity */}
                <ellipse cx="120" cy="15" rx="35" ry="18" fill="#FFFFFF" fillOpacity="0.9" stroke="#FA7952" strokeWidth="1.5" />
                <text x="120" y="19" textAnchor="middle" fontSize="10" fill="#1F1B3D">Quantity</text>
                <line x1="100" y1="30" x2="110" y2="25" stroke="#FA7952" strokeWidth="1.2" />

                {/* Connecting lines */}
                {/* To Department */}
                <line x1="75" y1="60" x2="140" y2="170" stroke="#FA7952" strokeWidth="2" />
                <text x="120" y="110" fontSize="11" fontWeight="bold" fill="currentColor">M</text>

                {/* To Item */}
                <line x1="25" y1="0" x2="-120" y2="-150" stroke="#7C83FF" strokeWidth="2" />
                <text x="-60" y="-80" fontSize="11" fontWeight="bold" fill="currentColor">N</text>
              </g>

              {/* ==========================================
                  8. COMPLETE CHEN NOTATION LEGEND (Bottom Center)
                 ========================================== */}
              <g transform="translate(240, 620)">
                <rect x="0" y="0" width="560" height="85" rx="14" fill="#FFFFFF" fillOpacity="0.85" stroke="#CBD5E1" strokeWidth="1.5" />
                <text x="20" y="24" fontSize="12" fontWeight="bold" fill="#1E293B">CHEN & EER NOTATION LEGEND (FOR EXAMINER VIVA):</text>
                
                {/* Strong Entity */}
                <rect x="20" y="38" width="55" height="22" rx="4" fill="#7C83FF" fillOpacity="0.2" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="25" y="53" fontSize="9" fontWeight="bold" fill="#1E293B">Entity</text>

                {/* Weak Entity */}
                <rect x="85" y="38" width="65" height="22" rx="4" fill="#FFA987" fillOpacity="0.2" stroke="#FFA987" strokeWidth="1.5" />
                <rect x="88" y="41" width="59" height="16" rx="2" fill="none" stroke="#FFA987" strokeWidth="1" />
                <text x="91" y="53" fontSize="9" fontWeight="bold" fill="#1E293B">Weak Entity</text>

                {/* Multivalued */}
                <ellipse cx="185" cy="49" rx="22" ry="12" fill="none" stroke="#2DBE95" strokeWidth="1.5" />
                <ellipse cx="185" cy="49" rx="18" ry="9" fill="none" stroke="#2DBE95" strokeWidth="1" />
                <text x="168" y="52" fontSize="8" fontWeight="bold" fill="#1E293B">Multivalued</text>

                {/* Derived */}
                <ellipse cx="245" cy="49" rx="24" ry="12" fill="none" stroke="#2DBE95" strokeWidth="1.5" strokeDasharray="3 2" />
                <text x="228" y="52" fontSize="8" fontWeight="bold" fill="#1E293B">Derived</text>

                {/* Disjoint */}
                <circle cx="300" cy="49" r="11" fill="none" stroke="#7C83FF" strokeWidth="1.5" />
                <text x="296" y="53" fontSize="10" fontWeight="bold" fill="#7C83FF">d</text>
                <text x="316" y="52" fontSize="9" fill="#1E293B">Disjoint Is-A</text>

                {/* Primary Key */}
                <text x="400" y="52" fontSize="10" textDecoration="underline" fontWeight="bold" fill="#1E293B">Attribute (PK)</text>
              </g>
            </svg>
          </div>
        </ClayCard>
      )}

      {/* =========================================================================
          TAB 3: 3NF NORMALIZATION STEPPER & AUDIT TABLE
         ========================================================================= */}
      {activeTab === 'normalization' && (
        <div className="space-y-6">
          {/* Stepper Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                step: 1,
                title: 'Fix 1: SUPPLIER Split',
                desc: 'Removes Transitive Dependency Pincode -> City'
              },
              {
                step: 2,
                title: 'Fix 2: Surrogate Keys',
                desc: 'Replaces Composite Keys in SUPPLIES & ISSUED_TO'
              },
              {
                step: 3,
                title: 'Formal 3NF Audit',
                desc: 'All 10 Tables Checked for 1NF, 2NF, 3NF'
              }
            ].map(s => (
              <ClayCard
                key={s.step}
                flat
                onClick={() => setNormStep(s.step as 1 | 2 | 3)}
                className={`p-4 cursor-pointer transition-all ${
                  normStep === s.step
                    ? 'border-2 border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40'
                    : 'hover:border-indigo-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      normStep === s.step ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-clay-text'
                    }`}
                  >
                    {s.step}
                  </span>
                  <h4 className="font-display font-bold text-sm text-clay-text">{s.title}</h4>
                </div>
                <p className="text-xs text-clay-text-muted">{s.desc}</p>
              </ClayCard>
            ))}
          </div>

          {/* Stepper Content */}
          {normStep === 1 && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-clay-text">
                  Fix 1: Transitive Dependency Removal in SUPPLIER (3NF Decomposition)
                </h3>
                <ClayChip label="Transitive FD Split" variant="rose" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Before: 2NF with Anomaly */}
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">
                    <span>Before (Violating 3NF):</span>
                    <span>Anomalous</span>
                  </div>
                  <pre className="font-mono text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-200">
                    {`SUPPLIER (SupplierID [PK], SupplierName, Street, Pincode, City)`}
                  </pre>
                  <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                    <strong>Dependency:</strong> SupplierID → Pincode, and Pincode → City.<br />
                    Therefore, SupplierID → City is a <strong>transitive dependency</strong> (X → Y and Y → Z where Y is not a candidate key).
                  </p>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-900/40">
                    ⚠ <strong>Update Anomaly:</strong> If Pincode 422001's city spelling changes, multiple supplier rows must be updated. If a new supplier isn't added, you cannot record that 422001 maps to Nashik (Insertion anomaly).
                  </div>
                </div>

                {/* After: 3NF Decomposed */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    <span>After (Normalized to 3NF):</span>
                    <span>Compliant</span>
                  </div>
                  <pre className="font-mono text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200">
                    {`SUPPLIER (SupplierID [PK], SupplierName, Street, Pincode [FK])
PINCODE_CITY (Pincode [PK], City)`}
                  </pre>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    <strong>Result:</strong> Transitive dependency eliminated. City is stored once per pincode.
                    Dependency preservation and lossless join property guaranteed!
                  </p>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40">
                    ✓ <strong>Nashik Anomaly Resolved:</strong> Nashik is stored exactly once in PINCODE_CITY for Pincode 422001. All suppliers reference it via Foreign Key.
                  </div>
                </div>
              </div>
            </ClayCard>
          )}

          {normStep === 2 && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-clay-text">
                  Fix 2: Surrogate Key Introduction in Relationship Tables
                </h3>
                <ClayChip label="Surrogate Key Resolution" variant="periwinkle" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Flawed Composite Key */}
                <div className="p-4 rounded-2xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 space-y-2">
                  <div className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">
                    Flawed Candidate Key Formulation:
                  </div>
                  <pre className="font-mono text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-rose-200">
                    {`SUPPLIES (ItemID, SupplierID, PurchaseDate [PK], Quantity, Cost)`}
                  </pre>
                  <p className="text-xs text-rose-800 dark:text-rose-200 leading-relaxed">
                    <strong>The Problem:</strong> If Supplier S01 delivers Item I123 twice on the same day (e.g. Morning rush delivery + Afternoon supplemental batch), the composite primary key (ItemID, SupplierID, PurchaseDate) causes a <strong>Primary Key Collision Error</strong>.
                  </p>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 p-2 rounded-lg bg-rose-100/60 dark:bg-rose-900/40 font-mono">
                    Mandated Doc Example: Item I123 supplied by S01 on 02-Jan-2026 (PO1001) and 14-Mar-2026 (PO1002).
                  </div>
                </div>

                {/* Surrogate Key Solution */}
                <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-2">
                  <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                    3NF Surrogate Key Solution:
                  </div>
                  <pre className="font-mono text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200">
                    {`SUPPLIES (PurchaseID [PK], ItemID [FK], SupplierID [FK], PurchaseDate, Quantity, Cost)
ISSUED_TO (IssueID [PK], ItemID [FK], DeptID [FK], IssueDate, Quantity)`}
                  </pre>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
                    <strong>Resolution:</strong> Surrogate keys PurchaseID and IssueID guarantee uniqueness, allow multiple transactions on identical dates, and provide compact foreign key index performance.
                  </p>
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-300 p-2 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40">
                    ✓ Clean M:N relationship with individual transaction audit tracking.
                  </div>
                </div>
              </div>
            </ClayCard>
          )}

          {normStep === 3 && (
            <ClayCard className="p-6 space-y-4">
              <h3 className="font-display font-bold text-lg text-clay-text">
                Formal 10-Table Relational Normalization Audit Matrix
              </h3>
              <p className="text-xs text-clay-text-muted">
                Complete justification for each relation verifying 1NF (atomicity), 2NF (no partial dependencies), and 3NF (no transitive dependencies)
              </p>

              <div className="overflow-x-auto rounded-2xl border border-clay-border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-display uppercase tracking-wider text-[11px] text-clay-text-muted">
                    <tr>
                      <th className="py-3 px-3">Relation</th>
                      <th className="py-3 px-3">Candidate Key</th>
                      <th className="py-3 px-3">Functional Dependencies</th>
                      <th className="py-3 px-3 text-center">1NF</th>
                      <th className="py-3 px-3 text-center">2NF</th>
                      <th className="py-3 px-3 text-center">3NF</th>
                      <th className="py-3 px-3">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border font-medium">
                    {NORMALIZATION_AUDIT.map(row => (
                      <tr key={row.table} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {row.table}
                        </td>
                        <td className="py-3 px-3 font-mono text-clay-text">{row.candidateKey}</td>
                        <td className="py-3 px-3 font-mono text-clay-text-muted">{row.fds}</td>
                        <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓</td>
                        <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓</td>
                        <td className="py-3 px-3 text-center text-emerald-600 font-bold">✓</td>
                        <td className="py-3 px-3">
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            {row.verdict}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClayCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: LIVE SQL LOG WITH "EXPLAIN THIS SQL" GEMINI INTEGRATION
         ========================================================================= */}
      {activeTab === 'sqllog' && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold font-display text-clay-text">
                Live Session SQL Transaction Stream
              </h3>
              <p className="text-xs text-clay-text-muted">
                Every relational INSERT, UPDATE, DELETE, and SELECT executed by the user generates real SQL statements
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ClayButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  const allSql = sqlLogs.map(l => `-- [${l.timestamp}] ${l.type} (${l.status})\n${l.query}`).join('\n\n');
                  handleCopy(allSql);
                }}
                icon={<Copy size={14} />}
              >
                Copy All SQL
              </ClayButton>
              <ClayButton variant="danger" size="sm" onClick={clearLogs} icon={<Trash2 size={14} />}>
                Clear Log
              </ClayButton>
            </div>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {sqlLogs.length === 0 ? (
              <div className="text-center py-12 text-clay-text-muted text-sm">
                No SQL logs in session. Perform actions in any module to inspect generated queries.
              </div>
            ) : (
              sqlLogs.map(log => (
                <div
                  key={log.id}
                  className="clay-card-flat p-4 bg-slate-900 text-slate-100 font-mono text-xs border border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        {log.type} • {log.status}
                      </span>
                      <span className="text-slate-400">{log.timestamp}</span>
                      <span className="text-slate-500">• {log.executionTimeMs}ms</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleExplainSql(log.query)}
                        className="text-indigo-400 hover:text-indigo-300 font-sans font-bold text-xs flex items-center gap-1 cursor-pointer"
                        title="Ask Gemini to explain this SQL statement for viva"
                      >
                        <Sparkles size={13} />
                        <span>Explain SQL</span>
                      </button>
                      <button
                        onClick={() => handleCopy(log.query)}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title="Copy Statement"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                  </div>

                  <pre className="text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
                    {log.query}
                  </pre>

                  {log.errorMessage && (
                    <div className="text-rose-400 text-[11px] pt-1 border-t border-rose-900/50">
                      Error: {log.errorMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ClayCard>
      )}

      {/* =========================================================================
          TAB 5: SQL PLAYGROUND (8 PRESET READ-ONLY QUERIES)
         ========================================================================= */}
      {activeTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Query Selector List */}
          <ClayCard className="p-5 space-y-2">
            <h3 className="font-display font-bold text-base text-clay-text mb-3">
              8 Preset Relational Queries
            </h3>
            <p className="text-xs text-clay-text-muted mb-4">
              Demonstrates complex joins, GROUP BY aggregations, weak entity filters, and derived stock calculations
            </p>

            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {PRESET_SQL_QUERIES.map(q => (
                <button
                  key={q.id}
                  onClick={() => handleRunQuery(q)}
                  className={`w-full p-3 rounded-2xl text-left text-xs font-medium transition-all cursor-pointer ${
                    selectedQuery.id === q.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-clay-text'
                  }`}
                >
                  <div className="font-bold">{q.title}</div>
                  <div className={`text-[11px] mt-1 line-clamp-1 ${selectedQuery.id === q.id ? 'text-indigo-100' : 'text-clay-text-muted'}`}>
                    {q.description}
                  </div>
                </button>
              ))}
            </div>
          </ClayCard>

          {/* Query Execution & Results Pane */}
          <div className="lg:col-span-2 space-y-4">
            <ClayCard className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-base text-clay-text">{selectedQuery.title}</h4>
                  <p className="text-xs text-clay-text-muted">{selectedQuery.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExplainSql(selectedQuery.sql)}
                    className="clay-card-flat px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles size={14} /> Explain with AI
                  </button>
                  <ClayButton variant="primary" size="sm" onClick={() => handleRunQuery(selectedQuery)} icon={<Play size={14} />}>
                    Execute SQL
                  </ClayButton>
                </div>
              </div>

              {/* SQL Statement Display */}
              <pre className="p-4 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-700 leading-relaxed">
                {selectedQuery.sql}
              </pre>
            </ClayCard>

            {/* Results Grid */}
            <ClayCard className="p-5 overflow-x-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-clay-text-muted uppercase">
                  Execution Output ({queryResult?.rows.length || 0} Tuples Returned):
                </span>
              </div>

              {queryResult && (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-mono uppercase text-[10px] text-clay-text-muted">
                    <tr>
                      {queryResult.columns.map(col => (
                        <th key={col} className="py-2.5 px-3">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border font-mono text-clay-text">
                    {queryResult.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {row.map((val, cellIdx) => (
                          <td key={cellIdx} className="py-2.5 px-3">
                            {String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </ClayCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: ABOUT THIS PROJECT (VIVA & STUDENT DETAILS)
         ========================================================================= */}
      {activeTab === 'about' && (
        <ClayCard className="p-6 sm:p-8 space-y-6 max-w-4xl mx-auto">
          <div className="border-b border-clay-border pb-4 flex items-start justify-between">
            <div>
              <span className="text-xs font-bold font-display uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                DBMS Mini Project Submission Documentation
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text mt-1">
                Stationery Management System (ClayStock)
              </h2>
            </div>
            <ClayChip label="Production Quality" variant="mint" />
          </div>

          {/* Editable Student Details */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 block">
              Student / Candidate Information:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ClayInput
                label="Student Name"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
              />
              <ClayInput
                label="Class / Division"
                value={studentClass}
                onChange={e => setStudentClass(e.target.value)}
              />
              <ClayInput
                label="Roll No / Exam Seat"
                value={studentRoll}
                onChange={e => setStudentRoll(e.target.value)}
              />
            </div>
            <div className="flex justify-end pt-1">
              <ClayButton variant="primary" size="sm" onClick={handleSaveStudentDetails}>
                Save Info
              </ClayButton>
            </div>
          </div>

          {/* Problem Statement */}
          <div className="space-y-2">
            <h4 className="font-display font-bold text-base text-clay-text">Problem Statement</h4>
            <p className="text-sm text-clay-text-muted leading-relaxed bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-clay-border">
              Develop a system for "Stationery Management" that automates inventory tracking, purchase
              recording, and item distribution, replacing manual stock registers with a centralized
              relational database to eliminate stock-outs, reduce procurement delays, and improve
              stationery management efficiency.
            </p>
          </div>

          {/* 5 Objectives Mapped to Implementation */}
          <div className="space-y-3">
            <h4 className="font-display font-bold text-base text-clay-text">
              The 5 Primary Project Objectives & Implementation Verification:
            </h4>
            <div className="space-y-2.5">
              {[
                {
                  obj: '1. Centralized Database Design',
                  desc: 'Designed a 10-table 3NF normalized schema with disjoint EER specialization (CONSUMABLE_ITEM / DURABLE_ITEM), weak entity (STOCK_BATCH with identifying relationship HAS_BATCH), and multivalued contact table.',
                  proven: 'Demonstrated in Database Lab Schema Tab & Seed Data.'
                },
                {
                  obj: '2. Stationery Purchases from Suppliers',
                  desc: 'Maintains incoming stock transactions in SUPPLIES relation with purchase date, quantity, total cost, and live implied unit cost verification.',
                  proven: 'Demonstrated in Module 3 (Purchases) with auto-generated PurchaseID PO1001...'
                },
                {
                  obj: '3. Item Issue & Distribution to Departments',
                  desc: 'Records outgoing stationery in ISSUED_TO relation linked to departments with distribution dates and quantity checks.',
                  proven: 'Demonstrated in Module 4 (Issues) with Department consumption analytics.'
                },
                {
                  obj: '4. Automatic Stock Updating',
                  desc: 'Eliminates stored stock values! Stock is dynamically derived: SUM(Purchases) - SUM(Issues). Updates instantaneously on any transaction without write skew.',
                  proven: 'Demonstrated in Module 2 (Stock) with interactive running balance ledgers.'
                },
                {
                  obj: '5. Quick Search & Stock Status Retrieval',
                  desc: 'Provides instant debounced search by name or category, dynamic SQL compilation preview, and Gemini AI natural language filter extraction.',
                  proven: 'Demonstrated in Module 5 (Search) and Ctrl/Cmd+K Command Palette.'
                }
              ].map((item, i) => (
                <div key={i} className="p-3.5 rounded-2xl clay-card-flat bg-white/70 dark:bg-slate-900/70 text-xs space-y-1">
                  <div className="flex items-center justify-between font-bold text-clay-text text-sm">
                    <span>{item.obj}</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                      <CheckCircle2 size={12} /> Verified
                    </span>
                  </div>
                  <p className="text-clay-text-muted leading-relaxed">{item.desc}</p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">{item.proven}</p>
                </div>
              ))}
            </div>
          </div>
        </ClayCard>
      )}

      {/* =========================================================================
          EXPLAIN SQL GEMINI MODAL
         ========================================================================= */}
      <ClayModal
        isOpen={!!sqlToExplain}
        onClose={() => setSqlToExplain(null)}
        title="Gemini AI DBMS Explanation"
        subtitle="Academic viva breakdown of relational operations"
      >
        <div className="space-y-4">
          <pre className="p-3 rounded-2xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-700">
            {sqlToExplain}
          </pre>

          {isExplaining ? (
            <div className="p-6 text-center text-clay-text-muted text-xs">
              <div className="w-8 h-8 rounded-full border-3 border-indigo-500 border-t-transparent animate-spin mx-auto mb-2" />
              Gemini AI is analyzing relational algebra, normalization rules, and query semantics...
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/50 text-xs sm:text-sm text-clay-text leading-relaxed whitespace-pre-line border border-indigo-200 dark:border-indigo-800">
              {explanation}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-clay-border">
            <ClayButton variant="secondary" onClick={() => setSqlToExplain(null)}>
              Close
            </ClayButton>
          </div>
        </div>
      </ClayModal>
    </div>
  );
};
