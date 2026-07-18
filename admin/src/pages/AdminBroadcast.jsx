/**
 * AdminBroadcast.jsx — send a realtime announcement.
 * Wires POST /admin/broadcast (existed with no UI): pushes an
 * "admin:broadcast" event over the realtime hub to every connected
 * client ("all") or only admin dashboards ("admins").
 */
import { useState } from "react";
import adminApi from "../api/adminApi";
import { FiRadio, FiSend } from "react-icons/fi";
import { Button, Card, ErrorState, FormField } from "../components/ui";

const MAX = 500;

const AdminBroadcast = () => {
    const [message, setMessage] = useState("");
    const [audience, setAudience] = useState("all");
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [sentAt, setSentAt] = useState(null);

    const send = async (e) => {
        e.preventDefault();
        if (!message.trim()) return setError("Message is required");
        if (!window.confirm(`Send this broadcast to ${audience === "all" ? "ALL connected users" : "admin dashboards only"}?`)) return;
        try {
            setSending(true); setError("");
            await adminApi.post("/admin/broadcast", { message: message.trim(), audience });
            setSentAt(new Date());
            setMessage("");
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
                    {error && <ErrorState message={error} />}
                    <Button type="submit" variant="primary" icon={FiSend} loading={sending} disabled={!message.trim()}>
                        {sending ? "Sending…" : "Send Broadcast"}
                    </Button>
                </form>
            </Card>
        </div>
    );
};

export default AdminBroadcast;
