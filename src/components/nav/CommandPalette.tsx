import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Package, ShoppingCart, Send, Database, Layers, ArrowRight, X } from 'lucide-react';
import { useDB } from '../../db/store';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  onTriggerAction: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  onTriggerAction
}) => {
  const { state, derivedStock } = useDB();
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setSearch('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredItems = derivedStock.filter(
    s =>
      s.item.ItemName.toLowerCase().includes(search.toLowerCase()) ||
      s.item.ItemID.toLowerCase().includes(search.toLowerCase()) ||
      s.item.Category.toLowerCase().includes(search.toLowerCase())
  );

  const pages = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: Layers, group: 'Pages' },
    { id: 'items', label: 'Item Management (Module 1)', icon: Package, group: 'Pages' },
    { id: 'stock', label: 'Stock Management & Ledger (Module 2)', icon: Layers, group: 'Pages' },
    { id: 'purchases', label: 'Purchase Recording (Module 3)', icon: ShoppingCart, group: 'Pages' },
    { id: 'issues', label: 'Issue & Distribution (Module 4)', icon: Send, group: 'Pages' },
    { id: 'search', label: 'Stationery Search (Module 5)', icon: Search, group: 'Pages' },
    { id: 'database-lab', label: 'Database Lab (Schema, ER, 3NF, SQL)', icon: Database, group: 'Pages' }
  ].filter(p => p.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
        />

        {/* Palette Panel */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="relative z-10 w-full max-w-2xl clay-card p-4 bg-white/95 dark:bg-slate-900/95 shadow-2xl rounded-3xl overflow-hidden border border-clay-border"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-3 py-2 border-b border-clay-border">
            <Search size={18} className="text-indigo-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search anything: items, pages, quick actions..."
              autoFocus
              className="w-full bg-transparent text-sm font-medium outline-none text-clay-text placeholder-clay-text-faint"
            />
            <button
              onClick={onClose}
              className="text-clay-text-muted hover:text-clay-text p-1 rounded-full cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto mt-3 space-y-4 pr-1">
            {/* Quick Actions */}
            <div>
              <div className="text-[11px] font-bold text-clay-text-muted px-3 py-1 uppercase tracking-wider">
                Quick Actions
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 px-2 mt-1">
                <button
                  onClick={() => {
                    setActiveTab('items');
                    onTriggerAction('NEW_ITEM');
                    onClose();
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-2xl clay-card-flat hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold text-clay-text cursor-pointer text-left"
                >
                  <Package size={14} className="text-indigo-500" />
                  <span>+ New Item</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('purchases');
                    onTriggerAction('NEW_PURCHASE');
                    onClose();
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-2xl clay-card-flat hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-xs font-bold text-clay-text cursor-pointer text-left"
                >
                  <ShoppingCart size={14} className="text-emerald-500" />
                  <span>+ Record Purchase</span>
                </button>
                <button
                  onClick={() => {
                    setActiveTab('issues');
                    onTriggerAction('NEW_ISSUE');
                    onClose();
                  }}
                  className="flex items-center gap-2 p-2.5 rounded-2xl clay-card-flat hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold text-clay-text cursor-pointer text-left"
                >
                  <Send size={14} className="text-amber-500" />
                  <span>+ Issue Stationery</span>
                </button>
              </div>
            </div>

            {/* Navigation Pages */}
            {pages.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-clay-text-muted px-3 py-1 uppercase tracking-wider">
                  Modules & Pages
                </div>
                <div className="space-y-1 px-1">
                  {pages.map(page => {
                    const Icon = page.icon;
                    return (
                      <button
                        key={page.id}
                        onClick={() => {
                          setActiveTab(page.id);
                          onClose();
                        }}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-clay-text cursor-pointer text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon size={16} className="text-indigo-500" />
                          <span>{page.label}</span>
                        </div>
                        <ArrowRight size={14} className="text-clay-text-muted" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stationery Items */}
            {filteredItems.length > 0 && (
              <div>
                <div className="text-[11px] font-bold text-clay-text-muted px-3 py-1 uppercase tracking-wider">
                  Stationery Items ({filteredItems.length})
                </div>
                <div className="space-y-1 px-1">
                  {filteredItems.slice(0, 6).map(s => (
                    <button
                      key={s.item.ItemID}
                      onClick={() => {
                        setActiveTab('items');
                        onTriggerAction(`VIEW_ITEM_${s.item.ItemID}`);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs cursor-pointer text-left transition-colors"
                    >
                      <div>
                        <div className="font-bold text-clay-text flex items-center gap-2">
                          <span>{s.item.ItemName}</span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 rounded-md font-mono">
                            {s.item.ItemID}
                          </span>
                        </div>
                        <div className="text-[11px] text-clay-text-muted flex items-center gap-2 mt-0.5">
                          <span>{s.item.Category}</span>
                          <span>•</span>
                          <span>₹{s.item.UnitPrice}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            s.status === 'In Stock'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                              : s.status === 'Low Stock'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                          }`}
                        >
                          {s.currentStock} in stock
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
