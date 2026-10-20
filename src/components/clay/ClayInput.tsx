import React from 'react';

export interface ClayInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  icon?: React.ReactNode;
}

export const ClayInput = React.forwardRef<HTMLInputElement, ClayInputProps>(
  ({ label, error, helper, icon, className = '', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-bold tracking-wide text-clay-text/80 uppercase">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3.5 text-clay-text-muted pointer-events-none">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`clay-input w-full font-medium ${icon ? 'pl-10' : ''} ${
              error ? 'border-red-400 focus:border-red-500' : ''
            } ${className}`}
            {...props}
          />
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

ClayInput.displayName = 'ClayInput';
