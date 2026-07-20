/**
 * ErrorBoundary.jsx — Catches unhandled React render errors
 */
import { Component } from "react";

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary]", error, info);
        try {
            const base = import.meta.env.VITE_API_URL || "http://localhost:9000/api";
            fetch(`${base}/client-errors`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    app: "delivery-panel",
                    message: error?.message,
                    stack: error?.stack,
                    url: window.location.href,
                }),
                keepalive: true,
            }).catch(() => {});
        } catch {
            // ignore
        }
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div style={{
                minHeight: "100vh", display: "flex", alignItems: "center",
                justifyContent: "center", background: "#f7f4ee",
                fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
                padding: 24,
            }}>
                <div style={{
                    background: "#fff", border: "1px solid #e8e4d9",
                    borderRadius: 14, padding: 36, maxWidth: 480,
                    width: "100%", textAlign: "center",
                }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1a1740", marginBottom: 8 }}>
                        Something went wrong
                    </h2>
                    <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 24, lineHeight: 1.6 }}>
                        An unexpected error occurred. Please refresh the page.
                    </p>
                    {import.meta.env.DEV && (
                        <pre style={{
                            textAlign: "left", background: "#f8fafc",
                            border: "1px solid #e2e8f0", borderRadius: 8,
                            padding: 12, fontSize: 11, color: "#64748b",
                            overflow: "auto", maxHeight: 120, marginBottom: 20,
                        }}>
                            {this.state.error?.message}
                        </pre>
                    )}
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: "11px 28px", background: "#1a1740", border: "none",
                            color: "#c9a84c", fontWeight: 700, fontSize: 13,
                            borderRadius: 8, cursor: "pointer",
                        }}
                    >
                        Refresh Page
                    </button>
                </div>
            </div>
        );
    }
}

export default ErrorBoundary;
