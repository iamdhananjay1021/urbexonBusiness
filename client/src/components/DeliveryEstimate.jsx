import { useState, useEffect, useCallback } from "react";
import { FaTruck, FaMapMarkerAlt, FaCheckCircle, FaClock, FaShieldAlt, FaUndo } from "react-icons/fa";
import api from "../api/axios";

/* ─────────────────────────────────────────────────────
   DeliveryEstimate — Flipkart-style pincode checker
   Shows: delivery date, COD availability, free delivery info
───────────────────────────────────────────────────── */
const CACHE_KEY = "user_delivery_pincode";

const addBusinessDays = (days) => {
    const d = new Date();
    let added = 0;
    while (added < days) {
        d.setDate(d.getDate() + 1);
        if (d.getDay() !== 0) added++; // skip Sundays
    }
    return d;
};

const fmtDate = (d) =>
    d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function DeliveryEstimate({ productPrice = 0, productWeight = 500 }) {
    const [pincode, setPincode] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [checked, setChecked] = useState(false);

    // Load saved pincode on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(CACHE_KEY);
            if (saved && /^\d{6}$/.test(saved)) {
                setPincode(saved);
                checkDelivery(saved);
            }
        } catch { }
    }, []); // eslint-disable-line

    const checkDelivery = useCallback(async (code) => {
        const pc = (code || pincode).trim();
        if (!/^\d{6}$/.test(pc)) { setError("Enter valid 6-digit pincode"); return; }
        setLoading(true); setError(""); setResult(null);
        try {
            const { data } = await api.post("/delivery/estimate", {
                pincode: pc,
                weight: productWeight,
                paymentMethod: "ONLINE",
                productType: "ecommerce",
            });

            if (!data.success || !data.available) {
                setError(data.message || "Delivery not available for this pincode");
                return;
            }

            // Parse ETD
            let minDays = 3, maxDays = 5;
            const etdStr = data.etdText || "3–5 days";
            const match = etdStr.match(/(\d+)\s*[–\-]\s*(\d+)/);
            if (match) { minDays = parseInt(match[1]); maxDays = parseInt(match[2]); }
            else {
                const single = etdStr.match(/(\d+)/);
                if (single) { minDays = parseInt(single[1]); maxDays = minDays + 2; }
            }

            const deliverByMin = addBusinessDays(minDays);
            const deliverByMax = addBusinessDays(maxDays);

            const freeDelivery = productPrice >= (data.freeDeliveryThreshold || 499);

            setResult({
                deliverByMin: fmtDate(deliverByMin),
                deliverByMax: fmtDate(deliverByMax),
                courier: data.courier || "Standard Courier",
                rate: freeDelivery ? 0 : (data.shippingRate || 40),
                freeDelivery,
                freeThreshold: data.freeDeliveryThreshold || 499,
                cod: data.codAvailable !== false,
                codCharge: data.codCharge || 0,
                returnDays: data.returnDays || 7,
                etdStr,
            });
            setChecked(true);
            localStorage.setItem(CACHE_KEY, pc);
        } catch (err) {
            setError(err?.response?.data?.message || "Could not check delivery");
        } finally { setLoading(false); }
    }, [pincode, productPrice, productWeight]);

    const handleCheck = () => checkDelivery(pincode);

    return (
        <div style={S.wrap}>
            <div style={S.header}>
                <FaTruck size={14} style={{ color: "#2874f0" }} />
                <span style={S.headerText}>Delivery</span>
            </div>

            {/* Pincode Input Row */}
            <div style={S.inputRow}>
                <FaMapMarkerAlt size={12} style={{ color: "#878787", flexShrink: 0 }} />
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter pincode"
                    value={pincode}
                    onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPincode(v);
                        if (checked) { setChecked(false); setResult(null); }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                    style={S.input}
                />
                <button
                    onClick={handleCheck}
                    disabled={loading || pincode.length !== 6}
                    style={{ ...S.checkBtn, opacity: loading || pincode.length !== 6 ? 0.5 : 1 }}
                >
                    {loading ? "..." : checked ? "Change" : "Check"}
                </button>
            </div>

            {error && <p style={S.error}>{error}</p>}

            {/* Result */}
            {result && (
                <div style={S.result}>
                    {/* Delivery date */}
                    <div style={S.row}>
                        <FaTruck size={13} style={{ color: "#388e3c", flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <p style={S.rowTitle}>
                                Delivery by <strong>{result.deliverByMin} — {result.deliverByMax}</strong>
                            </p>
                            {result.freeDelivery ? (
                                <p style={{ ...S.rowSub, color: "#388e3c" }}>FREE Delivery</p>
                            ) : (
                                <p style={S.rowSub}>₹{result.rate} delivery charge</p>
                            )}
                        </div>
                    </div>

                    {/* COD */}
                    {result.cod && (
                        <div style={S.row}>
                            <FaCheckCircle size={13} style={{ color: "#388e3c", flexShrink: 0, marginTop: 2 }} />
                            <p style={S.rowTitle}>Cash on Delivery available{result.codCharge > 0 ? ` (₹${result.codCharge} extra)` : ""}</p>
                        </div>
                    )}

                    {/* Return */}
                    <div style={S.row}>
                        <FaUndo size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={S.rowTitle}>{result.returnDays}-day easy return policy</p>
                    </div>

                    {/* Secure */}
                    <div style={S.row}>
                        <FaShieldAlt size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={S.rowTitle}>Secure & trusted packaging</p>
                    </div>
                </div>
            )}

            {/* Not checked yet — show generic info */}
            {!result && !error && !loading && (
                <div style={S.result}>
                    <div style={S.row}>
                        <FaClock size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ ...S.rowTitle, color: "#878787" }}>Enter pincode for delivery date & charges</p>
                    </div>
                    <div style={S.row}>
                        <FaTruck size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ ...S.rowTitle, color: "#878787" }}>Free delivery on orders above ₹499</p>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────────────
   UHDeliveryEstimate — Zepto-style quick delivery
   Shows: delivery time based on UH pincode, vendor distance
───────────────────────────────────────────────────── */
export function UHDeliveryEstimate({ vendorName }) {
    const [pincode, setPincode] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [checked, setChecked] = useState(false);

    // Load saved UH pincode on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem("uh_pincode");
            if (stored) {
                const p = JSON.parse(stored);
                if (p?.code && /^\d{6}$/.test(p.code)) {
                    setPincode(p.code);
                    checkUH(p.code);
                }
            }
        } catch { }
    }, []); // eslint-disable-line

    const checkUH = useCallback(async (code) => {
        const pc = (code || pincode).trim();
        if (!/^\d{6}$/.test(pc)) { setError("Enter valid 6-digit pincode"); return; }
        setLoading(true); setError(""); setResult(null);
        try {
            const { data } = await api.post("/delivery/estimate", {
                pincode: pc,
                productType: "urbexon_hour",
            });

            if (data.success && data.available) {
                setResult({
                    available: true,
                    area: data.area || data.city || "",
                    city: data.city || "",
                    vendorCount: data.vendorCount || 0,
                    etaMin: data.etaMinMinutes || 45,
                    etaMax: data.etaMaxMinutes || 120,
                    etaText: data.etaText || "45–120 mins",
                    cod: data.codAvailable !== false,
                    returnDays: data.returnDays || 7,
                });
            } else {
                setResult({
                    available: false,
                    message: data.message || "Urbexon Hour not available in this area yet.",
                    status: data.status,
                });
            }
            setChecked(true);
        } catch (err) {
            setError(err?.response?.data?.message || "Could not check availability");
        } finally { setLoading(false); }
    }, [pincode]);

    const handleCheck = () => checkUH(pincode);

    return (
        <div style={S.wrap}>
            <div style={S.header}>
                <span style={{ fontSize: 14 }}>⚡</span>
                <span style={{ ...S.headerText, color: "#7c3aed" }}>Express Delivery</span>
            </div>

            {/* Pincode Input */}
            <div style={S.inputRow}>
                <FaMapMarkerAlt size={12} style={{ color: "#878787", flexShrink: 0 }} />
                <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="Enter delivery pincode"
                    value={pincode}
                    onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPincode(v);
                        if (checked) { setChecked(false); setResult(null); }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                    style={S.input}
                />
                <button
                    onClick={handleCheck}
                    disabled={loading || pincode.length !== 6}
                    style={{ ...S.checkBtn, background: "#7c3aed", opacity: loading || pincode.length !== 6 ? 0.5 : 1 }}
                >
                    {loading ? "..." : checked ? "Change" : "Check"}
                </button>
            </div>

            {error && <p style={S.error}>{error}</p>}

            {/* Result */}
            {result && result.available && (
                <div style={{ ...S.result, background: "#f5f3ff", borderColor: "#e9e5ff" }}>
                    <div style={S.row}>
                        <FaTruck size={13} style={{ color: "#7c3aed", flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <p style={S.rowTitle}>
                                Delivery in <strong style={{ color: "#7c3aed" }}>{result.etaMin}–{result.etaMax} minutes</strong>
                            </p>
                            <p style={S.rowSub}>
                                {result.area}{result.city ? `, ${result.city}` : ""} · {result.vendorCount} vendor{result.vendorCount !== 1 ? "s" : ""} near you
                            </p>
                        </div>
                    </div>

                    <div style={S.row}>
                        <FaCheckCircle size={13} style={{ color: "#388e3c", flexShrink: 0, marginTop: 2 }} />
                        <p style={S.rowTitle}>Cash on Delivery available</p>
                    </div>

                    <div style={S.row}>
                        <FaShieldAlt size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={S.rowTitle}>OTP verified delivery · Real-time tracking</p>
                    </div>

                    {vendorName && (
                        <div style={S.row}>
                            <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>🏪</span>
                            <p style={S.rowTitle}>Shipped from <strong>{vendorName}</strong></p>
                        </div>
                    )}
                </div>
            )}

            {result && !result.available && (
                <div style={{ ...S.result, background: "#fef2f2", borderColor: "#fecaca" }}>
                    <div style={S.row}>
                        <FaClock size={13} style={{ color: "#b91c1c", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ ...S.rowTitle, color: "#b91c1c" }}>{result.message}</p>
                    </div>
                </div>
            )}

            {!result && !error && !loading && (
                <div style={S.result}>
                    <div style={S.row}>
                        <FaClock size={12} style={{ color: "#878787", flexShrink: 0, marginTop: 2 }} />
                        <p style={{ ...S.rowTitle, color: "#878787" }}>Enter pincode to check express delivery availability</p>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Shared styles ── */
const S = {
    wrap: {
        border: "1px solid #f0f0f0",
        borderRadius: 8,
        padding: "16px",
        marginBottom: 16,
        background: "#fff",
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 12,
    },
    headerText: {
        fontSize: 14,
        fontWeight: 700,
        color: "#212121",
    },
    inputRow: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        border: "1.5px solid #e0e0e0",
        borderRadius: 8,
        background: "#fafafa",
        marginBottom: 12,
    },
    input: {
        flex: 1,
        border: "none",
        outline: "none",
        background: "transparent",
        fontSize: 14,
        fontFamily: "inherit",
        fontWeight: 500,
        color: "#212121",
        letterSpacing: "0.5px",
    },
    checkBtn: {
        padding: "6px 16px",
        border: "none",
        borderRadius: 6,
        background: "#2874f0",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "opacity .15s",
    },
    error: {
        fontSize: 12,
        color: "#d32f2f",
        margin: "0 0 8px",
    },
    result: {
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "12px",
        background: "#f9f9f9",
        borderRadius: 8,
        border: "1px solid #f0f0f0",
    },
    row: {
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
    },
    rowTitle: {
        fontSize: 13,
        color: "#212121",
        margin: 0,
        lineHeight: 1.4,
    },
    rowSub: {
        fontSize: 12,
        color: "#878787",
        margin: "2px 0 0",
    },
};
