import React, { useState, useEffect } from 'react';
import { sqlClient } from '../../db/client';
import { IntrospectResult, IntrospectTable } from '../../db/worker/types';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Table, Key, Link as LinkIcon, Eye, Code, Layers, FileText } from 'lucide-react';

export const SchemaBrowserTab: React.FC = () => {
  const [intro, setIntro] = useState<IntrospectResult | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string>('ITEM');
  const [subView, setSubView] = useState<'columns' | 'eer' | 'ddl' | 'preview'>('columns');
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [sampleCols, setSampleCols] = useState<string[]>([]);
  const [tableDdl, setTableDdl] = useState<string>('');

  useEffect(() => {
    (async () => {
      const res = await sqlClient.introspect();
      setIntro(res);
    })();
  }, []);

  const selectedTable: IntrospectTable | undefined = (intro?.tables || []).find(
    t => t.name === selectedTableName
  );

  useEffect(() => {
    if (!selectedTableName) return;
    (async () => {
      // Fetch DDL from sqlite_master
      const ddlRes = await sqlClient.exec(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name = ?;`,
        [selectedTableName],
        false
      );
      if (ddlRes.rows.length > 0) {
        setTableDdl((ddlRes.rows[0][0] as string) || '');
      }

      // Fetch sample preview rows
      const previewRes = await sqlClient.exec(
        `SELECT * FROM "${selectedTableName}" LIMIT 10;`,
        [],
        false
      );
      setSampleCols(previewRes.columns);
      setSampleRows(previewRes.rows);
    })();
  }, [selectedTableName]);

  return (
    <div className="space-y-6">
      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="clay-card p-4 text-center">
          <span className="text-[11px] font-bold text-clay-text-muted uppercase">Relational Tables</span>
          <p className="text-2xl font-bold font-display text-indigo-600 dark:text-indigo-400">
            {intro?.tables.length || 21}
          </p>
        </div>
        <div className="clay-card p-4 text-center">
          <span className="text-[11px] font-bold text-clay-text-muted uppercase">Database Views</span>
          <p className="text-2xl font-bold font-display text-emerald-600 dark:text-emerald-400">
            {intro?.views.length || 9}
          </p>
        </div>
        <div className="clay-card p-4 text-center">
          <span className="text-[11px] font-bold text-clay-text-muted uppercase">Active Triggers</span>
          <p className="text-2xl font-bold font-display text-amber-600 dark:text-amber-400">
            {intro?.triggers.length || 11}
          </p>
        </div>
        <div className="clay-card p-4 text-center">
          <span className="text-[11px] font-bold text-clay-text-muted uppercase">Secondary Indexes</span>
          <p className="text-2xl font-bold font-display text-purple-600 dark:text-purple-400">
            {intro?.indexes.length || 8}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Table Selector Sidebar */}
        <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          <span className="text-xs font-bold font-display uppercase tracking-wider text-clay-text-muted block px-1">
            Schema Entities ({intro?.tables.length || 21})
          </span>

          {(intro?.tables || []).map(tbl => {
            const isSelected = tbl.name === selectedTableName;
            return (
              <button
                key={tbl.name}
                onClick={() => setSelectedTableName(tbl.name)}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md font-bold'
                    : 'clay-card text-clay-text hover:text-indigo-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Table size={14} className={isSelected ? 'text-white' : 'text-indigo-500'} />
                  <span className="text-xs font-mono">{tbl.name}</span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                  isSelected ? 'bg-white/20 text-white' : 'clay-inset text-clay-text-muted'
                }`}>
                  {tbl.rowCount} rows
                </span>
              </button>
            );
          })}
        </div>

        {/* Entity Inspector Main Pane */}
        <div className="lg:col-span-3 space-y-4">
          {/* Sub Navigation */}
          <div className="flex items-center gap-2 pb-2 border-b border-clay-border">
            <button
              onClick={() => setSubView('columns')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                subView === 'columns' ? 'bg-indigo-600 text-white shadow-sm' : 'clay-card text-clay-text'
              }`}
            >
              Columns & Keys
            </button>
            <button
              onClick={() => setSubView('preview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                subView === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'clay-card text-clay-text'
              }`}
            >
              Data Preview ({selectedTable?.rowCount} rows)
            </button>
            <button
              onClick={() => setSubView('ddl')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                subView === 'ddl' ? 'bg-indigo-600 text-white shadow-sm' : 'clay-card text-clay-text'
              }`}
            >
              Raw DDL
            </button>
            <button
              onClick={() => setSubView('eer')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                subView === 'eer' ? 'bg-indigo-600 text-white shadow-sm' : 'clay-card text-clay-text'
              }`}
            >
              EER Diagram Map
            </button>
          </div>

          {/* SubView 1: Columns */}
          {subView === 'columns' && selectedTable && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-clay-border pb-3">
                <div>
                  <h3 className="text-base font-bold font-display text-clay-text flex items-center gap-2">
                    <Table size={16} className="text-indigo-500" />
                    Table: <span className="font-mono text-indigo-600">{selectedTable.name}</span>
                  </h3>
                  <p className="text-xs text-clay-text-muted mt-0.5">
                    Live introspected schema details via PRAGMA table_info & PRAGMA foreign_key_list
                  </p>
                </div>
                <ClayChip variant="outline" size="sm">
                  {selectedTable.rowCount} Total Records
                </ClayChip>
              </div>

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Column Name</th>
                      <th className="p-3">Data Type</th>
                      <th className="p-3">Primary Key</th>
                      <th className="p-3">Nullable</th>
                      <th className="p-3">Foreign Key Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border">
                    {selectedTable.columns.map(col => {
                      const fk = selectedTable.fks.find(f => f.from === col.name);
                      return (
                        <tr key={col.cid} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono text-clay-text-muted">{col.cid}</td>
                          <td className="p-3 font-mono font-bold text-clay-text flex items-center gap-1.5">
                            {col.pk ? <Key size={12} className="text-amber-500" /> : null}
                            {col.name}
                          </td>
                          <td className="p-3 font-mono text-indigo-600 dark:text-indigo-400">{col.type || 'ANY'}</td>
                          <td className="p-3">
                            {col.pk ? (
                              <ClayChip variant="warning" size="sm">PK #{col.pk}</ClayChip>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            {col.notnull ? (
                              <span className="font-bold text-rose-600">NOT NULL</span>
                            ) : (
                              <span className="text-clay-text-muted">NULL</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {fk ? (
                              <span className="text-indigo-600 font-semibold flex items-center gap-1">
                                <LinkIcon size={12} /> {fk.table}({fk.to})
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
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

          {/* SubView 2: Preview */}
          {subView === 'preview' && (
            <ClayCard className="p-6 space-y-4">
              <h3 className="text-sm font-bold font-display text-clay-text">
                First 10 Rows from {selectedTableName}
              </h3>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-clay-text font-bold sticky top-0">
                    <tr>
                      {sampleCols.map(col => (
                        <th key={col} className="p-3 whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-clay-border">
                    {sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        {row.map((val: any, cIdx: number) => (
                          <td key={cIdx} className="p-3 font-mono truncate max-w-xs whitespace-nowrap">
                            {val !== null && val !== undefined ? String(val) : <span className="italic text-slate-400">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ClayCard>
          )}

          {/* SubView 3: Raw DDL */}
          {subView === 'ddl' && (
            <ClayCard className="p-6 space-y-3">
              <h3 className="text-sm font-bold font-display text-clay-text">
                CREATE TABLE DDL Definition
              </h3>
              <pre className="p-4 rounded-2xl clay-inset font-mono text-xs text-clay-text whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {tableDdl}
              </pre>
            </ClayCard>
          )}

          {/* SubView 4: EER Diagram */}
          {subView === 'eer' && (
            <ClayCard className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-clay-border pb-3">
                <div>
                  <h3 className="text-base font-bold font-display text-clay-text">
                    Extended Entity-Relationship (EER) Conceptual Architecture
                  </h3>
                  <p className="text-xs text-clay-text-muted">
                    Formal representation of strong entities, weak entities, disjoint specialization, and multivalued attributes.
                  </p>
                </div>
                <ClayChip variant="primary" size="sm">CHEN NOTATION</ClayChip>
              </div>

              <div className="p-6 rounded-2xl clay-inset space-y-4 text-xs leading-relaxed text-clay-text">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl clay-card space-y-2">
                    <span className="font-bold font-display text-indigo-600 block">Strong Entities (Rectangles)</span>
                    <ul className="list-disc list-inside space-y-1 text-clay-text-muted">
                      <li><strong>ITEM</strong>: ItemID (PK, Underlined), ItemName, Category, UnitPrice.</li>
                      <li><strong>SUPPLIER</strong>: SupplierID (PK), SupplierName, Street, Pincode (FK).</li>
                      <li><strong>DEPARTMENT</strong>: DeptID (PK), DeptName (Unique).</li>
                      <li><strong>EMPLOYEE</strong>: EmpID (PK), EmpName, Designation, ManagerID (Self-FK).</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl clay-card space-y-2">
                    <span className="font-bold font-display text-purple-600 block">Weak Entities (Double Rectangles)</span>
                    <ul className="list-disc list-inside space-y-1 text-clay-text-muted">
                      <li><strong>STOCK_BATCH</strong>: Identifying relationship HAS_BATCH to ITEM. Partial key BatchNo.</li>
                      <li><strong>REQUISITION_LINE</strong>: Dependent weak entity of REQUISITION. Partial key LineNo.</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl clay-card space-y-2">
                    <span className="font-bold font-display text-emerald-600 block">Specialization / Is-a (Circle 'd')</span>
                    <ul className="list-disc list-inside space-y-1 text-clay-text-muted">
                      <li><strong>Disjoint Specialization ('d')</strong>: An item is strictly either Consumable OR Durable (enforced by triggers).</li>
                      <li><strong>CONSUMABLE_ITEM</strong>: ReorderLevel.</li>
                      <li><strong>DURABLE_ITEM</strong>: WarrantyPeriod (in months).</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-xl clay-card space-y-2">
                    <span className="font-bold font-display text-amber-600 block">Relationships & Derivations</span>
                    <ul className="list-disc list-inside space-y-1 text-clay-text-muted">
                      <li><strong>SUPPLIES (M:N)</strong>: Purchases linking SUPPLIER and ITEM with surrogate PurchaseID.</li>
                      <li><strong>ISSUED_TO (M:N)</strong>: Distributions linking ITEM, DEPARTMENT, and EMPLOYEE.</li>
                      <li><strong>StockQty</strong>: Dashed Oval (Derived Attribute = SUM(SUPPLIES.Qty) - SUM(ISSUED_TO.Qty)).</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ClayCard>
          )}
        </div>
      </div>
    </div>
  );
};
