/**
 * BankDetails.jsx — FINAL FIXED VERSION
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FiEdit, FiX, FiCreditCard } from "react-icons/fi";

const BankDetails = () => {
    const [initialDetails, setInitialDetails] = useState(null);

    const [bankDetails, setBankDetails] = useState({
        accountHolder: "",
        accountNumber: "",
        ifsc: "",
        bankName: "",
        upiId: "",
    });

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");

    const navigate = useNavigate();

    // ================= LOAD =================
    useEffect(() => {
        const load = async () => {
            try {
                const { data } = await api.get("/vendor/me");

                if (data.vendor?.bankDetails) {
                    setInitialDetails(data.vendor.bankDetails);
                    setBankDetails(data.vendor.bankDetails);
                }
            } catch (err) {
                console.error(err);
            }
        };

        load();
    }, []);

    // ================= HANDLE CHANGE =================
    const handleChange = (e) => {
        const { name, value } = e.target;

        setBankDetails(prev => ({
            ...prev,
            [name]: name === "ifsc" ? value.toUpperCase() : value
        }));

        setMessage("");
    };

    // ================= VALIDATION =================
    const validate = () => {
        if (bankDetails.accountNumber && !/^\d{9,18}$/.test(bankDetails.accountNumber)) {
            setMessage("❌ Invalid account number (9-18 digits)");
            return false;
        }

        // IFSC validation — only validate if account number is provided AND ifsc is provided
        if (bankDetails.accountNumber && bankDetails.ifsc) {
            const ifscCode = bankDetails.ifsc?.trim()?.toUpperCase();

            // Check if user used letter O instead of zero
            if (ifscCode.includes("O") && ifscCode.length === 11) {
                // Suggest correction
                const corrected = ifscCode.replace(/O/g, "0");
                if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(corrected)) {
                    setMessage(`❌ IFSC has letter "O" instead of "0" (zero). Did you mean: ${corrected}?`);
                    return false;
                }
            }

            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
                setMessage("❌ Invalid IFSC format. Must be: 4 letters + 0 (zero) + 6 characters. Example: SBIN0001234");
                return false;
            }
        }

        // Require at least account number OR UPI
        if (!bankDetails.accountNumber && !bankDetails.upiId) {
            setMessage("❌ Add bank account number (9-18 digits) OR UPI ID");
            return false;
        }

        return true;
    };

    // ================= SAVE =================
    const handleSave = async () => {
        if (!validate()) return;

        try {
            setSaving(true);

            await api.patch("/vendor/bank-details", bankDetails);

            setMessage("✅ Bank details saved!");
            setEditing(false);

            setTimeout(() => {
                navigate("/earnings");
            }, 1000);

        } catch (err) {
            console.error(err);
            setMessage("❌ Save failed");
        } finally {
            setSaving(false);
        }
    };

    // ================= CANCEL =================
    const cancelEdit = () => {
        setEditing(false);
        setBankDetails(initialDetails || {});
        setMessage("");
    };

    // ================= LOADING =================
    if (!initialDetails && !editing) {
        return (
            <div style={{ textAlign: "center", padding: 60 }}>
                <FiCreditCard size={40} />
                <h2>Loading...</h2>
            </div>
        );
    }

    // ================= UI =================
    return (
        <div style={{ maxWidth: 600, margin: "auto", padding: 20 }}>

            <h2 style={{ textAlign: "center" }}>Bank Details</h2>

            {message && (
                <div style={{
                    marginBottom: 10,
                    padding: 10,
                    borderRadius: 6,
                    background: message.includes("✅") ? "#d1fae5" : "#fee2e2"
                }}>
                    {message}
                </div>
            )}

            <button
                onClick={() => setEditing(!editing)}
                style={{
                    marginBottom: 15,
                    padding: 8,
                    background: editing ? "red" : "blue",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6
                }}
            >
                {editing ? <FiX /> : <FiEdit />} {editing ? "Cancel" : "Edit"}
            </button>

            {/* FORM */}
            <div style={{ display: "grid", gap: 10 }}>

                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Account Holder</label>
                    <input
                        name="accountHolder"
                        placeholder="Name on bank account"
                        value={bankDetails.accountHolder}
                        onChange={handleChange}
                        disabled={!editing}
                        style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Account Number <span style={{ color: "#999", fontWeight: 400 }}>(9-18 digits)</span></label>
                    <input
                        name="accountNumber"
                        placeholder="e.g. 123456789012"
                        value={bankDetails.accountNumber}
                        onChange={handleChange}
                        disabled={!editing}
                        style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>IFSC Code <span style={{ color: "#999", fontWeight: 400 }}>(if bank account)</span></label>
                    <input
                        name="ifsc"
                        placeholder="e.g. SBIN0001234"
                        value={bankDetails.ifsc}
                        onChange={handleChange}
                        disabled={!editing}
                        style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #ddd", borderRadius: 4, textTransform: "uppercase" }}
                    />
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2, lineHeight: "1.5" }}>
                        Format: 4 letters + <strong>0</strong> (ZERO digit) + 6 alphanumeric<br />
                        Example: <strong>SBIN0001234</strong> or <strong>UBIN0576514</strong><br />
                        ⚠️ Use digit <strong>0</strong> not letter <strong>O</strong>
                    </div>
                </div>

                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>Bank Name</label>
                    <input
                        name="bankName"
                        placeholder="e.g. State Bank of India"
                        value={bankDetails.bankName}
                        onChange={handleChange}
                        disabled={!editing}
                        style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                </div>

                <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#333" }}>UPI ID <span style={{ color: "#999", fontWeight: 400 }}>(optional)</span></label>
                    <input
                        name="upiId"
                        placeholder="e.g. yourname@upi"
                        value={bankDetails.upiId}
                        onChange={handleChange}
                        disabled={!editing}
                        style={{ width: "100%", padding: 8, marginTop: 4, border: "1px solid #ddd", borderRadius: 4 }}
                    />
                </div>
            </div>

            {/* ACTIONS */}
            {editing && (
                <div style={{ marginTop: 20, display: "flex", gap: 10 }}>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                            flex: 1,
                            padding: 12,
                            background: "#10b981",
                            color: "#fff",
                            border: "none",
                            borderRadius: 8
                        }}
                    >
                        {saving ? "Saving..." : "Save"}
                    </button>

                    <button
                        onClick={cancelEdit}
                        style={{
                            flex: 1,
                            padding: 12,
                            background: "#eee",
                            borderRadius: 8
                        }}
                    >
                        Cancel
                    </button>

                </div>
            )}
        </div>
    );
};

export default BankDetails;