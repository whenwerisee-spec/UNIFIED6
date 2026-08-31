import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.name || 'Generic'}] Uncaught error:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-5 bg-red-50/40 border border-red-150 rounded-2xl flex flex-col items-center text-center space-y-3 shadow-xs">
          <span className="text-2xl">⚠️</span>
          <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">Widget Unavailable</h4>
          <p className="text-[11px] text-red-600 max-w-xs leading-normal">
            An error occurred while loading this section. Our status monitor has logged this event.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold text-[10px] rounded-lg transition-colors cursor-pointer"
          >
            Retry Section
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
