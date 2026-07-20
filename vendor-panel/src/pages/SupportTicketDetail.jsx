/**
 * SupportTicketDetail.jsx — single vendor support ticket: conversation
 * thread, reply, CSAT rating after resolution, reopen within window.
 * Live-refreshes when a "ticket_update" WS message for this ticket arrives
 * via the shared NotificationContext connection.
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useNotifications } from "../contexts/NotificationContext";
import { FiArrowLeft, FiPaperclip, FiSend, FiStar, FiRotateCcw } from "react-icons/fi";

const STATUS_STYLES = {
    open: { bg: "#dbeafe", color: "#1d4ed8", label: "Open" },
    in_progress: { bg: "#fef3c7", color: "#92400e", label: "In Progress" },
    waiting_customer: { bg: "#ede9fe", color: "#6d28d9", label: "Awaiting You" },
    resolved: { bg: "#d1fae5", color: "#065f46", label: "Resolved" },
    closed: { bg: "#f3f4f6", color: "#4b5563", label: "Closed" },
};

const fmtDateTime = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

const SupportTicketDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { lastMessage } = useNotifications();

    const [ticket, setTicket] = useState(null);
    const [reopenWindowDays, setReopenWindowDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState({ text: "", type: "" });

    const [reply, setReply] = useState("");
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);

    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [feedback, setFeedback] = useState("");
    const [ratingBusy, setRatingBusy] = useState(false);

    const [showReopen, setShowReopen] = useState(false);
    const [reopenMessage, setReopenMessage] = useState("");
    const [reopening, setReopening] = useState(false);

    const showMsg = (text, type = "info") => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: "", type: "" }), 5000);
    };

    const loadTicket = useCallback(async () => {
        try {
            const { data } = await api.get(`/vendor/tickets/${id}`);
            setTicket(data.ticket);
            if (data.reopenWindowDays) setReopenWindowDays(data.reopenWindowDays);
        } catch (err) {
            setError(err.response?.status === 404 ? "Ticket not found" : "Failed to load ticket");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadTicket(); }, [loadTicket]);

    // Live refresh on admin activity for this ticket. notificationEngine
    // spreads meta flat into the WS payload, so ticketId sits at
    // payload.ticketId (not payload.meta.ticketId).
    useEffect(() => {
        if (lastMessage?.type === "ticket_update" && lastMessage?.payload?.ticketId === id) {
            loadTicket();
        }
    }, [lastMessage, id, loadTicket]);

    const pickFiles = (e) => {
        const picked = Array.from(e.target.files || []).slice(0, 3);
        const tooBig = picked.find((f) => f.size > 5 * 1024 * 1024);
        if (tooBig) { showMsg(`"${tooBig.name}" exceeds the 5 MB limit`, "error"); return; }
        setFiles(picked);
    };

    const sendReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const fd = new FormData();
            fd.append("message", reply.trim());
            files.forEach((f) => fd.append("attachments", f));
            const { data } = await api.post(`/vendor/tickets/${id}/reply`, fd, { headers: { "Content-Type": "multipart/form-data" } });
            setTicket((prev) => ({ ...data.ticket, messages: (data.ticket.messages || []).filter((m) => !m.isInternalNote) }));
            setReply("");
            setFiles([]);
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to send reply", "error");
        } finally {
            setSending(false);
        }
    };

    const submitRating = async () => {
        if (!rating) return showMsg("Please select a star rating", "error");
        setRatingBusy(true);
        try {
            const { data } = await api.post(`/vendor/tickets/${id}/rate`, { rating, feedback });
            setTicket((prev) => ({ ...prev, csat: data.csat }));
            showMsg("Thanks for your feedback!", "success");
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to submit rating", "error");
        } finally {
            setRatingBusy(false);
        }
    };

    const reopenTicket = async () => {
        if (!reopenMessage.trim()) return showMsg("Please describe why you're reopening", "error");
        setReopening(true);
        try {
            const { data } = await api.post(`/vendor/tickets/${id}/reopen`, { message: reopenMessage.trim() });
            setTicket((prev) => ({ ...data.ticket, messages: (data.ticket.messages || []).filter((m) => !m.isInternalNote) }));
            setShowReopen(false);
            setReopenMessage("");
            showMsg("Ticket reopened — our team has been notified", "success");
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to reopen ticket", "error");
        } finally {
            setReopening(false);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    if (error || !ticket) return (
        <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>
            {error || "Ticket not found"}
            <div style={{ marginTop: 16 }}>
                <button onClick={() => navigate("/support")} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    Back to Support
                </button>
            </div>
        </div>
    );

    const statusInfo = STATUS_STYLES[ticket.status] || STATUS_STYLES.open;
    const isClosedish = ["resolved", "closed"].includes(ticket.status);
    const reopenAnchor = ticket.resolvedAt || ticket.closedAt;
    const withinReopenWindow = !reopenAnchor || Date.now() - new Date(reopenAnchor).getTime() <= reopenWindowDays * 86400000;

    return (
        <div style={{ maxWidth: 780 }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

            {/* Header */}
            <button onClick={() => navigate("/support")} style={{ display: "flex", alignItems: "center", gap: 6, border: "none", background: "none", color: "#6b7280", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 14 }}>
                <FiArrowLeft size={14} /> All tickets
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 19, fontWeight: 800, color: "#111827", margin: 0 }}>{ticket.subject}</h1>
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                        #{ticket._id.slice(-6).toUpperCase()} · {ticket.category} · opened {fmtDateTime(ticket.createdAt)}
                        {ticket.reopenedCount > 0 && ` · reopened ×${ticket.reopenedCount}`}
                    </div>
                </div>
                <span style={{ padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                    {statusInfo.label}
                </span>
            </div>

            {msg.text && (
                <div style={{
                    padding: "12px 16px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600, animation: "fadeUp .3s ease",
                    background: msg.type === "success" ? "#d1fae5" : msg.type === "error" ? "#fee2e2" : "#dbeafe",
                    color: msg.type === "success" ? "#065f46" : msg.type === "error" ? "#b91c1c" : "#1d4ed8",
                }}>
                    {msg.text}
                </div>
            )}

            {/* Thread */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 20, marginBottom: 18 }}>
                {(ticket.messages || []).map((m, i) => {
                    const mine = m.sender === "vendor";
                    return (
                        <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 14 }}>
                            <div style={{
                                maxWidth: "80%", padding: "10px 14px", borderRadius: 14, fontSize: 13, lineHeight: 1.55,
                                background: mine ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "#f3f4f6",
                                color: mine ? "#fff" : "#111827",
                                borderBottomRightRadius: mine ? 4 : 14,
                                borderBottomLeftRadius: mine ? 14 : 4,
                            }}>
                                <div style={{ fontSize: 10.5, fontWeight: 700, marginBottom: 3, opacity: 0.75 }}>
                                    {mine ? "You" : m.senderName || "Urbexon Support"} · {fmtDateTime(m.createdAt)}
                                </div>
                                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.message}</div>
                                {(m.attachments || []).length > 0 && (
                                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                                        {m.attachments.map((a, j) => (
                                            <a key={j} href={a.url} target="_blank" rel="noreferrer" style={{
                                                display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600,
                                                color: mine ? "#e9d5ff" : "#6d28d9", textDecoration: "underline",
                                            }}>
                                                <FiPaperclip size={11} /> {a.name || "attachment"}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* CSAT card */}
            {isClosedish && !ticket.csat?.rating && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 20, marginBottom: 18, animation: "fadeUp .3s ease" }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>How did we do?</div>
                    <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>Rate the support you received on this ticket</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHoverRating(n)} onMouseLeave={() => setHoverRating(0)}
                                style={{ border: "none", background: "none", cursor: "pointer", padding: 2, display: "flex" }}>
                                <FiStar size={26} fill={(hoverRating || rating) >= n ? "#f59e0b" : "none"} color={(hoverRating || rating) >= n ? "#f59e0b" : "#d1d5db"} />
                            </button>
                        ))}
                    </div>
                    <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={1000} placeholder="Any feedback for the team? (optional)"
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", marginBottom: 12 }} />
                    <button onClick={submitRating} disabled={ratingBusy} style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: ratingBusy ? 0.7 : 1 }}>
                        {ratingBusy ? "Submitting…" : "Submit Rating"}
                    </button>
                </div>
            )}
            {isClosedish && ticket.csat?.rating && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: "14px 20px", marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>Your rating:</span>
                    <span style={{ display: "flex", gap: 2 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                            <FiStar key={n} size={16} fill={ticket.csat.rating >= n ? "#f59e0b" : "none"} color={ticket.csat.rating >= n ? "#f59e0b" : "#d1d5db"} />
                        ))}
                    </span>
                </div>
            )}

            {/* Reply box OR reopen */}
            {!isClosedish ? (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 16 }}>
                    <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply…" disabled={sending}
                        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ minWidth: 0 }}>
                            <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={pickFiles} disabled={sending} style={{ fontSize: 12 }} />
                            {files.length > 0 && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{files.map((f) => f.name).join(", ")}</div>}
                        </div>
                        <button onClick={sendReply} disabled={sending || !reply.trim()} style={{
                            display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 10, border: "none",
                            background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontSize: 13, fontWeight: 700,
                            cursor: sending || !reply.trim() ? "default" : "pointer", opacity: sending || !reply.trim() ? 0.6 : 1,
                        }}>
                            <FiSend size={14} /> {sending ? "Sending…" : "Send"}
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ background: "#fafafa", borderRadius: 14, border: "1px dashed #d1d5db", padding: 18, textAlign: "center" }}>
                    <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: withinReopenWindow ? 12 : 0 }}>
                        This ticket is {ticket.status}.{withinReopenWindow ? " Issue not fixed?" : ` The ${reopenWindowDays}-day reopen window has passed — please create a new ticket.`}
                    </div>
                    {withinReopenWindow && !showReopen && (
                        <button onClick={() => setShowReopen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid #7c3aed", background: "#fff", color: "#6d28d9", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                            <FiRotateCcw size={13} /> Reopen Ticket
                        </button>
                    )}
                    {withinReopenWindow && showReopen && (
                        <div style={{ textAlign: "left", animation: "fadeUp .25s ease" }}>
                            <textarea value={reopenMessage} onChange={(e) => setReopenMessage(e.target.value)} rows={3} maxLength={5000} placeholder="Tell us what's still wrong…" disabled={reopening}
                                style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", marginBottom: 10 }} />
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button onClick={() => setShowReopen(false)} disabled={reopening} style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12.5, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
                                    Cancel
                                </button>
                                <button onClick={reopenTicket} disabled={reopening} style={{ padding: "9px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #7c3aed, #4f46e5)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer", opacity: reopening ? 0.7 : 1 }}>
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
