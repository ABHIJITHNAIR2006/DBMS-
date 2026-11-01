import React, { useState, useEffect } from 'react';
import { useSql } from '../db/useSql';
import { generateQrDataUrl } from '../services/qrService';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { Printer, QrCode } from 'lucide-react';

interface ItemQr {
  ItemID: string;
  ItemName: string;
  Category: string;
  StockQty: number;
}

export const QrLabelsPage: React.FC = () => {
  const { data: items } = useSql<ItemQr>(`
    SELECT ItemID, ItemName, Category, StockQty FROM V_CURRENT_STOCK ORDER BY ItemID ASC;
  `);

  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!items || items.length === 0) return;
    let cancelled = false;

    const generateAll = async () => {
      const map: Record<string, string> = {};
      for (const item of items) {
        try {
          const payload = JSON.stringify({ id: item.ItemID, name: item.ItemName, cat: item.Category });
          const url = await generateQrDataUrl(payload);
          if (!cancelled) map[item.ItemID] = url;
        } catch {
          // ignore error
        }
      }
      if (!cancelled) setQrCodes(map);
    };

    generateAll();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
              QR Inventory Label Sheets
            </h1>
            <ClayChip variant="primary" size="sm">
              3x8 PRINT MATRIX
            </ClayChip>
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Standard Avery 3×8 physical asset stickers with encoded ItemID and catalog specifications.
          </p>
        </div>

        <ClayButton
          variant="primary"
          size="md"
          icon={<Printer size={16} />}
          onClick={handlePrint}
        >
          Print Label Sheet (Ctrl+P)
        </ClayButton>
      </div>

      {/* 3x8 Sheet Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-3 print:gap-2">
        {(items || []).map(item => (
          <div
            key={item.ItemID}
            className="p-3.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-3 shadow-sm print:border-black print:shadow-none break-inside-avoid"
          >
            {qrCodes[item.ItemID] ? (
              <img
                src={qrCodes[item.ItemID]}
                alt={`QR code for ${item.ItemID}`}
                className="w-16 h-16 rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                <QrCode size={20} className="text-slate-400 animate-spin" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span className="font-mono font-bold text-xs text-indigo-600 dark:text-indigo-400 block">
                {item.ItemID}
              </span>
              <p className="font-bold text-xs text-clay-text truncate leading-tight">
                {item.ItemName}
              </p>
              <p className="text-[10px] text-clay-text-muted mt-0.5">
                {item.Category} • Stock: {item.StockQty}
              </p>
              <span className="text-[9px] font-mono text-slate-400 mt-1 block">
                K.K. Wagh Central Store
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
