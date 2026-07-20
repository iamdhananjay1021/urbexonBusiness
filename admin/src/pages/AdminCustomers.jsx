/**
 * AdminCustomers.jsx — Customers + Delivery Boys management
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/adminApi";
import { FiUsers, FiShoppingBag, FiTruck, FiUserX, FiUserCheck } from "react-icons/fi";
import {
    Button, Badge, Card, Table, Pagination, SearchBar, Modal, ErrorState,
} from "../components/ui";
import { showToast } from "../utils/toast";

const TABS = [
    { value: "user", label: "Customers" },
    { value: "vendor", label: "Vendors" },
    { value: "delivery_boy", label: "Delivery Boys" },
];

const ROLE_TONE = { user: "info", vendor: "success", delivery_boy: "warning" };

const AdminCustomers = ({ defaultRole = "user" }) => {
    const [activeRole, setActiveRole] = useState("user");
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [stats, setStats] = useState({});
    const [actionLoading, setActionLoading] = useState(null);
    const [confirmTarget, setConfirmTarget] = useState(null); // user pending block/unblock

    // [FIX] Previously the catch block only did setUsers([]) with no error
    // state at all — a genuine network/server failure rendered identically
    // to "there are zero customers" (Table's own empty state), silently
    // misleading rather than surfacing the failure.
    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({ role: activeRole, page, limit: 20 });
            if (search.trim()) params.set("search", search.trim());
            const { data } = await api.get(`/auth/users?${params}`);
            setUsers(data.users || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        } catch (err) {
            setUsers([]);
            setError(err.response?.data?.message || "Failed to load users");
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

    const toggleBlock = async () => {
        if (!confirmTarget) return;
        const { _id: userId } = confirmTarget;
        setActionLoading(userId);
        try {
            const { data } = await api.patch(`/auth/users/${userId}/toggle-block`);
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: data.isBlocked } : u));
            setConfirmTarget(null);
        } catch (e) {
            showToast(e.response?.data?.message || "Action failed", "error");
        } finally {
            setActionLoading(null);
        }
    };

    const roleLabel = (role) => (role === "delivery_boy" ? "Delivery" : role);

    const columns = [
        { key: "user", label: "User" },
        { key: "email", label: "Email" },
        { key: "phone", label: "Phone" },
        { key: "role", label: "Role" },
        { key: "verified", label: "Verified" },
        { key: "joined", label: "Joined" },
        { key: "actions", label: "Actions" },
    ];

    return (
        <div style={{ fontFamily: "var(--adm-font-sans)", color: "var(--adm-text-primary)", padding: 28 }}>
            <Modal
                open={!!confirmTarget}
                onClose={() => setConfirmTarget(null)}
                title={confirmTarget?.isBlocked ? "Unblock this user?" : "Block this user?"}
                width={380}
                footer={(
                    <>
                        <Button variant="secondary" onClick={() => setConfirmTarget(null)} disabled={!!actionLoading}>Cancel</Button>
                        <Button
                            variant={confirmTarget?.isBlocked ? "success" : "danger"}
                            icon={confirmTarget?.isBlocked ? FiUserCheck : FiUserX}
                            loading={actionLoading === confirmTarget?._id}
                            onClick={toggleBlock}
                        >
                            {confirmTarget?.isBlocked ? "Unblock" : "Block"}
                        </Button>
                    </>
                )}
            >
                <p style={{ fontSize: 13, color: "var(--adm-text-secondary)", margin: 0, lineHeight: 1.55 }}>
                    {confirmTarget?.isBlocked
                        ? `${confirmTarget?.name || "This user"} will regain access immediately.`
                        : `${confirmTarget?.name || "This user"} will lose access immediately.`}
                </p>
            </Modal>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <div>
                    <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--adm-text-primary)", margin: 0 }}>
                        {activeRole === "user" ? "Customers" : activeRole === "vendor" ? "Vendors" : "Delivery Boys"}
                    </h1>
                    <p style={{ fontSize: 13, color: "var(--adm-muted)", marginTop: 2 }}>
                        {total} {activeRole === "delivery_boy" ? "delivery partners" : activeRole + "s"} total
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
                <Card>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <FiUsers size={18} color="var(--adm-info)" />
                        <div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--adm-text-primary)" }}>{stats.users ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>Total Customers</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <FiShoppingBag size={18} color="var(--adm-success)" />
                        <div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--adm-text-primary)" }}>{stats.vendors ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>Vendors</div>
                        </div>
                    </div>
                </Card>
                <Card>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <FiTruck size={18} color="var(--adm-warning)" />
                        <div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--adm-text-primary)" }}>{stats.delivery ?? "—"}</div>
                            <div style={{ fontSize: 12, color: "var(--adm-muted)", marginTop: 2 }}>Delivery Partners</div>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
                {TABS.map(t => (
                    <Button
                        key={t.value}
                        variant={activeRole === t.value ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => setActiveRole(t.value)}
                    >
                        {t.label}
                    </Button>
                ))}
                <div style={{ minWidth: 240 }}>
                    <SearchBar value={search} onChange={setSearch} placeholder="Search by name, email, phone…" />
                </div>
            </div>

            {/* Table */}
            {error && !loading ? (
                <ErrorState message={error} onRetry={fetchUsers} />
            ) : (
            <Table
                columns={columns}
                rows={users}
                loading={loading}
                empty={{ icon: FiUsers, title: `No ${activeRole === "delivery_boy" ? "delivery partners" : activeRole + "s"} found` }}
                renderRow={(u) => (
                    <tr key={u._id}>
                        <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: "var(--adm-radius-sm)",
                                    background: "var(--adm-primary-tint)", color: "var(--adm-primary)",
                                    fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    {u.name?.[0]?.toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                                    {u.name}
                                    {u.isBlocked && <Badge tone="danger">Blocked</Badge>}
                                </span>
                            </div>
                        </td>
                        <td style={{ color: "var(--adm-text-secondary)" }}>{u.email}</td>
                        <td style={{ color: "var(--adm-text-secondary)" }}>{u.phone || "—"}</td>
                        <td><Badge tone={ROLE_TONE[u.role] || "neutral"}>{roleLabel(u.role)}</Badge></td>
                        <td>
                            {u.isEmailVerified
                                ? <span style={{ color: "var(--adm-success)", fontSize: 11, fontWeight: 700 }}>✓ Verified</span>
                                : <span style={{ color: "var(--adm-muted)", fontSize: 11 }}>Pending</span>}
                        </td>
                        <td style={{ color: "var(--adm-text-secondary)" }}>
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td>
                            <Button
                                variant={u.isBlocked ? "success" : "danger"}
                                size="sm"
                                icon={u.isBlocked ? FiUserCheck : FiUserX}
                                onClick={() => setConfirmTarget(u)}
                            >
                                {u.isBlocked ? "Unblock" : "Block"}
                            </Button>
                        </td>
                    </tr>
                )}
            />
            )}

            {!loading && !error && users.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, flexWrap: "wrap", gap: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--adm-muted)" }}>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
                    <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} disabled={loading} />
                </div>
            )}
        </div>
    );
};

export default AdminCustomers;
