import { useState, useEffect, useCallback, useRef } from "react";
import { submitContactForm } from "../api/contactApi";
import { getMyTickets, getMyTicketDetail, replyToTicket } from "../api/ticketApi";
import { useAuth } from "../contexts/AuthContext";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Textarea from "../design-system/Textarea";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Tabs from "../design-system/Tabs";
import Modal from "../design-system/Modal";
import StatusBadge from "../design-system/StatusBadge";
import { EmptyState, ErrorState } from "../design-system/EmptyState";
import { SkeletonText } from "../design-system/Skeleton";
import Loader from "../design-system/Loader";
import { FiPaperclip, FiSend } from "react-icons/fi";

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

/* ─── Ticket detail + reply modal ─── */
function TicketDetailModal({ ticketId, onClose, onChanged }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(false);
    const [reply, setReply] = useState("");
    const [files, setFiles] = useState([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!ticketId) return;
        setLoading(true);
        setError(null);
        try {
            const { data } = await getMyTicketDetail(ticketId);
            setTicket(data.ticket);
        } catch {
            setError("Failed to load this query.");
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { load(); }, [load]);

    const sendReply = async () => {
        if (!reply.trim()) return;
        setSending(true);
        try {
            const form = new FormData();
            form.append("message", reply.trim());
            files.forEach((f) => form.append("attachments", f));
            await replyToTicket(ticketId, form);
            setReply("");
            setFiles([]);
            await load();
            onChanged?.();
        } catch {
            setError("Failed to send your reply. Please try again.");
        } finally {
            setSending(false);
        }
    };

    return (
        <Modal open={!!ticketId} onClose={onClose} title={ticket?.subject || "Query"} size="lg">
            {loading || !ticket ? (
                <div className="py-8"><SkeletonText lines={4} /></div>
            ) : error ? (
                <ErrorState description={error} />
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={ticket.status} />
                        <span className="text-xs text-muted capitalize">{ticket.category}</span>
                    </div>

                    <div className="max-h-72 overflow-y-auto flex flex-col gap-2 pr-1">
                        {(ticket.messages || []).map((m, i) => (
                            <div
                                key={i}
                                className={`max-w-[85%] rounded-md px-3 py-2 text-sm ${m.sender === "customer" ? "self-end bg-accent-tint" : "self-start bg-graphite-50"
                                    }`}
                            >
                                <div className="text-[11px] text-muted mb-1">{m.senderName || (m.sender === "customer" ? "You" : "Support")} · {fmtDate(m.createdAt)}</div>
                                <div className="whitespace-pre-wrap text-primary">{m.message}</div>
                                {m.attachments?.length > 0 && (
                                    <div className="flex gap-2 mt-2 flex-wrap">
                                        {m.attachments.map((a, j) => (
                                            <a key={j} href={a.url} target="_blank" rel="noreferrer" className="text-accent text-xs flex items-center gap-1">
                                                <FiPaperclip size={11} /> {a.name || "attachment"}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {["resolved", "closed"].includes(ticket.status) ? (
                        <p className="text-xs text-muted">This query is {ticket.status}. Send a new message from "Raise a Query" if you need further help.</p>
                    ) : (
                        <div>
                            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Type your reply…" disabled={sending} />
                            <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                                <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} className="text-xs" />
                                <Button variant="primary" size="sm" onClick={sendReply} loading={sending} disabled={!reply.trim()}>
                                    <FiSend size={13} className="mr-1" /> Send
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}

/* ─── My Queries list ─── */
function MyQueriesPanel() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTicketId, setActiveTicketId] = useState(null);

    const load = useCallback(async () => {
        try {
            const { data } = await getMyTickets();
            setTickets(data.tickets || []);
            setError(null);
        } catch {
            setError("Failed to load your queries.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    // Realtime: GlobalWebSocket.jsx forwards every message type via this
    // event already (client:ws_message) — no new socket, just listening.
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.type === "ticket:update") load();
        };
        window.addEventListener("client:ws_message", handler);
        return () => window.removeEventListener("client:ws_message", handler);
    }, [load]);

    if (loading) return <div className="py-8"><SkeletonText lines={3} /></div>;
    if (error) return <ErrorState description={error} />;
    if (tickets.length === 0) {
        return <EmptyState title="No queries yet" description="Messages you send from the Raise a Query tab will show up here, along with our replies." />;
    }

    return (
        <>
            <div className="flex flex-col gap-3">
                {tickets.map((t) => (
                    <button
                        key={t._id}
                        onClick={() => setActiveTicketId(t._id)}
                        className="text-left border border-default rounded-md p-4 hover:border-accent transition-colors"
                    >
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-primary text-sm">{t.subject}</span>
                            <StatusBadge status={t.status} />
                        </div>
                        <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
                            <span className="capitalize">{t.category}</span>
                            <span>·</span>
                            <span>Last update {fmtDate(t.lastReplyAt || t.createdAt)}</span>
                        </div>
                    </button>
                ))}
            </div>
            <TicketDetailModal ticketId={activeTicketId} onClose={() => setActiveTicketId(null)} onChanged={load} />
        </>
    );
}

export default function ContactUs() {
    const { user } = useAuth();
    const [tab, setTab] = useState("new");
    const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
    const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async () => {
        if (!form.name || !form.email || !form.message) {
            alert("Please fill in Name, Email, and Message.");
            return;
        }
        setStatus("loading");

        try {
            const res = await submitContactForm(form);
            if (res.data) {
                setStatus("success");
                setForm({ name: "", email: "", phone: "", subject: "", message: "" });
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    const TABS = [
        { value: "new", label: "Raise a Query" },
        ...(user ? [{ value: "mine", label: "My Queries" }] : []),
    ];

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="Contact Us" description="Contact Urbexon in Noida. Call +91 88084 85840 or email support@urbexon.in. We're here to help!" path="/contact" />
            {/* Header */}
            <div className="bg-surface border-b border-default py-12">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <p className="text-accent text-sm font-medium tracking-widest uppercase mb-3">Get in Touch</p>
                    <h1 className="text-4xl font-bold text-primary font-display">
                        Contact Us
                    </h1>
                    <p className="mt-3 text-secondary max-w-md mx-auto">
                        Have a question or need help? We're here for you. Reach out and we'll respond within 24 hours.
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Contact Info */}
                    <div className="space-y-5">
                        <InfoCard icon="📧" title="Email Us" line1="support@urbexon.in" line2="For orders & general queries" />
                        <InfoCard icon="📞" title="Call Us" line1="+91 88084 85840" line2="Mon–Sun, 10am – 6pm" />
                        <InfoCard icon="📍" title="Our Address" line1="Ground Floor, Sector 63, Noida" line2="Noida, UP – 201301, India" />
                        <InfoCard icon="⏱️" title="Response Time" line1="Within 24 hours" line2="Usually much faster!" />
                    </div>

                    {/* Contact Form / My Queries */}
                    <Card className="md:col-span-2" padding="lg">
                        {TABS.length > 1 && (
                            <div className="mb-6">
                                <Tabs tabs={TABS} active={tab} onChange={setTab} />
                            </div>
                        )}

                        {tab === "mine" && user ? (
                            <MyQueriesPanel />
                        ) : (
                            <>
                                <h2 className="text-2xl font-semibold text-primary mb-6 font-display">
                                    Send a Message
                                </h2>

                                {status === "success" ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="text-5xl mb-4">✅</div>
                                        <h3 className="text-xl font-semibold text-primary mb-2">Message Sent!</h3>
                                        <p className="text-secondary">
                                            {user
                                                ? "Thank you for reaching out. Check the \"My Queries\" tab to see our reply."
                                                : "Thank you for reaching out. We'll get back to you within 24 hours."}
                                        </p>
                                        <button
                                            onClick={() => setStatus(null)}
                                            className="mt-6 text-accent hover:text-[var(--accent-primary-hover)] font-medium text-sm underline"
                                        >
                                            Send another message
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input label="Your Name *" name="name" value={form.name} onChange={handleChange} placeholder="Rahul Sharma" />
                                            <Input label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="rahul@example.com" />
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input label="Phone Number" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                                            <Input label="Subject" name="subject" value={form.subject} onChange={handleChange} placeholder="Order query, feedback..." />
                                        </div>
                                        <Textarea
                                            label="Message *"
                                            name="message"
                                            value={form.message}
                                            onChange={handleChange}
                                            rows={5}
                                            placeholder="Tell us how we can help you..."
                                        />

                                        {status === "error" && (
                                            <Alert variant="error">Something went wrong. Please try again or email us directly.</Alert>
                                        )}

                                        <Button variant="primary" className="w-full" onClick={handleSubmit} loading={status === "loading"}>
                                            Send Message
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </Card>

                </div>
            </div>
        </div>
    );
}

function InfoCard({ icon, title, line1, line2 }) {
    return (
        <Card className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">{icon}</span>
            <div>
                <p className="font-semibold text-primary text-sm">{title}</p>
                <p className="text-secondary text-sm mt-0.5">{line1}</p>
                <p className="text-muted text-xs mt-0.5">{line2}</p>
            </div>
        </Card>
    );
}
