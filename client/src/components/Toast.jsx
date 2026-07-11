/**
 * Toast.jsx — Lightweight toast notification system
 * Usage: import { useToast } from './Toast';
 *        const { toast, showToast } = useToast();
 *        <Toast toast={toast} />
 *        showToast("Success!", "success")
 */
import { useState, useCallback } from "react";

const COLORS = {
    success: { bg: "#f0fdf4", border: "#86efac", color: "#15803d", icon: "✓" },
    error:   { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", icon: "✕" },
    info:    { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", icon: "ℹ" },
    warning: { bg: "#fffbeb", border: "#fcd34d", color: "#d97706", icon: "⚠" },
};

export const Toast = ({ toast }) => {
    if (!toast) return null;
    const c = COLORS[toast.type] || COLORS.info;
    return (
        <div style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
            zIndex: 99999, minWidth: 280, maxWidth: 420,
            background: c.bg, border: `1px solid ${c.border}`, color: c.color,
            borderRadius: 10, padding: "12px 18px",
            display: "flex", alignItems: "center", gap: 10,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            animation: "toastIn .25s ease",
            fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
            fontSize: 14, fontWeight: 500,
        }}>
            <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
            <span style={{ fontSize: 16, fontWeight: 700 }}>{c.icon}</span>
            <span style={{ flex: 1 }}>{toast.message}</span>
        </div>
    );
};

export const useToast = () => {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = "info", duration = 3500) => {
        setToast({ message, type, id: Date.now() });
        setTimeout(() => setToast(null), duration);
    }, []);
    return { toast, showToast };
};

export default Toast;
