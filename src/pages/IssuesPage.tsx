import React, { useState } from 'react';
import {
  Send,
  Plus,
  Trash2,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Search,
  AlertCircle,
  ArrowRight
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
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface IssuesPageProps {
  initialItemId?: string;
  onOpenPurchaseWithItem?: (itemId: string) => void;
  onClearInitial?: () => void;
}

export const IssuesPage: React.FC<IssuesPageProps> = ({
  initialItemId = '',
  onOpenPurchaseWithItem,
  onClearInitial
}) => {
  const { state, derivedStock, showToast } = useDB();

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(!!initialItemId);
  const [selectedItemId, setSelectedItemId] = useState(initialItemId || (state.ITEM[0]?.ItemID ?? ''));
  const [selectedDeptId, setSelectedDeptId] = useState(state.DEPARTMENT[0]?.DeptID ?? '');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [quantity, setQuantity] = useState('10');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Filter States
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterItem, setFilterItem] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Delete modal state
  const [issueToDelete, setIssueToDelete] = useState<string | null>(null);

  // Available stock for selected item
  const currentItemInfo = derivedStock.find(s => s.item.ItemID === selectedItemId);
  const availableStock = currentItemInfo?.currentStock ?? 0;

  // Filtered Issues list
  const filteredIssues = state.ISSUED_TO.filter(i => {
    const item = state.ITEM.find(it => it.ItemID === i.ItemID);
    const dept = state.DEPARTMENT.find(d => d.DeptID === i.DeptID);

    const matchDept = filterDept === 'ALL' || i.DeptID === filterDept;
    const matchItm = filterItem === 'ALL' || i.ItemID === filterItem;
    const matchSearch =
      (item?.ItemName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (dept?.DeptName.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      i.IssueID.toLowerCase().includes(searchQuery.toLowerCase());

    return matchDept && matchItm && matchSearch;
  }).sort((a, b) => b.IssueDate.localeCompare(a.IssueDate));

  // Department Consumption stats for chart
  const deptStats = queries.getDepartmentStats();

  // Handle Record Issue
  const handleSubmitIssue = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedItemId) errors.itemId = 'Please select a stationery item';
    if (!selectedDeptId) errors.deptId = 'Please select a requesting department';
    if (!issueDate) errors.issueDate = 'Issue date is required';
    if (!quantity || Number(quantity) <= 0) errors.quantity = 'Quantity must be greater than zero';

    // Future date check
    const todayStr = new Date().toISOString().split('T')[0];
    if (issueDate > todayStr) {
      errors.issueDate = 'Issue date cannot be in the future';
    }

    // Stock-Out Prevention Rule
    if (Number(quantity) > availableStock) {
      errors.quantity = `Only ${availableStock} units available in stock. Cannot issue requested ${quantity} units.`;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const prevStock = availableStock;
      const newIssue = dbEngine.addIssue({
        itemId: selectedItemId,
        deptId: selectedDeptId,
        issueDate,
        quantity: Number(quantity)
      });

      const updatedStock = prevStock - Number(quantity);
      const consumable = state.CONSUMABLE_ITEM.find(c => c.ItemID === selectedItemId);
      const isNowLow = consumable && updatedStock <= consumable.ReorderLevel;

      showToast({
        title: 'Stationery Issued Successfully',
        description: `Issue ${newIssue.IssueID}: ${currentItemInfo?.item.ItemName} stock updated ${prevStock} -> ${updatedStock} units.`,
        type: 'success',
        ...(isNowLow
          ? {
              action: {
                label: 'Restock Consumable',
                onClick: () => {
                  if (onOpenPurchaseWithItem) onOpenPurchaseWithItem(selectedItemId);
                }
              }
            }
          : {})
      });

      setIsFormOpen(false);
      if (onClearInitial) onClearInitial();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ title: 'Transaction Error', description: msg, type: 'error' });
    }
  };

  // Handle Delete Issue
  const handleConfirmDelete = () => {
    if (!issueToDelete) return;
    try {
      dbEngine.deleteIssue(issueToDelete);
      showToast({
        title: 'Issue Record Removed',
        description: `Issue record ${issueToDelete} deleted. Stock restored.`,
        type: 'info'
      });
      setIssueToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ title: 'Delete Error', description: msg, type: 'error' });
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display text-clay-text">
              Issue & Distribution Module
            </h1>
            <ClayChip label="Module 4" variant="peach" />
            <ClayTooltip
              concept="Stock-Out Prevention Rule"
              explanation="Before committing an issue to ISSUED_TO, the engine asserts: requested quantity <= derived stock. If insufficient stock exists, the transaction rolls back with an advisory error."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Track distribution of stationery to academic departments with strict stock integrity
          </p>
        </div>

        <ClayButton
          variant="peach"
          onClick={() => {
            setSelectedItemId(state.ITEM[0]?.ItemID ?? '');
            setIsFormOpen(true);
          }}
          icon={<Plus size={16} />}
        >
          Issue Stationery
        </ClayButton>
      </div>

      {/* Department Consumption Overview Chart */}
      <ClayCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-clay-text">
              Department-Wise Stationery Consumption
            </h3>
            <p className="text-xs text-clay-text-muted">Total units distributed per university department</p>
          </div>
          <ClayChip label="ISSUED_TO Aggregation" variant="periwinkle" />
        </div>

        <div className="w-full h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="deptName" stroke="#8888AA" fontSize={11} tickLine={false} />
              <YAxis stroke="#8888AA" fontSize={11} tickLine={false} />
              <Tooltip />
              <Bar dataKey="totalUnitsIssued" name="Units Consumed" fill="#FFA987" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ClayCard>

      {/* Filter Bar */}
      <ClayCard flat className="p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <ClayInput
            placeholder="Search by issue ID, item, or department..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="w-48">
            <ClaySelect
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              options={[
                { value: 'ALL', label: 'All Departments' },
                ...state.DEPARTMENT.map(d => ({ value: d.DeptID, label: d.DeptName }))
              ]}
            />
          </div>

          <div className="w-48">
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

      {/* Issues History Table */}
      <ClayCard className="p-4 sm:p-6 overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-clay-border text-clay-text-muted font-display uppercase tracking-wider text-[11px]">
              <th className="py-3 px-3">Issue ID</th>
              <th className="py-3 px-3">Date</th>
              <th className="py-3 px-3">Stationery Item</th>
              <th className="py-3 px-3">Department (ISSUED_TO)</th>
              <th className="py-3 px-3 text-right">Quantity Distributed</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-clay-border">
            {filteredIssues.map(i => {
              const item = state.ITEM.find(it => it.ItemID === i.ItemID);
              const dept = state.DEPARTMENT.find(d => d.DeptID === i.DeptID);

              return (
                <tr key={i.IssueID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {i.IssueID}
                  </td>
                  <td className="py-3.5 px-3 text-clay-text-muted font-mono">{i.IssueDate}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-clay-text">{item?.ItemName ?? i.ItemID}</div>
                    <div className="text-[10px] text-clay-text-muted">{item?.Category}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-clay-text">{dept?.DeptName ?? i.DeptID}</div>
                    <div className="text-[10px] text-clay-text-muted font-mono">{dept?.DeptID}</div>
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-amber-600 dark:text-amber-400">
                    -{i.Quantity} units
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => setIssueToDelete(i.IssueID)}
                      className="p-1.5 text-clay-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                      title="Delete issue transaction"
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
          RECORD ISSUE MODAL WITH STOCK-OUT PREVENTION
         ========================================================================= */}
      <ClayModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          if (onClearInitial) onClearInitial();
        }}
        title="Distribute Stationery to Department (ISSUED_TO)"
        subtitle="Enforces Stock-Out Prevention Rule and automatic inventory decrement"
      >
        <form onSubmit={handleSubmitIssue} className="space-y-4">
          {/* Item Selector */}
          <div>
            <ClaySelect
              label="Stationery Item *"
              value={selectedItemId}
              onChange={e => setSelectedItemId(e.target.value)}
              options={derivedStock.map(s => ({
                value: s.item.ItemID,
                label: s.item.ItemName,
                sublabel: `Stock: ${s.currentStock} units • ${s.item.Category}`
              }))}
              error={formErrors.itemId}
            />
          </div>

          {/* Department Selector */}
          <div>
            <ClaySelect
              label="Department (FK -> DEPARTMENT.DeptID) *"
              value={selectedDeptId}
              onChange={e => setSelectedDeptId(e.target.value)}
              options={state.DEPARTMENT.map(d => ({
                value: d.DeptID,
                label: d.DeptName,
                sublabel: d.DeptID
              }))}
              error={formErrors.deptId}
            />
          </div>

          {/* Date & Quantity with Available Stock indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ClayInput
              label="Issue Date (Today or Past) *"
              type="date"
              max={new Date().toISOString().split('T')[0]}
              value={issueDate}
              onChange={e => setIssueDate(e.target.value)}
              error={formErrors.issueDate}
            />

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold tracking-wide text-clay-text/80 uppercase">
                  Quantity *
                </label>
                <span
                  className={`text-xs font-bold font-mono ${
                    availableStock <= 0 ? 'text-rose-500' : 'text-emerald-500'
                  }`}
                >
                  Available: {availableStock} units
                </span>
              </div>
              <ClayInput
                type="number"
                min="1"
                max={availableStock > 0 ? availableStock : 1}
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                error={formErrors.quantity}
              />

              {/* One-click reduce to available button if quantity exceeds stock */}
              {Number(quantity) > availableStock && availableStock > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantity(String(availableStock))}
                  className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                >
                  ⚡ One-click: Reduce to {availableStock} available units
                </button>
              )}
            </div>
          </div>

          {/* Live stock warning if at or below reorder */}
          {availableStock > 0 && Number(quantity) <= availableStock && (
            <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 text-xs text-clay-text flex items-center justify-between">
              <span>Remaining stock after this issue:</span>
              <strong className="font-mono text-sm text-indigo-600 dark:text-indigo-400">
                {availableStock - Number(quantity)} units
              </strong>
            </div>
          )}

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
            <ClayButton type="submit" variant="peach" disabled={availableStock <= 0}>
              Commit Issue Transaction
            </ClayButton>
          </div>
        </form>
      </ClayModal>

      {/* Delete Confirmation */}
      <ClayModal
        isOpen={!!issueToDelete}
        onClose={() => setIssueToDelete(null)}
        title="Delete Issue Transaction"
        subtitle="Stock will be automatically restored"
      >
        <p className="text-sm text-clay-text">
          Are you sure you want to delete issue transaction{' '}
          <strong className="text-rose-600">{issueToDelete}</strong>?
        </p>
        <div className="pt-4 border-t border-clay-border flex justify-end gap-3 mt-4">
          <ClayButton variant="secondary" onClick={() => setIssueToDelete(null)}>
            Cancel
          </ClayButton>
          <ClayButton variant="danger" onClick={handleConfirmDelete}>
            Delete Issue
          </ClayButton>
        </div>
      </ClayModal>
    </div>
  );
};
