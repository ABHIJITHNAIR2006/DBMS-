import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  Phone,
  MapPin,
  Building2,
  ShoppingCart,
  Send,
  AlertCircle
} from 'lucide-react';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayInput } from '../components/clay/ClayInput';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayModal } from '../components/clay/ClayModal';
import { ClayTooltip } from '../components/clay/ClayTooltip';
import { useDB } from '../db/store';
import { dbEngine } from '../db/engine';
import { Supplier, Department } from '../db/types';
import { queries } from '../db/queries';

export const SuppliersPage: React.FC = () => {
  const { state, showToast } = useDB();

  // Tab switch between Suppliers and Departments
  const [activeSubTab, setActiveSubTab] = useState<'suppliers' | 'departments'>('suppliers');

  // Supplier Form State
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierName, setSupplierName] = useState('');
  const [street, setStreet] = useState('');
  const [pincode, setPincode] = useState('');
  const [city, setCity] = useState('');
  const [isNewPincode, setIsNewPincode] = useState(false);
  const [contacts, setContacts] = useState<string[]>(['']);
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});

  // Department Form State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [deptError, setDeptError] = useState('');

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'SUPPLIER' | 'DEPARTMENT'; id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Supplier stats with decomposed city & contacts
  const supplierStats = queries.getSupplierStats();
  const departmentStats = queries.getDepartmentStats();

  // 3NF Pincode Auto-Fill Logic
  const handlePincodeChange = (inputPin: string) => {
    setPincode(inputPin);
    const existing = state.PINCODE_CITY.find(p => p.Pincode === inputPin.trim());
    if (existing) {
      setCity(existing.City);
      setIsNewPincode(false);
    } else if (inputPin.trim().length >= 6) {
      setIsNewPincode(true);
      setCity('');
    }
  };

  // Open Supplier Modal
  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierName('');
    setStreet('');
    setPincode('');
    setCity('');
    setIsNewPincode(false);
    setContacts(['']);
    setSupplierErrors({});
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierName(s.SupplierName);
    setStreet(s.Street);
    setPincode(s.Pincode);
    const existingCity = state.PINCODE_CITY.find(p => p.Pincode === s.Pincode)?.City ?? '';
    setCity(existingCity);
    setIsNewPincode(false);
    const currentContacts = state.SUPPLIER_CONTACT.filter(sc => sc.SupplierID === s.SupplierID).map(sc => sc.ContactNo);
    setContacts(currentContacts.length > 0 ? currentContacts : ['']);
    setSupplierErrors({});
    setIsSupplierModalOpen(true);
  };

  // Submit Supplier
  const handleSubmitSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!supplierName.trim()) errors.supplierName = 'Supplier name is required';
    if (!street.trim()) errors.street = 'Street address is required';
    if (!pincode.trim() || pincode.trim().length < 6) errors.pincode = 'Valid 6-digit Pincode is required';
    if (!city.trim()) errors.city = 'City is required for this pincode';

    const validContacts = contacts.map(c => c.trim()).filter(Boolean);
    if (validContacts.length === 0) {
      errors.contacts = 'At least one contact number is required';
    }

    if (Object.keys(errors).length > 0) {
      setSupplierErrors(errors);
      return;
    }

    try {
      if (editingSupplier) {
        dbEngine.updateSupplier({
          supplierId: editingSupplier.SupplierID,
          supplierName,
          street,
          pincode,
          city,
          contacts: validContacts
        });

        showToast({
          title: 'Supplier Updated',
          description: `Updated supplier '${supplierName}'. Pincode-City 3NF relations synchronized.`,
          type: 'success'
        });
      } else {
        const created = dbEngine.addSupplier({
          supplierName,
          street,
          pincode,
          city,
          contacts: validContacts
        });

        showToast({
          title: 'Supplier Registered',
          description: `Created supplier '${created.SupplierID}'. Decomposed city mapped in PINCODE_CITY.`,
          type: 'success'
        });
      }

      setIsSupplierModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast({ title: 'Constraint Error', description: msg, type: 'error' });
    }
  };

  // Submit Department
  const handleSubmitDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) {
      setDeptError('Department name is required');
      return;
    }

    try {
      const created = dbEngine.addDepartment(deptName);
      showToast({
        title: 'Department Created',
        description: `Department '${created.DeptName}' added with DeptID '${created.DeptID}'.`,
        type: 'success'
      });
      setIsDeptModalOpen(false);
      setDeptName('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeptError(msg);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    setDeleteError(null);

    try {
      if (deleteTarget.type === 'SUPPLIER') {
        dbEngine.deleteSupplier(deleteTarget.id);
        showToast({
          title: 'Supplier Deleted',
          description: `Supplier '${deleteTarget.name}' and contacts deleted.`,
          type: 'info'
        });
      } else {
        dbEngine.deleteDepartment(deleteTarget.id);
        showToast({
          title: 'Department Deleted',
          description: `Department '${deleteTarget.name}' deleted.`,
          type: 'info'
        });
      }
      setDeleteTarget(null);
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
              Master Data: Suppliers & Departments
            </h1>
            <ClayChip label="3NF & Normalization" variant="periwinkle" />
            <ClayTooltip
              concept="Transitive Dependency (3NF)"
              explanation="In SUPPLIER, SupplierID -> Pincode and Pincode -> City. Because City is transitively dependent on SupplierID, it is decomposed into PINCODE_CITY(Pincode, City) to achieve 3NF."
            />
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Manage external suppliers (with multivalued contacts) and internal university departments
          </p>
        </div>

        {/* Tab Switcher & Action */}
        <div className="flex items-center gap-2">
          <div className="clay-inset p-1 rounded-2xl flex items-center">
            <button
              onClick={() => setActiveSubTab('suppliers')}
              className={`px-3 py-1.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
                activeSubTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-xs' : 'text-clay-text-muted'
              }`}
            >
              Suppliers ({state.SUPPLIER.length})
            </button>
            <button
              onClick={() => setActiveSubTab('departments')}
              className={`px-3 py-1.5 rounded-xl font-display font-bold text-xs transition-all cursor-pointer ${
                activeSubTab === 'departments' ? 'bg-indigo-600 text-white shadow-xs' : 'text-clay-text-muted'
              }`}
            >
              Departments ({state.DEPARTMENT.length})
            </button>
          </div>

          {activeSubTab === 'suppliers' ? (
            <ClayButton variant="primary" onClick={handleOpenAddSupplier} icon={<Plus size={16} />}>
              Add Supplier
            </ClayButton>
          ) : (
            <ClayButton
              variant="mint"
              onClick={() => {
                setDeptName('');
                setDeptError('');
                setIsDeptModalOpen(true);
              }}
              icon={<Plus size={16} />}
            >
              Add Department
            </ClayButton>
          )}
        </div>
      </div>

      {/* =========================================================================
          SUPPLIERS TAB (WITH MULTIVALUED CONTACTS & PINCODE 3NF SPLIT)
         ========================================================================= */}
      {activeSubTab === 'suppliers' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {supplierStats.map(s => (
            <ClayCard key={s.SupplierID} enableTilt className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    {s.SupplierID}
                  </span>
                  <span className="text-[11px] font-bold text-clay-text-muted">
                    {s.purchaseCount} Order{s.purchaseCount === 1 ? '' : 's'}
                  </span>
                </div>

                <h3 className="font-display font-bold text-lg text-clay-text">{s.SupplierName}</h3>

                {/* 3NF Decomposed Address */}
                <div className="mt-2 text-xs text-clay-text-muted space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} className="text-rose-500 shrink-0" />
                    <span>{s.Street}</span>
                  </div>
                  <div className="ml-5 font-semibold text-clay-text">
                    {s.city} — Pincode: <span className="font-mono">{s.Pincode}</span>
                  </div>
                </div>

                {/* Multivalued Contacts Chips */}
                <div className="mt-4 pt-3 border-t border-clay-border">
                  <span className="text-[10px] uppercase font-bold text-clay-text-muted block mb-1.5">
                    Supplier Contacts (1NF Relation):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {s.contacts.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-100 dark:bg-slate-800 text-clay-text"
                      >
                        <Phone size={10} className="text-emerald-500" />
                        <span>{c}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Spend Overview */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs font-medium">
                  <span className="text-clay-text-muted">Total Procurement:</span>
                  <span className="font-extrabold text-clay-text font-mono">
                    ₹{s.totalCost.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-clay-border flex items-center justify-between">
                <button
                  onClick={() => handleOpenEditSupplier(s)}
                  className="p-1.5 text-clay-text-muted hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Edit Supplier"
                >
                  <Edit2 size={15} />
                </button>

                <button
                  onClick={() => {
                    setDeleteTarget({ type: 'SUPPLIER', id: s.SupplierID, name: s.SupplierName });
                    setDeleteError(null);
                  }}
                  className="p-1.5 text-clay-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Delete Supplier (ON DELETE RESTRICT check)"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </ClayCard>
          ))}
        </div>
      ) : (
        /* =========================================================================
            DEPARTMENTS TAB
           ========================================================================= */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {departmentStats.map(d => (
            <ClayCard key={d.deptId} enableTilt className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                    {d.deptId}
                  </span>
                  <Building2 size={20} className="text-indigo-500" />
                </div>

                <h3 className="font-display font-bold text-lg text-clay-text">{d.deptName}</h3>

                <div className="mt-4 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-clay-text-muted">Issue Transactions:</span>
                    <strong className="font-mono text-clay-text">{d.issueCount}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-clay-text-muted">Units Consumed:</span>
                    <strong className="font-mono text-emerald-600 dark:text-emerald-400">
                      {d.totalUnitsIssued} units
                    </strong>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-clay-border flex justify-end">
                <button
                  onClick={() => {
                    setDeleteTarget({ type: 'DEPARTMENT', id: d.deptId, name: d.deptName });
                    setDeleteError(null);
                  }}
                  className="p-1.5 text-clay-text-muted hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-slate-800 cursor-pointer"
                  title="Delete Department (ON DELETE RESTRICT check)"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </ClayCard>
          ))}
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT SUPPLIER MODAL WITH PINCODE-CITY 3NF AUTOFILL
         ========================================================================= */}
      <ClayModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        title={editingSupplier ? `Edit Supplier (${editingSupplier.SupplierID})` : 'Register New Stationery Supplier'}
        subtitle="Demonstrates 3NF decomposition: Pincode -> City and multivalued contacts"
      >
        <form onSubmit={handleSubmitSupplier} className="space-y-4">
          <ClayInput
            label="Supplier / Vendor Name *"
            placeholder="e.g. ABC Traders or Gokhale Stationers"
            value={supplierName}
            onChange={e => setSupplierName(e.target.value)}
            error={supplierErrors.supplierName}
          />

          <ClayInput
            label="Street Address *"
            placeholder="e.g. 42 M.G. Road, Raviwar Peth"
            value={street}
            onChange={e => setStreet(e.target.value)}
            error={supplierErrors.street}
          />

          {/* 3NF Split Demonstration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <div>
              <ClayInput
                label="Pincode (FK -> PINCODE_CITY) *"
                placeholder="e.g. 422001 or 411001"
                value={pincode}
                onChange={e => handlePincodeChange(e.target.value)}
                error={supplierErrors.pincode}
              />
              <span className="text-[10px] text-clay-text-muted mt-1 block">
                Type 422001, 411001, or 400001 to test auto-fill.
              </span>
            </div>

            <div>
              <ClayInput
                label={isNewPincode ? 'City Name (New 3NF Entry) *' : 'City (Auto-resolved from 3NF) *'}
                placeholder="City Name"
                value={city}
                onChange={e => setCity(e.target.value)}
                error={supplierErrors.city}
              />
              {isNewPincode && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-1 block">
                  ⚡ New pincode: City will be inserted into PINCODE_CITY relation first!
                </span>
              )}
            </div>
          </div>

          {/* Multivalued Contacts List */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-clay-border space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-clay-text uppercase">
                  Multivalued Contacts (SUPPLIER_CONTACT)
                </span>
                <p className="text-[11px] text-clay-text-muted">
                  Normalized to 1NF by eliminating repeating contact columns
                </p>
              </div>
              <ClayButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setContacts([...contacts, ''])}
              >
                + Add Contact
              </ClayButton>
            </div>

            {contacts.map((c, i) => (
              <div key={i} className="flex items-center gap-2 mt-2">
                <div className="flex-1">
                  <ClayInput
                    placeholder="e.g. +91 98220 12345 or +91 22 2288 9900"
                    value={c}
                    onChange={e => {
                      const updated = [...contacts];
                      updated[i] = e.target.value;
                      setContacts(updated);
                    }}
                  />
                </div>
                {contacts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setContacts(contacts.filter((_, idx) => idx !== i))}
                    className="p-2 text-rose-500 hover:text-rose-700 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            {supplierErrors.contacts && (
              <p className="text-xs text-rose-500 font-semibold">{supplierErrors.contacts}</p>
            )}
          </div>

          <div className="pt-4 border-t border-clay-border flex justify-end gap-3">
            <ClayButton type="button" variant="secondary" onClick={() => setIsSupplierModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="primary">
              {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
            </ClayButton>
          </div>
        </form>
      </ClayModal>

      {/* =========================================================================
          ADD DEPARTMENT MODAL
         ========================================================================= */}
      <ClayModal
        isOpen={isDeptModalOpen}
        onClose={() => setIsDeptModalOpen(false)}
        title="Register Academic Department"
        subtitle="Master entity in DEPARTMENT relation"
      >
        <form onSubmit={handleSubmitDept} className="space-y-4">
          <ClayInput
            label="Department Name *"
            placeholder="e.g. Information Technology or Electrical Engineering"
            value={deptName}
            onChange={e => setDeptName(e.target.value)}
            error={deptError}
          />
          <div className="pt-4 border-t border-clay-border flex justify-end gap-3">
            <ClayButton type="button" variant="secondary" onClick={() => setIsDeptModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton type="submit" variant="mint">
              Insert Department
            </ClayButton>
          </div>
        </form>
      </ClayModal>

      {/* =========================================================================
          DELETE CONFIRMATION MODAL (ON DELETE RESTRICT)
         ========================================================================= */}
      <ClayModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === 'SUPPLIER' ? 'Supplier' : 'Department'}`}
        subtitle="Referential Integrity Check: ON DELETE RESTRICT"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-clay-text">
              Are you sure you want to delete {deleteTarget.type.toLowerCase()}{' '}
              <strong className="text-rose-600">{deleteTarget.name}</strong> ({deleteTarget.id})?
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

            <div className="pt-3 border-t border-clay-border flex justify-end gap-3">
              <ClayButton variant="secondary" onClick={() => setDeleteTarget(null)}>
                Cancel
              </ClayButton>
              <ClayButton variant="danger" onClick={handleConfirmDelete}>
                Delete
              </ClayButton>
            </div>
          </div>
        )}
      </ClayModal>
    </div>
  );
};
