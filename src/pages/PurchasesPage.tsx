import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  AlertTriangle,
  Calendar,
  IndianRupee,
  CheckCircle2,
  Filter,
  Search,
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

interface PurchasesPageProps {
  initialItemId?: string;
  initialQuantity?: number;
  initialSupplierId?: string;
  onClearInitial?: () => void;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({
  initialItemId = '',
  initialQuantity,
  initialSupplierId = '',
  onClearInitial
}) => {
  const { state, showToast, fireConfetti } = useDB();

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(!!initialItemId);
  const [selectedItemId, setSelectedItemId] = useState(initialItemId);
  const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId || (state.SUPPLIER[0]?.SupplierID ?? ''));
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState(initialQuantity ? String(initialQuantity) : '50');
  const [cost, setCost] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter States
  const [filterSupplier, setFilterSupplier] = useState('ALL');
  const [filterItem, setFilterItem] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Auto-calculate suggested cost when item and quantity change
  const currentItem = state.ITEM.find(i => i.ItemID === selectedItemId);
  useEffect(() => {
    if (currentItem && quantity && !isNaN(Number(quantity))) {
      const calculated = Number(quantity) * currentItem.UnitPrice;
      setCost(String(calculated));
    }
  }, [selectedItemId, quantity]);

  // Live deviation calculation
  const impliedUnitCost =
    quantity && cost && Number(quantity) > 0 ? Number(cost) / Number(quantity) : null;
  const listPrice = currentItem?.UnitPrice ?? 0;
  const deviationPercent =
    impliedUnitCost && listPrice > 0 ? ((impliedUnitCost - listPrice) / listPrice) * 100 : 0;

