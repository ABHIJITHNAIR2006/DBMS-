import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  Download,
  Search,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Package,
  Calendar,
  Sparkles
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClaySelect } from '../components/clay/ClaySelect';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { useDB } from '../db/store';
import { queries } from '../db/queries';
import { DerivedStockInfo, StockLedgerEntry } from '../db/types';

interface StockPageProps {
  onOpenPurchaseWithItem?: (itemId: string) => void;
  onOpenIssueWithItem?: (itemId: string) => void;
}

export const StockPage: React.FC<StockPageProps> = ({
  onOpenPurchaseWithItem,
  onOpenIssueWithItem
}) => {
  const { derivedStock, showToast } = useDB();

  // Search, filter, and sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<'name' | 'stock' | 'purchased' | 'issued'>('stock');
  const [sortAsc, setSortAsc] = useState(false);

  // Expanded row for ledger inspection
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const categories = React.useMemo(
    () => Array.from(new Set(derivedStock.map(s => s.item.Category))).sort(),
    [derivedStock]
  );

  // Filtered & Sorted Stock List
  const filteredStock = React.useMemo(() => {
    return derivedStock
      .filter(s => {
        const matchSearch =
          s.item.ItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.item.ItemID.toLowerCase().includes(searchQuery.toLowerCase());
        const matchCat = categoryFilter === 'ALL' || s.item.Category === categoryFilter;
        const matchStatus = statusFilter === 'ALL' || s.status === statusFilter;
        return matchSearch && matchCat && matchStatus;
      })
      .sort((a, b) => {
        let valA: string | number = 0;
        let valB: string | number = 0;
        if (sortField === 'name') {
          valA = a.item.ItemName.toLowerCase();
          valB = b.item.ItemName.toLowerCase();
        } else if (sortField === 'stock') {
          valA = a.currentStock;
          valB = b.currentStock;
        } else if (sortField === 'purchased') {
          valA = a.totalPurchased;
          valB = b.totalPurchased;
        } else if (sortField === 'issued') {
          valA = a.totalIssued;
          valB = b.totalIssued;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [derivedStock, searchQuery, categoryFilter, statusFilter, sortField, sortAsc]);

  // Toggle sort column
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // CSV Export functionality
  const handleExportCSV = () => {
    const headers = ['ItemID', 'ItemName', 'Category', 'UnitPrice', 'TotalPurchased', 'TotalIssued', 'CurrentStock', 'ReorderLevel', 'Status'];
    const rows = filteredStock.map(s => [
      s.item.ItemID,
      `"${s.item.ItemName.replace(/"/g, '""')}"`,
      s.item.Category,
      s.item.UnitPrice,
      s.totalPurchased,
      s.totalIssued,
      s.currentStock,
      s.reorderLevel ?? 'N/A',
      s.status
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ClayStock_Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast({
      title: 'Stock Report Exported',
      description: `CSV file downloaded with ${rows.length} stationery stock records.`,
      type: 'success'
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Stock Management Module
            </h1>
            <ClayChip label="Module 2" variant="mint" />
            <ClayTooltip
              concept="Derived Stock Engine"
              explanation="StockQty is a derived attribute computed dynamically via SQL: (Total Inflow - Total Outflow). No stock value is permanently stored in any table, eliminating write skew and stale stock bugs."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Real-time derived stationery inventory tracking with chronological transaction ledgers
          </p>
        </div>

        <ClayButton variant="secondary" onClick={handleExportCSV} icon={<Download size={16} />}>
          Export CSV Report
        </ClayButton>
      </div>

      {/* Filter Toolbar */}
      <ClayCard flat className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <ClayInput
            placeholder="Search stationery by name or ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="w-40">
            <ClaySelect
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                ...categories.map(c => ({ value: c, label: c }))
              ]}
            />
          </div>

          <div className="w-40">
            <ClaySelect
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Statuses' },
                { value: 'In Stock', label: 'In Stock' },
                { value: 'Low Stock', label: 'Low Stock' },
                { value: 'Out of Stock', label: 'Out of Stock' },
                { value: 'Durable Stock', label: 'Durable Stock' }
              ]}
            />
          </div>
        </div>
      </ClayCard>

      {/* Stock Table with Expandable Running Ledger */}
      <ClayCard className="p-4 sm:p-6 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-clay-border text-clay-text-muted font-display uppercase tracking-wider text-[11px] select-none">
              <th className="py-3 px-3 w-8"></th>
              <th className="py-3 px-3 cursor-pointer hover:text-clay-text" onClick={() => handleSort('name')}>
                Item & ID {sortField === 'name' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th className="py-3 px-3">Category</th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-clay-text text-right"
                onClick={() => handleSort('purchased')}
              >
                Stock-In (+) {sortField === 'purchased' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-clay-text text-right"
                onClick={() => handleSort('issued')}
              >
                Stock-Out (-) {sortField === 'issued' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th
                className="py-3 px-3 cursor-pointer hover:text-clay-text text-right"
                onClick={() => handleSort('stock')}
              >
                Current Stock {sortField === 'stock' ? (sortAsc ? '↑' : '↓') : ''}
              </th>
              <th className="py-3 px-3 text-center">Status</th>
              <th className="py-3 px-3 text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-border">
            {filteredStock.map(s => {
              const isExpanded = expandedItemId === s.item.ItemID;
              const ledger = isExpanded ? queries.getStockLedger(s.item.ItemID) : [];

              return (
                <React.Fragment key={s.item.ItemID}>
                  <tr
                    onClick={() => setExpandedItemId(isExpanded ? null : s.item.ItemID)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3 text-clay-text-muted">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </td>
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-clay-text">{s.item.ItemName}</div>
                      <div className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                        {s.item.ItemID} • ₹{s.item.UnitPrice} / unit
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-clay-text-muted">{s.item.Category}</td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      +{s.totalPurchased}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                      -{s.totalIssued}
                    </td>
                    <td className="py-3.5 px-3 text-right">
                      <motion.span
                        key={s.currentStock}
                        initial={{ scale: 1.3, color: '#6366F1' }}
                        animate={{ scale: 1, color: s.currentStock <= 0 ? '#EF4444' : '#10B981' }}
                        transition={{ duration: 0.4 }}
                        className="font-mono font-extrabold text-base inline-block"
                      >
                        {s.currentStock}
                      </motion.span>
                      {s.reorderLevel !== undefined && (
                        <div className="text-[10px] text-clay-text-muted font-mono">
                          Reorder: {s.reorderLevel}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          s.status === 'In Stock'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : s.status === 'Low Stock'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                            : s.status === 'Out of Stock'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <ClayButton
                          variant="mint"
                          size="sm"
                          onClick={() => {
                            if (onOpenPurchaseWithItem) onOpenPurchaseWithItem(s.item.ItemID);
                          }}
                        >
                          Restock
                        </ClayButton>
                        <ClayButton
                          variant="secondary"
                          size="sm"
                          disabled={s.currentStock <= 0}
                          onClick={() => {
                            if (onOpenIssueWithItem) onOpenIssueWithItem(s.item.ItemID);
                          }}
                        >
                          Issue
                        </ClayButton>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Mini Stock Ledger Row */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 dark:bg-slate-800/60">
                      <td colSpan={8} className="p-4 sm:p-6">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-display font-bold text-sm text-clay-text">
                                Mini Stock Audit Ledger for {s.item.ItemName} ({s.item.ItemID})
                              </h4>
                              <ClayChip label={`${ledger.length} entries`} variant="periwinkle" />
                            </div>
                            <span className="text-xs text-clay-text-muted font-mono">
                              Stock Verification: {s.totalPurchased} - {s.totalIssued} = {s.currentStock} units
                            </span>
                          </div>

                          {ledger.length === 0 ? (
                            <p className="text-xs text-clay-text-muted py-2">No transaction ledger entries recorded.</p>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                              {ledger.map(entry => (
                                <div
                                  key={entry.id}
                                  className="clay-card-flat p-2.5 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold">
                                      <span
                                        className={`px-1 rounded text-[9px] ${
                                          entry.type === 'PURCHASE'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                                        }`}
                                      >
                                        {entry.type === 'PURCHASE' ? 'PURCHASE' : 'ISSUE'}
                                      </span>
                                      <span className="text-clay-text truncate max-w-[130px]">{entry.entityName}</span>
                                    </div>
                                    <span className="text-[10px] text-clay-text-muted font-mono">
                                      {entry.date} • {entry.id}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span
                                      className={`font-mono font-bold ${
                                        entry.inQty > 0 ? 'text-emerald-500' : 'text-amber-500'
                                      }`}
                                    >
                                      {entry.inQty > 0 ? `+${entry.inQty}` : `-${entry.outQty}`}
                                    </span>
                                    <div className="text-[10px] font-mono text-clay-text-muted font-bold">
                                      Bal: {entry.runningBalance}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </ClayCard>
    </div>
  );
};
