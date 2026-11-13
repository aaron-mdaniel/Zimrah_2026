import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in ZIMRAH 2026 application:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 shadow-xl text-center">
            <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-600 mb-6">
              An unexpected error occurred. Please try reloading the page or return to the homepage.
            </p>
            {this.state.error && (
              <div className="bg-slate-100 rounded-lg p-3 text-left text-xs font-mono text-slate-800 mb-6 overflow-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="default"
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reload Application
              </Button>
              <Button
                variant="outline"
                onClick={() => (window.location.href = '/')}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Return to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
