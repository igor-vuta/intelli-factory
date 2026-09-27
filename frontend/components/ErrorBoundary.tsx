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
    console.error('Unhandled UI error', {
      error,
      errorInfo,
    });
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
      <main className="min-h-dvh bg-[rgb(var(--bg))] px-6 py-12 text-[rgb(var(--text))]">
        <div className="mx-auto max-w-xl rounded-2xl border border-[rgb(var(--stroke))] bg-[rgb(var(--card))] p-6">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-2 text-sm text-[rgb(var(--muted))]">
            The page crashed unexpectedly. Reload to continue.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 rounded-lg border border-[rgb(var(--stroke))] px-4 py-2 text-sm hover:bg-[rgb(var(--panel))]"
          >
            Reload page
          </button>
        </div>
      </main>
    );
  }
}
