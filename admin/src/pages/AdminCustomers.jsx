/**
 * AdminCustomers.jsx — Customers + Delivery Boys management
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/adminApi";

const STYLES = `
    .ac-root { padding: 28px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .ac-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .ac-title { font-size: 22px; font-weight: 800; color: #1e293b; }
    .ac-subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
    .ac-filters { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .ac-search { padding: 9px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; min-width: 220px; }
    .ac-search:focus { border-color: #2563eb; }
    .ac-role-tab { padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; color: #64748b; }
    .ac-role-tab.active { background: #2563eb; border-color: #2563eb; color: #fff; }

    .ac-table-wrap { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
    .ac-table { width: 100%; border-collapse: collapse; }
    .ac-table th { padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    .ac-table td { padding: 14px 16px; font-size: 13px; color: #1e293b; border-bottom: 1px solid #f1f5f9; }
    .ac-table tr:last-child td { border-bottom: none; }
    .ac-table tr:hover td { background: #f8fafc; }
    .ac-avatar { width: 34px; height: 34px; border-radius: 8px; background: #eff6ff; color: #2563eb; font-weight: 700; font-size: 14px; display: flex; align-items: center; justify-content: center; }
    .ac-role-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .ac-badge-user     { background: #eff6ff; color: #2563eb; }
    .ac-badge-vendor   { background: #f0fdf4; color: #16a34a; }
    .ac-badge-delivery { background: #fffbeb; color: #d97706; }
    .ac-verified { color: #22c55e; font-size: 11px; font-weight: 700; }
    .ac-unverified { color: #94a3b8; font-size: 11px; }
    .ac-action-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; font-size: 11px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
    .ac-action-btn:hover { background: #f1f5f9; }
    .ac-action-btn.block { color: #dc2626; border-color: #fecaca; }
    .ac-action-btn.block:hover { background: #fef2f2; }
    .ac-action-btn.unblock { color: #16a34a; border-color: #bbf7d0; }
    .ac-action-btn.unblock:hover { background: #f0fdf4; }
    .ac-blocked-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; background: #fef2f2; color: #dc2626; margin-left: 6px; }
    .ac-empty { padding: 60px; text-align: center; color: #94a3b8; font-size: 14px; }
    .ac-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; }
    .ac-page-btns { display: flex; gap: 6px; }
    .ac-page-btn { padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 12px; font-weight: 600; color: #475569; }
    .ac-page-btn:hover:not(:disabled) { background: #f1f5f9; }
    .ac-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .ac-page-btn.current { background: #2563eb; border-color: #2563eb; color: #fff; }
    .ac-spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 60px auto; display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ac-stat-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .ac-stat { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; }
    .ac-stat-val { font-size: 26px; font-weight: 800; color: #1e293b; }
    .ac-stat-lbl { font-size: 12px; color: #64748b; margin-top: 4px; }
    @media(max-width:768px){
        .ac-root{padding:16px;}
        .ac-search{min-width:0;width:100%;}
        .ac-table-wrap{overflow-x:auto;}
        .ac-pagination{flex-direction:column;gap:10px;text-align:center;}
        .ac-page-btns{justify-content:center;}
    }
    @media(max-width:480px){
        .ac-root{padding:12px;}
    }
`;

const TABS = [
    { value: "user", label: "Customers" },
    { value: "vendor", label: "Vendors" },
    { value: "delivery_boy", label: "Delivery Boys" },
];

const AdminCustomers = ({ defaultRole = "user" }) => {
    const [activeRole, setActiveRole] = useState("user");
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({});

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ role: activeRole, page, limit: 20 });
            if (search.trim()) params.set("search", search.trim());
            const { data } = await api.get(`/auth/users?${params}`);
            setUsers(data.users || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        } catch {
            setUsers([]);
        } finally { setLoading(false); }
    }, [activeRole, page, search]);

    const fetchStats = useCallback(async () => {
        try {
            const [u, v, d] = await Promise.all([
                api.get("/auth/users?role=user&limit=1"),
                api.get("/auth/users?role=vendor&limit=1"),
                api.get("/auth/users?role=delivery_boy&limit=1"),
            ]);
            setStats({
                users: u.data.total || 0,
                vendors: v.data.total || 0,
                delivery: d.data.total || 0,
            });
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { fetchStats(); }, [fetchStats]);
    useEffect(() => { setPage(1); }, [activeRole, search]);

    const toggleBlock = async (userId, currentlyBlocked) => {
        if (!window.confirm(`${currentlyBlocked ? "Unblock" : "Block"} this user?`)) return;
        try {
            const { data } = await api.patch(`/auth/users/${userId}/toggle-block`);
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: data.isBlocked } : u));
        } catch (e) {
            alert(e.response?.data?.message || "Action failed");
        }
    };

    const roleBadgeClass = (role) => {
        if (role === "vendor") return "ac-badge-vendor";
        if (role === "delivery_boy") return "ac-badge-delivery";
        return "ac-badge-user";
    };
    const roleLabel = (role) => {
        if (role === "delivery_boy") return "Delivery";
        return role;
    };

    return (
        <div className="ac-root">
            <style>{STYLES}</style>

            <div className="ac-header">
                <div>
                    <div className="ac-title">
                        {activeRole === "user" ? "Customers"
                            : activeRole === "vendor" ? "Vendors"
                                : "Delivery Boys"}
                    </div>
                    <div className="ac-subtitle">
                        {total} {activeRole === "delivery_boy" ? "delivery partners" : activeRole + "s"} total
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="ac-stat-row">
                <div className="ac-stat">
                    <div className="ac-stat-val">{stats.users ?? "—"}</div>
                    <div className="ac-stat-lbl">Total Customers</div>
                </div>
                <div className="ac-stat">
                    <div className="ac-stat-val">{stats.vendors ?? "—"}</div>
                    <div className="ac-stat-lbl">Vendors</div>
                </div>
                <div className="ac-stat">
                    <div className="ac-stat-val">{stats.delivery ?? "—"}</div>
                    <div className="ac-stat-lbl">Delivery Partners</div>
                </div>
            </div>

            {/* Filters */}
            <div className="ac-filters" style={{ marginBottom: 16 }}>
                {TABS.map(t => (
                    <button key={t.value} className={`ac-role-tab ${activeRole === t.value ? "active" : ""}`}
                        onClick={() => setActiveRole(t.value)}>
                        {t.label}
                    </button>
                ))}
                <input
                    className="ac-search"
                    placeholder="Search by name, email, phone…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="ac-table-wrap">
                {loading ? (
                    <div className="ac-spinner" />
                ) : users.length === 0 ? (
                    <div className="ac-empty">No {activeRole === "delivery_boy" ? "delivery partners" : activeRole + "s"} found</div>
                ) : (
                    <table className="ac-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Role</th>
                                <th>Verified</th>
                                <th>Joined</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u._id}>
                                    <td>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div className="ac-avatar">{u.name?.[0]?.toUpperCase()}</div>
                                            <span style={{ fontWeight: 600 }}>{u.name}{u.isBlocked && <span className="ac-blocked-badge">Blocked</span>}</span>
                                        </div>
                                    </td>
                                    <td style={{ color: "#64748b" }}>{u.email}</td>
                                    <td style={{ color: "#64748b" }}>{u.phone || "—"}</td>
                                    <td>
                                        <span className={`ac-role-badge ${roleBadgeClass(u.role)}`}>
                                            {roleLabel(u.role)}
                                        </span>
                                    </td>
                                    <td>
                                        {u.isEmailVerified
                                            ? <span className="ac-verified">✓ Verified</span>
                                            : <span className="ac-unverified">Pending</span>}
                                    </td>
                                    <td style={{ color: "#64748b" }}>
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                    </td>
                                    <td>
                                        <button
                                            className={`ac-action-btn ${u.isBlocked ? "unblock" : "block"}`}
                                            onClick={() => toggleBlock(u._id, u.isBlocked)}
                                        >
                                            {u.isBlocked ? "Unblock" : "Block"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}

                {!loading && users.length > 0 && (
                    <div className="ac-pagination">
                        <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
                        <div className="ac-page-btns">
                            <button className="ac-page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                const p = i + 1;
                                return <button key={p} className={`ac-page-btn ${page === p ? "current" : ""}`} onClick={() => setPage(p)}>{p}</button>;
                            })}
                            <button className="ac-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminCustomers;
