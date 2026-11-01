import React from 'react';
import { useSql } from '../../db/useSql';
import { sqlClient } from '../../db/client';
import { useDB } from '../../db/store';
import { ClayModal } from '../clay/ClayModal';
import { ClayButton } from '../clay/ClayButton';
import { ClayChip } from '../clay/ClayChip';
import { Bell, Check, ShoppingCart, AlertTriangle, AlertCircle, Clock } from 'lucide-react';

interface AlertRow {
  AlertID: string;
  ItemID: string;
  ItemName: string;
  Category: string;
  AlertType: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'EXPIRING' | 'PRICE_VARIANCE';
  Message: string;
  CreatedAt: string;
  ResolvedAt?: string | null;
}

interface AlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPurchase: (itemId: string) => void;
}

export const AlertsModal: React.FC<AlertsModalProps> = ({ isOpen, onClose, onOpenPurchase }) => {
  const { showToast, refreshMetrics } = useDB();

  const { data: alerts, refetch } = useSql<AlertRow>(`
    SELECT 
      a.AlertID,
      a.ItemID,
      i.ItemName,
      i.Category,
      a.AlertType,
      a.Message,
      a.CreatedAt,
      a.ResolvedAt
    FROM ALERT a
    JOIN ITEM i ON a.ItemID = i.ItemID
    ORDER BY a.ResolvedAt IS NOT NULL, a.CreatedAt DESC;
  `, [], [isOpen], { enabled: isOpen });

  const handleResolve = async (alertId: string) => {
    try {
      await sqlClient.exec(
        `UPDATE ALERT SET ResolvedAt = datetime('now') WHERE AlertID = ?;`,
        [alertId]
      );
      showToast({
        title: 'Alert Resolved',
        description: `Alert ${alertId} marked as resolved.`,
        type: 'success'
      });
      refetch();
      refreshMetrics();
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Could not resolve alert',
        type: 'error'
      });
    }
  };

  return (
    <ClayModal isOpen={isOpen} onClose={onClose} title="Live Alerts Center">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
          <Bell size={16} />
          <span>
            Automated alerts dispatched in real-time by database triggers (trg_issue_alert, trg_price_variance).
          </span>
        </div>

        <div className="space-y-3">
          {(alerts || []).map(al => {
            const isResolved = Boolean(al.ResolvedAt);
            let chip: any = 'warning';
            let Icon = AlertTriangle;

            if (al.AlertType === 'OUT_OF_STOCK') {
              chip = 'danger';
              Icon = AlertCircle;
            } else if (al.AlertType === 'EXPIRING') {
              chip = 'primary';
              Icon = Clock;
            } else if (al.AlertType === 'PRICE_VARIANCE') {
              chip = 'outline';
              Icon = AlertTriangle;
            }

            return (
              <div
                key={al.AlertID}
                className={`p-4 rounded-2xl border transition-all ${
                  isResolved
                    ? 'border-clay-border bg-slate-50/50 dark:bg-slate-800/30 opacity-60'
                    : 'border-clay-border bg-white dark:bg-slate-900 shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={isResolved ? 'text-slate-400' : 'text-indigo-600'} />
                    <span className="font-mono text-xs font-bold text-clay-text">{al.ItemID}</span>
                    <ClayChip variant={chip} size="sm">
                      {al.AlertType.replace(/_/g, ' ')}
                    </ClayChip>
                  </div>

                  <span className="text-[10px] text-clay-text-muted">{al.CreatedAt}</span>
                </div>

                <p className="text-xs font-semibold text-clay-text mt-2">{al.ItemName}</p>
                <p className="text-xs text-clay-text-muted mt-0.5">{al.Message}</p>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-clay-border text-xs">
                  <span className="text-[11px] text-clay-text-muted">
                    {isResolved ? `Resolved on ${al.ResolvedAt}` : 'Open Issue'}
                  </span>

                  {!isResolved && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          onOpenPurchase(al.ItemID);
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-xl clay-card text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        <ShoppingCart size={12} /> Restock
                      </button>

                      <button
                        onClick={() => handleResolve(al.AlertID)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 hover:bg-emerald-700"
                      >
                        <Check size={12} /> Resolve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {(alerts || []).length === 0 && (
            <div className="clay-card p-8 text-center text-xs text-clay-text-muted italic">
              No active alerts. All inventory thresholds healthy.
            </div>
          )}
        </div>
      </div>
    </ClayModal>
  );
};
