/**
 * AdminReviews.jsx — review moderation.
 * Wires GET /reviews/admin/all + DELETE /reviews/admin/:reviewId (new).
 * Before this, admins had no way to remove abusive/fake reviews —
 * only the author could delete their own.
 */
import { useEffect, useState } from "react";
import adminApi from "../api/adminApi";
import { FiStar, FiTrash2, FiSearch } from "react-icons/fi";
import { Button, Badge, Card, ErrorState, Select } from "../components/ui";

const Stars = ({ n }) => (
    <span style={{ color: "var(--adm-warning)", fontSize: 12, letterSpacing: 1 }}>
        {"★".repeat(n)}{"☆".repeat(5 - n)}
    </span>
);

const AdminReviews = () => {
    const [page, setPage] = useState(1);
    const [rating, setRating] = useState("");
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState("");

    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [search]);

    const load = () => {
        setLoading(true);
        adminApi.get("/reviews/admin/all", {
            params: {
                page, limit: 30,
                ...(rating ? { rating } : {}),
                ...(debouncedSearch ? { search: debouncedSearch } : {}),
            },
        })
            .then(r => { setData(r.data); setError(""); })
            .catch(() => setError("Failed to load reviews"))
            .finally(() => setLoading(false));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(load, [page, rating, debouncedSearch]);

    const remove = async (rev) => {
        if (!window.confirm(`Delete this review by "${rev.name}"? Product rating will be recalculated.`)) return;
        try {
            setBusy(rev._id);
            await adminApi.delete(`/reviews/admin/${rev._id}`);
            load();
        } catch { setError("Failed to delete review"); }
        finally { setBusy(""); }
    };

    const reviews = data?.reviews || [];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--adm-text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiStar color="var(--adm-warning)" /> Reviews
                    </h1>
                    <p style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>
                        {loading ? "Loading…" : `${(data?.total || 0).toLocaleString()} reviews`} · moderate abusive or fake content
                    </p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--adm-border)", borderRadius: 9, padding: "0 10px", background: "var(--adm-surface)" }}>
                        <FiSearch size={12} color="var(--adm-muted)" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / comment…"
                            style={{ border: "none", outline: "none", background: "transparent", padding: "8px 0", fontSize: 12.5, width: 170, color: "var(--adm-text-primary)", fontFamily: "inherit" }} />
                    </div>
                    <Select value={rating} onChange={e => { setRating(e.target.value); setPage(1); }} style={{ width: 120 }}>
                        <option value="">All ratings</option>
                        {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r}★ only</option>)}
                    </Select>
                </div>
            </div>

            {error && <div style={{ marginBottom: 14 }}><ErrorState message={error} /></div>}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loading ? (
                    <Card><p style={{ padding: 12, textAlign: "center", color: "var(--adm-muted)", fontSize: 12.5 }}>Loading…</p></Card>
                ) : reviews.length === 0 ? (
                    <Card><p style={{ padding: 16, textAlign: "center", color: "var(--adm-muted)", fontSize: 12.5 }}>No reviews match</p></Card>
                ) : reviews.map(rev => (
                    <Card key={rev._id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                        {rev.product?.images?.[0]?.url ? (
                            <img src={rev.product.images[0].url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid var(--adm-border)" }} />
                        ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--adm-surface-alt)", flexShrink: 0 }} />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--adm-text-primary)" }}>{rev.name || "User"}</span>
                                <Stars n={rev.rating} />
                                {rev.rating <= 2 && <Badge tone="danger">low</Badge>}
                                <span style={{ fontSize: 10.5, color: "var(--adm-muted)", marginLeft: "auto" }}>
                                    {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
                                </span>
                            </div>
                            <p style={{ fontSize: 11, color: "var(--adm-muted)", marginTop: 2 }}>
                                on <strong style={{ color: "var(--adm-text-secondary)" }}>{rev.product?.name || "Deleted product"}</strong>
                            </p>
                            {rev.comment && (
                                <p style={{ fontSize: 12.5, color: "var(--adm-text-secondary)", marginTop: 6, lineHeight: 1.55, wordBreak: "break-word" }}>
                                    {rev.comment}
                                </p>
                            )}
                        </div>
                        <button onClick={() => remove(rev)} disabled={busy === rev._id} title="Delete review"
                            style={{ background: "var(--adm-danger-tint)", border: "1px solid var(--adm-danger)", borderRadius: 8, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--adm-danger)", flexShrink: 0, opacity: busy === rev._id ? 0.4 : 1 }}>
                            <FiTrash2 size={13} />
                        </button>
                    </Card>
                ))}
            </div>

            {(data?.totalPages || 1) > 1 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, alignItems: "center" }}>
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</Button>
                    <span style={{ fontSize: 12, color: "var(--adm-muted)" }}>Page {page} / {data.totalPages}</span>
                    <Button variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next →</Button>
                </div>
            )}
        </div>
    );
};

export default AdminReviews;
