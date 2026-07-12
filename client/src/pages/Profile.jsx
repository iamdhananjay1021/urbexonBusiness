import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as authApi from "../api/authApi";
import * as addressApi from "../api/addressApi";
import SEO from "../components/SEO";
import {
    FiUser, FiBox, FiHeart, FiTag, FiArrowRight,
    FiMapPin, FiLogOut, FiEdit2, FiSave,
    FiX, FiLock, FiEye, FiEyeOff, FiPlus, FiArrowLeft,
    FiTrash2, FiChevronRight, FiHome, FiHeadphones, FiSettings,
} from "react-icons/fi";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Select from "../design-system/Select";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Avatar from "../design-system/Avatar";
import { EmptyState } from "../design-system/EmptyState";
import Loader from "../design-system/Loader";

const INDIAN_STATES = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Jammu & Kashmir", "Ladakh", "Puducherry", "Andaman & Nicobar", "Dadra & Nagar Haveli", "Lakshadweep"];

/* One row inside the "Quick Links" card — mirrors the list-navigation
   pattern from the reference screenshot (icon, label, chevron). `to`
   navigates to a real route; `onClick` is used instead for the two
   sections that expand inline below (Addresses, Account Settings) since
   those aren't separate pages. */
const QuickLinkRow = ({ icon: Icon, label, badge, to, onClick, active }) => {
    const content = (
        <>
            <div className="w-10 h-10 rounded-full bg-accent-tint flex items-center justify-center flex-shrink-0">
                <Icon className="text-accent" size={16} aria-hidden="true" />
            </div>
            <span className="flex-1 text-left text-[14px] font-semibold text-primary">{label}</span>
            {badge != null && (
                <span className="text-[11px] font-bold text-accent bg-accent-tint px-2 py-0.5 rounded-full min-w-[22px] text-center">{badge}</span>
            )}
            <FiChevronRight size={14} className={active ? "text-accent rotate-90 transition-transform" : "text-muted transition-transform"} aria-hidden="true" />
        </>
    );
    const rowClass = "w-full flex items-center gap-3 px-4 py-3.5 hover:bg-canvas transition-colors";
    return to ? (
        <Link to={to} className={rowClass}>{content}</Link>
    ) : (
        <button onClick={onClick} className={rowClass}>{content}</button>
    );
};

