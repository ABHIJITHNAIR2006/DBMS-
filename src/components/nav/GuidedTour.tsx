import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ClayCard } from '../clay/ClayCard';
import { ClayButton } from '../clay/ClayButton';
import { Package, Layers, ShoppingCart, Send, Search, Check, ChevronRight } from 'lucide-react';

interface GuidedTourProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
}

const TOUR_STEPS = [
  {
    title: '1. Item Management Module',
    subtitle: 'Module 1 • Relational Stationery Catalog',
    desc: 'Catalog every stationery item (ItemID, Name, Category, UnitPrice). Enforces disjoint EER specialization: an item is either Consumable (with ReorderLevel threshold) or Durable (with WarrantyPeriod), never both.',
    tab: 'items',
    icon: Package,
    accent: 'bg-indigo-500'
  },
  {
    title: '2. Stock Management Module',
    subtitle: 'Module 2 • Derived Attribute Engine',
    desc: 'Stock is NEVER stored in the database! It is computed dynamically as SUM(Purchases) - SUM(Issues). Expand any item to inspect its chronological audit ledger with running balance.',
    tab: 'stock',
    icon: Layers,
    accent: 'bg-emerald-500'
  },
  {
    title: '3. Purchase Management Module',
    subtitle: 'Module 3 • Supplier Transactions (SUPPLIES)',
    desc: 'Record incoming stock from suppliers with date, quantity, and cost. Uses surrogate key PurchaseID to allow multiple supplies on the same day. Implied unit cost is checked live against list price.',
    tab: 'purchases',
    icon: ShoppingCart,
    accent: 'bg-blue-500'
  },
  {
    title: '4. Issue Management Module',
    subtitle: 'Module 4 • Distribution & Stock-Out Prevention',
    desc: 'Distribute stationery to university departments. Enforces the strict Stock-Out Prevention rule: if requested quantity > current derived stock, the transaction is rejected automatically.',
    tab: 'issues',
    icon: Send,
    accent: 'bg-amber-500'
  },
  {
    title: '5. Search & AI Intelligence',
    subtitle: 'Module 5 • Instant & Natural Language Search',
    desc: 'Search stationery records by name, category, and stock status with instant debouncing. Features Gemini AI Smart Search to translate queries like "cheap writing items running low" into structured SQL filters.',
    tab: 'search',
    icon: Search,
    accent: 'bg-pink-500'
  }
];

export const GuidedTour: React.FC<GuidedTourProps> = ({ isOpen, onClose, setActiveTab }) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      setActiveTab(TOUR_STEPS[next].tab);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      setActiveTab(TOUR_STEPS[prev].tab);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
        />

        {/* Tour Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative z-10 w-full max-w-lg"
        >
          <ClayCard className="p-6 sm:p-8 bg-white/95 dark:bg-slate-900/95 shadow-2xl border-2 border-indigo-200 dark:border-indigo-800 rounded-3xl">
            {/* Step Indicator */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Mini Project Walkthrough ({currentStep + 1} of {TOUR_STEPS.length})
              </span>
              <button
                onClick={onClose}
                className="text-xs font-semibold text-clay-text-muted hover:text-clay-text cursor-pointer"
              >
                Skip Tour
              </button>
            </div>

            {/* Icon Header */}
            <div className="flex items-start gap-4 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl ${step.accent} text-white flex items-center justify-center shadow-lg shrink-0`}
              >
                <Icon size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold font-display text-clay-text">{step.title}</h3>
                <p className="text-xs font-semibold text-clay-text-muted">{step.subtitle}</p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-clay-text-muted leading-relaxed mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-clay-border">
              {step.desc}
            </p>

            {/* Step Dots & Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-clay-border">
              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setCurrentStep(idx);
                      setActiveTab(TOUR_STEPS[idx].tab);
                    }}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === currentStep
                        ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                        : 'w-2 bg-slate-300 dark:bg-slate-700'
                    }`}
                    aria-label={`Go to tour step ${idx + 1}`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <ClayButton variant="secondary" size="sm" onClick={handlePrev}>
                    Back
                  </ClayButton>
                )}
                <ClayButton
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  icon={currentStep === TOUR_STEPS.length - 1 ? <Check size={14} /> : <ChevronRight size={14} />}
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Finish' : 'Next'}
                </ClayButton>
              </div>
            </div>
          </ClayCard>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
