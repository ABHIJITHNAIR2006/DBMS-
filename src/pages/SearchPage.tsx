import React, { useState, useMemo } from 'react';
import {
  Search,
  Sparkles,
  Code2,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClaySelect } from '../components/clay/ClaySelect';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { useDB } from '../db/store';
import { geminiService, SmartSearchFilterResult } from '../services/gemini';

interface SearchPageProps {
  onInspectItem?: (itemId: string) => void;
  onOpenPurchaseWithItem?: (itemId: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({
  onInspectItem,
  onOpenPurchaseWithItem
}) => {
  const { derivedStock, showToast } = useDB();

  // Search input state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [maxPriceFilter, setMaxPriceFilter] = useState<number | null>(null);

  // Toggle "Show SQL"
  const [showSql, setShowSql] = useState(true);

  // Gemini AI Smart Search State
  const [aiNaturalQuery, setAiNaturalQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiFilterApplied, setAiFilterApplied] = useState<SmartSearchFilterResult | null>(null);

  const availableCategories = useMemo(() => {
    return Array.from(new Set(derivedStock.map(s => s.item.Category))).sort();
  }, [derivedStock]);

  // Handle Gemini Smart Search
  const handleRunAiSmartSearch = async (queryToRun?: string) => {
    const q = queryToRun || aiNaturalQuery;
    if (!q.trim()) return;

    setIsAiLoading(true);
    try {
      const result = await geminiService.parseSmartSearch(q, availableCategories);
      setAiFilterApplied(result);

      // Auto-apply structured filters
      if (result.categories && result.categories.length > 0) {
        const matched = availableCategories.find(
          c => c.toLowerCase() === result.categories[0].toLowerCase()
        );
        setSelectedCategory(matched || result.categories[0]);
      }
      if (result.type && result.type !== 'All') {
        setSelectedType(result.type);
      }
      if (result.status && result.status !== 'All') {
        setSelectedStatus(result.status);
      }
      if (result.maxPrice && result.maxPrice > 0) {
        setMaxPriceFilter(result.maxPrice);
      }
      if (result.keywords && result.keywords.length > 0) {
        setSearchTerm(result.keywords.join(' '));
      }

      showToast({
        title: 'AI Smart Filter Compiled',
        description: `Applied ${result.categories.length} categories, max price ₹${result.maxPrice || 'Any'}, and keywords.`,
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Smart Search failed';
      showToast({ title: 'AI Notice', description: msg, type: 'warning' });
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleClearAiFilters = () => {
    setAiFilterApplied(null);
    setSearchTerm('');
    setSelectedCategory('ALL');
    setSelectedType('ALL');
    setSelectedStatus('ALL');
    setMaxPriceFilter(null);
  };

  // Filtered stationery records
  const filteredResults = useMemo(() => {
    return derivedStock.filter(s => {
      const q = searchTerm.toLowerCase().trim();
      const matchKeyword =
        !q ||
        s.item.ItemName.toLowerCase().includes(q) ||
        s.item.ItemID.toLowerCase().includes(q) ||
        s.item.Category.toLowerCase().includes(q);

      const matchCat =
        selectedCategory === 'ALL' ||
        (aiFilterApplied?.categories && aiFilterApplied.categories.length > 0
          ? aiFilterApplied.categories.some(c => c.toLowerCase() === s.item.Category.toLowerCase())
          : s.item.Category === selectedCategory);

      const matchType = selectedType === 'ALL' || s.itemType === selectedType;
      const matchStatus = selectedStatus === 'ALL' || s.status === selectedStatus;
      const matchPrice = maxPriceFilter === null || s.item.UnitPrice <= maxPriceFilter;

      return matchKeyword && matchCat && matchType && matchStatus && matchPrice;
    });
  }, [derivedStock, searchTerm, selectedCategory, selectedType, selectedStatus, maxPriceFilter, aiFilterApplied]);

  // Construct Dynamic SQL query string representation
  const generatedSql = useMemo(() => {
    const whereClauses: string[] = [];

    if (searchTerm.trim()) {
      whereClauses.push(`(i.ItemName LIKE '%${searchTerm.trim()}%' OR i.ItemID = '${searchTerm.trim()}')`);
    }
    if (selectedCategory !== 'ALL') {
      whereClauses.push(`i.Category = '${selectedCategory}'`);
    }
    if (selectedType !== 'ALL') {
      if (selectedType === 'Consumable') whereClauses.push(`c.ItemID IS NOT NULL`);
      else if (selectedType === 'Durable') whereClauses.push(`d.ItemID IS NOT NULL`);
    }
    if (maxPriceFilter !== null) {
      whereClauses.push(`i.UnitPrice <= ${maxPriceFilter}`);
    }
    if (selectedStatus === 'Low Stock') {
      whereClauses.push(`(COALESCE(p.Qty, 0) - COALESCE(iss.Qty, 0)) <= c.ReorderLevel`);
    } else if (selectedStatus === 'Out of Stock') {
      whereClauses.push(`(COALESCE(p.Qty, 0) - COALESCE(iss.Qty, 0)) <= 0`);
    }

    const whereStr = whereClauses.length > 0 ? `\nWHERE ${whereClauses.join(' AND\n  ')}` : '';

    return `SELECT 
    i.ItemID, i.ItemName, i.Category, i.UnitPrice,
    (COALESCE(p.Qty, 0) - COALESCE(iss.Qty, 0)) AS DerivedStockQty
FROM ITEM i
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS Qty FROM SUPPLIES GROUP BY ItemID) p ON i.ItemID = p.ItemID
LEFT JOIN (SELECT ItemID, SUM(Quantity) AS Qty FROM ISSUED_TO GROUP BY ItemID) iss ON i.ItemID = iss.ItemID
LEFT JOIN CONSUMABLE_ITEM c ON i.ItemID = c.ItemID
LEFT JOIN DURABLE_ITEM d ON i.ItemID = d.ItemID${whereStr}
ORDER BY DerivedStockQty ASC;`;
  }, [searchTerm, selectedCategory, selectedType, selectedStatus, maxPriceFilter]);

  // Highlight search term helper
  const highlightMatch = (text: string, term: string) => {
    if (!term.trim()) return text;
    const parts = text.split(new RegExp(`(${term})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === term.toLowerCase() ? (
            <mark key={i} className="bg-amber-300 dark:bg-amber-600 text-slate-900 rounded px-1">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Stationery Search & Query Module
            </h1>
            <ClayChip label="Module 5" variant="rose" />
            <ClayTooltip
              concept="Relational Selection & Projection"
              explanation="Search executes dynamic WHERE clauses against the centralized relational schema, projecting Item attributes and computing derived stock levels."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Instant debounced keyword retrieval, dynamic relational filters, and Gemini AI natural language query parsing
          </p>
        </div>

        <button
          onClick={() => setShowSql(!showSql)}
          className="clay-card-flat px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 cursor-pointer"
        >
          <Code2 size={15} />
          <span>{showSql ? 'Hide SQL Query' : 'Show SQL Query'}</span>
        </button>
      </div>

      {/* AI Smart Search Box */}
      <ClayCard className="p-5 border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/60 via-purple-50/40 to-pink-50/60 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
            <span className="font-display font-bold text-sm text-clay-text">
              Gemini AI Smart Search Compiler
            </span>
          </div>
          <span className="text-[11px] text-clay-text-muted">
            Converts natural language into structured SQL filters
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input
            type="text"
            value={aiNaturalQuery}
            onChange={e => setAiNaturalQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleRunAiSmartSearch()}
            placeholder="Try: 'cheap writing items running low' or 'files under ₹200'..."
            className="clay-input flex-1 text-sm font-medium"
          />
          <ClayButton
            variant="primary"
            onClick={() => handleRunAiSmartSearch()}
            disabled={isAiLoading || !aiNaturalQuery.trim()}
            icon={<Sparkles size={14} />}
          >
            {isAiLoading ? 'Compiling Query...' : 'AI Search'}
          </ClayButton>
        </div>

        {/* Suggested Queries */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-[11px] font-bold text-clay-text-muted">Quick Examples:</span>
          {[
            'cheap writing items running low',
            'durable office supplies with warranty',
            'paper items under ₹300',
            'items out of stock'
          ].map(sample => (
            <button
              key={sample}
              onClick={() => {
                setAiNaturalQuery(sample);
                handleRunAiSmartSearch(sample);
              }}
              className="text-[11px] px-2.5 py-0.5 rounded-full clay-card-flat bg-white/70 dark:bg-slate-800/70 hover:bg-indigo-50 text-clay-text cursor-pointer transition-colors"
            >
              "{sample}"
            </button>
          ))}
        </div>

        {/* Applied AI Chips */}
        {aiFilterApplied && (
          <div className="mt-3 pt-3 border-t border-clay-border flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Interpreted AI Filters:
            </span>
            {aiFilterApplied.categories?.map(c => (
              <ClayChip key={c} label={`Category: ${c}`} variant="periwinkle" />
            ))}
            {aiFilterApplied.type && aiFilterApplied.type !== 'All' && (
              <ClayChip label={`Type: ${aiFilterApplied.type}`} variant="sunshine" />
            )}
            {aiFilterApplied.status && aiFilterApplied.status !== 'All' && (
              <ClayChip label={`Status: ${aiFilterApplied.status}`} variant="peach" />
            )}
            {aiFilterApplied.maxPrice && aiFilterApplied.maxPrice > 0 && (
              <ClayChip label={`Max Price: ₹${aiFilterApplied.maxPrice}`} variant="mint" />
            )}
            <button
              onClick={handleClearAiFilters}
              className="text-xs font-bold text-rose-500 hover:underline ml-auto flex items-center gap-1 cursor-pointer"
            >
              <X size={13} /> Clear AI Filters
            </button>
          </div>
        )}
      </ClayCard>

      {/* Manual Search & Filters Toolbar */}
      <ClayCard flat className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1">
            <ClayInput
              placeholder="Search by keyword in name, ID, or category..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <ClaySelect
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  ...availableCategories.map(c => ({ value: c, label: c }))
                ]}
              />
            </div>

            <div className="w-32">
              <ClaySelect
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Types' },
                  { value: 'Consumable', label: 'Consumable' },
                  { value: 'Durable', label: 'Durable' }
                ]}
              />
            </div>

            <div className="w-36">
              <ClaySelect
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'In Stock', label: 'In Stock' },
                  { value: 'Low Stock', label: 'Low Stock' },
                  { value: 'Out of Stock', label: 'Out of Stock' }
                ]}
              />
            </div>
          </div>
        </div>
      </ClayCard>

      {/* Live SQL Preview Box (Demonstration Feature) */}
      {showSql && (
        <ClayCard flat className="p-4 bg-slate-900 text-slate-100 border border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs font-bold">
              <Code2 size={14} />
              <span>LIVE RELATIONAL SQL (Compiled from Search Parameters):</span>
            </div>
            <span className="text-[10px] text-slate-400">
              Matched Rows: <strong>{filteredResults.length}</strong>
            </span>
          </div>
          <pre className="text-xs font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">
            {generatedSql}
          </pre>
        </ClayCard>
      )}

      {/* Search Results Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-clay-text-muted">
            Found {filteredResults.length} Stationery Match{filteredResults.length === 1 ? '' : 'es'}
          </span>
        </div>

        {filteredResults.length === 0 ? (
          <ClayCard className="p-12 text-center">
            <Package size={40} className="mx-auto text-clay-text-muted mb-3 opacity-60" />
            <h3 className="font-display font-bold text-lg text-clay-text">No stationery items match</h3>
            <p className="text-xs text-clay-text-muted mt-1 max-w-sm mx-auto">
              Try adjusting your search terms, removing filters, or asking Gemini AI for suggested queries.
            </p>
          </ClayCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResults.map(s => (
              <ClayCard
                key={s.item.ItemID}
                enableTilt
                onClick={() => {
                  if (onInspectItem) onInspectItem(s.item.ItemID);
                }}
                className="p-5 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                      {s.item.ItemID}
                    </span>
                    <ClayChip
                      label={s.status}
                      variant={
                        s.status === 'In Stock'
                          ? 'mint'
                          : s.status === 'Low Stock'
                          ? 'peach'
                          : s.status === 'Out of Stock'
                          ? 'rose'
                          : 'periwinkle'
                      }
                    />
                  </div>

                  <h3 className="font-display font-bold text-base text-clay-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {highlightMatch(s.item.ItemName, searchTerm)}
                  </h3>
                  <p className="text-xs text-clay-text-muted mt-1">{s.item.Category}</p>

                  <div className="mt-4 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs font-medium">
                    <span>Unit Catalog Price:</span>
                    <span className="font-bold text-clay-text font-mono">₹{s.item.UnitPrice}</span>
                  </div>

                  <div className="mt-2 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 flex items-center justify-between text-xs">
                    <span className="text-indigo-700 dark:text-indigo-300 font-bold">Current Stock:</span>
                    <span className="font-extrabold text-base font-mono text-clay-text">
                      {s.currentStock} units
                    </span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-clay-border flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    View Stock Ledger →
                  </span>

                  <ClayButton
                    variant="mint"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      if (onOpenPurchaseWithItem) onOpenPurchaseWithItem(s.item.ItemID);
                    }}
                  >
                    Restock
                  </ClayButton>
                </div>
              </ClayCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
