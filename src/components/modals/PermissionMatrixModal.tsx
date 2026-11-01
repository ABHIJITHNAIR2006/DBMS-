import React, { useState } from 'react';
import { useSql } from '../../db/useSql';
import { sqlClient } from '../../db/client';
import { useDB } from '../../db/store';
import { ClayModal } from '../clay/ClayModal';
import { ClayChip } from '../clay/ClayChip';
import { Shield, Key, Info } from 'lucide-react';

interface PermRow {
  RoleName: string;
  Resource: string;
  Action: string;
}

interface PermissionMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionMatrixModal: React.FC<PermissionMatrixModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, showToast } = useDB();
  const isAdmin = currentUser.role === 'ADMIN';

  const { data: permissions, refetch } = useSql<PermRow>(`
    SELECT RoleName, Resource, Action FROM PERMISSION ORDER BY RoleName, Resource, Action;
  `, [], [isOpen], { enabled: isOpen });

  const [lastDclStatement, setLastDclStatement] = useState<string | null>(null);

  const roles = ['ADMIN', 'STORE_KEEPER', 'DEPT_HEAD', 'ACCOUNTANT', 'AUDITOR'];
  const resources = ['ITEM', 'SUPPLIER', 'PURCHASE', 'ISSUE', 'REQUISITION', 'AUDIT_LOG', 'REPORT'];
  const actions = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'FULFIL', 'EXPORT'];

  const hasPermission = (role: string, resource: string, action: string) => {
    if (role === 'ADMIN') return true;
    return (permissions || []).some(
      p => p.RoleName === role && p.Resource === resource && p.Action === action
    );
  };

  const handleToggle = async (role: string, resource: string, action: string) => {
    if (!isAdmin) {
      showToast({
        title: 'Admin Privilege Required',
        description: 'Only the ADMIN role can execute GRANT or REVOKE operations.',
        type: 'warning'
      });
      return;
    }

    if (role === 'ADMIN') {
      showToast({
        title: 'Immutable Superuser',
        description: 'ADMIN maintains total unrevokable schema privileges.',
        type: 'info'
      });
      return;
    }

    const current = hasPermission(role, resource, action);
    const safeAction = /^[A-Z_]+$/.test(action) ? action : 'SELECT';
    const safeResource = /^[A-Za-z0-9_]+$/.test(resource) ? resource : 'UNKNOWN';
    const safeRole = /^[A-Za-z0-9_]+$/.test(role) ? role : 'UNKNOWN';

    try {
      if (current) {
        // Revoke
        await sqlClient.exec(
          `DELETE FROM PERMISSION WHERE RoleName = ? AND Resource = ? AND Action = ?;`,
          [role, resource, action]
        );
        const dcl = `/* Simulated DCL */ REVOKE ${safeAction} ON "${safeResource}" FROM "${safeRole}";`;
        setLastDclStatement(dcl);
        showToast({
          title: 'Privilege Revoked',
          description: dcl,
          type: 'info'
        });
      } else {
        // Grant
        await sqlClient.exec(
          `INSERT INTO PERMISSION (RoleName, Resource, Action) VALUES (?, ?, ?);`,
          [role, resource, action]
        );
        const dcl = `/* Simulated DCL */ GRANT ${safeAction} ON "${safeResource}" TO "${safeRole}";`;
        setLastDclStatement(dcl);
        showToast({
          title: 'Privilege Granted',
          description: dcl,
          type: 'success'
        });
      }
      refetch();
    } catch (err: any) {
      showToast({
        title: 'DCL Execution Error',
        description: err?.message || 'Failed to modify permission relation',
        type: 'error'
      });
    }
  };

  return (
    <ClayModal isOpen={isOpen} onClose={onClose} title="Security & RBAC Permission Matrix">
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Educational Emulation Banner */}
        <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 space-y-2">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Key size={16} />
            <span className="text-xs font-bold font-display">Emulated GRANT / REVOKE Security Engine</span>
            <ClayChip variant="primary" size="sm">SIMULATED DCL</ClayChip>
          </div>
          <p className="text-[11px] text-clay-text-muted leading-relaxed">
            SQLite lacks built-in native SQL <span className="font-mono">GRANT/REVOKE</span> commands. ClayStock models enterprise RBAC via a 3NF <span className="font-mono font-bold">PERMISSION</span> table checked by stored procedures and row-level views before executing transactions.
          </p>
        </div>

        {lastDclStatement && (
          <div className="p-3 rounded-xl clay-inset space-y-1">
            <span className="text-[10px] uppercase font-bold text-clay-text-muted">Equivalent Production RDBMS DCL:</span>
            <pre className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">{lastDclStatement}</pre>
          </div>
        )}

        {/* Matrix Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
              <tr>
                <th className="p-2.5">Resource & Action</th>
                {roles.map(r => (
                  <th key={r} className="p-2.5 text-center font-mono text-[11px]">{r}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-clay-border">
              {resources.map(res => (
                <React.Fragment key={res}>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    <td colSpan={roles.length + 1} className="p-2 font-bold font-display text-indigo-600 dark:text-indigo-400 text-xs uppercase tracking-wide">
                      {res} Table / Entity
                    </td>
                  </tr>
                  {actions.map(act => (
                    <tr key={`${res}_${act}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2 pl-4 text-clay-text font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {act}
                      </td>
                      {roles.map(role => {
                        const granted = hasPermission(role, res, act);
                        return (
                          <td key={role} className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggle(role, res, act)}
                              disabled={!isAdmin || role === 'ADMIN'}
                              className={`w-6 h-6 rounded-lg font-bold text-xs inline-flex items-center justify-center transition-all ${
                                granted
                                  ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 hover:bg-slate-300'
                              } ${(!isAdmin || role === 'ADMIN') ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                            >
                              {granted ? '✓' : '—'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </ClayModal>
  );
};
