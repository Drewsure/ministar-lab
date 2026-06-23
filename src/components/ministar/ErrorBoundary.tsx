'use client';

import React from 'react';

// ============================================================================
// ErrorBoundary — catches client-side errors so the app doesn't crash
// with "Application error: a client-side exception has occurred"
// ============================================================================

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[MiniStar] ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#05030f', color: '#fff' }}>
          <div className="max-w-md w-full rounded-3xl p-6 text-center" style={{ background: '#1a1535', border: '1px solid rgba(168,85,247,0.4)' }}>
            <div className="text-5xl mb-4">🐶</div>
            <div className="font-bold text-lg mb-2">Oops! Cloud Dog stumbled.</div>
            <div className="text-sm opacity-70 mb-4">
              Something went wrong. Tap below to try again.
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                window.location.reload();
              }}
              className="rounded-xl px-6 py-3 font-bold"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff' }}
            >
              🔄 Try Again
            </button>
            <details className="mt-4 text-xs opacity-50 text-left">
              <summary>Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.message}</pre>
            </details>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
