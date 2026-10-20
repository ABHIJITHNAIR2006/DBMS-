import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  LayoutGrid,
  Table as TableIcon,
  Trash2,
  Edit2,
  Info,
  Calendar,
  Sparkles,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClaySelect } from '../components/clay/ClaySelect';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { useDB } from '../db/store';
import { dbEngine } from '../db/engine';
import { queries } from '../db/queries';
import { Item, ItemType, DerivedStockInfo } from '../db/types';
import { geminiService } from '../services/gemini';

interface ItemsPageProps {
  initialOpenNewModal?: boolean;
  selectedItemId?: string | null;
  onClearSelectedItem?: () => void;
  onOpenPurchaseWithItem?: (itemId: string) => void;
}

export const ItemsPage: React.FC<ItemsPageProps> = ({
  initialOpenNewModal = false,
  selectedItemId,
  onClearSelectedItem,
  onOpenPurchaseWithItem
}) => {
  const { state, derivedStock, showToast } = useDB();

  // View state
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Modal & Drawer states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(initialOpenNewModal);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [inspectingItem, setInspectingItem] = useState<DerivedStockInfo | null>(() => {
    if (selectedItemId) {
      return derivedStock.find(s => s.item.ItemID === selectedItemId) || null;
    }
    return null;
  });

  // Delete confirmation modal state
  const [itemToDelete, setItemToDelete] = useState<Item | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    itemName: '',
    category: '',
    unitPrice: '',
    type: 'Consumable' as ItemType,
    reorderLevel: '25',
    warrantyPeriod: '12',
    batches: [] as { batchNo: string; expiryDate: string }[]
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);

  // Available unique categories
  const categories = Array.from(new Set(state.ITEM.map(i => i.Category))).sort();

  // Filtered items
  const filteredStock = derivedStock.filter(s => {
    const matchesSearch =
      s.item.ItemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.item.ItemID.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'ALL' || s.item.Category === selectedCategory;
    const matchesType = selectedType === 'ALL' || s.itemType === selectedType;
    return matchesSearch && matchesCat && matchesType;
  });

  // Handle open add modal
  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      itemName: '',
      category: categories[0] || 'Paper',
      unitPrice: '',
      type: 'Consumable',
      reorderLevel: '25',
      warrantyPeriod: '12',
      batches: []
    });
    setFormErrors({});
    setIsAddEditModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    const consumable = state.CONSUMABLE_ITEM.find(c => c.ItemID === item.ItemID);
    const durable = state.DURABLE_ITEM.find(d => d.ItemID === item.ItemID);
    const batches = state.STOCK_BATCH.filter(b => b.ItemID === item.ItemID);

    setFormData({
      itemName: item.ItemName,
      category: item.Category,
      unitPrice: String(item.UnitPrice),
      type: consumable ? 'Consumable' : 'Durable',
      reorderLevel: String(consumable?.ReorderLevel ?? 20),
      warrantyPeriod: String(durable?.WarrantyPeriod ?? 12),
      batches: batches.map(b => ({ batchNo: b.BatchNo, expiryDate: b.ExpiryDate }))
    });
    setFormErrors({});
    setIsAddEditModalOpen(true);
  };

  // Gemini Feature 3: Item Assistant ("Suggest with AI")
  const handleSuggestWithAi = async () => {
    if (!formData.itemName.trim()) {
      setFormErrors(prev => ({ ...prev, itemName: 'Type an item name first to get AI suggestions' }));
      return;
    }

    setIsAiSuggesting(true);
    try {
      const suggestion = await geminiService.suggestItemDetails(formData.itemName, categories);
      setFormData(prev => ({
        ...prev,
        category: suggestion.suggestedCategory || prev.category,
        type: suggestion.itemType,
        unitPrice: String(suggestion.unitPrice),
        reorderLevel: suggestion.reorderLevel ? String(suggestion.reorderLevel) : prev.reorderLevel,
        warrantyPeriod: suggestion.warrantyPeriod ? String(suggestion.warrantyPeriod) : prev.warrantyPeriod
      }));

      showToast({
        title: 'AI Item Suggestions Applied',
        description: `Suggested ${suggestion.suggestedCategory} (${suggestion.itemType}) at ₹${suggestion.unitPrice}. Rationale: ${suggestion.rationale}`,
        type: 'success'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI suggestion failed';
      showToast({
        title: 'AI Notice',
        description: msg,
        type: 'warning'
      });
    } finally {
      setIsAiSuggesting(false);
    }
  };

  // Form submit handler
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!formData.itemName.trim()) errors.itemName = 'Item name is required';
    if (!formData.category.trim()) errors.category = 'Category is required';
    if (!formData.unitPrice || isNaN(Number(formData.unitPrice)) || Number(formData.unitPrice) < 0) {
      errors.unitPrice = 'Valid unit price is required (>= 0)';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      if (editingItem) {
        dbEngine.updateItem({
          itemId: editingItem.ItemID,
          itemName: formData.itemName,
          category: formData.category,
          unitPrice: Number(formData.unitPrice),
          type: formData.type,
          reorderLevel: formData.type === 'Consumable' ? Number(formData.reorderLevel) : undefined,
          warrantyPeriod: formData.type === 'Durable' ? Number(formData.warrantyPeriod) : undefined,
          batches: formData.batches
        });

        showToast({
          title: 'Item Updated',
          description: `Item '${formData.itemName}' updated successfully in ITEM relation.`,
          type: 'success'
        });
      } else {
        const created = dbEngine.addItem({
          itemName: formData.itemName,
          category: formData.category,
          unitPrice: Number(formData.unitPrice),
          type: formData.type,
          reorderLevel: formData.type === 'Consumable' ? Number(formData.reorderLevel) : undefined,
          warrantyPeriod: formData.type === 'Durable' ? Number(formData.warrantyPeriod) : undefined,
          batches: formData.batches
        });

        showToast({
          title: 'Item Created',
          description: `Assigned ItemID '${created.ItemID}' with disjoint specialization in ${formData.type.toUpperCase()}_ITEM.`,
          type: 'success'
        });
      }

      setIsAddEditModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ title: 'Constraint Error', description: msg, type: 'error' });
    }
  };

  // Delete item handler
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    setDeleteError(null);

    try {
      dbEngine.deleteItem(itemToDelete.ItemID);
      showToast({
        title: 'Item Deleted',
        description: `Item '${itemToDelete.ItemName}' and its specialization rows were removed.`,
        type: 'info'
      });
      setItemToDelete(null);
      if (inspectingItem?.item.ItemID === itemToDelete.ItemID) {
        setInspectingItem(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Item Management Module
            </h1>
            <ClayChip label="Module 1" variant="periwinkle" />
            <ClayTooltip
              concept="Disjoint Specialization"
              explanation="Items are partitioned using disjoint EER specialization into CONSUMABLE_ITEM (with ReorderLevel) or DURABLE_ITEM (with WarrantyPeriod). An item cannot be both."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Maintain master stationery catalog records (ItemID, Name, Category, UnitPrice) and subclasses
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Grid / Table View Switcher */}
          <div className="clay-inset p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-clay-text-muted'
              }`}
              title="Card Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'table' ? 'bg-indigo-600 text-white shadow-xs' : 'text-clay-text-muted'
              }`}
              title="Table View"
            >
              <TableIcon size={16} />
            </button>
          </div>

          <ClayButton variant="primary" onClick={handleOpenAdd} icon={<Plus size={16} />}>
            New Item
          </ClayButton>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <ClayCard flat className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <ClayInput
            placeholder="Search by Item ID or Name..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <div className="w-40">
            <ClaySelect
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Categories' },
                ...categories.map(c => ({ value: c, label: c }))
              ]}
            />
          </div>

          {/* Type Filter */}
          <div className="w-40">
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
        </div>
      </ClayCard>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredStock.map(s => {
            const stockPercent = s.reorderLevel ? Math.min(100, (s.currentStock / (s.reorderLevel * 2)) * 100) : 100;

            return (
              <ClayCard
                key={s.item.ItemID}
                enableTilt
                onClick={() => setInspectingItem(s)}
                className="p-5 flex flex-col justify-between cursor-pointer group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                      {s.item.ItemID}
                    </span>
                    <ClayChip
                      label={s.itemType}
                      variant={s.itemType === 'Consumable' ? 'sunshine' : 'periwinkle'}
                    />
                  </div>

                  <h3 className="font-display font-bold text-base text-clay-text group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {s.item.ItemName}
                  </h3>
                  <p className="text-xs text-clay-text-muted mt-1">{s.item.Category}</p>

                  <div className="mt-3 py-2 px-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border flex items-center justify-between text-xs">
                    <span className="text-clay-text-muted">Unit Price</span>
                    <span className="font-extrabold text-clay-text font-mono">₹{s.item.UnitPrice}</span>
                  </div>

                  {/* Stock Level Progress */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-clay-text-muted">Current Stock:</span>
                      <span
                        className={`font-bold font-mono ${
                          s.status === 'Out of Stock'
                            ? 'text-rose-500'
                            : s.status === 'Low Stock'
                            ? 'text-amber-500'
                            : 'text-emerald-500'
                        }`}
                      >
                        {s.currentStock} units
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          s.status === 'Out of Stock'
                            ? 'bg-rose-500'
                            : s.status === 'Low Stock'
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                        }`}
                        style={{ width: `${s.currentStock <= 0 ? 0 : Math.max(5, stockPercent)}%` }}
                      />
                    </div>
                  </div>

                  {s.reorderLevel !== undefined && (
                    <p className="text-[11px] text-clay-text-muted mt-2">
                      Reorder threshold: <strong>{s.reorderLevel} units</strong>
                    </p>
                  )}
                  {s.warrantyPeriod !== undefined && (
                    <p className="text-[11px] text-clay-text-muted mt-2">
                      Warranty: <strong>{s.warrantyPeriod} months</strong>
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-clay-border flex items-center justify-between">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleOpenEdit(s.item);
                    }}
                    className="p-1.5 rounded-lg text-clay-text-muted hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Edit Item"
                  >
                    <Edit2 size={15} />
                  </button>

                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setItemToDelete(s.item);
                      setDeleteError(null);
                    }}
                    className="p-1.5 rounded-lg text-clay-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Delete Item (FK Check)"
                  >
                    <Trash2 size={15} />
                  </button>

                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                    View Ledger →
                  </span>
                </div>
              </ClayCard>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <ClayCard className="p-4 overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-clay-border text-clay-text-muted font-display uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3">Item ID</th>
                <th className="py-3 px-3">Name</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Unit Price</th>
                <th className="py-3 px-3">Current Stock</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clay-border">
              {filteredStock.map(s => (
                <tr
                  key={s.item.ItemID}
                  onClick={() => setInspectingItem(s)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {s.item.ItemID}
                  </td>
                  <td className="py-3 px-3 font-bold text-clay-text">{s.item.ItemName}</td>
                  <td className="py-3 px-3 text-clay-text-muted">{s.item.Category}</td>
                  <td className="py-3 px-3">
                    <ClayChip
                      label={s.itemType}
                      variant={s.itemType === 'Consumable' ? 'sunshine' : 'periwinkle'}
                    />
                  </td>
                  <td className="py-3 px-3 font-mono font-bold text-clay-text">₹{s.item.UnitPrice}</td>
                  <td className="py-3 px-3 font-mono font-extrabold text-clay-text">{s.currentStock}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        s.status === 'In Stock'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          : s.status === 'Low Stock'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenEdit(s.item)}
                        className="p-1 text-clay-text-muted hover:text-indigo-600 cursor-pointer"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setItemToDelete(s.item);
                          setDeleteError(null);
                        }}
                        className="p-1 text-clay-text-muted hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}

      {/* =========================================================================
          ADD / EDIT ITEM MODAL WITH GEMINI "SUGGEST WITH AI"
         ========================================================================= */}
      <ClayModal
        isOpen={isAddEditModalOpen}
        onClose={() => setIsAddEditModalOpen(false)}
        title={editingItem ? `Edit Item (${editingItem.ItemID})` : 'Catalog New Stationery Item'}
        subtitle="Enforces 3NF Item relation schema and disjoint EER specialization"
      >
        <form onSubmit={handleSaveItem} className="space-y-4">
          {/* Item Name with AI Suggest button */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <ClayInput
                label="Item Name *"
                placeholder="e.g., A4 Copier Paper Ream or Heavy Duty Stapler"
                value={formData.itemName}
                onChange={e => setFormData({ ...formData, itemName: e.target.value })}
                error={formErrors.itemName}
              />
            </div>
            <ClayButton
              type="button"
              variant="peach"
              size="sm"
              onClick={handleSuggestWithAi}
              disabled={isAiSuggesting}
              icon={<Sparkles size={14} />}
              className="shrink-0 mb-0.5"
              title="Use Gemini AI to infer category, type, price, and thresholds"
            >
              {isAiSuggesting ? 'Thinking...' : 'Suggest with AI'}
            </ClayButton>
          </div>

          {/* Category & Unit Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <ClayInput
                label="Category *"
                placeholder="Paper, Writing, Electronics..."
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                error={formErrors.category}
              />
              <div className="flex flex-wrap gap-1 mt-1.5">
                {categories.slice(0, 4).map(cat => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setFormData({ ...formData, category: cat })}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-clay-text hover:bg-indigo-100 cursor-pointer"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <ClayInput
                label="Unit Price (₹ INR) *"
                type="number"
                step="0.01"
                placeholder="e.g., 280.00"
                value={formData.unitPrice}
                onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                error={formErrors.unitPrice}
              />
            </div>
          </div>

          {/* Disjoint Specialization Switch */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                EER Disjoint Specialization Type *
              </span>
              <ClayTooltip
                concept="Disjoint Specialization Rule"
                explanation="Specialization is disjoint: An item must be either Consumable or Durable, never both. Switching will drop the record in one subclass and insert into the other."
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-clay-text">
                <input
                  type="radio"
                  name="itemType"
                  value="Consumable"
                  checked={formData.type === 'Consumable'}
                  onChange={() => setFormData({ ...formData, type: 'Consumable' })}
                  className="accent-indigo-600"
                />
                <span>Consumable (Reorder Level)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-clay-text">
                <input
                  type="radio"
                  name="itemType"
                  value="Durable"
                  checked={formData.type === 'Durable'}
                  onChange={() => setFormData({ ...formData, type: 'Durable' })}
                  className="accent-indigo-600"
                />
                <span>Durable (Warranty Period)</span>
              </label>
            </div>

            {formData.type === 'Consumable' ? (
              <ClayInput
                label="Reorder Level (Units) *"
                type="number"
                placeholder="e.g. 25"
                value={formData.reorderLevel}
                onChange={e => setFormData({ ...formData, reorderLevel: e.target.value })}
                helper="Alert will trigger when derived stock falls at or below this value."
              />
            ) : (
              <ClayInput
                label="Warranty Period (Months) *"
                type="number"
                placeholder="e.g. 12"
                value={formData.warrantyPeriod}
                onChange={e => setFormData({ ...formData, warrantyPeriod: e.target.value })}
                helper="Manufacturer guarantee duration in months."
              />
            )}
          </div>

          {/* Batches Sub-form for Consumables */}
          {formData.type === 'Consumable' && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-clay-text uppercase">
                    Stock Batches (Weak Entity)
                  </span>
                  <p className="text-[11px] text-clay-text-muted">
                    Identifying relationship HAS_BATCH to ITEM for expiration tracking
                  </p>
                </div>
                <ClayButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    const nextBatchNum = `B0${formData.batches.length + 1}`;
                    setFormData({
                      ...formData,
                      batches: [...formData.batches, { batchNo: nextBatchNum, expiryDate: '' }]
                    });
                  }}
                >
                  + Add Batch
                </ClayButton>
              </div>

              {formData.batches.map((b, idx) => (
                <div key={idx} className="flex items-center gap-2 mt-2">
                  <div className="w-28">
                    <ClayInput
                      placeholder="BatchNo"
                      value={b.batchNo}
                      onChange={e => {
                        const updated = [...formData.batches];
                        updated[idx].batchNo = e.target.value;
                        setFormData({ ...formData, batches: updated });
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <ClayInput
                      type="date"
                      value={b.expiryDate}
                      onChange={e => {
                        const updated = [...formData.batches];
                        updated[idx].expiryDate = e.target.value;
                        setFormData({ ...formData, batches: updated });
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = formData.batches.filter((_, i) => i !== idx);
                      setFormData({ ...formData, batches: updated });
                    }}
                    className="p-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="pt-4 border-t border-clay-border flex justify-end gap-3">
            <ClayButton type="button" variant="secondary" onClick={() => setIsAddEditModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              {editingItem ? 'Save Changes' : 'Insert into Database'}
            </ClayButton>
          </div>
        </form>
      </ClayModal>

      {/* =========================================================================
          DELETE CONFIRMATION WITH FOREIGN KEY RESTRICT MESSAGING
         ========================================================================= */}
      <ClayModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Confirm Item Deletion"
        subtitle="Referential Integrity Check: ON DELETE RESTRICT"
      >
        {itemToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-clay-text">
              Are you sure you want to delete item{' '}
              <strong className="text-rose-600">{itemToDelete.ItemName}</strong> (ID: {itemToDelete.ItemID})?
            </p>

            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs leading-relaxed flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-1">Referential Integrity Violation (ON DELETE RESTRICT):</strong>
                  {deleteError}
                </div>
              </div>
            )}

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs text-clay-text-muted space-y-1">
              <p>• If referenced in SUPPLIES or ISSUED_TO, DBMS rejects deletion to prevent orphaned ledger records.</p>
              <p>• If unreferenced, cascades will safely remove CONSUMABLE_ITEM / DURABLE_ITEM / STOCK_BATCH.</p>
            </div>

            <div className="pt-3 border-t border-clay-border flex justify-end gap-3">
              <ClayButton variant="secondary" onClick={() => setItemToDelete(null)}>
                Cancel
              </ClayButton>
              <ClayButton variant="danger" onClick={handleConfirmDelete}>
                Delete Item
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>

      {/* =========================================================================
          ITEM DETAIL & LEDGER DRAWER
         ========================================================================= */}
      <AnimatePresence>
        {inspectingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInspectingItem(null)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="relative z-10 w-full max-w-xl h-full sm:h-[95vh] clay-card p-6 sm:p-8 bg-white dark:bg-slate-900 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between pb-4 border-b border-clay-border">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                        {inspectingItem.item.ItemID}
                      </span>
                      <ClayChip
                        label={inspectingItem.itemType}
                        variant={inspectingItem.itemType === 'Consumable' ? 'sunshine' : 'periwinkle'}
                      />
                    </div>
                    <h2 className="text-xl font-bold font-display text-clay-text">
                      {inspectingItem.item.ItemName}
                    </h2>
                    <p className="text-xs text-clay-text-muted mt-0.5">{inspectingItem.item.Category}</p>
                  </div>

                  <button
                    onClick={() => setInspectingItem(null)}
                    className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-clay-text cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Stock Stats Row */}
                <div className="grid grid-cols-3 gap-2 my-4">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300">
                      Total In
                    </span>
                    <p className="font-mono font-bold text-base text-clay-text">
                      +{inspectingItem.totalPurchased}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-300">
                      Total Out
                    </span>
                    <p className="font-mono font-bold text-base text-clay-text">
                      -{inspectingItem.totalIssued}
                    </p>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-center">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300">
                      Derived Stock
                    </span>
                    <p className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                      {inspectingItem.currentStock}
                    </p>
                  </div>
                </div>

                {/* Chronological Stock Ledger */}
                <div className="mt-6">
                  <h4 className="font-display font-bold text-sm text-clay-text mb-2">
                    Chronological Stock Audit Ledger
                  </h4>
                  <p className="text-[11px] text-clay-text-muted mb-3">
                    Every incoming purchase order (+) and outgoing department issue (-)
                  </p>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {queries.getStockLedger(inspectingItem.item.ItemID).length === 0 ? (
                      <p className="text-xs text-clay-text-muted py-4 text-center">No transaction history yet.</p>
                    ) : (
                      queries.getStockLedger(inspectingItem.item.ItemID).map(entry => (
                        <div
                          key={entry.id}
                          className="clay-card-flat p-2.5 flex items-center justify-between text-xs bg-white/70 dark:bg-slate-900/70"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 font-bold text-clay-text">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] ${
                                  entry.type === 'PURCHASE'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {entry.type}
                              </span>
                              <span>{entry.entityName}</span>
                            </div>
                            <span className="text-[10px] text-clay-text-muted font-mono">{entry.date} • {entry.id}</span>
                          </div>
                          <div className="text-right">
                            <span
                              className={`font-mono font-bold ${
                                entry.inQty > 0 ? 'text-emerald-500' : 'text-amber-500'
                              }`}
                            >
                              {entry.inQty > 0 ? `+${entry.inQty}` : `-${entry.outQty}`}
                            </span>
                            <div className="text-[10px] font-mono text-clay-text-muted">
                              Bal: {entry.runningBalance}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* SQL Query Representation */}
                <div className="mt-6 p-3 rounded-2xl bg-slate-900 text-slate-100 text-[11px] font-mono overflow-x-auto">
                  <div className="text-indigo-400 font-bold mb-1">-- Relational Query for Item Ledger:</div>
                  <code>{`SELECT p.PurchaseID, p.PurchaseDate, p.Quantity, NULL as IssueID
FROM SUPPLIES p WHERE p.ItemID = '${inspectingItem.item.ItemID}'
UNION ALL
SELECT NULL, i.IssueDate, NULL, i.Quantity 
FROM ISSUED_TO i WHERE i.ItemID = '${inspectingItem.item.ItemID}'
ORDER BY 2 ASC;`}</code>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 border-t border-clay-border flex justify-between items-center mt-4">
                <ClayButton
                  variant="mint"
                  size="sm"
                  onClick={() => {
                    setInspectingItem(null);
                    if (onOpenPurchaseWithItem) onOpenPurchaseWithItem(inspectingItem.item.ItemID);
                  }}
                >
                  Record Purchase for this Item
                </ClayButton>
                <ClayButton variant="secondary" size="sm" onClick={() => setInspectingItem(null)}>
                  Close
                </ClayButton>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
