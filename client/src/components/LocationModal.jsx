/**
 * LocationModal.jsx — Zepto-like location selector modal
 * - Shows current detected location
 * - Manual pincode entry fallback
 * - Saved addresses (if logged in)
 */
import { useState, useRef, useEffect } from "react";
import { FaMapMarkerAlt, FaTimes, FaCrosshairs, FaSpinner, FaCheck, FaHome, FaBriefcase } from "react-icons/fa";
import { useLocation2 } from "../contexts/LocationContext";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";

const CSS = `
.loc-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.55); backdrop-filter: blur(4px);
    display: flex; align-items: flex-start; justify-content: center;
    padding: 10vh 16px 0;
    animation: loc-fade .2s ease;
}
@keyframes loc-fade { from{opacity:0} to{opacity:1} }
@keyframes loc-slide { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:none} }

.loc-modal {
    background: #fff; width: 100%; max-width: 420px;
    border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.2);
    overflow: hidden; animation: loc-slide .22s ease;
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    max-height: 80vh; overflow-y: auto;
}
.loc-head {
    padding: 16px 20px; display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #f0f0f0;
}
.loc-title { font-size: 16px; font-weight: 700; color: #111827; }
.loc-close {
    width: 32px; height: 32px; border-radius: 50%; border: none; background: #f3f4f6;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: background .15s;
}
.loc-close:hover { background: #e5e7eb; }

.loc-body { padding: 16px 20px; }

.loc-detect-btn {
    width: 100%; display: flex; align-items: center; gap: 10px;
    padding: 14px 16px; background: #f0f7ff; border: 1.5px solid #bfdbfe;
    border-radius: 12px; cursor: pointer; transition: all .18s;
    font-family: inherit; font-size: 14px; font-weight: 600; color: #2563eb;
}
.loc-detect-btn:hover { background: #dbeafe; border-color: #93c5fd; }
.loc-detect-btn:disabled { opacity: .6; cursor: not-allowed; }

.loc-divider {
    display: flex; align-items: center; gap: 12px;
    margin: 16px 0; color: #9ca3af; font-size: 12px; font-weight: 600;
}
.loc-divider::before, .loc-divider::after {
    content: ""; flex: 1; height: 1px; background: #e5e7eb;
}

.loc-pin-row {
    display: flex; gap: 8px;
}
.loc-pin-inp {
    flex: 1; padding: 12px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px;
    font-family: inherit; font-size: 14px; color: #111827; outline: none;
    transition: border-color .18s;
}
.loc-pin-inp:focus { border-color: #5b5bf6; }
.loc-pin-inp::placeholder { color: #9ca3af; }
.loc-pin-btn {
    padding: 0 20px; background: #5b5bf6; border: none; border-radius: 10px;
    color: #fff; font-weight: 700; font-size: 13px; cursor: pointer;
    transition: background .18s; white-space: nowrap;
}
.loc-pin-btn:hover { background: #4949d6; }
.loc-pin-btn:disabled { opacity: .6; cursor: not-allowed; }

.loc-error {
    margin-top: 8px; font-size: 12px; color: #dc2626;
    display: flex; align-items: center; gap: 6px;
}

.loc-current {
    margin-top: 16px; padding: 12px 14px; background: #f0fdf4;
    border: 1px solid #bbf7d0; border-radius: 10px;
    display: flex; align-items: flex-start; gap: 10px;
}
.loc-current-icon {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: #dcfce7; display: flex; align-items: center; justify-content: center;
    color: #16a34a;
}
.loc-current-label { font-size: 10px; font-weight: 700; color: #16a34a; letter-spacing: .5px; text-transform: uppercase; }
.loc-current-text { font-size: 13px; color: #374151; font-weight: 500; margin-top: 2px; }
.loc-current-pin { font-size: 11px; color: #6b7280; margin-top: 2px; }

.loc-addrs-title {
    margin-top: 20px; font-size: 11px; font-weight: 700; color: #9ca3af;
    letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 8px;
}
.loc-addr-card {
    padding: 12px 14px; border: 1.5px solid #e5e7eb; border-radius: 10px;
    cursor: pointer; transition: all .15s; margin-bottom: 8px;
    display: flex; align-items: flex-start; gap: 10px;
}
.loc-addr-card:hover { border-color: #5b5bf6; background: #fafaff; }
.loc-addr-icon {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    background: #f3f4f6; display: flex; align-items: center; justify-content: center;
    color: #6b7280; font-size: 12px;
}
.loc-addr-text { font-size: 13px; color: #374151; font-weight: 500; line-height: 1.4; }
.loc-addr-pin { font-size: 11px; color: #6b7280; margin-top: 2px; }
`;

