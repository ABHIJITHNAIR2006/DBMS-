import React, { useState } from 'react';
import { useSql } from '../db/useSql';
import { sqlClient } from '../db/client';
import { useDB } from '../db/store';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { ClayModal } from '../components/clay/ClayModal';
import {
  FileText,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  GitCommit,
  Check,
  X,
  Play
} from 'lucide-react';

interface RequisitionRow {
  ReqID: string;
  DeptID: string;
  DeptName: string;
  EmpID: string;
  EmpName: string;
  ReqDate: string;
  Status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PARTIALLY_FULFILLED' | 'FULFILLED';
  ApprovedBy?: string | null;
  Remarks?: string | null;
  LineCount: number;
}

interface RequisitionLineRow {
  ReqID: string;
  LineNo: number;
  ItemID: string;
  ItemName: string;
  QtyRequested: number;
  QtyApproved?: number | null;
  CurrentStock: number;
}

export const RequisitionsPage: React.FC = () => {
  const { currentUser, can, showToast, fireConfetti } = useDB();

  // Queries
  const { data: requisitions, loading, refetch } = useSql<RequisitionRow>(`
    SELECT 
      r.ReqID,
      r.DeptID,
      d.DeptName,
      r.EmpID,
      e.EmpName,
      r.ReqDate,
      r.Status,
      r.ApprovedBy,
      r.Remarks,
      (SELECT COUNT(*) FROM REQUISITION_LINE rl WHERE rl.ReqID = r.ReqID) AS LineCount
    FROM REQUISITION r
    JOIN DEPARTMENT d ON r.DeptID = d.DeptID
    JOIN EMPLOYEE e ON r.EmpID = e.EmpID
    ORDER BY r.ReqDate DESC;
  `);

  const { data: allItems } = useSql<{ ItemID: string; ItemName: string; StockQty: number }>(`
    SELECT ItemID, ItemName, StockQty FROM V_CURRENT_STOCK ORDER BY ItemName ASC;
  `);

  const { data: departments } = useSql<{ DeptID: string; DeptName: string }>(`
    SELECT DeptID, DeptName FROM DEPARTMENT ORDER BY DeptName ASC;
  `);

  const { data: employees } = useSql<{ EmpID: string; EmpName: string; DeptID: string }>(`
    SELECT EmpID, EmpName, DeptID FROM EMPLOYEE ORDER BY EmpName ASC;
  `);

  // Selected Requisition for Inspection & Action
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState<string[]>([]);

  // Create Requisition Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newDeptId, setNewDeptId] = useState('D02');
  const [newEmpId, setNewEmpId] = useState('E006');
  const [newRemarks, setNewRemarks] = useState('');
  const [lines, setLines] = useState<{ itemId: string; qty: number }[]>([
    { itemId: 'I101', qty: 5 }
  ]);

  // Selected Requisition Lines
  const { data: selectedLines } = useSql<RequisitionLineRow>(
    `SELECT 
      rl.ReqID,
      rl.LineNo,
      rl.ItemID,
      i.ItemName,
      rl.QtyRequested,
      rl.QtyApproved,
      cs.StockQty AS CurrentStock
    FROM REQUISITION_LINE rl
    JOIN ITEM i ON rl.ItemID = i.ItemID
    JOIN V_CURRENT_STOCK cs ON rl.ItemID = cs.ItemID
    WHERE rl.ReqID = ?
    ORDER BY rl.LineNo ASC;`,
    [selectedReqId || ''],
    [selectedReqId],
    { enabled: Boolean(selectedReqId) }
  );

  const handleCreateRequisition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nextIdRes = await sqlClient.exec("SELECT COALESCE(MAX(CAST(substr(ReqID, 5) AS INTEGER)), 100) FROM REQUISITION;");
      const nextSeq = Number(nextIdRes.rows[0][0]) + 1;
      const reqId = `REQ-${nextSeq}`;
      const today = new Date().toISOString().split('T')[0];

      const res = await sqlClient.callProcedure('sp_submit_requisition', {
        reqId,
        deptId: newDeptId,
        empId: newEmpId,
        reqDate: today,
        remarks: newRemarks,
        lines: lines.map(l => ({ itemId: l.itemId, qtyRequested: l.qty }))
      });

      if (!res.ok) throw new Error(res.message);

      showToast({
        title: 'Requisition Submitted',
        description: `Created ticket ${reqId} with ${lines.length} line items.`,
        type: 'success'
      });
      setCreateModalOpen(false);
      refetch();
    } catch (err: any) {
      showToast({
        title: 'Failed to Submit Requisition',
        description: err?.message || 'Error executing stored procedure',
        type: 'error'
      });
    }
  };

  const handleApprove = async (reqId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const res = await sqlClient.callProcedure('sp_approve_requisition', {
        reqId,
        status,
        approvedBy: currentUser.userId,
        resource: 'REQUISITION',
        action: 'APPROVE'
      });
      if (!res.ok) throw new Error(res.message);

      showToast({
        title: `Requisition ${status}`,
        description: `Ticket ${reqId} has been marked as ${status}.`,
        type: status === 'APPROVED' ? 'success' : 'info'
      });
      refetch();
    } catch (err: any) {
      showToast({
        title: 'Action Denied',
        description: err?.message || 'Permission denied or constraint failure',
        type: 'error'
      });
    }
  };

  const handleFulfil = async (reqId: string) => {
    try {
      const res = await sqlClient.callProcedure('sp_fulfil_requisition', {
        reqId,
        resource: 'REQUISITION',
        action: 'FULFIL'
      });

      const timeline = res.result?.timeline || [];
      setTimelineEvents(timeline);
      setTimelineModalOpen(true);

      if (res.ok) {
        showToast({
          title: `Fulfillment Complete: ${res.result?.status}`,
          description: `Processed with ${res.result?.successfulLines} issued, ${res.result?.shortfalls} shortfall(s).`,
          type: res.result?.status === 'FULFILLED' ? 'success' : 'warning'
        });
        if (res.result?.status === 'FULFILLED') fireConfetti();
        refetch();
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      showToast({
        title: 'Fulfillment Error',
        description: err?.message || 'Transaction aborted',
        type: 'error'
      });
    }
  };

  const columns: { status: RequisitionRow['Status']; label: string; icon: any; color: string }[] = [
    { status: 'SUBMITTED', label: 'Pending Approval', icon: Clock, color: 'text-amber-500' },
    { status: 'APPROVED', label: 'Approved (Pending Store)', icon: CheckCircle2, color: 'text-indigo-500' },
    { status: 'PARTIALLY_FULFILLED', label: 'Partially Fulfilled', icon: AlertCircle, color: 'text-orange-500' },
    { status: 'FULFILLED', label: 'Fulfilled', icon: Check, color: 'text-emerald-500' },
    { status: 'REJECTED', label: 'Rejected', icon: XCircle, color: 'text-rose-500' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
              Requisitions Workflow
            </h1>
            <ClayChip variant="primary" size="sm">
              ACID SAVEPOINTS
            </ClayChip>
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Multi-line department requests enforced by transactional savepoints and role authorization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <ClayButton
            variant="primary"
            size="md"
            icon={<Plus size={16} />}
            onClick={() => setCreateModalOpen(true)}
            disabled={!can('REQUISITION', 'CREATE')}
          >
            New Requisition
          </ClayButton>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {columns.map(col => {
          const colItems = (requisitions || []).filter(r => r.Status === col.status);
          const ColIcon = col.icon;
          return (
            <div key={col.status} className="flex flex-col gap-3">
              <div className="clay-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={col.color} />
                  <span className="text-xs font-bold font-display text-clay-text">{col.label}</span>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-clay-text">
                  {colItems.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[300px]">
                {colItems.map(req => (
                  <ClayCard
                    key={req.ReqID}
                    enableTilt
                    onClick={() => setSelectedReqId(req.ReqID)}
                    className={`p-4 space-y-3 cursor-pointer transition-all ${
                      selectedReqId === req.ReqID ? 'ring-2 ring-indigo-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {req.ReqID}
                      </span>
                      <span className="text-[10px] text-clay-text-muted">{req.ReqDate}</span>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-clay-text line-clamp-1">{req.DeptName}</p>
                      <p className="text-[11px] text-clay-text-muted">By {req.EmpName}</p>
                    </div>

                    {req.Remarks && (
                      <p className="text-[11px] italic text-clay-text-muted line-clamp-2">
                        "{req.Remarks}"
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-clay-border text-[11px]">
                      <span className="text-clay-text-muted">{req.LineCount} Line Item(s)</span>
                      
                      {/* Workflow Actions */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        {req.Status === 'SUBMITTED' && can('REQUISITION', 'APPROVE') && (
                          <>
                            <button
                              onClick={() => handleApprove(req.ReqID, 'APPROVED')}
                              title="Approve"
                              className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 hover:scale-105"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={() => handleApprove(req.ReqID, 'REJECTED')}
                              title="Reject"
                              className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 hover:scale-105"
                            >
                              <X size={12} />
                            </button>
                          </>
                        )}

                        {req.Status === 'APPROVED' && can('REQUISITION', 'FULFIL') && (
                          <button
                            onClick={() => handleFulfil(req.ReqID)}
                            title="Fulfil with Savepoint Transaction"
                            className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[10px] flex items-center gap-1 hover:bg-indigo-700"
                          >
                            <Play size={10} /> Fulfil
                          </button>
                        )}
                      </div>
                    </div>
                  </ClayCard>
                ))}

                {colItems.length === 0 && (
                  <div className="clay-card p-6 text-center text-xs text-clay-text-muted italic border-dashed">
                    No tickets in this stage
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Requisition Inspection Card */}
      {selectedReqId && (
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-clay-border pb-3">
            <div>
              <h3 className="text-base font-bold font-display text-clay-text">
                Ticket Details: <span className="text-indigo-600 font-mono">{selectedReqId}</span>
              </h3>
              <p className="text-xs text-clay-text-muted">
                Line items stored in weak entity relation <span className="font-mono">REQUISITION_LINE</span>
              </p>
            </div>
            <button
              onClick={() => setSelectedReqId(null)}
              className="text-xs text-clay-text-muted hover:text-clay-text font-bold"
            >
              Close Details
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                <tr>
                  <th className="p-3">Line #</th>
                  <th className="p-3">Item Name</th>
                  <th className="p-3">Item ID</th>
                  <th className="p-3">Qty Requested</th>
                  <th className="p-3">Qty Approved</th>
                  <th className="p-3">Live Stock</th>
                  <th className="p-3">Stock Feasibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-clay-border">
                {(selectedLines || []).map(line => {
                  const feasible = line.CurrentStock >= line.QtyRequested;
                  return (
                    <tr key={line.LineNo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-3 font-mono">{line.LineNo}</td>
                      <td className="p-3 font-semibold text-clay-text">{line.ItemName}</td>
                      <td className="p-3 font-mono text-clay-text-muted">{line.ItemID}</td>
                      <td className="p-3 font-bold">{line.QtyRequested}</td>
                      <td className="p-3">{line.QtyApproved ?? line.QtyRequested}</td>
                      <td className="p-3 font-mono font-bold">{line.CurrentStock}</td>
                      <td className="p-3">
                        {feasible ? (
                          <ClayChip variant="success" size="sm">Available</ClayChip>
                        ) : (
                          <ClayChip variant="danger" size="sm">Shortfall Risk</ClayChip>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ClayCard>
      )}

      {/* Timeline Modal (Transaction Savepoints Execution Log) */}
      <ClayModal
        isOpen={timelineModalOpen}
        onClose={() => setTimelineModalOpen(false)}
        title="Transaction Execution Timeline"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300">
            <GitCommit size={16} />
            <span>
              Real-time transaction execution log showing SAVEPOINT isolation and rollback per requisition line.
            </span>
          </div>

          <div className="p-4 rounded-2xl clay-inset font-mono text-xs space-y-1.5 max-h-80 overflow-y-auto">
            {timelineEvents.map((evt, idx) => {
              const isRollback = evt.includes('ROLLBACK');
              const isSavepoint = evt.includes('SAVEPOINT');
              const isCommit = evt.includes('COMMIT');
              return (
                <div
                  key={idx}
                  className={`py-0.5 ${
                    isRollback
                      ? 'text-rose-600 dark:text-rose-400 font-bold'
                      : isSavepoint
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : isCommit
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                      : 'text-clay-text'
                  }`}
                >
                  {evt}
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <ClayButton variant="primary" onClick={() => setTimelineModalOpen(false)}>
              Done
            </ClayButton>
          </div>
        </div>
      </ClayModal>

      {/* Create Requisition Modal */}
      <ClayModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Submit Department Requisition"
      >
        <form onSubmit={handleCreateRequisition} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-clay-text mb-1">Department</label>
              <select
                value={newDeptId}
                onChange={e => {
                  setNewDeptId(e.target.value);
                  const firstEmp = (employees || []).find(emp => emp.DeptID === e.target.value);
                  if (firstEmp) setNewEmpId(firstEmp.EmpID);
                }}
                className="w-full clay-inset p-2.5 rounded-xl text-xs text-clay-text"
              >
                {(departments || []).map(d => (
                  <option key={d.DeptID} value={d.DeptID}>{d.DeptName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-clay-text mb-1">Requesting Staff</label>
              <select
                value={newEmpId}
                onChange={e => setNewEmpId(e.target.value)}
                className="w-full clay-inset p-2.5 rounded-xl text-xs text-clay-text"
              >
                {(employees || [])
                  .filter(e => e.DeptID === newDeptId)
                  .map(e => (
                    <option key={e.EmpID} value={e.EmpID}>{e.EmpName}</option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-clay-text mb-1">Purpose / Remarks</label>
            <input
              type="text"
              value={newRemarks}
              onChange={e => setNewRemarks(e.target.value)}
              placeholder="e.g. End semester examination stationary dispatch"
              className="w-full clay-inset p-2.5 rounded-xl text-xs text-clay-text"
            />
          </div>

          {/* Line Items */}
          <div className="space-y-2 pt-2 border-t border-clay-border">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-clay-text">Requisition Line Items</span>
              <button
                type="button"
                onClick={() => setLines([...lines, { itemId: (allItems || [])[0]?.ItemID || 'I101', qty: 1 }])}
                className="text-xs text-indigo-600 font-bold hover:underline"
              >
                + Add Line
              </button>
            </div>

            {lines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={line.itemId}
                  onChange={e => {
                    const updated = [...lines];
                    updated[idx].itemId = e.target.value;
                    setLines(updated);
                  }}
                  className="flex-1 clay-inset p-2 rounded-xl text-xs text-clay-text"
                >
                  {(allItems || []).map(it => (
                    <option key={it.ItemID} value={it.ItemID}>
                      {it.ItemName} (Stock: {it.StockQty})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min={1}
                  value={line.qty}
                  onChange={e => {
                    const updated = [...lines];
                    updated[idx].qty = parseInt(e.target.value, 10) || 1;
                    setLines(updated);
                  }}
                  className="w-20 clay-inset p-2 rounded-xl text-xs text-clay-text"
                />

                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                    className="p-2 text-rose-500 font-bold text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <ClayButton variant="ghost" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </ClayButton>
            <ClayButton variant="primary" type="submit">
              Submit Requisition
            </ClayButton>
          </div>
        </form>
      </ClayModal>
    </div>
  );
};
