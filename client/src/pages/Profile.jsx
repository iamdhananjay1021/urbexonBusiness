import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as authApi from "../api/authApi";
import * as addressApi from "../api/addressApi";
import * as orderApi from "../api/orderApi";
import SEO from "../components/SEO";
import {
    FiUser, FiBox, FiArrowRight,
    FiMapPin, FiLogOut, FiEdit2, FiSave,
    FiX, FiLock, FiEye, FiEyeOff, FiPlus, FiArrowLeft,
    FiTrash2, FiCheckCircle, FiChevronRight,
} from "react-icons/fi";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Select from "../design-system/Select";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Tabs from "../design-system/Tabs";
import Avatar from "../design-system/Avatar";
import StatusBadge from "../design-system/StatusBadge";
import { EmptyState } from "../design-system/EmptyState";
import Loader from "../design-system/Loader";

const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh", "Puducherry", "Andaman & Nicobar", "Dadra & Nagar Haveli", "Lakshadweep"];

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
            const { data } = await addressApi.getAddresses();
            setAddresses(Array.isArray(data) ? data : (data?.addresses || []));
        } catch { setAddresses([]); }
        finally { setLoadingAddr(false); }
    };

    /* ── Fetch recent orders ── */
    const fetchRecentOrders = async () => {
        try {
            setLoadingOrders(true);
            const { data } = await orderApi.getMyOrders("?limit=3");
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
            const { data } = await authApi.updateProfile({ name: editName.trim(), phone: editPhone.trim() });
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
            await authApi.changePassword({ currentPassword: currentPw, newPassword: newPw });
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
                await addressApi.updateAddress(addrForm._id, addrForm);
            } else {
                await addressApi.addAddress(addrForm);
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
            await addressApi.deleteAddress(id);
            setAddresses(prev => prev.filter(a => a._id !== id));
        } catch {
            // Intentionally swallowed — UI already reflects optimistic local removal above only on success;
            // on failure the address list is simply left unchanged. No behavior change, just documented for lint.
        }
    };

    /* ── Logout ── */
    const handleLogout = () => { logout(); navigate("/"); };

    const TABS = [
        { value: "profile", label: "Profile" },
        { value: "addresses", label: "Addresses" },
        { value: "orders", label: "Orders" },
    ];

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="My Profile" noindex />

            {/* ── Header ── */}
            <div className="relative bg-[var(--color-graphite-900)] pt-10 pb-20 px-5 text-center overflow-hidden">
                <div className="absolute bottom-[-1px] left-0 right-0 h-10 bg-canvas rounded-t-[40px]" />
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Go back"
                    className="absolute top-5 left-5 bg-white/15 hover:bg-white/25 border-none rounded-full w-9 h-9 flex items-center justify-center text-white transition-colors"
                >
                    <FiArrowLeft size={14} aria-hidden="true" />
                </button>
                <Avatar name={user?.name} size="xl" className="mx-auto mb-3" />
                <p className="font-display text-2xl font-bold text-white mb-1">{user?.name}</p>
                <p className="text-xs text-white/50 tracking-wide">{user?.email}</p>
            </div>

            {/* ── Content ── */}
            <div className="max-w-[560px] mx-auto px-4 pb-12 -mt-8 relative z-10">
                <div className="flex justify-center mb-6">
                    <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} className="bg-surface rounded-full border-0 shadow-sm px-2" />
                </div>

                {/* ════ PROFILE TAB ════ */}
                {activeTab === "profile" && (
                    <div className="flex flex-col gap-4">
                        {/* Profile info */}
                        <Card>
                            <p className="text-[11px] font-extrabold tracking-widest uppercase text-accent mb-5 flex items-center gap-2"><FiUser size={10} aria-hidden="true" /> Account Info</p>

                            {profileMsg.text && (
                                <Alert variant={profileMsg.type === "success" ? "success" : "error"} className="mb-4">{profileMsg.text}</Alert>
                            )}

                            <div className="flex flex-col gap-4">
                                <Input
                                    label="Full Name"
                                    value={editMode ? editName : (user?.name || "")}
                                    onChange={e => setEditName(e.target.value)}
                                    disabled={!editMode}
                                    placeholder="Your name"
                                />
                                <Input label="Email" value={user?.email || ""} disabled placeholder="Email" helperText="Email cannot be changed" />
                                <Input
                                    label="Phone" type="tel" maxLength={10}
                                    value={editMode ? editPhone : (user?.phone || "")}
                                    onChange={e => setEditPhone(e.target.value.replace(/\D/g, ""))}
                                    disabled={!editMode}
                                    placeholder="10-digit mobile number"
                                    helperText={editMode ? "Enter 10-digit Indian mobile number" : undefined}
                                />
                            </div>

                            <div className="flex gap-2.5 mt-5">
                                {editMode ? (
                                    <>
                                        <Button variant="primary" className="flex-1" icon={FiSave} loading={savingProfile} onClick={handleSaveProfile}>
                                            {savingProfile ? "Saving…" : "Save Changes"}
                                        </Button>
                                        <Button variant="secondary" className="flex-1" icon={FiX} onClick={() => { setEditMode(false); setEditName(user?.name || ""); setEditPhone(user?.phone || ""); setProfileMsg({ type: "", text: "" }); }}>
                                            Cancel
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="secondary" className="flex-1" icon={FiEdit2} onClick={() => { setEditMode(true); setEditName(user?.name || ""); setEditPhone(user?.phone || ""); }}>
                                        Edit Profile
                                    </Button>
                                )}
                            </div>
                        </Card>

                        {/* Change Password */}
                        <Card>
                            <p className="text-[11px] font-extrabold tracking-widest uppercase text-accent mb-5 flex items-center gap-2"><FiLock size={10} aria-hidden="true" /> Change Password</p>

                            {pwMsg.text && (
                                <Alert variant={pwMsg.type === "success" ? "success" : "error"} className="mb-4">{pwMsg.text}</Alert>
                            )}

                            {pwMode ? (
                                <div className="flex flex-col gap-3.5">
                                    <Input
                                        label="Current Password" type={showCurrent ? "text" : "password"}
                                        value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password"
                                        trailingIcon={showCurrent ? FiEyeOff : FiEye} trailingIconLabel={showCurrent ? "Hide password" : "Show password"}
                                        onTrailingIconClick={() => setShowCurrent(s => !s)}
                                    />
                                    <Input
                                        label="New Password" type={showNew ? "text" : "password"}
                                        value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Min 6 characters"
                                        trailingIcon={showNew ? FiEyeOff : FiEye} trailingIconLabel={showNew ? "Hide password" : "Show password"}
                                        onTrailingIconClick={() => setShowNew(s => !s)}
                                    />
                                    <Input label="Confirm New Password" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
                                    <div className="flex gap-2.5 mt-1">
                                        <Button variant="primary" className="flex-1" icon={FiLock} loading={savingPw} onClick={handleSavePassword}>
                                            {savingPw ? "Saving…" : "Update Password"}
                                        </Button>
                                        <Button variant="secondary" className="flex-1" icon={FiX} onClick={() => { setPwMode(false); setCurrentPw(""); setNewPw(""); setConfirmPw(""); setPwMsg({ type: "", text: "" }); }}>
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <Button variant="secondary" className="w-full" icon={FiLock} onClick={() => setPwMode(true)}>
                                    Change Password
                                </Button>
                            )}
                        </Card>

                        {/* Logout */}
                        <Button variant="danger" className="w-full" icon={FiLogOut} onClick={handleLogout}>
                            Logout
                        </Button>
                    </div>
                )}

                {/* ════ ADDRESSES TAB ════ */}
                {activeTab === "addresses" && (
                    <Card>
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-[11px] font-extrabold tracking-widest uppercase text-accent flex items-center gap-2"><FiMapPin size={10} aria-hidden="true" /> Saved Addresses</p>
                            {!addrForm && (
                                <Button
                                    variant="primary" size="sm" icon={FiPlus}
                                    onClick={() => setAddrForm({ name: "", phone: "", house: "", area: "", landmark: "", city: "", state: "", pincode: "" })}
                                >
                                    Add New
                                </Button>
                            )}
                        </div>

                        {addrMsg.text && (
                            <Alert variant={addrMsg.type === "success" ? "success" : "error"} className="mb-4">{addrMsg.text}</Alert>
                        )}

                        {/* Address Form */}
                        {addrForm && (
                            <Card className="mb-4 border-[var(--accent-primary)] bg-accent-tint" padding="md">
                                <p className="text-[11px] font-extrabold tracking-widest uppercase text-accent mb-3.5">
                                    {addrForm._id ? "Edit Address" : "New Address"}
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="sm:col-span-2">
                                        <Input label="Full Name *" value={addrForm.name || ""} onChange={e => setAddrForm(f => ({ ...f, name: e.target.value }))} placeholder="Recipient name" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Input label="Phone *" value={addrForm.phone || ""} onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile number" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Input label="House / Flat / Street *" value={addrForm.house || ""} onChange={e => setAddrForm(f => ({ ...f, house: e.target.value }))} placeholder="House no, building, street" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Input label="Area / Locality *" value={addrForm.area || ""} onChange={e => setAddrForm(f => ({ ...f, area: e.target.value }))} placeholder="Area, colony, locality" />
                                    </div>
                                    <div className="sm:col-span-2">
                                        <Input label="Landmark" value={addrForm.landmark || ""} onChange={e => setAddrForm(f => ({ ...f, landmark: e.target.value }))} placeholder="Nearby landmark (optional)" />
                                    </div>
                                    <Input label="City *" value={addrForm.city || ""} onChange={e => setAddrForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
                                    <Input label="Pincode *" value={addrForm.pincode || ""} onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value }))} placeholder="6-digit pincode" maxLength={6} />
                                    <div className="sm:col-span-2">
                                        <Select
                                            label="State *"
                                            value={addrForm.state || ""}
                                            onChange={e => setAddrForm(f => ({ ...f, state: e.target.value }))}
                                            placeholder="Select State"
                                            options={INDIAN_STATES.map(s => ({ value: s, label: s }))}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2.5 mt-3.5">
                                    <Button variant="primary" className="flex-1" icon={FiSave} loading={savingAddr} onClick={handleSaveAddress}>
                                        {savingAddr ? "Saving…" : "Save Address"}
                                    </Button>
                                    <Button variant="secondary" className="flex-1" icon={FiX} onClick={() => { setAddrForm(null); setAddrMsg({ type: "", text: "" }); }}>
                                        Cancel
                                    </Button>
                                </div>
                            </Card>
                        )}

                        {/* Address List */}
                        {loadingAddr ? (
                            <div className="flex justify-center py-8"><Loader /></div>
                        ) : addresses.length === 0 ? (
                            <EmptyState icon={FiMapPin} title="No saved addresses yet" />
                        ) : (
                            addresses.map(addr => (
                                <Card key={addr._id} className="mb-3" padding="md">
                                    <div className="flex justify-between items-start gap-2.5">
                                        <div className="flex-1">
                                            <p className="text-[13px] font-bold text-primary mb-1">{addr.name}</p>
                                            <p className="text-xs text-secondary leading-relaxed">
                                                {addr.house}{addr.area ? `, ${addr.area}` : ""}{addr.landmark ? `, ${addr.landmark}` : ""}<br />
                                                {addr.city}, {addr.state} — {addr.pincode}<br />
                                                📞 {addr.phone}
                                            </p>
                                        </div>
                                        <div className="flex gap-2 flex-shrink-0">
                                            <button
                                                onClick={() => setAddrForm({ ...addr })}
                                                aria-label="Edit address"
                                                className="w-[30px] h-[30px] border border-default bg-surface rounded-[var(--radius-sm)] flex items-center justify-center text-secondary hover:border-[var(--accent-primary)] hover:text-accent transition-colors"
                                            >
                                                <FiEdit2 size={11} aria-hidden="true" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteAddress(addr._id)}
                                                aria-label="Delete address"
                                                className="w-[30px] h-[30px] border border-[var(--color-error-100)] bg-error-tint rounded-[var(--radius-sm)] flex items-center justify-center text-error hover:brightness-95 transition-all"
                                            >
                                                <FiTrash2 size={11} aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        )}
                    </Card>
                )}

                {/* ════ ORDERS TAB ════ */}
                {activeTab === "orders" && (
                    <Card>
                        <div className="flex items-center justify-between mb-5">
                            <p className="text-[11px] font-extrabold tracking-widest uppercase text-accent flex items-center gap-2"><FiBox size={10} aria-hidden="true" /> Recent Orders</p>
                            <Link to="/orders" className="text-[11px] font-bold text-accent uppercase tracking-wide flex items-center gap-1">
                                View All <FiChevronRight size={9} aria-hidden="true" />
                            </Link>
                        </div>

                        {loadingOrders ? (
                            <div className="flex justify-center py-8"><Loader /></div>
                        ) : recentOrders.length === 0 ? (
                            <EmptyState
                                icon={FiBox}
                                title="No orders yet"
                                action={<Button variant="primary" icon={FiArrowRight} onClick={() => navigate("/")}>Start Shopping</Button>}
                            />
                        ) : (
                            <>
                                {recentOrders.map(order => (
                                    <Card
                                        key={order._id} interactive className="mb-3"
                                        padding="md" onClick={() => navigate(`/orders/${order._id}`)}
                                    >
                                        <div className="flex justify-between items-start mb-2.5">
                                            <div>
                                                <p className="text-[11px] font-bold text-muted uppercase tracking-wide mb-0.5">
                                                    #{order._id?.slice(-8).toUpperCase()}
                                                </p>
                                                <p className="text-xs text-secondary">
                                                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <StatusBadge status={order.orderStatus || "Pending"} />
                                                <p className="text-[13px] font-bold text-primary mt-1.5">
                                                    ₹{Number(order.totalPrice || order.totalAmount || 0).toLocaleString("en-IN")}
                                                </p>
                                            </div>
                                        </div>
                                        {/* Order items preview */}
                                        <div className="flex gap-2 items-center">
                                            {order.orderItems?.slice(0, 3).map((item, i) => (
                                                <div key={i} className="w-11 h-11 rounded-[var(--radius-sm)] overflow-hidden border border-default flex-shrink-0 bg-canvas">
                                                    {item.image || item.images?.[0]?.url ? (
                                                        <img src={item.image || item.images?.[0]?.url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-lg">📦</div>
                                                    )}
                                                </div>
                                            ))}
                                            {order.orderItems?.length > 3 && (
                                                <span className="text-[11px] text-secondary font-semibold">+{order.orderItems.length - 3} more</span>
                                            )}
                                            <FiChevronRight size={11} className="text-muted ml-auto" aria-hidden="true" />
                                        </div>
                                    </Card>
                                ))}
                                <Link to="/orders">
                                    <Button variant="secondary" className="w-full mt-1" icon={FiArrowRight}>
                                        View All Orders
                                    </Button>
                                </Link>
                            </>
                        )}
                    </Card>
                )}

            </div>
        </div>
    );
};

export default Profile;
