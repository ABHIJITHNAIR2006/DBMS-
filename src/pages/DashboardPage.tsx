import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Package,
  Layers,
  AlertTriangle,
  IndianRupee,
  ShoppingCart,
  Send,
  ArrowRight,
  Sparkles,
  Calendar,
  Clock,
  TrendingUp,
  CheckCircle2,
  Box
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { HeroCanvas } from '../components/hero3d/HeroCanvas';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useDB } from '../db/store';
import { queries } from '../db/queries';
import { geminiService, RestockAdvisorResult } from '../services/gemini';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

interface DashboardPageProps {
  setActiveTab: (tab: string) => void;
  onOpenPurchaseFormWithItem?: (itemId: string, suggestedQty?: number, supplierId?: string) => void;
  onOpenNewItemModal?: () => void;
  onOpenNewIssueModal?: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  setActiveTab,
  onOpenPurchaseFormWithItem,
  onOpenNewItemModal,
  onOpenNewIssueModal
}) => {
  const { state, derivedStock, showToast } = useDB();
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  // Stats and analytics (memoized to prevent re-computation on hover or unrelated state)
  const stats = React.useMemo(() => queries.getDashboardStats(), [state]);
  const monthlyData = React.useMemo(() => queries.getMonthlyAnalytics(), [state]);
  const categoryData = React.useMemo(() => queries.getStockByCategory(), [state]);
  const topIssued = React.useMemo(() => queries.getTopIssuedItems(5), [state]);
  const lowStockItems = React.useMemo(() => queries.getLowStockItems(), [state]);
  const expiringBatches = React.useMemo(() => queries.getExpiringBatches(30), [state]);

  // AI Restock Advisor State
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<RestockAdvisorResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleAskAiRestock = async () => {
    setIsAiLoading(true);
    setAiError(null);

    try {
      const summaryPayload = lowStockItems.map(item => ({
        itemId: item.item.ItemID,
        itemName: item.item.ItemName,
        category: item.item.Category,
        currentStock: item.currentStock,
        reorderLevel: item.reorderLevel,
        unitPrice: item.item.UnitPrice
      }));

      const res = await geminiService.getRestockRecommendations(summaryPayload);
      setAiResult(res);
      showToast({
        title: 'AI Restock Advice Ready',
        description: `Generated prioritized suggestions for ${res.recommendations.length} stationery items.`,
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI service unavailable';
      setAiError(msg);
      showToast({
        title: 'AI Advisor Notice',
        description: msg,
        type: 'warning'
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  const CATEGORY_COLORS = ['#7C83FF', '#5ED6B0', '#FFA987', '#FFD36B', '#FF8FB1', '#66A6FF'];

  return (
    <div className="w-full space-y-12 pb-16">
      {/* =========================================================================
          1. 3D HERO SECTION (Full-Viewport NEST-Inspired Architectural Feel)
         ========================================================================= */}
      <section className="relative min-h-[85vh] flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-10 clay-card bg-gradient-to-br from-indigo-50/70 via-white/80 to-purple-50/60 dark:from-slate-900/80 dark:via-slate-900/90 dark:to-indigo-950/40">
        {/* Background 3D Canvas */}
        <div className="absolute inset-0 z-0">
          <ErrorBoundary
            name="3D Hero Canvas"
            fallback={
              <div className="w-full h-full bg-gradient-to-br from-indigo-100/40 via-purple-50/20 to-pink-50/30 dark:from-slate-900/60 dark:to-indigo-950/30" />
            }
          >
            <HeroCanvas hoveredModule={hoveredModule} />
          </ErrorBoundary>
        </div>

        {/* Top Floating Badge */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full clay-card-flat bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold font-display tracking-wide text-clay-text">
              Relational 3NF DBMS Active • 10 Normalized Tables
            </span>
            <ClayTooltip
              concept="3NF Normalization"
              explanation="The database is normalized to Third Normal Form (3NF). Every non-prime attribute is non-transitively dependent on the primary key, eliminating insertion, deletion, and update anomalies."
            />
          </div>
          <span className="hidden sm:inline-block text-xs font-bold text-clay-text-muted">
            Indian Academic Stationery Standard
          </span>
        </div>

        {/* Central Hero Headline & CTAs */}
        <div className="relative z-10 max-w-2xl my-auto pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl sm:text-6xl font-extrabold font-display text-clay-text tracking-tight leading-[1.12]">
              Every pencil.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500">
                Every ream.
              </span>{' '}
              Always in stock.
            </h1>
            <p className="mt-4 text-base sm:text-lg text-clay-text-muted leading-relaxed font-medium">
              A centralized relational database automating stationery inventory tracking, purchase
              recording, and department distribution. Eliminates stock-outs with zero manual registers.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <ClayButton
                variant="primary"
                size="lg"
                onClick={() => {
                  const el = document.getElementById('dashboard-stats');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                icon={<ArrowRight size={18} />}
              >
                Explore Dashboard
              </ClayButton>

              <ClayButton
                variant="mint"
                size="lg"
                onClick={() => {
                  setActiveTab('purchases');
                  if (onOpenPurchaseFormWithItem) onOpenPurchaseFormWithItem('');
                }}
                icon={<ShoppingCart size={18} />}
              >
                Record a Purchase
              </ClayButton>

              <ClayButton
                variant="secondary"
                size="lg"
                onClick={() => setActiveTab('database-lab')}
                icon={<Box size={18} />}
              >
                View 3NF Schema
              </ClayButton>
            </div>
          </motion.div>
        </div>

        {/* Scroll cue */}
        <div className="relative z-10 flex items-center justify-between pt-6 border-t border-clay-border/60 text-xs text-clay-text-muted">
          <span>Scroll to explore modules & live relational analytics</span>
          <span className="hidden sm:inline font-mono">↓ Dynamic Stock Derived In-Memory</span>
        </div>
      </section>

      {/* =========================================================================
          2. SCROLL-DRIVEN MODULE SHOWCASE (Interactive Tilting Cards)
         ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold font-display text-clay-text">Project Modules Showcase</h2>
            <p className="text-xs text-clay-text-muted">
              5 core mini-project modules mapped directly to relational database operations
            </p>
          </div>
          <ClayTooltip
            concept="Relational Decomposition"
            explanation="Each module executes specialized SQL transactions against decomposed 3NF relations, ensuring atomicity and referential integrity."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            {
              id: 'items',
              name: 'Item Management',
              tag: 'Module 1',
              desc: 'Catalog items with disjoint consumable vs durable specialization.',
              color: 'from-indigo-500 to-indigo-600',
              icon: Package,
              moduleId: 'items'
            },
            {
              id: 'stock',
              name: 'Stock Management',
              tag: 'Module 2',
              desc: 'Derived stock levels with automated chronological audit ledger.',
              color: 'from-emerald-500 to-teal-600',
              icon: Layers,
              moduleId: 'stock'
            },
            {
              id: 'purchases',
              name: 'Purchase Recording',
              tag: 'Module 3',
              desc: 'Stock-in transactions from suppliers with unit cost verification.',
              color: 'from-blue-500 to-cyan-600',
              icon: ShoppingCart,
              moduleId: 'purchases'
            },
            {
              id: 'issues',
              name: 'Issue & Distribution',
              tag: 'Module 4',
              desc: 'Department distribution with strict stock-out prevention rule.',
              color: 'from-amber-500 to-orange-600',
              icon: Send,
              moduleId: 'issues'
            },
            {
              id: 'search',
              name: 'Search & Retrieval',
              tag: 'Module 5',
              desc: 'Instant keyword search and Gemini AI natural language filter compiler.',
              color: 'from-pink-500 to-rose-600',
              icon: Sparkles,
              moduleId: 'search'
            }
          ].map(mod => {
            const Icon = mod.icon;
            return (
              <ClayCard
                key={mod.id}
                enableTilt
                onMouseEnter={() => setHoveredModule(mod.moduleId)}
                onMouseLeave={() => setHoveredModule(null)}
                onClick={() => setActiveTab(mod.id)}
                className="cursor-pointer p-5 flex flex-col justify-between group hover:border-indigo-400 dark:hover:border-indigo-600"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${mod.color} text-white flex items-center justify-center shadow-md`}
                    >
                      <Icon size={20} />
                    </div>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-clay-text-muted">
                      {mod.tag}
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-clay-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {mod.name}
                  </h3>
                  <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">{mod.desc}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-clay-border flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Open Module</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </ClayCard>
            );
          })}
        </div>
      </section>

      {/* =========================================================================
          3. ANIMATED STAT CLAY-CARDS
         ========================================================================= */}
      <section id="dashboard-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Items */}
        <ClayCard enableTilt className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted">
              Total Catalog Items
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Package size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold font-display text-clay-text">
              {stats.totalItems}
            </span>
            <span className="text-xs text-clay-text-muted ml-2">stationery records</span>
          </div>
          <div className="mt-3 text-xs text-clay-text-muted flex items-center gap-1">
            <span className="text-emerald-500 font-bold">✓ 3NF Compliant</span>
            <span>in ITEM relation</span>
          </div>
        </ClayCard>

        {/* Total Stock Units (Derived) */}
        <ClayCard enableTilt className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted">
                Total Stock Units
              </span>
              <ClayTooltip
                concept="Derived Attribute"
                explanation="Stock is dynamically calculated: SUM(SUPPLIES.Quantity) - SUM(ISSUED_TO.Quantity). It is never stored directly, preventing data synchronization anomalies."
              />
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Layers size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold font-display text-clay-text">
              {stats.totalStockUnits.toLocaleString()}
            </span>
            <span className="text-xs text-clay-text-muted ml-2">units on hand</span>
          </div>
          <div className="mt-3 text-xs text-clay-text-muted flex items-center gap-1">
            <TrendingUp size={13} className="text-emerald-500" />
            <span>Updated automatically on purchase/issue</span>
          </div>
        </ClayCard>

        {/* Low-Stock Consumables */}
        <ClayCard
          enableTilt
          className={`p-6 ${
            stats.lowStockCount > 0 ? 'border-amber-300 dark:border-amber-700' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted">
              Needs Attention
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold font-display text-amber-600 dark:text-amber-400">
              {stats.lowStockCount}
            </span>
            <span className="text-xs text-clay-text-muted ml-2">items below reorder level</span>
          </div>
          <div className="mt-3 text-xs text-clay-text-muted">
            <button
              onClick={() => {
                const el = document.getElementById('needs-attention-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
            >
              View Restock Alerts →
            </button>
          </div>
        </ClayCard>

        {/* Total Purchase Spend */}
        <ClayCard enableTilt className="p-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted">
              Total Purchase Spend
            </span>
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <IndianRupee size={20} />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl sm:text-4xl font-extrabold font-display text-clay-text">
              ₹{(stats.totalPurchaseSpend / 1000).toFixed(1)}k
            </span>
            <span className="text-xs text-clay-text-muted ml-2">total procurement</span>
          </div>
          <div className="mt-3 text-xs text-clay-text-muted flex items-center gap-1">
            <span>Across {stats.totalPurchasesCount} orders from {stats.suppliersCount} suppliers</span>
          </div>
        </ClayCard>
      </section>

      {/* =========================================================================
          4. CHARTS SECTION (Purchases vs Issues Area, Category Donut, Top 5 Bar)
         ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Purchases vs Issues (Area Chart) */}
        <ClayCard className="lg:col-span-2 p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-clay-text">
                Stock Movements: Purchases (In) vs Issues (Out)
              </h3>
              <p className="text-xs text-clay-text-muted">
                Aggregated monthly transaction quantities demonstrating stock replenishment vs departmental usage
              </p>
            </div>
            <ClayChip label="Derived Analysis" variant="periwinkle" />
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C83FF" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#7C83FF" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFA987" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#FFA987" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" stroke="#8888AA" fontSize={11} tickLine={false} />
                <YAxis stroke="#8888AA" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    borderRadius: '16px',
                    border: '1px solid #E0E7FF',
                    boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="purchasesQty"
                  name="Purchases (Stock-In)"
                  stroke="#7C83FF"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorPurchases)"
                />
                <Area
                  type="monotone"
                  dataKey="issuesQty"
                  name="Issues (Stock-Out)"
                  stroke="#FA7952"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorIssues)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 pt-3 border-t border-clay-border flex items-center justify-around text-xs font-bold text-clay-text">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#7C83FF]" />
              <span>Total Purchased: {state.SUPPLIES.reduce((sum, s) => sum + s.Quantity, 0)} units</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#FA7952]" />
              <span>Total Issued: {state.ISSUED_TO.reduce((sum, i) => sum + i.Quantity, 0)} units</span>
            </div>
          </div>
        </ClayCard>

        {/* Stock by Category (Donut Chart) */}
        <ClayCard className="p-6 flex flex-col justify-between">
          <div className="mb-2">
            <h3 className="font-display font-bold text-lg text-clay-text">Stock by Category</h3>
            <p className="text-xs text-clay-text-muted">Total inventory units per stationery division</p>
          </div>

          <div className="w-full h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-extrabold font-display text-clay-text">
                {stats.totalStockUnits}
              </span>
              <span className="text-[10px] uppercase font-bold text-clay-text-muted">Units</span>
            </div>
          </div>

          <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {categoryData.map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                  />
                  <span className="font-medium text-clay-text truncate max-w-[130px]">{cat.name}</span>
                </div>
                <span className="font-bold font-mono text-clay-text-muted">{cat.value} units</span>
              </div>
            ))}
          </div>
        </ClayCard>
      </section>

      {/* =========================================================================
          5. NEEDS ATTENTION PANEL (Low Stock, Expiring Batches & AI Restock Advisor)
         ========================================================================= */}
      <section id="needs-attention-section" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold font-display text-clay-text">Needs Attention & Alerts</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {lowStockItems.length} Low Stock • {expiringBatches.length} Expiring Batches
              </span>
            </div>
            <p className="text-xs text-clay-text-muted">
              Automatic alert triggers based on EER Consumable ReorderLevel and Weak Entity Batch ExpiryDate
            </p>
          </div>

          {/* AI Restock Advisor Action Button */}
          <ClayButton
            variant="peach"
            onClick={handleAskAiRestock}
            disabled={isAiLoading}
            icon={<Sparkles size={16} />}
            className="shadow-md"
          >
            {isAiLoading ? 'Analyzing Inventory...' : 'Ask AI What to Reorder'}
          </ClayButton>
        </div>

        {/* AI Recommendations Panel (if generated) */}
        {aiResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="clay-card p-6 border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-950/30"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-indigo-600 dark:text-indigo-400" size={20} />
                <h3 className="font-display font-bold text-lg text-clay-text">
                  Gemini AI Restock Strategy
                </h3>
              </div>
              <span className="text-xs font-bold text-clay-text-muted">Advisory Suggestions</span>
            </div>
            <p className="text-sm text-clay-text-muted mb-4">{aiResult.summaryOverview}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiResult.recommendations.map(rec => (
                <div
                  key={rec.itemId}
                  className="clay-card-flat p-4 bg-white/90 dark:bg-slate-900/90 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-clay-text">{rec.itemName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          rec.urgency === 'CRITICAL'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                        }`}
                      >
                        {rec.urgency}
                      </span>
                    </div>
                    <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">{rec.reason}</p>
                    <div className="mt-3 flex items-center justify-between text-xs font-medium">
                      <span>Order Qty: <strong>{rec.suggestedQuantity} units</strong></span>
                      {rec.estimatedCostINR && (
                        <span>Est: <strong>₹{rec.estimatedCostINR}</strong></span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-2 border-t border-clay-border">
                    <ClayButton
                      variant="primary"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        setActiveTab('purchases');
                        if (onOpenPurchaseFormWithItem) {
                          onOpenPurchaseFormWithItem(rec.itemId, rec.suggestedQuantity, rec.preferredSupplierId);
                        }
                      }}
                    >
                      Pre-fill Purchase Order
                    </ClayButton>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Low Stock Items Table */}
          <ClayCard className="p-6">
            <h3 className="font-display font-bold text-base text-clay-text mb-3 flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={18} />
              <span>Consumables At or Below Reorder Threshold</span>
            </h3>

            {lowStockItems.length === 0 ? (
              <div className="text-center py-8 text-clay-text-muted text-sm">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                All stationery consumable items are adequately stocked!
              </div>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map(s => (
                  <div
                    key={s.item.ItemID}
                    className="clay-card-flat p-3.5 flex items-center justify-between bg-white/70 dark:bg-slate-900/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-clay-text">{s.item.ItemName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                          {s.item.ItemID}
                        </span>
                      </div>
                      <div className="text-xs text-clay-text-muted mt-1 flex items-center gap-3">
                        <span>Current Stock: <strong className="text-rose-500">{s.currentStock}</strong></span>
                        <span>•</span>
                        <span>Reorder Level: <strong>{s.reorderLevel}</strong></span>
                      </div>
                    </div>

                    <ClayButton
                      variant="mint"
                      size="sm"
                      onClick={() => {
                        setActiveTab('purchases');
                        if (onOpenPurchaseFormWithItem) {
                          onOpenPurchaseFormWithItem(s.item.ItemID, (s.reorderLevel || 20) * 2);
                        }
                      }}
                    >
                      Restock
                    </ClayButton>
                  </div>
                ))}
              </div>
            )}
          </ClayCard>

          {/* Expiring Batches Table */}
          <ClayCard className="p-6">
            <h3 className="font-display font-bold text-base text-clay-text mb-3 flex items-center gap-2">
              <Clock className="text-rose-500" size={18} />
              <span>Weak Entity: Batches Expiring in 30 Days</span>
            </h3>

            {expiringBatches.length === 0 ? (
              <div className="text-center py-8 text-clay-text-muted text-sm">
                <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                No batches expiring within the next 30 days.
              </div>
            ) : (
              <div className="space-y-3">
                {expiringBatches.map(b => (
                  <div
                    key={`${b.ItemID}-${b.BatchNo}`}
                    className="clay-card-flat p-3.5 flex items-center justify-between bg-white/70 dark:bg-slate-900/70"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-clay-text">{b.itemName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-clay-text">
                          Batch: {b.BatchNo}
                        </span>
                      </div>
                      <div className="text-xs text-clay-text-muted mt-1 flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>Expiry: {b.ExpiryDate}</span>
                        </span>
                        <span>•</span>
                        <span className="text-rose-500 font-bold">
                          {b.daysRemaining === 0 ? 'Expires Today' : `${b.daysRemaining} days left`}
                        </span>
                      </div>
                    </div>

                    <ClayChip label={`Batch ${b.BatchNo}`} variant="rose" />
                  </div>
                ))}
              </div>
            )}
          </ClayCard>
        </div>
      </section>

      {/* =========================================================================
          6. RECENT ACTIVITY TIMELINE & TOP ISSUED ITEMS
         ========================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Most Issued Stationery Items */}
        <ClayCard className="p-6">
          <h3 className="font-display font-bold text-lg text-clay-text mb-1">
            Top 5 Most-Issued Stationery
          </h3>
          <p className="text-xs text-clay-text-muted mb-4">Highest consumed stationery across departments</p>

          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topIssued} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <XAxis type="number" stroke="#8888AA" fontSize={10} />
                <YAxis dataKey="itemName" type="category" stroke="#8888AA" fontSize={10} width={90} />
                <Tooltip />
                <Bar dataKey="totalIssued" fill="#7C83FF" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ClayCard>

        {/* Recent Purchases and Issues Timeline */}
        <ClayCard className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-bold text-lg text-clay-text">Recent Relational Transactions</h3>
              <p className="text-xs text-clay-text-muted">Chronological purchase and issue audit log</p>
            </div>
            <ClayButton variant="secondary" size="sm" onClick={() => setActiveTab('database-lab')}>
              View Live SQL Log
            </ClayButton>
          </div>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {[
              ...state.SUPPLIES.map(s => ({
                id: s.PurchaseID,
                type: 'PURCHASE' as const,
                date: s.PurchaseDate,
                item: state.ITEM.find(i => i.ItemID === s.ItemID)?.ItemName ?? s.ItemID,
                entity: state.SUPPLIER.find(sp => sp.SupplierID === s.SupplierID)?.SupplierName ?? s.SupplierID,
                qty: s.Quantity,
                cost: s.Cost
              })),
              ...state.ISSUED_TO.map(i => ({
                id: i.IssueID,
                type: 'ISSUE' as const,
                date: i.IssueDate,
                item: state.ITEM.find(it => it.ItemID === i.ItemID)?.ItemName ?? i.ItemID,
                entity: state.DEPARTMENT.find(d => d.DeptID === i.DeptID)?.DeptName ?? i.DeptID,
                qty: i.Quantity,
                cost: undefined
              }))
            ]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 7)
              .map(tx => (
                <div
                  key={tx.id}
                  className="clay-card-flat p-3 flex items-center justify-between text-xs bg-white/70 dark:bg-slate-900/70"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        tx.type === 'PURCHASE'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {tx.type === 'PURCHASE' ? '+ IN' : '- OUT'}
                    </div>
                    <div>
                      <div className="font-bold text-clay-text flex items-center gap-2">
                        <span>{tx.item}</span>
                        <span className="font-mono text-[10px] text-clay-text-muted">{tx.id}</span>
                      </div>
                      <div className="text-[11px] text-clay-text-muted mt-0.5">
                        {tx.type === 'PURCHASE' ? `From: ${tx.entity}` : `To: ${tx.entity}`} • {tx.date}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold font-mono text-sm text-clay-text">
                      {tx.type === 'PURCHASE' ? `+${tx.qty}` : `-${tx.qty}`}
                    </span>
                    {tx.cost && (
                      <p className="text-[10px] text-clay-text-muted">₹{tx.cost.toLocaleString('en-IN')}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </ClayCard>
      </section>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-30 flex items-center gap-2">
        <ClayButton
          variant="primary"
          onClick={() => {
            if (onOpenNewItemModal) onOpenNewItemModal();
            else setActiveTab('items');
          }}
          icon={<Package size={16} />}
          className="shadow-xl"
        >
          + New Item
        </ClayButton>
        <ClayButton
          variant="mint"
          onClick={() => {
            setActiveTab('purchases');
            if (onOpenPurchaseFormWithItem) onOpenPurchaseFormWithItem('');
          }}
          icon={<ShoppingCart size={16} />}
          className="shadow-xl"
        >
          + Purchase
        </ClayButton>
        <ClayButton
          variant="peach"
          onClick={() => {
            if (onOpenNewIssueModal) onOpenNewIssueModal();
            else setActiveTab('issues');
          }}
          icon={<Send size={16} />}
          className="shadow-xl"
        >
          + Issue
        </ClayButton>
      </div>
    </div>
  );
};
