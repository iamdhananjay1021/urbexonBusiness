/**
 * AdminBroadcast.jsx — send a realtime announcement.
 * Wires POST /admin/broadcast (existed with no UI): pushes an
 * "admin:broadcast" event over the realtime hub to every connected
 * client ("all") or only admin dashboards ("admins").
 */
import { useState, useEffect, useCallback } from "react";
import adminApi from "../api/adminApi";
import { FiRadio, FiSend, FiMail, FiMessageCircle, FiClock } from "react-icons/fi";
import { Button, Card, ErrorState, FormField } from "../components/ui";

const MAX = 500;

const AdminBroadcast = () => {
    const [message, setMessage] = useState("");
    const [audience, setAudience] = useState("all");
    const [channels, setChannels] = useState({ email: false, whatsapp: false });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sentAt, setSentAt] = useState(null);
    const [history, setHistory] = useState([]);

    const loadHistory = useCallback(() => {
        adminApi.get("/admin/broadcast/history").then(({ data }) => setHistory(data.logs || [])).catch(() => { });
    }, []);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    const send = async (e) => {
        e.preventDefault();
        if (!message.trim()) return setError("Message is required");
        const extra = [channels.email && "Email", channels.whatsapp && "WhatsApp"].filter(Boolean);
        const audienceLabel = audience === "all" ? "ALL connected users" : "admin dashboards only";
        const confirmMsg = extra.length
            ? `Send this broadcast to ${audienceLabel}, plus ${extra.join(" + ")} to every matching recipient in the database (not just currently-online ones)?`
            : `Send this broadcast to ${audienceLabel}?`;
        if (!window.confirm(confirmMsg)) return;
        try {
            setSending(true); setError("");
            await adminApi.post("/admin/broadcast", { message: message.trim(), audience, channels });
            setSentAt(new Date());
            setMessage("");
            loadHistory();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to send broadcast");
        } finally { setSending(false); }
    };

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 560, margin: "0 auto" }}>
            <div style={{ marginBottom: 18 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                    <FiRadio color="var(--adm-primary)" /> Broadcast
                </h1>
                <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                    Realtime announcement to connected clients (not a push notification — only users currently online receive it)
                </p>
            </div>

            {sentAt && (
                <Card style={{ marginBottom: 14, borderLeft: "3px solid var(--adm-success)" }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--adm-success)" }}>
                        ✓ Broadcast sent at {sentAt.toLocaleTimeString()}
                    </p>
                </Card>
            )}

            <Card>
                <form onSubmit={send} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <FormField label="Audience">
                        <div style={{ display: "flex", gap: 10 }}>
                            {[["all", "🌐 All connected users"], ["admins", "🛡️ Admin dashboards only"]].map(([val, label]) => (
                                <button key={val} type="button" onClick={() => setAudience(val)}
                                    style={{ flex: 1, padding: "10px 14px", border: `2px solid ${audience === val ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: 10, background: audience === val ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 12.5, fontWeight: audience === val ? 700 : 500, color: audience === val ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                                    {label}
                                </button>
                            ))}
                        </div>
                    </FormField>
                    <FormField label={`Message (${message.length}/${MAX})`}>
                        <textarea
                            value={message}
                            onChange={e => { setMessage(e.target.value.slice(0, MAX)); setError(""); }}
                            rows={4}
                            placeholder="e.g. Flash sale goes live at 6 PM — up to 60% off on Urbexon Hour!"
                            style={{ width: "100%", padding: "10px 12px", fontSize: 13, border: "1px solid var(--adm-border)", borderRadius: 10, background: "var(--adm-surface)", color: "var(--adm-text-primary)", fontFamily: "inherit", resize: "vertical", boxSizing: "border-box", outline: "none" }}
                        />
                    </FormField>
                    <FormField label="Also send to (optional — reaches everyone in the database, not just online users)">
                        <div style={{ display: "flex", gap: 10 }}>
                            {[["email", FiMail, "Email"], ["whatsapp", FiMessageCircle, "WhatsApp"]].map(([key, Icon, label]) => (
                                <button key={key} type="button" onClick={() => setChannels(c => ({ ...c, [key]: !c[key] }))}
                                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 14px", border: `2px solid ${channels[key] ? "var(--adm-primary)" : "var(--adm-border)"}`, borderRadius: 10, background: channels[key] ? "var(--adm-primary-tint)" : "var(--adm-surface)", cursor: "pointer", fontSize: 12.5, fontWeight: channels[key] ? 700 : 500, color: channels[key] ? "var(--adm-primary)" : "var(--adm-text-secondary)", fontFamily: "inherit" }}>
                                    <Icon size={13} /> {label}
                                </button>
                            ))}
                        </div>
                    </FormField>
                    {error && <ErrorState message={error} />}
                    <Button type="submit" variant="primary" icon={FiSend} loading={sending} disabled={!message.trim()}>
                        {sending ? "Sending…" : "Send Broadcast"}
                    </Button>
                </form>
            </Card>

            {history.length > 0 && (
                <Card style={{ marginTop: 18 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--adm-text-primary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                        <FiClock size={13} /> Recent Broadcasts
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {history.map((log) => (
                            <div key={log._id} style={{ padding: "10px 12px", border: "1px solid var(--adm-border)", borderRadius: 10, fontSize: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ color: "var(--adm-text-primary)", fontWeight: 600 }}>{log.message}</span>
                                    <span style={{ color: "var(--adm-muted)", whiteSpace: "nowrap" }}>{new Date(log.createdAt).toLocaleString()}</span>
                                </div>
                                <div style={{ marginTop: 6, display: "flex", gap: 12, flexWrap: "wrap", color: "var(--adm-muted)" }}>
                                    <span>🌐 {log.audience} · {log.wsConnections} online</span>
                                    {log.channels?.email && (
                                        <span>✉️ {log.status === "sending" ? "sending…" : `${log.emailStats?.sent || 0}/${log.emailStats?.attempted || 0} sent`}</span>
                                    )}
                                    {log.channels?.whatsapp && (
                                        <span>💬 {log.status === "sending" ? "sending…" : `${log.whatsappStats?.sent || 0}/${log.whatsappStats?.attempted || 0} sent`}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default AdminBroadcast;
