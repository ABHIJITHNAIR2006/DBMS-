import React, { useState, useEffect } from 'react';
import { useDB } from '../db/store';
import { sqlClient } from '../db/client';
import { ClayCard } from '../components/clay/ClayCard';
import { ClayButton } from '../components/clay/ClayButton';
import { ClayChip } from '../components/clay/ClayChip';
import { Settings, RefreshCw, Sun, Moon, Database, Cpu, CheckCircle2, AlertTriangle, Trash2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, toggleTheme, resetDemoData, showToast, fireConfetti } = useDB();
  const [orgName, setOrgName] = useState(() => {
    return localStorage.getItem('claystock_org_name') || 'K.K. Wagh Institute of Engineering Education & Research, Nashik';
  });

  const [aiStatus, setAiStatus] = useState<{ available: boolean; model: string } | null>(null);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  useEffect(() => {
    checkAiStatus();
    measureDbLatency();
  }, []);

  const checkAiStatus = async () => {
    setIsCheckingAi(true);
    try {
      const res = await fetch('/api/gemini/status');
      const data = await res.json();
      setAiStatus(data);
    } catch {
      setAiStatus({ available: false, model: 'unknown' });
    } finally {
      setIsCheckingAi(false);
    }
  };

  const measureDbLatency = async () => {
    const start = performance.now();
    await sqlClient.exec('SELECT 1;', [], false);
    setLatencyMs(Math.round((performance.now() - start) * 10) / 10);
  };

  const handleSaveOrg = () => {
    localStorage.setItem('claystock_org_name', orgName);
    showToast({
      title: 'Settings Saved',
      description: 'Organization name updated for all Purchase Orders and Issue Slips.',
      type: 'success'
    });
  };

  const handleClearAuditLog = async () => {
    try {
      await sqlClient.exec('DELETE FROM AUDIT_LOG;');
      showToast({
        title: 'Audit Log Truncated',
        description: 'All historical AUDIT_LOG records have been cleared.',
        type: 'info'
      });
    } catch (err: any) {
      showToast({
        title: 'Error',
        description: err?.message || 'Could not truncate audit log',
        type: 'error'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
            System & Engine Settings
          </h1>
          <ClayChip variant="outline" size="sm">
            v2.0 RELATIONAL
          </ClayChip>
        </div>
        <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
          Configure institutional metadata, appearance, seed state, and verify SQLite WebAssembly engine health.
        </p>
      </div>

      {/* Engine Status Banner */}
      <ClayCard className="p-6 space-y-4">
        <h3 className="text-base font-bold font-display text-clay-text flex items-center gap-2">
          <Cpu size={18} className="text-indigo-500" />
          Engine Diagnostics & Health
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl clay-inset space-y-1">
            <span className="text-[11px] text-clay-text-muted uppercase font-bold tracking-wider">Engine Core</span>
            <p className="text-sm font-bold text-clay-text">SQLite 3 (WASM Worker)</p>
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={10} /> Zero Main-Thread SQL
            </span>
          </div>

          <div className="p-4 rounded-2xl clay-inset space-y-1">
            <span className="text-[11px] text-clay-text-muted uppercase font-bold tracking-wider">Worker RPC Latency</span>
            <p className="text-sm font-bold text-clay-text">{latencyMs !== null ? `${latencyMs} ms` : 'Measuring...'}</p>
            <span className="text-[10px] text-clay-text-muted">postMessage roundtrip</span>
          </div>

          <div className="p-4 rounded-2xl clay-inset space-y-1">
            <span className="text-[11px] text-clay-text-muted uppercase font-bold tracking-wider">AI Gemini Status</span>
            <p className="text-sm font-bold text-clay-text">
              {aiStatus?.available ? 'Available' : 'Unconfigured'}
            </p>
            <span className="text-[10px] text-clay-text-muted font-mono">{aiStatus?.model}</span>
          </div>
        </div>
      </ClayCard>

      {/* Institutional Metadata */}
      <ClayCard className="p-6 space-y-4">
        <h3 className="text-base font-bold font-display text-clay-text">
          Institutional Organization Profile
        </h3>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-clay-text">Institute Name (Appears on A4 PDFs)</label>
          <input
            type="text"
            value={orgName}
            onChange={e => setOrgName(e.target.value)}
            className="w-full clay-inset p-3 rounded-2xl text-xs text-clay-text font-medium"
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-clay-text-muted italic">
            Dataset Notice: All catalog items, employee hierarchies, and vendors are fictional demo data.
          </span>
          <ClayButton variant="primary" size="sm" onClick={handleSaveOrg}>
            Save Changes
          </ClayButton>
        </div>
      </ClayCard>

      {/* Appearance & Theme */}
      <ClayCard className="p-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold font-display text-clay-text">
            Interface Theme
          </h3>
          <p className="text-xs text-clay-text-muted">
            Toggle high-contrast claymorphism light and dark aesthetic mode.
          </p>
        </div>

        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl clay-card text-xs font-bold text-clay-text hover:text-indigo-600 transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
          <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
        </button>
      </ClayCard>

      {/* Data Management & Seed Reset */}
      <ClayCard className="p-6 space-y-4 border border-rose-200 dark:border-rose-900/40">
        <div>
          <h3 className="text-base font-bold font-display text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle size={16} />
            Data Maintenance & Reset Actions
          </h3>
          <p className="text-xs text-clay-text-muted mt-1">
            Restores the database to the deterministic competition baseline or flushes operational audit logs.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <ClayButton
            variant="outline"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={resetDemoData}
            className="w-full sm:w-auto"
          >
            Reset All 21 Tables to Seed
          </ClayButton>

          <ClayButton
            variant="outline"
            size="sm"
            icon={<Trash2 size={14} />}
            onClick={handleClearAuditLog}
            className="w-full sm:w-auto text-rose-600"
          >
            Clear Audit Log Only
          </ClayButton>
        </div>
      </ClayCard>
    </div>
  );
};
