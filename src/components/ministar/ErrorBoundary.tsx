'use client';
import React from 'react';

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[MiniStar] ErrorBoundary:', error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#05030f', color: '#fff' }}>
          <div className="max-w-md w-full rounded-3xl p-6 text-center" style={{ background: '#1a1535', border: '1px solid rgba(168,85,247,0.4)' }}>
            <div className="text-5xl mb-4">🐶</div>
            <div className="font-bold text-lg mb-2">Oops! Cloud Dog stumbled.</div>
            <div className="text-sm opacity-70 mb-4">Something went wrong. Tap below to try again.</div>
            <button onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="rounded-xl px-6 py-3 font-bold" style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)', color: '#fff' }}>🔄 Try Again</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
