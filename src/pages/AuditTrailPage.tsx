import React, { useState } from 'react';
import { useSql } from '../db/useSql';
import { sqlClient } from '../db/client';
import { useDB } from '../db/store';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { ShieldAlert, RotateCcw, Search, Filter } from 'lucide-react';

interface AuditRow {
  AuditID: number;
  TableName: string;
  RecordKey: string;
  Action: 'INSERT' | 'UPDATE' | 'DELETE';
  OldValues?: string | null;
  NewValues?: string | null;
  ChangedBy?: string | null;
  ChangedAt: string;
}

export const AuditTrailPage: React.FC = () => {
  const { currentUser, showToast } = useDB();
  const [selectedTable, setSelectedTable] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: auditLogs, refetch } = useSql<AuditRow>(`
    SELECT 
      AuditID,
      TableName,
      RecordKey,
      Action,
      OldValues,
      NewValues,
      ChangedBy,
      ChangedAt
    FROM AUDIT_LOG
    ORDER BY AuditID DESC
    LIMIT 200;
  `);

  const handleUndo = async (log: AuditRow) => {
    if (log.TableName !== 'ITEM' || log.Action !== 'UPDATE' || !log.OldValues) {
      showToast({
        title: 'Undo Not Applicable',
        description: 'Compensating transaction undo is supported for ITEM updates.',
        type: 'warning'
      });
      return;
    }

    try {
      const oldObj = JSON.parse(log.OldValues);
      await sqlClient.exec(
        `UPDATE ITEM SET ItemName = ?, Category = ?, UnitPrice = ? WHERE ItemID = ?;`,
        [oldObj.ItemName, oldObj.Category, oldObj.UnitPrice, oldObj.ItemID]
      );

      showToast({
        title: 'Compensating Transaction Committed',
        description: `Reverted ITEM ${oldObj.ItemID} to prior state (UnitPrice: ₹${oldObj.UnitPrice}).`,
        type: 'success'
      });
      refetch();
    } catch (err: any) {
      showToast({
        title: 'Undo Failed',
        description: err?.message || 'Error executing compensating transaction',
        type: 'error'
      });
    }
  };

  const filteredLogs = (auditLogs || []).filter(log => {
    if (selectedTable !== 'ALL' && log.TableName !== selectedTable) return false;
    if (selectedAction !== 'ALL' && log.Action !== selectedAction) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchKey = log.RecordKey.toLowerCase().includes(term);
      const matchUser = (log.ChangedBy || '').toLowerCase().includes(term);
      const matchOld = (log.OldValues || '').toLowerCase().includes(term);
      const matchNew = (log.NewValues || '').toLowerCase().includes(term);
      return matchKey || matchUser || matchOld || matchNew;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
              Audit Trail & Compliance Log
            </h1>
            <ClayChip variant="primary" size="sm">
              TRIGGER ENFORCED
            </ClayChip>
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Immutable audit journal captured via database triggers with JSON diff state tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ClayChip variant="outline" size="md">
            Logged as: {currentUser.role}
          </ClayChip>
        </div>
      </div>

      {/* Filter Bar */}
      <ClayCard className="p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="flex-1 w-full flex items-center gap-2 clay-inset px-3 py-2 rounded-xl">
          <Search size={14} className="text-clay-text-muted" />
          <input
            type="text"
            placeholder="Search by entity key, changed by, or JSON diff..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-transparent text-xs text-clay-text outline-none"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-clay-text-muted" />
            <select
              value={selectedTable}
              onChange={e => setSelectedTable(e.target.value)}
              className="clay-inset px-3 py-2 rounded-xl text-xs text-clay-text"
            >
              <option value="ALL">All Tables</option>
              <option value="ITEM">ITEM</option>
              <option value="SUPPLIES">SUPPLIES</option>
              <option value="ISSUED_TO">ISSUED_TO</option>
              <option value="REQUISITION">REQUISITION</option>
            </select>
          </div>

          <select
            value={selectedAction}
            onChange={e => setSelectedAction(e.target.value)}
            className="clay-inset px-3 py-2 rounded-xl text-xs text-clay-text"
          >
            <option value="ALL">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>
      </ClayCard>

      {/* Table */}
      <ClayCard className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold border-b border-clay-border">
              <tr>
                <th className="p-3.5">Audit ID</th>
                <th className="p-3.5">Table</th>
                <th className="p-3.5">Record Key</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Prior State (OldValues)</th>
                <th className="p-3.5">New State (NewValues)</th>
                <th className="p-3.5">Changed By</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right">Compensating Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clay-border">
              {filteredLogs.map(log => {
                let actionChip: any = 'outline';
                if (log.Action === 'INSERT') actionChip = 'success';
                else if (log.Action === 'UPDATE') actionChip = 'primary';
                else if (log.Action === 'DELETE') actionChip = 'danger';

                return (
                  <tr key={log.AuditID} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="p-3.5 font-mono text-clay-text-muted">#{log.AuditID}</td>
                    <td className="p-3.5 font-bold text-clay-text">{log.TableName}</td>
                    <td className="p-3.5 font-mono text-indigo-600 dark:text-indigo-400 font-semibold">{log.RecordKey}</td>
                    <td className="p-3.5">
                      <ClayChip variant={actionChip} size="sm">
                        {log.Action}
                      </ClayChip>
                    </td>
                    <td className="p-3.5 max-w-xs font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {log.OldValues || <span className="italic text-slate-400">NULL</span>}
                    </td>
                    <td className="p-3.5 max-w-xs font-mono text-[11px] text-slate-700 dark:text-slate-200 truncate">
                      {log.NewValues || <span className="italic text-slate-400">NULL</span>}
                    </td>
                    <td className="p-3.5 font-semibold text-clay-text">{log.ChangedBy || 'SYSTEM'}</td>
                    <td className="p-3.5 text-clay-text-muted whitespace-nowrap">{log.ChangedAt}</td>
                    <td className="p-3.5 text-right">
                      {log.TableName === 'ITEM' && log.Action === 'UPDATE' && (
                        <button
                          onClick={() => handleUndo(log)}
                          className="px-2.5 py-1 rounded-xl clay-card text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 ml-auto"
                        >
                          <RotateCcw size={12} /> Undo
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-clay-text-muted text-xs italic">
                    No matching audit log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ClayCard>
    </div>
  );
};
