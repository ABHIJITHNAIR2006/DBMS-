import React, { useState } from 'react';
import { useDB, DEMO_ACCOUNTS, DemoAccount } from '../../db/store';
import {
  Search,
  Sun,
  Moon,
  Sparkles,
  Command,
  Database,
  RefreshCw,
  Bell,
  Presentation,
  Key,
  FileDown,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { ClayButton } from '../clay/ClayButton';
import { ClayChip } from '../clay/ClayChip';
import { AlertsModal } from '../modals/AlertsModal';
import { PermissionMatrixModal } from '../modals/PermissionMatrixModal';
import { downloadDossierMarkdown } from '../../services/dossierService';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onOpenAIAssistant: () => void;
  onStartTour: () => void;
  onOpenPresentMode: () => void;
  onOpenPurchaseWithItem: (itemId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCommandPalette,
  onOpenAIAssistant,
  onStartTour,
  onOpenPresentMode,
  onOpenPurchaseWithItem
}) => {
  const { theme, toggleTheme, resetDemoData, currentUser, switchUser, openAlertsCount, showToast } = useDB();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [permMatrixOpen, setPermMatrixOpen] = useState(false);

  const handleExportDossier = () => {
    const org = localStorage.getItem('claystock_org_name') || 'K.K. Wagh Institute of Engineering Education & Research, Nashik';
    downloadDossierMarkdown(org);
    showToast({
      title: 'Project Dossier Exported',
      description: 'Comprehensive technical Markdown dossier compiled.',
      type: 'success'
    });
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md border-b border-clay-border transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand / Logo */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-3 cursor-pointer group select-none shrink-0"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-400 p-0.5 clay-card flex items-center justify-center transform group-hover:scale-105 transition-transform">
              <span className="text-white font-display font-extrabold text-lg">C</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-xl sm:text-2xl text-clay-text tracking-tight">
                  Clay<span className="text-indigo-600 dark:text-indigo-400">Stock</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  21-TABLE 3NF
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-clay-text-muted font-medium">
                Stationery Management System • K.K. Wagh Institute
              </p>
            </div>
          </div>

          {/* Quick Search */}
          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-2">
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="w-full clay-inset px-3 py-1.5 flex items-center justify-between text-xs text-clay-text-muted hover:text-clay-text transition-colors cursor-pointer rounded-2xl"
            >
              <div className="flex items-center gap-2">
                <Search size={13} className="text-clay-text-muted" />
                <span>Search catalog, tables...</span>
              </div>
              <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-mono bg-white dark:bg-slate-800 rounded border border-clay-border text-clay-text-muted">
                <Command size={9} /> K
              </kbd>
            </button>
          </div>

          {/* Center Action Controls */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Present Mode Button (Ctrl+Shift+P) */}
            <button
              onClick={onOpenPresentMode}
              title="Launch 7-Step Competition Presentation Mode"
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm hover:from-amber-600 hover:to-orange-600"
            >
              <Presentation size={14} />
              <span className="hidden sm:inline">Present Mode</span>
            </button>

            {/* Quick Role Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="px-3 py-1.5 rounded-full text-xs font-bold clay-card text-clay-text hover:text-indigo-600 flex items-center gap-1.5 cursor-pointer"
                title="Switch Demo User & Role"
              >
                <UserCheck size={14} className="text-indigo-600" />
                <span className="font-mono text-[11px] font-bold">{currentUser.role}</span>
                <ChevronDown size={12} className="text-clay-text-muted" />
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl clay-card shadow-xl p-2 z-50 animate-in fade-in space-y-1">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-clay-text-muted uppercase tracking-wider border-b border-clay-border">
                    Quick Switch Demo Account (6 Roles):
                  </div>
                  {DEMO_ACCOUNTS.map(acc => {
                    const isCur = acc.userId === currentUser.userId;
                    return (
                      <button
                        key={acc.userId}
                        onClick={() => {
                          switchUser(acc);
                          setRoleMenuOpen(false);
                        }}
                        className={`w-full p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                          isCur
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-clay-text'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold">{acc.name}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isCur ? 'bg-white/20' : 'clay-inset text-clay-text-muted'
                          }`}>
                            {acc.role}
                          </span>
                        </div>
                        <span className={`text-[10px] block mt-0.5 ${isCur ? 'text-white/80' : 'text-clay-text-muted'}`}>
                          {acc.designation} ({acc.dept})
                        </span>
                      </button>
                    );
                  })}

                  <div className="pt-1 border-t border-clay-border">
                    <button
                      onClick={() => {
                        setRoleMenuOpen(false);
                        setPermMatrixOpen(true);
                      }}
                      className="w-full p-1.5 text-center text-[11px] font-bold text-indigo-600 hover:underline flex items-center justify-center gap-1"
                    >
                      <Key size={12} /> Live Permission Matrix
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Live Alerts Bell */}
            <button
              onClick={() => setAlertsModalOpen(true)}
              title="Open Live Alerts Center"
              className="relative w-8 h-8 rounded-full clay-icon-circle bg-clay-surface text-clay-text hover:text-amber-600 transition-colors flex items-center justify-center cursor-pointer"
            >
              <Bell size={15} />
              {openAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {openAlertsCount}
                </span>
              )}
            </button>

            {/* Dossier Export */}
            <button
              onClick={handleExportDossier}
              title="Export Technical Project Dossier (Markdown Report)"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-clay-text px-2.5 py-1.5 rounded-full clay-card hover:text-indigo-600 transition-colors cursor-pointer"
            >
              <FileDown size={13} />
              <span className="hidden md:inline">Dossier</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-12 h-7 rounded-full clay-inset p-0.5 relative flex items-center cursor-pointer transition-colors"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-gradient-to-tr ${
                  theme === 'light'
                    ? 'from-amber-400 to-yellow-300 text-amber-900 translate-x-0'
                    : 'from-indigo-400 to-purple-400 text-slate-900 translate-x-5'
                } shadow-md transition-transform duration-300 flex items-center justify-center`}
              >
                {theme === 'light' ? <Sun size={11} strokeWidth={2.5} /> : <Moon size={11} strokeWidth={2.5} />}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <AlertsModal
        isOpen={alertsModalOpen}
        onClose={() => setAlertsModalOpen(false)}
        onOpenPurchase={onOpenPurchaseWithItem}
      />

      <PermissionMatrixModal
        isOpen={permMatrixOpen}
        onClose={() => setPermMatrixOpen(false)}
      />
    </>
  );
};
