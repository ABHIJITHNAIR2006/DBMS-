import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary ${this.props.name || 'Component'}]`, error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full p-6 my-4 clay-card border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 text-clay-text rounded-3xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0">
              <AlertCircle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-bold text-base text-clay-text">
                Something went wrong {this.props.name ? `in ${this.props.name}` : ''}
              </h3>
              <p className="text-xs text-clay-text-muted mt-1 leading-relaxed">
                An unexpected error occurred while rendering this section. You can retry safely.
              </p>
              {this.state.error && (
                <div className="mt-2 p-2.5 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-clay-border font-mono text-[11px] text-rose-600 dark:text-rose-400 overflow-x-auto">
                  {this.state.error.message || String(this.state.error)}
                </div>
              )}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  className="clay-btn clay-btn-secondary text-xs px-4 py-2 font-display font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={13} />
                  <span>Retry Component</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
