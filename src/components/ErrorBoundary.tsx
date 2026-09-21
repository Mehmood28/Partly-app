import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#070A0B] text-zinc-100 flex items-center justify-center p-4">
          <div className="app-panel max-w-md w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-[#B9EF68]/15 border border-[#B9EF68]/30 text-[#B9EF68] flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-zinc-100 font-display">Something went wrong</h2>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              An unexpected error occurred. Your saved data is still stored on this device. Please reload the app and try again.
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.reload();
              }}
              className="app-button app-button-primary inline-flex items-center gap-2 px-4"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
