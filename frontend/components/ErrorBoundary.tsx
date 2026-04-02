import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled UI error', { error, errorInfo });
  }

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-300">
            The page crashed unexpectedly. Reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg border border-slate-500 px-4 py-2 text-sm hover:bg-slate-800"
          >
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
