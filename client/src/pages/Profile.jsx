import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import {
    FaUser, FaEnvelope, FaBox, FaArrowRight,
    FaMapMarkerAlt, FaSignOutAlt, FaEdit, FaSave,
    FaTimes, FaLock, FaEye, FaEyeSlash, FaPlus,
    FaTrash, FaCheckCircle, FaSpinner, FaPhone,
    FaStar, FaChevronRight,
} from "react-icons/fa";

/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
const Profile = () => {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();

    /* ── Tabs ── */
    const [activeTab, setActiveTab] = useState("profile");

    /* ── Edit Profile ── */
    const [editMode, setEditMode] = useState(false);
    const [editName, setEditName] = useState(user?.name || "");
    const [editEmail, setEditEmail] = useState(user?.email || "");
    const [editPhone, setEditPhone] = useState(user?.phone || "");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });

    /* ── Change Password ── */
    const [pwMode, setPwMode] = useState(false);
    const [currentPw, setCurrentPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [savingPw, setSavingPw] = useState(false);
    const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

    /* ── Addresses ── */
    const [addresses, setAddresses] = useState([]);
    const [loadingAddr, setLoadingAddr] = useState(false);
    const [addrForm, setAddrForm] = useState(null); // null = closed, {} = new, {_id} = edit
    const [savingAddr, setSavingAddr] = useState(false);
    const [addrMsg, setAddrMsg] = useState({ type: "", text: "" });

    /* ── Orders ── */
    const [recentOrders, setRecentOrders] = useState([]);
    const [loadingOrders, setLoadingOrders] = useState(false);

    /* ── Fetch addresses ── */
    const fetchAddresses = async () => {
        try {
            setLoadingAddr(true);
            const { data } = await api.get("/addresses");
            setAddresses(Array.isArray(data) ? data : (data?.addresses || []));
        } catch { setAddresses([]); }
        finally { setLoadingAddr(false); }
    };

    /* ── Fetch recent orders ── */
    const fetchRecentOrders = async () => {
        try {
            setLoadingOrders(true);
            const { data } = await api.get("/orders/my?limit=3");
            const orders = Array.isArray(data) ? data : (data?.orders || []);
            setRecentOrders(orders.slice(0, 3));
        } catch { setRecentOrders([]); }
        finally { setLoadingOrders(false); }
    };

    useEffect(() => {
        fetchAddresses();
        fetchRecentOrders();
    }, []);

    /* ── Save profile ── */
    const handleSaveProfile = async () => {
        if (!editName.trim()) return setProfileMsg({ type: "error", text: "Name cannot be empty" });
        try {
            setSavingProfile(true); setProfileMsg({ type: "", text: "" });
            const { data } = await api.put("/auth/profile", { name: editName.trim(), phone: editPhone.trim() });
            if (updateUser) updateUser(data);
            setProfileMsg({ type: "success", text: "Profile updated successfully!" });
            setEditMode(false);
        } catch (err) {
            setProfileMsg({ type: "error", text: err.response?.data?.message || "Failed to update profile" });
        } finally { setSavingProfile(false); }
    };

    /* ── Save password ── */
    const handleSavePassword = async () => {
        if (!currentPw || !newPw || !confirmPw) return setPwMsg({ type: "error", text: "All fields required" });
        if (newPw.length < 6) return setPwMsg({ type: "error", text: "New password must be at least 6 characters" });
        if (newPw !== confirmPw) return setPwMsg({ type: "error", text: "Passwords do not match" });
        try {
            setSavingPw(true); setPwMsg({ type: "", text: "" });
            await api.put("/auth/change-password", { currentPassword: currentPw, newPassword: newPw });
            setPwMsg({ type: "success", text: "Password changed successfully!" });
            setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwMode(false);
        } catch (err) {
            setPwMsg({ type: "error", text: err.response?.data?.message || "Failed to change password" });
        } finally { setSavingPw(false); }
    };

    /* ── Save address ── */
    const handleSaveAddress = async () => {
        if (!addrForm?.name || !addrForm?.phone || !addrForm?.house || !addrForm?.area || !addrForm?.city || !addrForm?.state || !addrForm?.pincode) {
            return setAddrMsg({ type: "error", text: "Please fill all required fields" });
        }
        try {
            setSavingAddr(true); setAddrMsg({ type: "", text: "" });
            if (addrForm._id) {
                await api.put(`/addresses/${addrForm._id}`, addrForm);
            } else {
                await api.post("/addresses", addrForm);
            }
            await fetchAddresses();
            setAddrForm(null);
            setAddrMsg({ type: "success", text: "Address saved!" });
            setTimeout(() => setAddrMsg({ type: "", text: "" }), 2500);
        } catch (err) {
            setAddrMsg({ type: "error", text: err.response?.data?.message || "Failed to save address" });
        } finally { setSavingAddr(false); }
    };

    /* ── Delete address ── */
    const handleDeleteAddress = async (id) => {
        if (!window.confirm("Delete this address?")) return;
        try {
            await api.delete(`/addresses/${id}`);
            setAddresses(prev => prev.filter(a => a._id !== id));
        } catch { }
    };

    /* ── Logout ── */
    const handleLogout = () => { logout(); navigate("/"); };

    /* ── Order status color ── */
    const statusColor = (s) => {
        const map = {
            delivered: "#16a34a", shipped: "#2563eb", processing: "#d97706",
            cancelled: "#dc2626", pending: "#78716c",
        };
        return map[s?.toLowerCase()] || "#78716c";
    };

    const TABS = [
        { key: "profile", label: "Profile" },
        { key: "addresses", label: "Addresses" },
        { key: "orders", label: "Orders" },
    ];

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

                :root {
                    --pf-gold:   #c9a84c;
                    --pf-navy:   #1a1740;
                    --pf-cream:  #f7f4ee;
                    --pf-border: #e8e4d9;
                    --pf-muted:  #78716c;
                    --pf-red:    #dc2626;
                    --pf-green:  #16a34a;
                }

                .pf-root { font-family:'DM Sans',sans-serif; min-height:100vh; background:var(--pf-cream); }

                /* Header */
                .pf-header { background:var(--pf-navy); padding:40px 20px 80px; text-align:center; position:relative; overflow:hidden; }
                .pf-header::after { content:''; position:absolute; bottom:-1px; left:0; right:0; height:40px; background:var(--pf-cream); border-radius:40px 40px 0 0; }
                .pf-avatar { width:80px; height:80px; border-radius:50%; background:var(--pf-gold); color:#fff; font-family:'Cormorant Garamond',serif; font-size:2.2rem; font-weight:700; display:flex; align-items:center; justify-content:center; margin:0 auto 12px; border:3px solid rgba(255,255,255,.2); box-shadow:0 8px 24px rgba(0,0,0,.2); }
                .pf-name { font-family:'Cormorant Garamond',serif; font-size:1.5rem; font-weight:700; color:#fff; margin-bottom:4px; }
                .pf-email { font-size:12px; color:rgba(255,255,255,.5); letter-spacing:.04em; }

                /* Tabs */
                .pf-tabs { display:flex; justify-content:center; gap:4px; padding:0 20px; margin-bottom:24px; }
                .pf-tab { padding:9px 22px; font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; border:1.5px solid var(--pf-border); background:#fff; color:var(--pf-muted); cursor:pointer; border-radius:40px; transition:all .2s; }
                .pf-tab.active { background:var(--pf-navy); color:#fff; border-color:var(--pf-navy); }
                .pf-tab:hover:not(.active) { border-color:var(--pf-gold); color:var(--pf-gold); }

                /* Card */
                .pf-card { background:#fff; border:1px solid var(--pf-border); border-radius:4px; padding:24px; margin-bottom:16px; }
                .pf-card-title { font-size:11px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; color:var(--pf-gold); margin-bottom:20px; display:flex; align-items:center; gap:8px; }

                /* Input */
                .pf-input { width:100%; padding:11px 14px; border:1.5px solid var(--pf-border); background:#fff; font-family:'DM Sans',sans-serif; font-size:13px; color:var(--pf-navy); outline:none; transition:border-color .2s; border-radius:4px; }
                .pf-input:focus { border-color:var(--pf-gold); }
                .pf-input:disabled { background:var(--pf-cream); color:var(--pf-muted); cursor:not-allowed; }
                .pf-label { font-size:11px; font-weight:700; color:var(--pf-muted); letter-spacing:.06em; text-transform:uppercase; margin-bottom:6px; display:block; }

                /* Buttons */
                .pf-btn-primary { display:flex; align-items:center; justify-content:center; gap:7px; padding:12px 24px; background:var(--pf-navy); color:#fff; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; transition:all .2s; border-radius:4px; }
                .pf-btn-primary:hover { background:var(--pf-gold); }
                .pf-btn-primary:disabled { opacity:.6; cursor:not-allowed; }
                .pf-btn-outline { display:flex; align-items:center; justify-content:center; gap:7px; padding:11px 24px; background:transparent; color:var(--pf-navy); border:1.5px solid var(--pf-navy); cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; transition:all .2s; border-radius:4px; }
                .pf-btn-outline:hover { background:var(--pf-navy); color:#fff; }
                .pf-btn-danger { display:flex; align-items:center; justify-content:center; gap:7px; padding:12px 24px; background:#fff5f5; color:var(--pf-red); border:1.5px solid #fecaca; cursor:pointer; font-family:'DM Sans',sans-serif; font-size:12px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; transition:all .2s; border-radius:4px; }
                .pf-btn-danger:hover { background:#fee2e2; }

                /* Message */
                .pf-msg { padding:10px 14px; border-radius:4px; font-size:12px; font-weight:600; margin-bottom:16px; display:flex; align-items:center; gap:8px; }
                .pf-msg.success { background:#f0fdf4; color:var(--pf-green); border:1px solid #bbf7d0; }
                .pf-msg.error   { background:#fff5f5; color:var(--pf-red);   border:1px solid #fecaca; }

                /* Address card */
                .pf-addr-card { border:1.5px solid var(--pf-border); border-radius:4px; padding:16px; margin-bottom:12px; position:relative; transition:border-color .2s; }
                .pf-addr-card:hover { border-color:var(--pf-gold); }

                /* Order card */
                .pf-order-card { border:1px solid var(--pf-border); border-radius:4px; padding:16px; margin-bottom:12px; cursor:pointer; transition:all .2s; }
                .pf-order-card:hover { border-color:var(--pf-gold); box-shadow:0 4px 16px rgba(28,25,23,.06); transform:translateY(-1px); }

                /* Pw input wrap */
                .pf-pw-wrap { position:relative; }
                .pf-pw-toggle { position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:var(--pf-muted); padding:4px; }

                @media(max-width:640px) {
                    .pf-card { padding:16px; }
                    .pf-tabs { gap:6px; }
                    .pf-tab { padding:8px 14px; font-size:11px; }
                }
            `}</style>

            <div className="pf-root">

                {/* ── Header ── */}
                <div className="pf-header">
                    <div className="pf-avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
                    <p className="pf-name">{user?.name}</p>
                    <p className="pf-email">{user?.email}</p>
                </div>

                {/* ── Content ── */}
                <div style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px 48px" }}>

                    {/* Tabs */}
                    <div className="pf-tabs">
                        {TABS.map(t => (
                            <button key={t.key} className={`pf-tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ════ PROFILE TAB ════ */}
                    {activeTab === "profile" && (
                        <>
                            {/* Profile info */}
                            <div className="pf-card">
                                <p className="pf-card-title"><FaUser size={10} /> Account Info</p>

                                {profileMsg.text && (
                                    <div className={`pf-msg ${profileMsg.type}`}>
                                        <FaCheckCircle size={11} /> {profileMsg.text}
                                    </div>
                                )}

                                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                    <div>
                                        <label className="pf-label">Full Name</label>
                                        <input className="pf-input" value={editMode ? editName : (user?.name || "")} onChange={e => setEditName(e.target.value)} disabled={!editMode} placeholder="Your name" />
                                    </div>
                                    <div>
                                        <label className="pf-label">Email</label>
                                        <input className="pf-input" value={user?.email || ""} disabled placeholder="Email" />
                                        <p style={{ fontSize: 10, color: "var(--pf-muted)", marginTop: 4 }}>Email cannot be changed</p>
                                    </div>
                                    <div>
                                        <label className="pf-label">Phone</label>
                                        <input className="pf-input" type="tel" maxLength={10} value={editMode ? editPhone : (user?.phone || "")} onChange={e => setEditPhone(e.target.value.replace(/\D/g, ""))} disabled={!editMode} placeholder="10-digit mobile number" />
                                        {editMode && <p style={{ fontSize: 10, color: "var(--pf-muted)", marginTop: 4 }}>Enter 10-digit Indian mobile number</p>}
                                    </div>
                                </div>

                                <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                                    {editMode ? (
                                        <>
                                            <button className="pf-btn-primary" onClick={handleSaveProfile} disabled={savingProfile} style={{ flex: 1 }}>
                                                {savingProfile ? <FaSpinner size={11} style={{ animation: "spin .7s linear infinite" }} /> : <FaSave size={11} />}
                                                {savingProfile ? "Saving…" : "Save Changes"}
                                            </button>
                                            <button className="pf-btn-outline" onClick={() => { setEditMode(false); setEditName(user?.name || ""); setEditPhone(user?.phone || ""); setProfileMsg({ type: "", text: "" }); }} style={{ flex: 1 }}>
                                                <FaTimes size={11} /> Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <button className="pf-btn-outline" onClick={() => { setEditMode(true); setEditName(user?.name || ""); setEditPhone(user?.phone || ""); }} style={{ flex: 1 }}>
                                            <FaEdit size={11} /> Edit Profile
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Change Password */}
                            <div className="pf-card">
                                <p className="pf-card-title"><FaLock size={10} /> Change Password</p>

                                {pwMsg.text && (
                                    <div className={`pf-msg ${pwMsg.type}`}>
                                        <FaCheckCircle size={11} /> {pwMsg.text}
                                    </div>
                                )}

                                {pwMode ? (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                        <div>
                                            <label className="pf-label">Current Password</label>
                                            <div className="pf-pw-wrap">
                                                <input className="pf-input" type={showCurrent ? "text" : "password"} value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" style={{ paddingRight: 40 }} />
                                                <button className="pf-pw-toggle" onClick={() => setShowCurrent(s => !s)}>{showCurrent ? <FaEyeSlash size={13} /> : <FaEye size={13} />}</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="pf-label">New Password</label>
                                            <div className="pf-pw-wrap">
                                                <input className="pf-input" type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters" style={{ paddingRight: 40 }} />
                                                <button className="pf-pw-toggle" onClick={() => setShowNew(s => !s)}>{showNew ? <FaEyeSlash size={13} /> : <FaEye size={13} />}</button>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="pf-label">Confirm New Password</label>
                                            <input className="pf-input" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                                        </div>
                                        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                                            <button className="pf-btn-primary" onClick={handleSavePassword} disabled={savingPw} style={{ flex: 1 }}>
                                                {savingPw ? <FaSpinner size={11} style={{ animation: "spin .7s linear infinite" }} /> : <FaLock size={11} />}
                                                {savingPw ? "Saving…" : "Update Password"}
                                            </button>
                                            <button className="pf-btn-outline" onClick={() => { setPwMode(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwMsg({ type: "", text: "" }); }} style={{ flex: 1 }}>
                                                <FaTimes size={11} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="pf-btn-outline" onClick={() => setPwMode(true)} style={{ width: "100%" }}>
                                        <FaLock size={11} /> Change Password
                                    </button>
                                )}
                            </div>

                            {/* Logout */}
                            <button className="pf-btn-danger" onClick={handleLogout} style={{ width: "100%", marginBottom: 0 }}>
                                <FaSignOutAlt size={13} /> Logout
                            </button>
                        </>
                    )}

                    {/* ════ ADDRESSES TAB ════ */}
                    {activeTab === "addresses" && (
                        <>
                            <div className="pf-card">
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                                    <p className="pf-card-title" style={{ margin: 0 }}><FaMapMarkerAlt size={10} /> Saved Addresses</p>
                                    {!addrForm && (
                                        <button className="pf-btn-primary" onClick={() => setAddrForm({ name: "", phone: "", house: "", area: "", landmark: "", city: "", state: "", pincode: "" })} style={{ padding: "8px 14px", fontSize: 11 }}>
                                            <FaPlus size={10} /> Add New
                                        </button>
                                    )}
                                </div>

                                {addrMsg.text && (
                                    <div className={`pf-msg ${addrMsg.type}`}>
                                        <FaCheckCircle size={11} /> {addrMsg.text}
                                    </div>
                                )}

                                {/* Address Form */}
                                {addrForm && (
                                    <div style={{ border: "1.5px solid var(--pf-gold)", borderRadius: 4, padding: 16, marginBottom: 16, background: "#fffdf5" }}>
                                        <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--pf-gold)", marginBottom: 14 }}>
                                            {addrForm._id ? "Edit Address" : "New Address"}
                                        </p>
                                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">Full Name *</label>
                                                <input className="pf-input" value={addrForm.name || ""} onChange={e => setAddrForm(f => ({ ...f, name: e.target.value }))} placeholder="Recipient name" />
                                            </div>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">Phone *</label>
                                                <input className="pf-input" value={addrForm.phone || ""} onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile number" />
                                            </div>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">House / Flat / Street *</label>
                                                <input className="pf-input" value={addrForm.house || ""} onChange={e => setAddrForm(f => ({ ...f, house: e.target.value }))} placeholder="House no, building, street" />
                                            </div>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">Area / Locality *</label>
                                                <input className="pf-input" value={addrForm.area || ""} onChange={e => setAddrForm(f => ({ ...f, area: e.target.value }))} placeholder="Area, colony, locality" />
                                            </div>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">Landmark</label>
                                                <input className="pf-input" value={addrForm.landmark || ""} onChange={e => setAddrForm(f => ({ ...f, landmark: e.target.value }))} placeholder="Nearby landmark (optional)" />
                                            </div>
                                            <div>
                                                <label className="pf-label">City *</label>
                                                <input className="pf-input" value={addrForm.city || ""} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                                            </div>
                                            <div>
                                                <label className="pf-label">Pincode *</label>
                                                <input className="pf-input" value={addrForm.pincode || ""} onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} placeholder="6-digit pincode" maxLength={6} />
                                            </div>
                                            <div style={{ gridColumn: "1/-1" }}>
                                                <label className="pf-label">State *</label>
                                                <select className="pf-input" value={addrForm.state || ""} onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))}>
                                                    <option value="">Select State</option>
                                                    {["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh", "Puducherry", "Andaman & Nicobar", "Dadra & Nagar Haveli", "Lakshadweep"].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                                            <button className="pf-btn-primary" onClick={handleSaveAddress} disabled={savingAddr} style={{ flex: 1 }}>
                                                {savingAddr ? <FaSpinner size={11} style={{ animation: "spin .7s linear infinite" }} /> : <FaSave size={11} />}
                                                {savingAddr ? "Saving…" : "Save Address"}
                                            </button>
                                            <button className="pf-btn-outline" onClick={() => { setAddrForm(null); setAddrMsg({ type: "", text: "" }); }} style={{ flex: 1 }}>
                                                <FaTimes size={11} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Address List */}
                                {loadingAddr ? (
                                    <div style={{ textAlign: "center", padding: "32px 0", color: "var(--pf-muted)", fontSize: 13 }}>Loading addresses…</div>
                                ) : addresses.length === 0 ? (
                                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                                        <FaMapMarkerAlt size={28} style={{ color: "var(--pf-border)", marginBottom: 10 }} />
                                        <p style={{ fontSize: 13, color: "var(--pf-muted)" }}>No saved addresses yet</p>
                                    </div>
                                ) : (
                                    addresses.map(addr => (
                                        <div key={addr._id} className="pf-addr-card">
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-navy)", marginBottom: 4 }}>{addr.name}</p>
                                                    <p style={{ fontSize: 12, color: "var(--pf-muted)", lineHeight: 1.6 }}>
                                                        {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}<br />
                                                        {addr.city}, {addr.state} — {addr.pincode}<br />
                                                        📞 {addr.phone}
                                                    </p>
                                                </div>
                                                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                                                    <button onClick={() => setAddrForm({ ...addr })}
                                                        style={{ width: 30, height: 30, border: "1px solid var(--pf-border)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--pf-muted)", transition: "all .2s" }}
                                                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--pf-gold)"; e.currentTarget.style.color = "var(--pf-gold)"; }}
                                                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--pf-border)"; e.currentTarget.style.color = "var(--pf-muted)"; }}>
                                                        <FaEdit size={11} />
                                                    </button>
                                                    <button onClick={() => handleDeleteAddress(addr._id)}
                                                        style={{ width: 30, height: 30, border: "1px solid #fecaca", background: "#fff5f5", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 4, color: "var(--pf-red)", transition: "all .2s" }}
                                                        onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
                                                        onMouseLeave={e => e.currentTarget.style.background = "#fff5f5"}>
                                                        <FaTrash size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}

                    {/* ════ ORDERS TAB ════ */}
                    {activeTab === "orders" && (
                        <div className="pf-card">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                                <p className="pf-card-title" style={{ margin: 0 }}><FaBox size={10} /> Recent Orders</p>
                                <Link to="/orders" style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-gold)", textDecoration: "none", letterSpacing: ".06em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                                    View All <FaChevronRight size={9} />
                                </Link>
                            </div>

                            {loadingOrders ? (
                                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--pf-muted)", fontSize: 13 }}>Loading orders…</div>
                            ) : recentOrders.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "40px 0" }}>
                                    <FaBox size={28} style={{ color: "var(--pf-border)", marginBottom: 10 }} />
                                    <p style={{ fontSize: 13, color: "var(--pf-muted)", marginBottom: 16 }}>No orders yet</p>
                                    <button className="pf-btn-primary" onClick={() => navigate("/")} style={{ margin: "0 auto" }}>
                                        Start Shopping <FaArrowRight size={11} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {recentOrders.map(order => (
                                        <div key={order._id} className="pf-order-card" onClick={() => navigate(`/orders/${order._id}`)}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                                                <div>
                                                    <p style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-muted)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>
                                                        #{order._id?.slice(-8).toUpperCase()}
                                                    </p>
                                                    <p style={{ fontSize: 12, color: "var(--pf-muted)" }}>
                                                        {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: "right" }}>
                                                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", background: `${statusColor(order.orderStatus)}18`, color: statusColor(order.orderStatus) }}>
                                                        {order.orderStatus || "Pending"}
                                                    </span>
                                                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-navy)", marginTop: 5 }}>
                                                        ₹{Number(order.totalPrice || order.totalAmount || 0).toLocaleString("en-IN")}
                                                    </p>
                                                </div>
                                            </div>
                                            {/* Order items preview */}
                                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                                {order.orderItems?.slice(0, 3).map((item, i) => (
                                                    <div key={i} style={{ width: 44, height: 44, borderRadius: 4, overflow: "hidden", border: "1px solid var(--pf-border)", flexShrink: 0, background: "var(--pf-cream)" }}>
                                                        {item.image || item.images?.[0]?.url
                                                            ? <img src={item.image || item.images?.[0]?.url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
                                                        }
                                                    </div>
                                                ))}
                                                {order.orderItems?.length > 3 && (
                                                    <span style={{ fontSize: 11, color: "var(--pf-muted)", fontWeight: 600 }}>+{order.orderItems.length - 3} more</span>
                                                )}
                                                <FaChevronRight size={11} style={{ color: "var(--pf-border)", marginLeft: "auto" }} />
                                            </div>
                                        </div>
                                    ))}
                                    <Link to="/orders">
                                        <button className="pf-btn-outline" style={{ width: "100%", marginTop: 4 }}>
                                            View All Orders <FaArrowRight size={11} />
                                        </button>
                                    </Link>
                                </>
                            )}
                        </div>
                    )}

                </div>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </>
    );
};

export default Profile;