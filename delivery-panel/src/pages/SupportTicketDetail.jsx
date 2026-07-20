/**
 * SupportTicketDetail.jsx — single delivery support ticket: chat thread,
 * reply, CSAT rating after resolution, reopen within window. Polls every
 * 30s while open (the delivery panel has no shared WS context like the
 * vendor panel's NotificationContext — its sockets live inside individual
 * order pages — so a light poll is the consistent choice here).
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { G } from "../utils/theme";

const STATUS_STYLES = {
    open: { bg: G.blue50, color: G.blue600, label: "Open" },
    in_progress: { bg: G.amber50, color: G.amber600, label: "In Progress" },
    waiting_customer: { bg: "#ede9fe", color: "#6d28d9", label: "Awaiting You" },
    resolved: { bg: G.green50, color: G.green600, label: "Resolved" },
    closed: { bg: G.borderLight, color: G.textSub, label: "Closed" },
};

const fmtDT = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const areaStyle = {
    width: "100%", padding: "11px 12px", borderRadius: 10, border: `1px solid ${G.border}`,
    fontSize: 13.5, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", background: G.white,
};

const SupportTicketDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [ticket, setTicket] = useState(null);
    const [reopenWindowDays, setReopenWindowDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");

    const [reply, setReply] = useState("");
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);

    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [ratingBusy, setRatingBusy] = useState(false);

    const [showReopen, setShowReopen] = useState(false);
    const [reopenMessage, setReopenMessage] = useState("");
    const [reopening, setReopening] = useState(false);

    const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

    const load = useCallback(async () => {
        try {
            const { data } = await api.get(`/delivery/tickets/${id}`);
            setTicket(data.ticket);
            if (data.reopenWindowDays) setReopenWindowDays(data.reopenWindowDays);
        } catch { }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        const t = setInterval(load, 30000);
        return () => clearInterval(t);
    }, [load]);

    const stripInternal = (tk) => ({ ...tk, messages: (tk.messages || []).filter((m) => !m.isInternalNote) });

    const pickFiles = (e) => {
        const picked = Array.from(e.target.files || []).slice(0, 3);
        const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
        if (tooBig) { showMsg(`❌ "${tooBig.name}" is over 5 MB`); return; }
        setFiles(picked);
    };

    const sendReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const fd = new FormData();
            fd.append("message", reply.trim());
            files.forEach((f) => fd.append("attachments", f));
            const { data } = await api.post(`/delivery/tickets/${id}/reply`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            setTicket(stripInternal(data.ticket));
            setReply(""); setFiles([]);
        } catch (err) {
            showMsg(`❌ ${err.response?.data?.message || "Failed to send reply"}`);
        } finally {
            setSending(false);
        }
    };

    const submitRating = async () => {
        if (!rating) return showMsg("❌ Please select a star rating");
        setRatingBusy(true);
        try {
            const { data } = await api.post(`/delivery/tickets/${id}/rate`, { rating, feedback });
            setTicket((prev) => ({ ...prev, csat: data.csat }));
            showMsg("✅ Thanks for your feedback!");
        } catch (err) {
            showMsg(`❌ ${err.response?.data?.message || "Failed to submit rating"}`);
        } finally {
            setRatingBusy(false);
        }
    };

    const reopenTicket = async () => {
        if (!reopenMessage.trim()) return showMsg("❌ Please describe why you're reopening");
        setReopening(true);
        try {
            const { data } = await api.post(`/delivery/tickets/${id}/reopen`, { message: reopenMessage.trim() });
            setTicket(stripInternal(data.ticket));
            setShowReopen(false); setReopenMessage("");
            showMsg("✅ Ticket reopened — our team has been notified");
        } catch (err) {
            showMsg(`❌ ${err.response?.data?.message || "Failed to reopen ticket"}`);
        } finally {
            setReopening(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${G.green100}`, borderTopColor: G.brand, borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (!ticket) return (
        <div style={{ textAlign: "center", padding: 50, color: G.textSub, fontSize: 13 }}>
            Ticket not found
            <div style={{ marginTop: 14 }}>
                <button onClick={() => navigate("/support")} style={{ border: `1px solid ${G.border}`, background: G.white, borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    ← Back to Support
                </button>
            </div>
        </div>
    );

    const s = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
    const isClosedish = ["resolved", "closed"].includes(ticket.status);
    const anchor = ticket.resolvedAt || ticket.closedAt;
    const withinWindow = !anchor || Date.now() - new Date(anchor).getTime() <= reopenWindowDays * 86400000;

    return (
        <div style={{ padding: "16px var(--px) 24px" }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

            <button onClick={() => navigate("/support")} style={{ border: "none", background: "none", color: G.textSub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0, marginBottom: 12 }}>
                ← All tickets
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 14 }}>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 17, fontWeight: 800, color: G.text, margin: 0, lineHeight: 1.35 }}>{ticket.subject}</h1>
                    <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>
                        #{ticket._id.slice(-6).toUpperCase()} · {ticket.category} · {fmtDT(ticket.createdAt)}
                    </div>
                </div>
                <span style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap" }}>{s.label}</span>
            </div>

            {msg && (
                <div style={{ padding: "11px 14px", borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600, background: G.amber50, color: G.amber600, animation: "fadeUp .3s ease" }}>
                    {msg}
                </div>
            )}

            {/* Thread */}
            <div style={{ background: G.white, borderRadius: 14, border: `1px solid ${G.border}`, padding: 16, marginBottom: 14 }}>
                {(ticket.messages || []).map((m, i) => {
                    const mine = m.sender === "delivery";
                    return (
                        <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 12 }}>
                            <div style={{
                                maxWidth: "85%", padding: "9px 13px", borderRadius: 13, fontSize: 13, lineHeight: 1.55,
                                background: mine ? G.brand : G.borderLight,
                                color: mine ? G.white : G.text,
                                borderBottomRightRadius: mine ? 4 : 13,
                                borderBottomLeftRadius: mine ? 13 : 4,
                            }}>
                                <div style={{ fontSize: 10, fontWeight: 700, marginBottom: 2, opacity: 0.75 }}>
                                    {mine ? "You" : m.senderName || "Urbexon Support"} · {fmtDT(m.createdAt)}
                                </div>
                                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.message}</div>
                                {(m.attachments || []).length > 0 && (
                                    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                                        {m.attachments.map((a, j) => (
                                            <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 11.5, fontWeight: 600, color: mine ? "#d1fae5" : G.green600, textDecoration: "underline" }}>
                                                📎 {a.name || "attachment"}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CSAT */}
            {isClosedish && !ticket.csat?.rating && (
                <div style={{ background: G.white, borderRadius: 14, border: `1px solid ${G.border}`, padding: 16, marginBottom: 14, animation: "fadeUp .3s ease" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: G.text, marginBottom: 3 }}>How did we do?</div>
                    <div style={{ fontSize: 12, color: G.textSub, marginBottom: 10 }}>Rate the support you received</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} onClick={() => setRating(n)} style={{ border: "none", background: "none", cursor: "pointer", padding: 2, fontSize: 26, lineHeight: 1, filter: rating >= n ? "none" : "grayscale(1) opacity(0.4)" }}>
                                ⭐
                            </button>
                        ))}
                    </div>
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={1000} placeholder="Any feedback? (optional)" style={{ ...areaStyle, marginBottom: 10 }} />
                    <button onClick={submitRating} disabled={ratingBusy} style={{ width: "100%", padding: "12px", background: G.brand, color: G.white, border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 800, cursor: "pointer", opacity: ratingBusy ? 0.7 : 1 }}>
                        {ratingBusy ? "Submitting…" : "Submit Rating"}
                    </button>
                </div>
            )}
            {isClosedish && ticket.csat?.rating && (
                <div style={{ background: G.white, borderRadius: 14, border: `1px solid ${G.border}`, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: G.textSub, fontWeight: 600 }}>
                    Your rating: {"⭐".repeat(ticket.csat.rating)}
                </div>
            )}

            {/* Reply / reopen */}
            {!isClosedish ? (
                <div style={{ background: G.white, borderRadius: 14, border: `1px solid ${G.border}`, padding: 14 }}>
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply…" disabled={sending} style={{ ...areaStyle, marginBottom: 8 }} />
                    <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickFiles} disabled={sending} style={{ fontSize: 12, marginBottom: 8, display: "block" }} />
                    {files.length > 0 && <div style={{ fontSize: 11, color: G.textSub, marginBottom: 8 }}>{files.map((f) => f.name).join(", ")}</div>}
                    <button onClick={sendReply} disabled={sending || !reply.trim()} style={{
                        width: "100%", padding: "12px", background: G.brand, color: G.white, border: "none", borderRadius: 10,
                        fontSize: 13.5, fontWeight: 800, cursor: sending || !reply.trim() ? "default" : "pointer", opacity: sending || !reply.trim() ? 0.6 : 1,
                    }}>
                        {sending ? "Sending…" : "Send Reply"}
                    </button>
                </div>
            ) : (
                <div style={{ background: G.bg, borderRadius: 14, border: `1px dashed ${G.border}`, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, color: G.textSub, marginBottom: withinWindow ? 10 : 0 }}>
                        This ticket is {ticket.status}.{withinWindow ? " Issue not fixed?" : ` The ${reopenWindowDays}-day reopen window has passed — please create a new ticket.`}
                    </div>
                    {withinWindow && !showReopen && (
                        <button onClick={() => setShowReopen(true)} style={{ padding: "10px 18px", borderRadius: 10, border: `1.5px solid ${G.brand}`, background: G.white, color: G.green600, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            ↻ Reopen Ticket
                        </button>
                    )}
                    {withinWindow && showReopen && (
                        <div style={{ textAlign: "left", animation: "fadeUp .25s ease" }}>
                            <textarea value={reopenMessage} onChange={(e) => setReopenMessage(e.target.value)} rows={3} maxLength={5000} placeholder="Tell us what's still wrong…" disabled={reopening} style={{ ...areaStyle, marginBottom: 10 }} />
                            <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setShowReopen(false)} disabled={reopening} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${G.border}`, background: G.white, fontSize: 13, fontWeight: 700, color: G.textSub, cursor: "pointer" }}>
                                    Cancel
                                </button>
                                <button onClick={reopenTicket} disabled={reopening} style={{ flex: 1, padding: "11px", borderRadius: 10, border: "none", background: G.brand, color: G.white, fontSize: 13, fontWeight: 800, cursor: "pointer", opacity: reopening ? 0.7 : 1 }}>
                                    {reopening ? "Reopening…" : "Reopen"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SupportTicketDetail;
