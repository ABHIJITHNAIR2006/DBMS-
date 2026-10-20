import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useDB } from '../../db/store';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ClayToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useDB();

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map(toast => {
          const icon = {
            success: <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />,
            warning: <AlertTriangle className="text-amber-500 shrink-0" size={20} />,
            error: <AlertCircle className="text-rose-500 shrink-0" size={20} />,
            info: <Info className="text-indigo-500 shrink-0" size={20} />
          }[toast.type || 'info'];

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto clay-card p-4 flex items-start gap-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl border border-clay-border rounded-2xl"
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <h5 className="font-display font-bold text-sm text-clay-text">{toast.title}</h5>
                {toast.description && (
                  <p className="text-xs text-clay-text-muted mt-0.5 leading-relaxed">{toast.description}</p>
                )}
                {toast.action && (
                  <button
                    onClick={() => {
                      toast.action?.onClick();
                      dismissToast(toast.id);
                    }}
                    className="mt-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-block cursor-pointer"
                  >
                    {toast.action.label} →
                  </button>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.id)}
                className="text-clay-text-muted hover:text-clay-text p-1 rounded-full cursor-pointer"
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
