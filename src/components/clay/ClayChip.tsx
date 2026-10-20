import React from 'react';

export interface ClayChipProps {
  label: string;
  variant?: 'periwinkle' | 'mint' | 'peach' | 'sunshine' | 'rose' | 'muted';
  icon?: React.ReactNode;
  onRemove?: () => void;
  className?: string;
}

export const ClayChip: React.FC<ClayChipProps> = ({
  label,
  variant = 'periwinkle',
  icon,
  onRemove,
  className = ''
}) => {
  const variantStyles = {
    periwinkle: 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800',
    mint: 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800',
    peach: 'bg-orange-100 dark:bg-orange-950/70 text-orange-900 dark:text-orange-200 border-orange-200 dark:border-orange-800',
    sunshine: 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800',
    rose: 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800',
    muted: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
  }[variant];

  return (
    <span className={`clay-chip font-display select-none transition-all ${variantStyles} ${className}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{label}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 hover:opacity-75 focus:outline-none cursor-pointer rounded-full p-0.5"
          aria-label={`Remove ${label}`}
        >
          ✕
        </button>
      )}
    </span>
  );
};
