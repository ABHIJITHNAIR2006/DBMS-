import React, { useState, useEffect } from 'react';
import { sqlClient } from '../../db/client';
import { saveNamedSnapshot, loadNamedSnapshot, listSnapshots, deleteSnapshot, DbSnapshotMeta } from '../../db/persistence';
import { useDB } from '../../db/store';
import { ClayCard } from '../../components/clay/ClayCard';
import { ClayButton } from '../../components/clay/ClayButton';
import { ClayChip } from '../../components/clay/ClayChip';
import { Download, Upload, Database, Camera, Trash2, RotateCcw, FileCode } from 'lucide-react';

export const BackupRestoreTab: React.FC = () => {
  const { showToast, resetDemoData, fireConfetti } = useDB();
  const [snapshots, setSnapshots] = useState<DbSnapshotMeta[]>([]);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [isExportingSql, setIsExportingSql] = useState(false);

  const refreshSnapshots = async () => {
    const list = await listSnapshots();
    setSnapshots(list);
  };

  useEffect(() => {
    refreshSnapshots();
  }, []);

  const handleDownloadSqlite = async () => {
    try {
      const bytes = await sqlClient.exportDb();
      const blob = new Blob([bytes as any], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claystock_${Date.now()}.sqlite`;
      a.click();
      URL.revokeObjectURL(url);
      showToast({
        title: 'SQLite Database Downloaded',
        description: 'File is ready to open in DB Browser for SQLite or any standard SQLite CLI.',
        type: 'success'
      });
    } catch (err: any) {
      showToast({ title: 'Export Error', description: err?.message, type: 'error' });
    }
  };

  const handleUploadSqlite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuf = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      const intro = await sqlClient.importDb(bytes);
      showToast({
        title: 'Database Restored Successfully',
        description: `Imported ${intro.tables.length} tables from ${file.name}.`,
        type: 'success'
      });
      fireConfetti();
    } catch (err: any) {
      showToast({
        title: 'Import Failed',
        description: err?.message || 'Invalid SQLite file header',
        type: 'error'
      });
    }
  };

  const handleCreateSnapshot = async () => {
    const name = newSnapshotName.trim() || `Snapshot_${new Date().toLocaleTimeString().replace(/\s/g, '_')}`;
    try {
      const bytes = await sqlClient.exportDb();
      await saveNamedSnapshot(name, bytes);
      setNewSnapshotName('');
      showToast({ title: 'Named Snapshot Saved', description: `Saved "${name}" to IndexedDB.`, type: 'success' });
      refreshSnapshots();
    } catch (err: any) {
      showToast({ title: 'Snapshot Error', description: err?.message, type: 'error' });
    }
  };

  const handleRestoreSnapshot = async (name: string) => {
    try {
      const bytes = await loadNamedSnapshot(name);
      if (!bytes) throw new Error('Snapshot not found in storage');
      await sqlClient.importDb(bytes);
      showToast({ title: 'Snapshot Restored', description: `Loaded "${name}" into SQLite engine.`, type: 'success' });
      fireConfetti();
    } catch (err: any) {
      showToast({ title: 'Restore Error', description: err?.message, type: 'error' });
    }
  };

  const handleDeleteSnapshot = async (name: string) => {
    await deleteSnapshot(name);
    refreshSnapshots();
  };

  const handleExportFullSqlDump = async () => {
    setIsExportingSql(true);
    try {
      const intro = await sqlClient.introspect();
      const lines: string[] = [
        '-- ========================================================',
        '-- ClayStock Relational Database Full SQL Dump',
        `-- Generated At: ${new Date().toISOString()}`,
        '-- Engine: SQLite 3 Compatible',
        '-- ========================================================',
        'PRAGMA foreign_keys = OFF;',
        'BEGIN TRANSACTION;'
      ];

      for (const tbl of intro.tables) {
        // Get DDL
        const ddlRes = await sqlClient.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name = ?;`, [tbl.name], false);
        if (ddlRes.rows.length > 0) {
          lines.push(`\n-- Table: ${tbl.name}`);
          lines.push(`${ddlRes.rows[0][0]};`);
        }

        // Get Rows
        const dataRes = await sqlClient.exec(`SELECT * FROM "${tbl.name}";`, [], false);
        for (const row of dataRes.rows) {
          const values = row.map(v => (v === null ? 'NULL' : typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`));
          lines.push(`INSERT INTO "${tbl.name}" VALUES (${values.join(', ')});`);
        }
      }

      lines.push('\nCOMMIT;', 'PRAGMA foreign_keys = ON;');

      const fullDump = lines.join('\n');
      const blob = new Blob([fullDump], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `claystock_full_dump_${Date.now()}.sql`;
      a.click();
      URL.revokeObjectURL(url);

      showToast({
        title: 'Full SQL Dump Generated',
        description: 'All 21 tables DDL and INSERT statements compiled to .sql file.',
        type: 'success'
      });
    } catch (err: any) {
      showToast({ title: 'Dump Failed', description: err?.message, type: 'error' });
    } finally {
      setIsExportingSql(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Download / Upload Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-indigo-600" />
            <h3 className="text-base font-bold font-display text-clay-text">
              Export Database Artifacts
            </h3>
          </div>
          <p className="text-xs text-clay-text-muted leading-relaxed">
            Download the binary SQLite file for external inspection in DB Browser for SQLite, or generate an ANSI-standard .sql dump file.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <ClayButton variant="primary" size="md" icon={<Download size={14} />} onClick={handleDownloadSqlite} className="w-full sm:w-auto">
              Download .sqlite File
            </ClayButton>

            <ClayButton variant="outline" size="md" icon={<FileCode size={14} />} onClick={handleExportFullSqlDump} disabled={isExportingSql} className="w-full sm:w-auto">
              {isExportingSql ? 'Generating...' : 'Export Full .sql Dump'}
            </ClayButton>
          </div>
        </ClayCard>

        <ClayCard className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={20} className="text-purple-600" />
            <h3 className="text-base font-bold font-display text-clay-text">
              Import & Restore .sqlite
            </h3>
          </div>
          <p className="text-xs text-clay-text-muted leading-relaxed">
            Upload an existing .sqlite file. The worker re-initializes and validates user_version and foreign key pragmas.
          </p>

          <label className="flex items-center justify-center p-4 border-2 border-dashed border-clay-border rounded-2xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
            <input type="file" accept=".sqlite,.db,.sqlite3" onChange={handleUploadSqlite} className="hidden" />
            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
              Select or Drop .sqlite File to Restore
            </span>
          </label>
        </ClayCard>
      </div>

      {/* Named Snapshots in IndexedDB */}
      <ClayCard className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-clay-border pb-3">
          <div>
            <h3 className="text-base font-bold font-display text-clay-text flex items-center gap-2">
              <Camera size={18} className="text-indigo-500" />
              IndexedDB Named Savepoints & Snapshots
            </h3>
            <p className="text-xs text-clay-text-muted">
              Capture frozen states of the database in browser IndexedDB before testing complex operations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Snapshot name..."
              value={newSnapshotName}
              onChange={e => setNewSnapshotName(e.target.value)}
              className="clay-inset p-2 rounded-xl text-xs text-clay-text font-medium"
            />
            <ClayButton variant="primary" size="sm" onClick={handleCreateSnapshot}>
              Create Snapshot
            </ClayButton>
          </div>
        </div>

        <div className="space-y-3">
          {snapshots.map(s => (
            <div key={s.name} className="p-3.5 rounded-2xl clay-card flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-clay-text">{s.name}</span>
                <span className="text-[10px] text-clay-text-muted block mt-0.5">
                  Captured: {s.createdAt} • Size: {Math.round(s.sizeBytes / 1024)} KB
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestoreSnapshot(s.name)}
                  className="px-2.5 py-1 rounded-xl clay-inset text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  onClick={() => handleDeleteSnapshot(s.name)}
                  className="p-1 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {snapshots.length === 0 && (
            <p className="text-xs text-clay-text-muted text-center py-4 italic">
              No named snapshots saved in IndexedDB yet.
            </p>
          )}
        </div>
      </ClayCard>
    </div>
  );
};