const LABEL_ICONS = {
    Home: <FaHome size={11} />,
    Work: <FaBriefcase size={11} />,
};

const LocationModal = ({ onClose }) => {
    const { locationData, loading, error, detectLocation, setPincode, setLocation } = useLocation2();
    const { user } = useAuth();
    const [pinInput, setPinInput] = useState("");
    const [pinError, setPinError] = useState("");
    const [addresses, setAddresses] = useState([]);
    const inputRef = useRef(null);

    // Load saved addresses if logged in
    useEffect(() => {
        if (user) {
            api.get("/addresses").then(r => setAddresses(r.data || [])).catch(() => { });
        }
    }, [user]);

    useEffect(() => {
        setTimeout(() => inputRef.current?.focus(), 200);
    }, []);

    const handleDetect = () => {
        setPinError("");
        detectLocation();
    };

    const handlePincodeSubmit = async (e) => {
        e?.preventDefault();
        setPinError("");
        if (!pinInput.trim()) { setPinError("Enter a pincode"); return; }
        if (!/^[1-9]\d{5}$/.test(pinInput.trim())) { setPinError("Enter a valid 6-digit pincode"); return; }
        const ok = await setPincode(pinInput.trim());
        if (ok) onClose?.();
    };

    const handleSelectAddress = (addr) => {
        const data = {
            lat: addr.lat || null,
            lng: addr.lng || null,
            locality: addr.locality || addr.area || "",
            city: addr.city || "",
            state: addr.state || "",
            pincode: addr.pincode || "",
            label: [addr.locality || addr.area, addr.city, addr.state].filter(Boolean).join(", "),
            fullLabel: [addr.locality || addr.area, addr.city, addr.pincode].filter(Boolean).join(", "),
        };
        setLocation(data);
        onClose?.();
    };

    return (
        <>
            <style>{CSS}</style>
            <div className="loc-overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
                <div className="loc-modal">
                    <div className="loc-head">
                        <span className="loc-title">
                            <FaMapMarkerAlt size={14} style={{ color: "#5b5bf6", marginRight: 8 }} />
                            Choose your location
                        </span>
                        <button className="loc-close" onClick={onClose}><FaTimes size={12} color="#666" /></button>
                    </div>

                    <div className="loc-body">
                        {/* Detect via GPS */}
                        <button className="loc-detect-btn" onClick={handleDetect} disabled={loading}>
                            {loading ? <FaSpinner size={16} className="loc-spin" /> : <FaCrosshairs size={16} />}
                            {loading ? "Detecting location..." : "Detect my location"}
                        </button>

                        {error && <div className="loc-error">{error}</div>}

                        {/* Current location */}
                        {locationData && (
                            <div className="loc-current">
                                <div className="loc-current-icon"><FaCheck size={12} /></div>
                                <div>
                                    <div className="loc-current-label">Current Location</div>
                                    <div className="loc-current-text">{locationData.label || "Your location"}</div>
                                    {locationData.pincode && <div className="loc-current-pin">Pincode: {locationData.pincode}</div>}
                                </div>
                            </div>
                        )}

                        <div className="loc-divider">or enter pincode</div>

                        {/* Manual pincode */}
                        <form className="loc-pin-row" onSubmit={handlePincodeSubmit}>
                            <input
                                ref={inputRef}
                                className="loc-pin-inp"
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="Enter 6-digit pincode"
                                value={pinInput}
                                onChange={e => { setPinInput(e.target.value.replace(/\D/g, "")); setPinError(""); }}
                            />
                            <button type="submit" className="loc-pin-btn" disabled={loading}>
                                {loading ? <FaSpinner size={12} /> : "Apply"}
                            </button>
                        </form>
                        {pinError && <div className="loc-error">{pinError}</div>}

                        {/* Saved addresses */}
                        {addresses.length > 0 && (
                            <>
                                <div className="loc-addrs-title">Saved Addresses</div>
                                {addresses.map(addr => (
                                    <div key={addr._id} className="loc-addr-card" onClick={() => handleSelectAddress(addr)}>
                                        <div className="loc-addr-icon">
                                            {LABEL_ICONS[addr.label] || <FaMapMarkerAlt size={11} />}
                                        </div>
                                        <div>
                                            <div className="loc-addr-text">
                                                {[addr.street, addr.locality || addr.area, addr.city].filter(Boolean).join(", ")}
                                            </div>
                                            {addr.pincode && <div className="loc-addr-pin">Pincode: {addr.pincode}</div>}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <style>{`@keyframes loc-spin-anim { to { transform: rotate(360deg) } } .loc-spin { animation: loc-spin-anim .8s linear infinite; }`}</style>
        </>
    );
};

export default LocationModal;
