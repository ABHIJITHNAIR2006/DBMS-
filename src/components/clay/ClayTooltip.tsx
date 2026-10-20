import React, { useState } from 'react';
import { Info } from 'lucide-react';

export interface ClayTooltipProps {
  concept: string; // e.g. "Derived Attribute", "Foreign Key ON DELETE RESTRICT", "Weak Entity"
  explanation: string;
  children?: React.ReactNode;
}

export const ClayTooltip: React.FC<ClayTooltipProps> = ({ concept, explanation, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center align-middle ml-1">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={() => setIsOpen(prev => !prev)}
        className="w-4 h-4 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-600 dark:text-indigo-400 inline-flex items-center justify-center cursor-help transition-colors"
        aria-label={`DBMS concept: ${concept}`}
      >
        {children || <Info size={11} strokeWidth={2.5} />}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-2xl shadow-xl text-left pointer-events-none"
        >
          <div className="flex items-center gap-1.5 mb-1 text-indigo-600 dark:text-indigo-400 font-display font-bold text-xs uppercase tracking-wide">
            <span>🎓 DBMS Viva Concept</span>
          </div>
          <div className="font-bold text-xs text-clay-text mb-0.5">{concept}</div>
          <div className="text-[11px] leading-relaxed text-clay-text-muted">{explanation}</div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-slate-900 border-r border-b border-indigo-200 dark:border-indigo-800 rotate-45" />
        </div>
      )}
    </span>
  );
};
