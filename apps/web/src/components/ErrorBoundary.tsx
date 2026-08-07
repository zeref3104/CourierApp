import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Surfaces render errors on screen instead of leaving a blank page.
 * Temporary boot diagnostics — safe to remove once production is healthy.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[boot] React render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem', color: '#b91c1c', background: '#fef2f2', whiteSpace: 'pre-wrap' }}>
          <strong>React render error:</strong>
          <pre style={{ margin: '0.5rem 0', whiteSpace: 'pre-wrap' }}>{this.state.error.message}</pre>
          {this.state.error.stack && <pre style={{ color: '#666', whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>}
        </div>
      );
    }
    return this.props.children;
  }
}
