import React from 'react';
import { useDB } from '../../db/store';
import { Search, Sun, Moon, Sparkles, Command, Database, RefreshCw } from 'lucide-react';
import { ClayButton } from '../clay/ClayButton';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenCommandPalette: () => void;
  onOpenAIAssistant: () => void;
  onStartTour: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenCommandPalette,
  onOpenAIAssistant,
  onStartTour
}) => {
  const { theme, toggleTheme, resetDemoData } = useDB();

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md border-b border-clay-border transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-400 p-0.5 clay-card flex items-center justify-center transform group-hover:scale-105 transition-transform">
            <span className="text-white font-display font-extrabold text-xl">C</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl sm:text-2xl text-clay-text tracking-tight">
                Clay<span className="text-indigo-600 dark:text-indigo-400">Stock</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                DBMS 3NF
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-clay-text-muted font-medium">
              Stationery Relational Management System
            </p>
          </div>
        </div>

        {/* Global Search Bar (Trigger Cmd+K) */}
        <div className="hidden md:flex items-center flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full clay-inset px-4 py-2 flex items-center justify-between text-xs text-clay-text-muted hover:text-clay-text transition-colors cursor-pointer rounded-2xl"
          >
            <div className="flex items-center gap-2">
              <Search size={14} className="text-clay-text-muted" />
              <span>Search stationery, modules, or run queries...</span>
            </div>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-800 rounded-md border border-clay-border text-clay-text-muted">
              <Command size={10} /> K
            </kbd>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Guided Tour Button */}
          <button
            onClick={onStartTour}
            title="Start DBMS Walkthrough Tour"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-clay-text px-3 py-1.5 rounded-full clay-card hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <span>🧭 Tour</span>
          </button>

          {/* Database Lab Shortcut */}
          <button
            onClick={() => setActiveTab('database-lab')}
            title="Open Database Lab (Schema, ER, 3NF, SQL)"
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'database-lab'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'clay-card text-clay-text hover:text-indigo-600 dark:hover:text-indigo-400'
            }`}
          >
            <Database size={14} />
            <span className="hidden md:inline">DB Lab</span>
          </button>

          {/* AI Assistant Button */}
          <ClayButton
            variant="primary"
            size="sm"
            onClick={onOpenAIAssistant}
            icon={<Sparkles size={14} />}
            className="hidden sm:inline-flex shadow-sm"
          >
            AI Assistant
          </ClayButton>

          {/* Reset Demo Data Button */}
          <button
            onClick={resetDemoData}
            title="Reset All 10 Relational Tables to Initial 3NF Demo Data"
            className="w-9 h-9 rounded-full clay-icon-circle bg-clay-surface hover:text-amber-600 text-clay-text-muted transition-colors flex items-center justify-center cursor-pointer"
            aria-label="Reset demo data"
          >
            <RefreshCw size={15} />
          </button>

          {/* Clay Theme Toggle Switch */}
          <button
            onClick={toggleTheme}
            className="w-14 h-8 rounded-full clay-inset p-1 relative flex items-center cursor-pointer transition-colors"
            title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            aria-label="Toggle theme"
          >
            <div
              className={`w-6 h-6 rounded-full bg-gradient-to-tr ${
                theme === 'light'
                  ? 'from-amber-400 to-yellow-300 text-amber-900 translate-x-0'
                  : 'from-indigo-400 to-purple-400 text-slate-900 translate-x-6'
              } shadow-md transition-transform duration-300 flex items-center justify-center`}
            >
              {theme === 'light' ? <Sun size={13} strokeWidth={2.5} /> : <Moon size={13} strokeWidth={2.5} />}
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
