import React, { useState, Suspense } from 'react';
import { ClayChip } from '../components/clay/ClayChip';
import {
  Database,
  Terminal,
  BookOpen,
  Zap,
  Layers,
  GitBranch,
  ShieldCheck,
  Save,
  CheckCircle2,
  Trophy,
  Activity,
  Map
} from 'lucide-react';

const SchemaBrowserTab = React.lazy(() => import('./lab/SchemaBrowserTab').then(m => ({ default: m.SchemaBrowserTab })));
const WorkbenchTab = React.lazy(() => import('./lab/WorkbenchTab').then(m => ({ default: m.WorkbenchTab })));
const QueryLibraryTab = React.lazy(() => import('./lab/QueryLibraryTab').then(m => ({ default: m.QueryLibraryTab })));
const IndexLabTab = React.lazy(() => import('./lab/IndexLabTab').then(m => ({ default: m.IndexLabTab })));
const NormalizationLabTab = React.lazy(() => import('./lab/NormalizationLabTab').then(m => ({ default: m.NormalizationLabTab })));
const RelationalAlgebraTab = React.lazy(() => import('./lab/RelationalAlgebraTab').then(m => ({ default: m.RelationalAlgebraTab })));
const AcidLabTab = React.lazy(() => import('./lab/AcidLabTab').then(m => ({ default: m.AcidLabTab })));
const BackupRestoreTab = React.lazy(() => import('./lab/BackupRestoreTab').then(m => ({ default: m.BackupRestoreTab })));
const SelfTestTab = React.lazy(() => import('./lab/SelfTestTab').then(m => ({ default: m.SelfTestTab })));
const PracticeArenaTab = React.lazy(() => import('./lab/PracticeArenaTab').then(m => ({ default: m.PracticeArenaTab })));
const TriggersGalleryTab = React.lazy(() => import('./lab/TriggersGalleryTab').then(m => ({ default: m.TriggersGalleryTab })));
const ConceptMapTab = React.lazy(() => import('./lab/ConceptMapTab').then(m => ({ default: m.ConceptMapTab })));

const TabLoadingFallback = () => (
  <div className="w-full min-h-[300px] flex items-center justify-center p-8">
    <div className="clay-card p-6 flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-3 border-indigo-400 border-t-transparent animate-spin" />
      <span className="text-xs font-semibold text-clay-text-muted">Loading Database Lab Workspace...</span>
    </div>
  </div>
);

export const DatabaseLabPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('schema');

  const tabs = [
    { id: 'schema', label: 'Schema Browser', icon: Database },
    { id: 'workbench', label: 'SQL Workbench', icon: Terminal },
    { id: 'library', label: '42 Query Library', icon: BookOpen },
    { id: 'indexlab', label: 'Index Optimizer (50k)', icon: Zap },
    { id: 'normalization', label: 'Normalization & FDs', icon: Layers },
    { id: 'relational', label: 'Relational Algebra', icon: GitBranch },
    { id: 'acid', label: 'ACID & Concurrency', icon: ShieldCheck },
    { id: 'backup', label: 'Backup & Restore', icon: Save },
    { id: 'selftest', label: 'Self-Tests (25/25)', icon: CheckCircle2, badge: '25/25' },
    { id: 'practice', label: 'Practice Arena', icon: Trophy },
    { id: 'triggers', label: 'Triggers Gallery', icon: Activity },
    { id: 'concepts', label: 'Concept Map', icon: Map }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-clay-text tracking-tight">
              The Database Lab Workspace
            </h1>
            <ClayChip variant="primary" size="sm">
              ENGINEERING EDITION
            </ClayChip>
          </div>
          <p className="text-xs sm:text-sm text-clay-text-muted mt-1">
            Empirical relational theory laboratory: schemas, index optimizer benchmarks, 2NF/3NF/BCNF solver, and ACID proofs.
          </p>
        </div>
      </div>

      {/* Tabs Navigation Strip */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-clay-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'clay-card text-clay-text hover:text-indigo-600'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <Suspense fallback={<TabLoadingFallback />}>
        {activeTab === 'schema' && <SchemaBrowserTab />}
        {activeTab === 'workbench' && <WorkbenchTab />}
        {activeTab === 'library' && <QueryLibraryTab />}
        {activeTab === 'indexlab' && <IndexLabTab />}
        {activeTab === 'normalization' && <NormalizationLabTab />}
        {activeTab === 'relational' && <RelationalAlgebraTab />}
        {activeTab === 'acid' && <AcidLabTab />}
        {activeTab === 'backup' && <BackupRestoreTab />}
        {activeTab === 'selftest' && <SelfTestTab />}
        {activeTab === 'practice' && <PracticeArenaTab />}
        {activeTab === 'triggers' && <TriggersGalleryTab />}
        {activeTab === 'concepts' && <ConceptMapTab onNavigateSubTab={(tab) => setActiveTab(tab)} />}
      </Suspense>
    </div>
  );
};