/* ══════════════════════════════════════
   PROFILE PAGE
══════════════════════════════════════ */
const Profile = () => {
    const { user, logout, updateUser } = useAuth();
    const navigate = useNavigate();

    /* ── Which inline section is open (null = none) ── */
    const [openSection, setOpenSection] = useState(null); // "addresses" | "account" | null

    /* ── Real "member since" — AuthContext's user object doesn't carry
       createdAt (the login response never included it), so fetch the
       full profile once instead of fabricating a date. ── */
    const [joinedAt, setJoinedAt] = useState(null);
    useEffect(() => {
        authApi.getProfile().then(({ data }) => setJoinedAt(data?.createdAt || null)).catch(() => { });
    }, []);

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

    /* ── Fetch addresses ── */
    const fetchAddresses = async () => {
        try {
            setLoadingAddr(true);
            const { data } = await addressApi.getAddresses();
            setAddresses(Array.isArray(data) ? data : (data?.addresses || []));
        } catch { setAddresses([]); }
        finally { setLoadingAddr(false); }
    };

    useEffect(() => { fetchAddresses(); }, []);

    /* ── Save profile ── */
    const handleSaveProfile = async () => {
        if (!editName.trim()) return setProfileMsg({ type: "error", text: "Name cannot be empty" });
        // 🐛 FIX: phone was never actually validated for length before hitting
        // the API — helper text promised "10-digit" but a 3-digit number would
        // silently go through. Only enforce when a phone is provided at all.
        if (editPhone && editPhone.length !== 10) {
            return setProfileMsg({ type: "error", text: "Enter a valid 10-digit phone number" });
        }
        try {
            setSavingProfile(true); setProfileMsg({ type: "", text: "" });
            const { data } = await authApi.updateProfile({ name: editName.trim(), phone: editPhone.trim() });
            // 🐛 FIX: updateUser(data) assumed the response body IS the user
            // object. If the API wraps it as { user: {...}, message } (the same
            // shape bug you hit in AdminAuthContext), this silently stored the
            // wrong object into auth state. Falls back safely either way.
            if (updateUser) updateUser(data?.user || data);
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
        // 🐛 FIX: phone/pincode had no format validation at all before save —
        // the labels promise "10-digit" and "6-digit" but nothing enforced it,
        // so malformed addresses could reach the backend (and delivery/rider
        // matching downstream depends on a clean 6-digit pincode).
        if (!/^\d{10}$/.test(addrForm.phone)) {
            return setAddrMsg({ type: "error", text: "Phone must be a valid 10-digit number" });
        }
        if (!/^\d{6}$/.test(addrForm.pincode)) {
            return setAddrMsg({ type: "error", text: "Pincode must be a valid 6-digit number" });
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
            // Local list is only updated after the API confirms deletion —
            // not optimistic, so a failed delete just leaves the list as-is.
            setAddresses(prev => prev.filter(a => a._id !== id));
        } catch (err) {
            setAddrMsg({ type: "error", text: err.response?.data?.message || "Failed to delete address" });
            setTimeout(() => setAddrMsg({ type: "", text: "" }), 2500);
        }
    };

    /* ── Logout ── */
    const handleLogout = () => { logout(); navigate("/"); };

    const memberSince = joinedAt
        ? new Date(joinedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
        : null;

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="My Profile" noindex />

            {/* ── Header — soft indigo-tint gradient fading into the page canvas ── */}
            <div
                className="relative pt-6 pb-16 px-5 text-center overflow-hidden"
                style={{ background: "linear-gradient(180deg, var(--accent-primary-tint) 0%, var(--accent-primary-tint) 55%, transparent 100%)" }}
            >
                <div className="flex items-center justify-between max-w-[560px] mx-auto mb-6 relative z-10">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="w-9 h-9 rounded-full bg-surface shadow-xs flex items-center justify-center text-secondary hover:text-accent transition-colors"
                    >
                        <FiArrowLeft size={15} aria-hidden="true" />
                    </button>
                    <p className="text-[15px] font-bold text-primary font-display">My Profile</p>
                    <Link
                        to="/contact"
                        className="flex items-center gap-1.5 bg-surface shadow-xs rounded-full px-3 py-1.5 text-[12px] font-bold text-secondary hover:text-accent transition-colors"
                    >
                        <FiHeadphones size={13} aria-hidden="true" /> Help
                    </Link>
                </div>

                <Avatar name={user?.name} size="xl" className="mx-auto mb-3 relative z-10 shadow-md" />
                <p className="font-display text-xl font-bold text-primary mb-1 relative z-10">{user?.name}</p>
                <p className="text-xs text-secondary relative z-10">{user?.email}</p>
                {memberSince && (
                    <p className="text-[11px] text-muted mt-1 relative z-10">Member since {memberSince}</p>
                )}
            </div>

            <div className="max-w-[560px] mx-auto px-4 relative z-10 -mt-8 pb-8">
                {/* ── Quick Links — the "list navigation" card ── */}
                <Card padding="none" className="mb-4 overflow-hidden divide-y divide-[var(--border-default)]">
                    <QuickLinkRow icon={FiBox} label="My Orders" to="/orders" />
                    <QuickLinkRow icon={FiHeart} label="Wishlist" to="/wishlist" />
                    <QuickLinkRow icon={FiTag} label="My Coupons" to="/coupons" />
                    <QuickLinkRow
                        icon={FiMapPin} label="Saved Addresses" badge={addresses.length}
                        active={openSection === "addresses"}
                        onClick={() => setOpenSection(s => s === "addresses" ? null : "addresses")}
                    />
                    <QuickLinkRow
                        icon={FiSettings} label="Account Settings"
                        active={openSection === "account"}
                        onClick={() => setOpenSection(s => s === "account" ? null : "account")}
                    />
                </Card>

                {/* ════ ADDRESSES (inline, toggled) ════ */}
                {openSection === "addresses" && (
                    <Card className="mb-4">
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
                                        <Input
                                            label="Phone *" type="tel" maxLength={10}
                                            value={addrForm.phone || ""}
                                            onChange={e => setAddrForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                                            placeholder="10-digit mobile number"
                                        />
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
                                    <Input
                                        label="Pincode *" maxLength={6}
                                        value={addrForm.pincode || ""}
                                        onChange={e => setAddrForm(f => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                                        placeholder="6-digit pincode"
                                    />
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
                                        <div className="w-9 h-9 rounded-full bg-accent-tint flex items-center justify-center flex-shrink-0">
                                            <FiHome size={14} className="text-accent" aria-hidden="true" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <p className="text-[13px] font-bold text-primary">{addr.name}</p>
                                                {addr.isDefault && (
                                                    <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-accent bg-accent-tint px-2 py-0.5 rounded-full">Default</span>
                                                )}
                                            </div>
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

                {/* ════ ACCOUNT SETTINGS (inline, toggled) ════ */}
                {openSection === "account" && (
                    <div className="flex flex-col gap-4 mb-4">
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
                    </div>
                )}

                {/* Logout */}
                <Button variant="danger" className="w-full" icon={FiLogOut} onClick={handleLogout}>
                    Logout
                </Button>
            </div>
        </div>
    );
};

export default Profile;
