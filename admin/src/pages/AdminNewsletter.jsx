/**
 * AdminNewsletter.jsx — newsletter subscribers list.
 * Wires GET /contact/newsletter/subscribers (new) — subscribers were
 * write-only before (no admin visibility). Copy-emails button included
 * for quick campaign exports.
 */
import { useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { FiMail, FiCopy } from "react-icons/fi";
import { Button, Card, ErrorState } from "../components/ui";

const AdminNewsletter = () => {
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setLoading(true);
        adminApi.get("/contact/newsletter/subscribers", { params: { page, limit: 50 } })
            .then(r => { setData(r.data); setError(""); })
            .catch(() => setError("Failed to load subscribers"))
            .finally(() => setLoading(false));
    }, [page]);

    const copyEmails = async () => {
        const emails = (data?.subscribers || []).map(s => s.email).join(", ");
        try {
            await navigator.clipboard.writeText(emails);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
    };

    const subs = data?.subscribers || [];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 720, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiMail color="var(--adm-primary)" /> Newsletter
                    </h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        {loading ? "Loading…" : `${(data?.total || 0).toLocaleString()} subscribers`}
                    </p>
                </div>
                <Button variant="secondary" icon={FiCopy} onClick={copyEmails} disabled={!subs.length}>
                    {copied ? "✓ Copied" : "Copy page emails"}
                </Button>
            </div>

            {error && <div style={{ marginBottom: 14 }}><ErrorState message={error} /></div>}

            <Card padded={false} style={{ overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead>
                        <tr style={{ background: "var(--adm-surface-alt)", textAlign: "left" }}>
                            <th style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>Email</th>
                            <th style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>Subscribed on</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={2} style={{ padding: 24, textAlign: "center", color: "var(--adm-muted)" }}>Loading…</td></tr>
                        ) : subs.length === 0 ? (
                            <tr><td colSpan={2} style={{ padding: 24, textAlign: "center", color: "var(--adm-muted)" }}>No subscribers yet</td></tr>
                        ) : subs.map(s => (
                            <tr key={s._id} style={{ borderTop: "1px solid var(--adm-border)" }}>
                                <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--adm-text-primary)" }}>{s.email}</td>
                                <td style={{ padding: "10px 14px", color: "var(--adm-text-secondary)", whiteSpace: "nowrap" }}>
                                    {s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>

            {(data?.totalPages || 1) > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 14, alignItems: "center" }}>
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                    <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>Page {page} / {data.totalPages}</span>
                    <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
                </div>
            )}
        </div>
    );
};

export default AdminNewsletter;
