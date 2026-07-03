import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  // Human-readable name of the region this boundary protects (e.g. "Viewport").
  label: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render/runtime errors in a subtree so one failing panel (the Three.js
// viewport or the node editor) shows a recoverable fallback instead of white-screening
// the whole app.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[${this.props.label}] crashed:`, error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return (
        <div
          role="alert"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            width: "100%",
            height: "100%",
            padding: "2rem",
            boxSizing: "border-box",
            background: "#191919",
            color: "#e6e6e6",
            fontSize: "1.3rem",
            textAlign: "center",
          }}
        >
          <div style={{ fontWeight: 600 }}>{this.props.label} stopped responding</div>
          <div style={{ maxWidth: "40rem", color: "#9a9a9a", wordBreak: "break-word" }}>
            {error.message || "An unexpected error occurred."}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              padding: "0.6rem 1.2rem",
              borderRadius: "0.4rem",
              border: "1px solid #444",
              background: "#2d2d2d",
              color: "#e6e6e6",
              cursor: "pointer",
              fontSize: "1.2rem",
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
