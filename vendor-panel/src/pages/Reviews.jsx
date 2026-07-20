/**
 * Reviews.jsx — Vendor Reviews & Replies.
 * Follows Support.jsx's established structural convention (stat row,
 * filter chips, inline styles, local state, no shared component library —
 * vendor-panel has none, confirmed in the earlier architecture audit).
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { FiStar, FiMessageSquare, FiEdit2, FiTrash2, FiChevronLeft, FiChevronRight } from "react-icons/fi";

const Stars = ({ n, size = 13 }) => (
    <span style={{ color: "#f59e0b", fontSize: size, letterSpacing: 1 }}>
        {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
);

const inputStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #e5e7eb",
    fontSize: 13, fontFamily: "inherit", boxSizing: "border-box", outline: "none", resize: "vertical",
};

const ReplyBox = ({ initial, busy, onSubmit, onCancel }) => {
    const [text, setText] = useState(initial || "");
    return (
        <div style={{ marginTop: 8 }}>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={1000}
                placeholder="Write a public reply…" style={inputStyle} disabled={busy} />
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button onClick={() => onSubmit(text)} disabled={busy || !text.trim()} style={{
                    padding: "7px 14px", borderRadius: 8, border: "none", background: "#7c3aed", color: "#fff",
                    fontSize: 12, fontWeight: 700, cursor: busy || !text.trim() ? "default" : "pointer", opacity: busy || !text.trim() ? 0.6 : 1,
                }}>
                    {busy ? "Saving…" : "Post Reply"}
                </button>
                {onCancel && (
                    <button onClick={onCancel} disabled={busy} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, color: "#6b7280", cursor: "pointer" }}>
                        Cancel
                    </button>
                )}
            </div>
        </div>
    );
};

const Reviews = () => {
    const [reviews, setReviews] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [ratingFilter, setRatingFilter] = useState("");
    const [replyFilter, setReplyFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [replyingId, setReplyingId] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const showMsg = (text) => { setMsg(text); setTimeout(() => setMsg(""), 4000); };

    const load = useCallback(async () => {
        try {
            const params = { page, limit: 20 };
            if (ratingFilter) params.rating = ratingFilter;
            if (replyFilter) params.hasReply = replyFilter;
            if (search.trim()) params.search = search.trim();
            const [listRes, statsRes] = await Promise.all([
                api.get("/vendor/reviews", { params }),
                api.get("/vendor/reviews/stats"),
            ]);
            setReviews(listRes.data.reviews || []);
            setTotalPages(listRes.data.totalPages || 1);
            setStats(statsRes.data);
        } catch { showMsg("Failed to load reviews"); }
        finally { setLoading(false); }
    }, [page, ratingFilter, replyFilter, search]);

    useEffect(() => { load(); }, [load]);

    const submitReply = async (reviewId, message, isEdit) => {
        setBusyId(reviewId);
        try {
            const { data } = isEdit
                ? await api.put(`/vendor/reviews/${reviewId}/reply`, { message })
                : await api.post(`/vendor/reviews/${reviewId}/reply`, { message });
            setReviews((prev) => prev.map((r) => (r._id === reviewId ? data.review : r)));
            setReplyingId(null); setEditingId(null);
            showMsg(isEdit ? "Reply updated" : "Reply posted");
            load(); // refresh stats (reply rate)
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to save reply");
        } finally {
            setBusyId(null);
        }
    };

    const deleteReply = async (reviewId) => {
        if (!window.confirm("Delete this reply?")) return;
        setBusyId(reviewId);
        try {
            await api.delete(`/vendor/reviews/${reviewId}/reply`);
            setReviews((prev) => prev.map((r) => (r._id === reviewId ? { ...r, vendorReply: { message: null, repliedAt: null } } : r)));
            showMsg("Reply deleted");
            load();
        } catch (err) {
            showMsg(err.response?.data?.message || "Failed to delete reply");
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
    );

    const maxDist = Math.max(1, ...(stats ? [5, 4, 3, 2, 1].map((n) => stats.distribution[n]) : [1]));

    return (
        <div style={{ maxWidth: 900 }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                    <FiStar /> Reviews
                </h1>
                <p style={{ fontSize: 13, color: "#6b7280", marginTop: 3 }}>See and respond to reviews on your products</p>
            </div>

            {msg && (
                <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 20, fontSize: 13, fontWeight: 600, background: "#dbeafe", color: "#1d4ed8", animation: "fadeUp .3s ease" }}>
                    {msg}
                </div>
            )}

            {/* Stats */}
            {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 24 }}>
                    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb", textAlign: "center" }}>
                        <div style={{ fontSize: 34, fontWeight: 800, color: "#111827" }}>{stats.avgRating || "—"}</div>
                        <Stars n={Math.round(stats.avgRating)} size={16} />
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{stats.total} review{stats.total !== 1 ? "s" : ""}</div>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 4 }}>{stats.replyRate}% replied to</div>
                    </div>
                    <div style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e5e7eb" }}>
                        {[5, 4, 3, 2, 1].map((n) => (
                            <div key={n} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: "#6b7280", width: 30 }}>{n}★</span>
                                <div style={{ flex: 1, height: 7, background: "#f3f4f6", borderRadius: 4, overflow: "hidden" }}>
                                    <div style={{ width: `${(stats.distribution[n] / maxDist) * 100}%`, height: "100%", background: "#f59e0b", borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 11, color: "#9ca3af", width: 24, textAlign: "right" }}>{stats.distribution[n]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                {[["", "All"], ["5", "5★"], ["4", "4★"], ["3", "3★"], ["2", "2★"], ["1", "1★"]].map(([val, label]) => (
                    <button key={val} onClick={() => { setRatingFilter(val); setPage(1); }} style={{
                        padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${ratingFilter === val ? "#7c3aed" : "#e5e7eb"}`,
                        background: ratingFilter === val ? "#f5f3ff" : "#fff",
                        color: ratingFilter === val ? "#6d28d9" : "#6b7280",
                    }}>
                        {label}
                    </button>
                ))}
                <button onClick={() => { setReplyFilter(replyFilter === "false" ? "" : "false"); setPage(1); }} style={{
                    padding: "6px 13px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${replyFilter === "false" ? "#7c3aed" : "#e5e7eb"}`,
                    background: replyFilter === "false" ? "#f5f3ff" : "#fff",
                    color: replyFilter === "false" ? "#6d28d9" : "#6b7280",
                }}>
                    Not Replied
                </button>
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search comments…"
                    style={{ ...inputStyle, width: 200, marginLeft: "auto" }} />
            </div>

            {/* List */}
            {reviews.length === 0 ? (
                <div style={{ textAlign: "center", padding: 50, color: "#9ca3af", fontSize: 13, background: "#fff", border: "1px dashed #e5e7eb", borderRadius: 14 }}>
                    No reviews match these filters.
                </div>
            ) : reviews.map((rev) => {
                const busy = busyId === rev._id;
                const hasReply = !!rev.vendorReply?.message;
                return (
                    <div key={rev._id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 16, marginBottom: 12 }}>
                        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                            {rev.product?.images?.[0]?.url ? (
                                <img src={rev.product.images[0].url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
                            ) : (
                                <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f3f4f6", flexShrink: 0 }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{rev.name}</span>
                                    <Stars n={rev.rating} />
                                    <span style={{ fontSize: 10.5, color: "#9ca3af", marginLeft: "auto" }}>
                                        {new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                </div>
                                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>on <strong style={{ color: "#6b7280" }}>{rev.product?.name || "Deleted product"}</strong></p>
                                {rev.comment && <p style={{ fontSize: 12.5, color: "#374151", marginTop: 6, lineHeight: 1.55 }}>{rev.comment}</p>}

                                {hasReply && editingId !== rev._id && (
                                    <div style={{ marginTop: 10, padding: "10px 12px", background: "#f5f3ff", borderRadius: 10, borderLeft: "3px solid #7c3aed" }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6d28d9", marginBottom: 3 }}>Your reply</div>
                                        <p style={{ fontSize: 12.5, color: "#374151", lineHeight: 1.5 }}>{rev.vendorReply.message}</p>
                                        <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
                                            <button onClick={() => setEditingId(rev._id)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6d28d9", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                                                <FiEdit2 size={11} /> Edit
                                            </button>
                                            <button onClick={() => deleteReply(rev._id)} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#dc2626", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                                                <FiTrash2 size={11} /> Delete
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {editingId === rev._id && (
                                    <ReplyBox initial={rev.vendorReply.message} busy={busy} onCancel={() => setEditingId(null)} onSubmit={(text) => submitReply(rev._id, text, true)} />
                                )}

                                {!hasReply && replyingId === rev._id && (
                                    <ReplyBox busy={busy} onCancel={() => setReplyingId(null)} onSubmit={(text) => submitReply(rev._id, text, false)} />
                                )}

                                {!hasReply && replyingId !== rev._id && (
                                    <button onClick={() => setReplyingId(rev._id)} style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", color: "#7c3aed", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                                        <FiMessageSquare size={12} /> Reply
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, marginTop: 18 }}>
                    <button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1, display: "flex" }}>
                        <FiChevronLeft size={15} />
                    </button>
                    <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>Page {page} of {totalPages}</span>
                    <button aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: 8, cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, display: "flex" }}>
                        <FiChevronRight size={15} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default Reviews;
