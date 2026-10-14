import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-red-200 dark:border-red-900/30">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Algo salió mal en este módulo</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
            Ocurrió un error inesperado al intentar cargar esta sección. Por favor, recarga la página.
          </p>
          <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-lg w-full max-w-2xl overflow-auto text-left mb-6">
            <p className="text-sm font-mono text-red-600 dark:text-red-400 font-bold mb-2">
              {this.state.error?.toString()}
            </p>
            <pre className="text-xs font-mono text-red-500/80 dark:text-red-400/80 whitespace-pre-wrap">
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-2 bg-copper hover:bg-copper-dark text-white rounded-lg font-medium transition"
          >
            <RefreshCw size={18} />
            Recargar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
