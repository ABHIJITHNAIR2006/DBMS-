import React from 'react';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Send,
  Search,
  Users,
  Database,
  Sparkles
} from 'lucide-react';

interface SidebarDockProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: '' },
  { id: 'items', label: 'Items (M1)', icon: Package, badge: 'M1' },
  { id: 'stock', label: 'Stock (M2)', icon: Layers, badge: 'M2' },
  { id: 'purchases', label: 'Purchases (M3)', icon: ShoppingCart, badge: 'M3' },
  { id: 'issues', label: 'Issues (M4)', icon: Send, badge: 'M4' },
  { id: 'search', label: 'Search (M5)', icon: Search, badge: 'M5' },
  { id: 'suppliers', label: 'Suppliers & Depts', icon: Users, badge: '' },
  { id: 'database-lab', label: 'Database Lab', icon: Database, badge: '3NF' },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, badge: 'AI' }
];

export const SidebarDock: React.FC<SidebarDockProps> = ({ activeTab, setActiveTab }) => {
  return (
    <>
      {/* Desktop Floating Clay Dock (Fixed Left Center) */}
      <aside className="hidden lg:flex fixed left-5 top-1/2 -translate-y-1/2 z-40 flex-col gap-2 p-2.5 clay-card rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-2xl max-h-[92vh] overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ scale: 1.08, x: 4 }}
              whileTap={{ scale: 0.95 }}
              className={`relative flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer select-none group text-left ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg'
                  : 'text-clay-text-muted hover:text-clay-text hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
              title={item.label}
              aria-label={item.label}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'group-hover:text-indigo-500'} />
              <span className="font-display font-semibold text-xs tracking-wide pr-2 whitespace-nowrap">
                {item.label}
              </span>
              {item.badge && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </motion.button>
          );
        })}
      </aside>

      {/* Mobile Floating Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-3 left-3 right-3 z-40 clay-card p-2 rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl flex items-center justify-around overflow-x-auto">
        {NAV_ITEMS.slice(0, 7).map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all cursor-pointer min-w-[50px] ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-clay-text-muted hover:text-clay-text'
              }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${
                  isActive ? 'bg-indigo-100 dark:bg-indigo-950/80 shadow-xs' : ''
                }`}
              >
                <Icon size={18} />
              </div>
              <span className="text-[10px] font-display font-medium truncate max-w-[58px]">
                {item.id === 'dashboard' ? 'Home' : item.badge || item.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
