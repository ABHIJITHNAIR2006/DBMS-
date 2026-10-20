import React from 'react';

export interface ClaySelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface ClaySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helper?: string;
  options: ClaySelectOption[];
  placeholder?: string;
}

export const ClaySelect = React.forwardRef<HTMLSelectElement, ClaySelectProps>(
  ({ label, error, helper, options, placeholder, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="text-xs font-bold tracking-wide text-clay-text/80 uppercase">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={`clay-input w-full font-medium appearance-none pr-10 cursor-pointer ${
              error ? 'border-red-400 focus:border-red-500' : ''
            } ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-clay-text">
                {opt.label} {opt.sublabel ? `(${opt.sublabel})` : ''}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-clay-text-muted">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        {error ? (
          <p className="text-xs font-semibold text-rose-500 flex items-center gap-1 mt-0.5">
            <span>⚠</span> {error}
          </p>
        ) : helper ? (
          <p className="text-xs text-clay-text-muted mt-0.5">{helper}</p>
        ) : null}
      </div>
    );
  }
);

ClaySelect.displayName = 'ClaySelect';