  // Filtered Purchases
  const filteredPurchases = state.SUPPLIES.filter(p => {
    const item = state.ITEM.find(i => i.ItemID === p.ItemID);
    const supplier = state.SUPPLIER.find(s => s.SupplierID === p.SupplierID);

    const matchesSup = filterSupplier === 'ALL' || p.SupplierID === filterSupplier;
    const matchesItm = filterItem === 'ALL' || p.ItemID === filterItem;
    const matchesSearch =
      (item?.ItemName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (supplier?.SupplierName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      p.PurchaseID.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSup && matchesItm && matchesSearch;
  }).sort((a, b) => b.PurchaseDate.localeCompare(a.PurchaseDate));

  const filteredSpend = filteredPurchases.reduce((sum, p) => sum + p.Cost, 0);

  // Handle Record Purchase
  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedItemId) errors.itemId = 'Please select a stationery item';
    if (!selectedSupplierId) errors.supplierId = 'Please select a registered supplier';
    if (!purchaseDate) errors.purchaseDate = 'Purchase date is required';
    if (!quantity || Number(quantity) <= 0) errors.quantity = 'Quantity must be greater than zero';
    if (!cost || Number(cost) < 0) errors.cost = 'Total cost cannot be negative';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const prevStock = dbEngine.getDerivedStock(selectedItemId);
      const newPurchase = dbEngine.addPurchase({
        itemId: selectedItemId,
        supplierId: selectedSupplierId,
        purchaseDate,
        quantity: Number(quantity),
        cost: Number(cost)
      });

      const updatedStock = dbEngine.getDerivedStock(selectedItemId);
      fireConfetti();

      showToast({
        title: 'Purchase Recorded & Stock Updated',
        description: `Order ${newPurchase.PurchaseID}: ${currentItem?.ItemName} stock increased from ${prevStock} -> ${updatedStock} units.`,
        type: 'success'
      });

      setIsFormOpen(false);
      if (onClearInitial) onClearInitial();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ title: 'Transaction Error', description: msg, type: 'error' });
    }
  };

  // Handle Delete Purchase
  const handleConfirmDelete = () => {
    if (!purchaseToDelete) return;
    setDeleteError(null);

    try {
      dbEngine.deletePurchase(purchaseToDelete);
      showToast({
        title: 'Purchase Deleted',
        description: `Purchase order ${purchaseToDelete} removed. Stock decremented.`,
        type: 'info'
      });
      setPurchaseToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Purchase Management Module
            </h1>
            <ClayChip label="Module 3" variant="periwinkle" />
            <ClayTooltip
              concept="Surrogate Key (PurchaseID)"
              explanation="SUPPLIES uses the surrogate key PurchaseID rather than composite (ItemID, SupplierID, PurchaseDate) so that the same supplier can supply the same item multiple times on the same date without primary key collision."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Record stationery replenishment from suppliers into the SUPPLIES relation
          </p>
        </div>

        <ClayButton
          variant="mint"
          onClick={() => {
            setSelectedItemId(state.ITEM[0]?.ItemID ?? '');
            setIsFormOpen(true);
          }}
          icon={<Plus size={16} />}
        >
          Record Purchase
        </ClayButton>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ClayCard flat className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-clay-text-muted uppercase">Filtered Spend</span>
            <p className="text-2xl font-extrabold font-display text-clay-text mt-1">
              ₹{filteredSpend.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
            <IndianRupee size={20} />
          </div>
        </ClayCard>

        <ClayCard flat className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-clay-text-muted uppercase">Purchase Orders</span>
            <p className="text-2xl font-extrabold font-display text-clay-text mt-1">
              {filteredPurchases.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center">
            <ShoppingCart size={20} />
          </div>
        </ClayCard>

        <ClayCard flat className="p-4 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-clay-text-muted uppercase">Total Units Supplied</span>
            <p className="text-2xl font-extrabold font-display text-clay-text mt-1">
              {filteredPurchases.reduce((sum, p) => sum + p.Quantity, 0).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center">
            <CheckCircle2 size={20} />
          </div>
        </ClayCard>
      </div>

      {/* Filter Bar */}
      <ClayCard flat className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <ClayInput
            placeholder="Search by order ID, item, or supplier..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="w-44">
            <ClaySelect
              value={filterSupplier}
              onChange={e => setFilterSupplier(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Suppliers' },
                ...state.SUPPLIER.map(s => ({ value: s.SupplierID, label: s.SupplierName }))
              ]}
            />
          </div>

          <div className="w-44">
            <ClaySelect
              value={filterItem}
              onChange={e => setFilterItem(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Items' },
                ...state.ITEM.map(i => ({ value: i.ItemID, label: i.ItemName }))
              ]}
            />
          </div>
        </div>
      </ClayCard>

      {/* Purchases History Table */}
      <ClayCard className="p-4 sm:p-6 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-clay-border text-clay-text-muted font-display uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3">Order ID</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Item Name</th>
              <th className="py-3 px-3">Supplier & City</th>
              <th className="py-3 px-3 text-right">Quantity</th>
              <th className="py-3 px-3 text-right">Implied Unit Cost</th>
              <th className="py-3 px-3 text-right">Total Cost</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-border">
            {filteredPurchases.map(p => {
              const item = state.ITEM.find(i => i.ItemID === p.ItemID);
              const supplier = state.SUPPLIER.find(s => s.SupplierID === p.SupplierID);
              const city = state.PINCODE_CITY.find(pc => pc.Pincode === supplier?.Pincode)?.City;
              const unitCost = (p.Cost / p.Quantity).toFixed(2);

              return (
                <tr key={p.PurchaseID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {p.PurchaseID}
                  </td>
                  <td className="py-3.5 px-3 text-clay-text-muted font-mono">{p.PurchaseDate}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-clay-text">{item?.ItemName ?? p.ItemID}</div>
                    <div className="text-[10px] text-clay-text-muted font-mono">Catalog Price: ₹{item?.UnitPrice}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-clay-text">{supplier?.SupplierName ?? p.SupplierID}</div>
                    <div className="text-[10px] text-clay-text-muted">{city} • {supplier?.Pincode}</div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    +{p.Quantity}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono text-clay-text">
                    ₹{unitCost}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-extrabold text-clay-text">
                    ₹{p.Cost.toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => {
                        setPurchaseToDelete(p.PurchaseID);
                        setDeleteError(null);
                      }}
                      className="p-1.5 text-clay-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                      title="Delete purchase order (stock-never-negative check)"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ClayCard>

      {/* =========================================================================
          RECORD PURCHASE MODAL
         ========================================================================= */}
      <ClayModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          if (onClearInitial) onClearInitial();
        }}
        title="Record Stationery Purchase (SUPPLIES)"
        subtitle="Automatic stock update upon transaction commit"
      >
        <form onSubmit={handleSubmitPurchase} className="space-y-4">
          {/* Item Selector */}
          <div>
            <ClaySelect
              label="Stationery Item *"
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
              options={state.ITEM.map(i => ({
                value: i.ItemID,
                label: i.ItemName,
                sublabel: `${i.Category} • List: ₹${i.UnitPrice}`
              }))}
              error={formErrors.itemId}
            />
          </div>

          {/* Supplier Selector */}
          <div>
            <ClaySelect
              label="Supplier (with 3NF Decomposed City) *"
              value={selectedSupplierId}
              onChange={e => setSelectedSupplierId(e.target.value)}
              options={state.SUPPLIER.map(s => {
                const city = state.PINCODE_CITY.find(p => p.Pincode === s.Pincode)?.City;
                return {
                  value: s.SupplierID,
                  label: s.SupplierName,
                  sublabel: `${city} (${s.Pincode})`
                };
              })}
              error={formErrors.supplierId}
            />
          </div>

          {/* Date & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ClayInput
              label="Purchase Date *"
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              error={formErrors.purchaseDate}
            />

            <ClayInput
              label="Quantity Purchased *"
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              error={formErrors.quantity}
            />
          </div>

          {/* Cost & Live Helper */}
          <div>
            <ClayInput
              label="Total Cost (₹ INR) *"
              type="number"
              step="0.01"
              min="0"
              value={cost}
              onChange={e => setCost(e.target.value)}
              error={formErrors.cost}
            />

            {/* Implied unit cost vs list price comparison */}
            {impliedUnitCost !== null && currentItem && (
              <div
                className={`mt-2 p-3 rounded-2xl text-xs flex items-center justify-between border ${
                  Math.abs(deviationPercent) > 20
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                }`}
              >
                <div>
                  <span>Implied Unit Cost: <strong>₹{impliedUnitCost.toFixed(2)}</strong></span>
                  <span className="mx-2">•</span>
                  <span>Catalog List Price: <strong>₹{currentItem.UnitPrice.toFixed(2)}</strong></span>
                </div>
                {Math.abs(deviationPercent) > 20 && (
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle size={13} /> {deviationPercent > 0 ? `+${deviationPercent.toFixed(1)}% higher` : `${deviationPercent.toFixed(1)}% discount`}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-clay-border flex justify-end gap-3">
            <ClayButton
              type="button"
              variant="secondary"
              onClick={() => {
                setIsFormOpen(false);
                if (onClearInitial) onClearInitial();
              }}
            >
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="mint">
              Commit Purchase & Update Stock
            </ClayButton>
          </div>
        </form>
      </ClayModal>

      {/* =========================================================================
          DELETE PURCHASE CONFIRMATION MODAL (STOCK NEVER NEGATIVE CHECK)
         ========================================================================= */}
      <ClayModal
        isOpen={!!purchaseToDelete}
        onClose={() => setPurchaseToDelete(null)}
        title="Delete Purchase Order"
        subtitle="Integrity Constraint Check: Stock Cannot Become Negative"
      >
        {purchaseToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-clay-text">
              Are you sure you want to delete purchase order{' '}
              <strong className="text-rose-600">{purchaseToDelete}</strong>?
            </p>

            {deleteError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs leading-relaxed flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block mb-1">Transaction Rejected:</strong>
                  {deleteError}
                </div>
              </div>
            )}

            <p className="text-xs text-clay-text-muted bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl">
              Deleting a purchase decrements the derived stock for that item. If the item has already been issued to departments such that remaining stock would be negative, deletion is rejected.
            </p>

            <div className="pt-3 border-t border-clay-border flex justify-end gap-3">
              <ClayButton variant="secondary" onClick={() => setPurchaseToDelete(null)}>
                Cancel
              </ClayButton>
              <ClayButton variant="danger" onClick={handleConfirmDelete}>
                Delete Purchase
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>
    </div>
  );
};
