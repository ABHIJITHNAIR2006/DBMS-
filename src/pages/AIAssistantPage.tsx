import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Database,
  HelpCircle,
  Lightbulb,
  Info,
  Code,
  Play,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Layers,
  ChevronRight,
  ChevronDown,
  Copy,
  Clock,
  BookOpen
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { useDB } from '../db/store';
import { sqlClient } from '../db/client';
import { geminiService } from '../services/gemini';
import { SCHEMA_DDL } from '../db/schemaDdl';
import { QueryResult } from '../db/worker/types';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface VivaCard {
  id: string;
  category: string;
  question: string;
  answerKey: string;
  followUp: string;
}

export const AIAssistantPage: React.FC = () => {
  const { state, derivedStock, showToast } = useDB();
  const [activeTab, setActiveTab] = useState<'ask-data' | 'schema' | 'viva' | 'chat'>('ask-data');

  // --- TAB 1: ASK YOUR DATA (NL TO SQL) ---
  const [nlPrompt, setNlPrompt] = useState('');
  const [isNlLoading, setIsNlLoading] = useState(false);
  const [generatedSql, setGeneratedSql] = useState<string | null>(null);
  const [sqlExplanation, setSqlExplanation] = useState<string | null>(null);
  const [nlQueryResult, setNlQueryResult] = useState<QueryResult | null>(null);
  const [nlQueryError, setNlQueryError] = useState<string | null>(null);
  const [nlExecutionMs, setNlExecutionMs] = useState<number | null>(null);

  const sampleNlQueries = [
    'Which 3 departments consumed the most stationery units?',
    'Show items with low stock and their suggested reorder quantities',
    'List all suppliers from Nashik who delivered goods over ₹10,000',
    'Find items that have had no issues in the last 60 days',
    'What is the running inventory balance of Legal Green Ledger Paper?'
  ];

  const handleRunNlToSql = async (overridePrompt?: string) => {
    const promptToUse = (overridePrompt || nlPrompt).trim();
    if (!promptToUse) return;

    setIsNlLoading(true);
    setNlQueryError(null);
    setGeneratedSql(null);
    setSqlExplanation(null);
    setNlQueryResult(null);

    try {
      const res = await geminiService.askData(promptToUse);
      setGeneratedSql(res.sql);
      setSqlExplanation(res.explanation);

      // Execute generated SQL directly against the SQLite worker with query_only read-only guard
      const start = performance.now();
      await sqlClient.exec('PRAGMA query_only = ON;', [], false);
      try {
        const queryRes = await sqlClient.exec(res.sql, [], false);
        setNlExecutionMs(Math.round(performance.now() - start));
        setNlQueryResult(queryRes);
      } finally {
        await sqlClient.exec('PRAGMA query_only = OFF;', [], false).catch(() => {});
      }
    } catch (err: any) {
      setNlQueryError(err?.message || 'Failed to process natural language query.');
    } finally {
      setIsNlLoading(false);
    }
  };

  // --- TAB 2: SCHEMA & NORMALIZATION REVIEWER ---
  const [reviewFocus, setReviewFocus] = useState('3NF and BCNF normalization verification across all 21 tables');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ review: string; recommendations: string[]; normalFormRating: string } | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleReviewSchema = async () => {
    setIsReviewing(true);
    setReviewError(null);
    try {
      const res = await geminiService.reviewSchema(SCHEMA_DDL, reviewFocus);
      setReviewResult(res);
    } catch (err: any) {
      setReviewError(err?.message || 'Schema review failed.');
    } finally {
      setIsReviewing(false);
    }
  };

  // --- TAB 3: DBMS VIVA COACH ---
  const [vivaMode, setVivaMode] = useState<'cards' | 'interrogation'>('cards');
  const [vivaCards, setVivaCards] = useState<VivaCard[]>([]);
  const [isCardsLoading, setIsCardsLoading] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);

  // Viva interrogation chat
  const [vivaChat, setVivaChat] = useState<Array<{ role: 'user' | 'model'; text: string; score?: number; feedback?: string }>>([
    {
      role: 'model',
      text: "Good morning candidate. I am the external DBMS examiner. Let's begin your viva defense for the ClayStock Stationery Management System. First question: Why did you decide NOT to store 'StockQty' as an attribute in any table? Defend your derived attribute discipline."
    }
  ]);
  const [vivaInput, setVivaInput] = useState('');
  const [isVivaReplying, setIsVivaReplying] = useState(false);

  const loadVivaCards = async () => {
    if (vivaCards.length > 0) return;
    setIsCardsLoading(true);
    try {
      const res = await geminiService.getVivaCards();
      setVivaCards(res.cards);
    } catch (err) {
      // Fallback deterministic cards if serverless function cold starts
      setVivaCards([
        {
          id: 'v1',
          category: 'Normalization',
          question: 'Why was PINCODE_CITY decomposed out of the SUPPLIER table into its own relation?',
          answerKey: 'To achieve 3NF. In SUPPLIER, Pincode -> City is a transitive dependency (SupplierID -> Pincode -> City) where Pincode is not a candidate key. Splitting eliminates update and insertion anomalies.',
          followUp: 'What would happen if a city changed its name or a supplier moved to a new pincode in the un-normalized table?'
        },
        {
          id: 'v2',
          category: 'Derived Attributes',
          question: 'How is current stock calculated without storing StockQty?',
          answerKey: 'Via SQL aggregation view V_CURRENT_STOCK: COALESCE(SUM(SUPPLIES.Quantity), 0) - COALESCE(SUM(ISSUED_TO.Quantity), 0). Storing StockQty would invite race conditions, lost updates, and synchronization drift.',
          followUp: 'What index ensures this query runs in logarithmic time on large datasets?'
        },
        {
          id: 'v3',
          category: 'EER Specialization',
          question: 'What type of specialization hierarchy exists between ITEM, CONSUMABLE_ITEM, and DURABLE_ITEM?',
          answerKey: 'Disjoint total/partial specialization. An item is either consumable (with ReorderLevel) or durable (with WarrantyPeriod), enforced via trigger trg_disjoint_consumable.',
          followUp: 'Could an item simultaneously have a warranty period and a reorder level in your schema?'
        },
        {
          id: 'v4',
          category: 'Integrity Constraints',
          question: 'Explain how trg_supplies_delete_guard enforces stock consistency.',
          answerKey: 'When an admin tries to delete a purchase order, the trigger checks if removing that inflow would make derived stock negative. If so, RAISE(ABORT) terminates the delete.',
          followUp: 'Is this an ECA (Event-Condition-Action) trigger or a check constraint?'
        },
        {
          id: 'v5',
          category: 'ACID Transactions',
          question: 'How does sp_fulfil_requisition handle multi-line order fulfillment when one line lacks stock?',
          answerKey: 'It uses SQLite nested SAVEPOINTs. Each item is issued inside a savepoint; if stock is insufficient, it rolls back that line while releasing successful lines.',
          followUp: 'What isolation level guarantees that concurrent issues do not cause phantom reads?'
        }
      ]);
    } finally {
      setIsCardsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'viva' && vivaCards.length === 0) {
      loadVivaCards();
    }
  }, [activeTab]);

  const handleSendVivaReply = async () => {
    if (!vivaInput.trim() || isVivaReplying) return;
    const text = vivaInput.trim();
    setVivaInput('');

    const newHistory = [...vivaChat, { role: 'user' as const, text }];
    setVivaChat(newHistory);
    setIsVivaReplying(true);

    try {
      const res = await geminiService.chatViva(text, newHistory);
      setVivaChat(prev => [
        ...prev,
        {
          role: 'model',
          text: res.reply,
          score: res.score,
          feedback: res.feedback
        }
      ]);
    } catch (err: any) {
      setVivaChat(prev => [
        ...prev,
        {
          role: 'model',
          text: "Notice: The examiner service is temporarily offline. Please review the 15 viva cards or verify your GEMINI_API_KEY environment variable."
        }
      ]);
    } finally {
      setIsVivaReplying(false);
    }
  };

  // --- TAB 4: GENERAL ASSISTANT CHAT ---
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am your AI Database Assistant for ClayStock. I can answer questions about the 21-table schema, relational normal forms, current inventory stock levels, supplier purchases, or department consumption. Ask me anything!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || isChatLoading) return;

    setChatMessages(prev => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await geminiService.askDatabaseAssistant({
        message: text,
        contextType: 'CHAT',
        dataSnapshot: {
          itemsCount: state.ITEM.length,
          suppliersCount: state.SUPPLIER.length,
          purchasesCount: state.SUPPLIES.length,
          issuesCount: state.ISSUED_TO.length,
          lowStock: derivedStock.filter(s => s.status !== 'In Stock').map(s => s.item.ItemName)
        }
      });

      setChatMessages(prev => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'assistant',
          text: res,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Notice: ${err.message || 'Unable to connect to AI server'}. Please ensure GEMINI_API_KEY is configured.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              AI Database Intelligence Suite
            </h1>
            <ClayChip label="Gemini Server-Side AI" variant="periwinkle" />
            <ClayTooltip
              concept="Server-Authoritative AI"
              explanation="All AI features operate through backend proxy handlers with strictly enforced SELECT/WITH-only validations and zero client-side API key leakage."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Natural language to SQL compilation, automated schema review, and interactive DBMS viva defense
          </p>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl clay-card-flat bg-white/60 dark:bg-slate-900/60 border border-clay-border">
        {[
          { id: 'ask-data', label: 'Ask Your Data (NL to SQL)', icon: Code },
          { id: 'schema', label: 'Schema Reviewer', icon: Layers },
          { id: 'viva', label: 'DBMS Viva Coach', icon: GraduationCap },
          { id: 'chat', label: 'Assistant Chat', icon: Bot }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
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
          TAB 1: ASK YOUR DATA (NL TO SQL + WORKER EXECUTION)
         ========================================================================= */}
      {activeTab === 'ask-data' && (
        <div className="space-y-6">
          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-clay-text">
                  Ask Your Relational Database in Natural Language
                </h3>
                <p className="text-xs text-clay-text-muted">
                  Gemini translates your question into an executable SQLite SELECT query, validated against mutating keywords
                </p>
              </div>
              <ClayChip label="Read-Only SELECT Engine" variant="mint" />
            </div>

            {/* Input Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Ask e.g. Which department received the most stationery items?"
                value={nlPrompt}
                onChange={e => setNlPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleRunNlToSql()}
                className="flex-1 px-4 py-3 rounded-2xl clay-inset bg-transparent text-sm text-clay-text placeholder:text-clay-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <ClayButton
                variant="primary"
                onClick={() => handleRunNlToSql()}
                disabled={isNlLoading || !nlPrompt.trim()}
                icon={<Sparkles size={16} />}
              >
                {isNlLoading ? 'Compiling SQL...' : 'Generate & Run SQL'}
              </ClayButton>
            </div>

            {/* Suggested Prompts */}
            <div className="mt-4 pt-3 border-t border-clay-border">
              <span className="text-[11px] font-bold text-clay-text-muted uppercase tracking-wider block mb-2">
                Sample Analytical Inquiries:
              </span>
              <div className="flex flex-wrap gap-2">
                {sampleNlQueries.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setNlPrompt(sample);
                      handleRunNlToSql(sample);
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl clay-card-flat hover:border-indigo-400 text-clay-text text-left transition-all cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          </ClayCard>

          {/* Error Banner */}
          {nlQueryError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{nlQueryError}</span>
            </div>
          )}

          {/* Generated SQL & Explanation */}
          {generatedSql && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Code size={18} className="text-indigo-600 dark:text-indigo-400" />
                  <h4 className="font-display font-bold text-base text-clay-text">
                    Compiled SQL Query
                  </h4>
                </div>
                {nlExecutionMs !== null && (
                  <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    Executed in {nlExecutionMs} ms on SQLite WebAssembly
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 text-indigo-300 font-mono text-xs overflow-x-auto relative group">
                <pre>{generatedSql}</pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedSql);
                    showToast({ title: 'SQL Copied', description: 'Query copied to clipboard.', type: 'info' });
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Copy SQL"
                >
                  <Copy size={14} />
                </button>
              </div>

              {sqlExplanation && (
                <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-xs text-clay-text leading-relaxed">
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">AI Query Logic: </span>
                  {sqlExplanation}
                </div>
              )}

              {/* Execution Results Table */}
              {nlQueryResult && (
                <div className="mt-4 pt-4 border-t border-clay-border space-y-3">
                  <div className="flex items-center justify-between text-xs text-clay-text-muted">
                    <span className="font-bold">
                      Query Output ({nlQueryResult.rows.length} rows returned)
                    </span>
                    <span className="font-mono">{nlQueryResult.columns.length} columns</span>
                  </div>

                  {nlQueryResult.rows.length === 0 ? (
                    <div className="p-6 text-center text-xs text-clay-text-muted">
                      Query executed successfully with 0 matching rows.
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-80 border border-clay-border rounded-2xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-display text-clay-text font-bold">
                          <tr>
                            {nlQueryResult.columns.map((col, idx) => (
                              <th key={idx} className="p-2.5 border-b border-clay-border font-mono">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-clay-border">
                          {nlQueryResult.rows.map((row, rIdx) => (
                            <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 font-mono">
                              {row.map((cell: any, cIdx: number) => (
                                <td key={cIdx} className="p-2.5 text-clay-text">
                                  {cell !== null && cell !== undefined ? String(cell) : <span className="text-clay-text-muted italic">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </ClayCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: SCHEMA & NORMALIZATION REVIEWER
         ========================================================================= */}
      {activeTab === 'schema' && (
        <div className="space-y-6">
          <ClayCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-clay-text">
                  Formal Schema & Normalization Auditor
                </h3>
                <p className="text-xs text-clay-text-muted">
                  Gemini audits the 21-table schema against 1NF, 2NF, 3NF, BCNF, and referential constraints
                </p>
              </div>
              <ClayChip label="Architectural Audit" variant="purple" />
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-clay-text">Audit Focus or Specific Invariant:</label>
              <input
                type="text"
                value={reviewFocus}
                onChange={e => setReviewFocus(e.target.value)}
                placeholder="e.g. Verify that PINCODE_CITY achieves BCNF and explain transitive dependencies"
                className="w-full px-4 py-3 rounded-2xl clay-inset bg-transparent text-sm text-clay-text placeholder:text-clay-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <ClayButton
                variant="primary"
                onClick={handleReviewSchema}
                disabled={isReviewing}
                icon={<Layers size={16} />}
              >
                {isReviewing ? 'Analyzing 21 Tables...' : 'Run Formal Schema Review'}
              </ClayButton>
            </div>
          </ClayCard>

          {reviewError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs text-rose-700 dark:text-rose-300">
              {reviewError}
            </div>
          )}

          {reviewResult && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-base text-clay-text">
                  Audit Findings & Normal Form Assessment
                </h4>
                <ClayChip label={`Rating: ${reviewResult.normalFormRating}`} variant="mint" />
              </div>

              <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-clay-border text-xs text-clay-text leading-relaxed whitespace-pre-line">
                {reviewResult.review}
              </div>

              {reviewResult.recommendations && reviewResult.recommendations.length > 0 && (
                <div>
                  <h5 className="font-display font-bold text-xs uppercase tracking-wider text-clay-text-muted mb-2">
                    Architectural Recommendations:
                  </h5>
                  <div className="space-y-2">
                    {reviewResult.recommendations.map((rec, i) => (
                      <div key={i} className="clay-card-flat p-3 text-xs flex items-start gap-2 bg-indigo-50/50 dark:bg-indigo-950/30">
                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-clay-text">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ClayCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: DBMS VIVA COACH
         ========================================================================= */}
      {activeTab === 'viva' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-lg text-clay-text">
                DBMS Mini Project Viva Voce Defense Coach
              </h3>
              <p className="text-xs text-clay-text-muted">
                Prepare for engineering faculty external viva with 15 core defense cards or mock examiner interrogation
              </p>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-xl clay-card-flat">
              <button
                onClick={() => setVivaMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  vivaMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-clay-text-muted'
                }`}
              >
                15 Viva Cards
              </button>
              <button
                onClick={() => setVivaMode('interrogation')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  vivaMode === 'interrogation' ? 'bg-indigo-600 text-white' : 'text-clay-text-muted'
                }`}
              >
                Mock Examiner Chat
              </button>
            </div>
          </div>

          {vivaMode === 'cards' ? (
            <div className="space-y-3">
              {isCardsLoading ? (
                <div className="p-8 text-center text-xs text-clay-text-muted">
                  Generating 15 syllabus-aligned viva cards...
                </div>
              ) : (
                vivaCards.map(card => {
                  const isOpen = expandedCardId === card.id;
                  return (
                    <ClayCard key={card.id} className="p-4 transition-all">
                      <div
                        onClick={() => setExpandedCardId(isOpen ? null : card.id)}
                        className="flex items-start justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            Q
                          </div>
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                              {card.category}
                            </span>
                            <h4 className="font-bold text-sm text-clay-text mt-0.5">{card.question}</h4>
                          </div>
                        </div>

                        <div className="p-1 rounded-md text-clay-text-muted">
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </div>

                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-3 border-t border-clay-border space-y-3 text-xs"
                        >
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-clay-text leading-relaxed">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                              Model Faculty Answer:
                            </span>
                            {card.answerKey}
                          </div>

                          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-clay-text leading-relaxed">
                            <span className="font-bold text-amber-600 dark:text-amber-400 block mb-1">
                              Expected Follow-up Question from Examiner:
                            </span>
                            {card.followUp}
                          </div>
                        </motion.div>
                      )}
                    </ClayCard>
                  );
                })
              )}
            </div>
          ) : (
            <ClayCard className="p-6 flex flex-col h-[520px] justify-between">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {vivaChat.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 text-xs ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'model' && (
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                        <GraduationCap size={16} />
                      </div>
                    )}
                    <div
                      className={`max-w-[78%] p-3.5 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'clay-card-flat bg-white/90 dark:bg-slate-900/90 text-clay-text rounded-bl-none'
                      }`}
                    >
                      <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                      {msg.feedback && (
                        <div className="mt-2 pt-2 border-t border-clay-border/60 text-[11px] text-amber-600 dark:text-amber-400">
                          <strong>Examiner Evaluation: </strong>
                          {msg.feedback} {msg.score && `(Score: ${msg.score}/10)`}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-clay-border flex gap-2">
                <input
                  type="text"
                  placeholder="Defend your architectural decisions e.g. We enforced 3NF by decomposing..."
                  value={vivaInput}
                  onChange={e => setVivaInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendVivaReply()}
                  className="flex-1 px-4 py-2.5 rounded-2xl clay-inset bg-transparent text-xs text-clay-text placeholder:text-clay-text-muted focus:outline-none"
                />
                <ClayButton
                  variant="primary"
                  size="sm"
                  onClick={handleSendVivaReply}
                  disabled={isVivaReplying || !vivaInput.trim()}
                  icon={<Send size={14} />}
                >
                  Defend
                </ClayButton>
              </div>
            </ClayCard>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 4: GENERAL ASSISTANT CHAT
         ========================================================================= */}
      {activeTab === 'chat' && (
        <ClayCard className="p-6 flex flex-col h-[520px] justify-between">
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-3 text-xs ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-[78%] p-3.5 rounded-2xl ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'clay-card-flat bg-white/90 dark:bg-slate-900/90 text-clay-text rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-line">{msg.text}</p>
                  <span className="block text-[10px] opacity-70 mt-1 text-right">{msg.timestamp}</span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="mt-4 pt-3 border-t border-clay-border flex gap-2">
            <input
              type="text"
              placeholder="Ask anything about the schema, purchases, or normal forms..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
              className="flex-1 px-4 py-2.5 rounded-2xl clay-inset bg-transparent text-xs text-clay-text placeholder:text-clay-text-muted focus:outline-none"
            />
            <ClayButton
              variant="primary"
              size="sm"
              onClick={handleSendChatMessage}
              disabled={isChatLoading || !chatInput.trim()}
              icon={<Send size={14} />}
            >
              Send
            </ClayButton>
          </div>
        </ClayCard>
      )}
    </div>
  );
};
