/**
 * AddressForm.jsx
 * Reusable address form with GPS + pincode auto-fill
 */

import { useState, useCallback, useRef, memo } from "react";
import { FaHome, FaBriefcase, FaMapMarkerAlt, FaLocationArrow, FaSpinner, FaCheckCircle, FaTimesCircle, FaBookmark } from "react-icons/fa";
import { verifyPincode } from "../../services/checkoutService";
import { resolveNearestPincode } from "../../api/pincodeApi";

const LABEL_ICONS = {
    Home: <FaHome size={10} />,
    Work: <FaBriefcase size={10} />,
    Other: <FaMapMarkerAlt size={10} />,
};

const emptyForm = () => ({
    label: "Home", name: "", phone: "", house: "",
    area: "", landmark: "", city: "", state: "", pincode: "",
    lat: null, lng: null,
});

const AddressForm = memo(({ initial, onSave, onCancel, saving }) => {
    const [form, setForm] = useState(initial || emptyForm());
    const [pincodeMsg, setPincodeMsg] = useState({ text: "", ok: null });
    const [pincodeLoad, setPincodeLoad] = useState(false);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsMsg, setGpsMsg] = useState("");
    const [formError, setFormError] = useState("");
    const pincodeTimer = useRef(null);

    const set = useCallback((e) => {
        const { name, value } = e.target;
        setForm(f => ({ ...f, [name]: value }));
        setFormError("");

        if (name === "pincode") {
            setPincodeMsg({ text: "", ok: null });
            clearTimeout(pincodeTimer.current);
            if (/^\d{6}$/.test(value))
                pincodeTimer.current = setTimeout(() => checkPin(value), 400);
        }
    }, []);

    const checkPin = useCallback(async (pin) => {
        try {
            setPincodeLoad(true);
            const data = await verifyPincode(pin);
            setForm(f => ({
                ...f,
                city: data.city || f.city,
                state: data.state || f.state,
                lat: data.lat || null,
                lng: data.lng || null,
            }));
            setPincodeMsg({ text: `✓ ${data.city}, ${data.state}`, ok: true });
        } catch (err) {
            setPincodeMsg({ text: err.response?.data?.message || "Invalid pincode", ok: false });
        } finally {
            setPincodeLoad(false);
        }
    }, []);

    const handleGPS = useCallback(() => {
        if (!navigator.geolocation) { setGpsMsg("Location not supported"); return; }
        setGpsLoading(true); setGpsMsg("");
        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude, longitude } }) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
                        { headers: { "User-Agent": "Urbexon/2.0" } }
                    );
                    const data = await res.json();
                    const addr = data.address || {};
                    let pin = addr.postcode || "";

                    // Backend is the single source of truth for the final pincode —
                    // Nominatim's postcode is patchy near pincode boundaries (a
                    // genuinely-224122 GPS fix can come back tagged something else).
                    // Only ever CORRECTS the guess, never blocks the result on failure.
                    try {
                        const { data: nearest } = await resolveNearestPincode(latitude, longitude);
                        if (nearest?.success && nearest.found && nearest.code) pin = nearest.code;
                    } catch { /* fall back to reverse-geocoder's postcode */ }

                    setForm(f => ({
                        ...f,
                        area: addr.suburb || addr.neighbourhood || addr.road || f.area,
                        city: addr.city || addr.town || addr.village || f.city,
                        state: addr.state || f.state,
                        pincode: pin || f.pincode,
                        lat: latitude, lng: longitude,
                    }));
                    setGpsMsg(`📍 ${addr.city || addr.town || "Location"} detected`);
                    if (/^\d{6}$/.test(pin)) checkPin(pin);
                } catch { setGpsMsg("Could not fetch address details"); }
                setGpsLoading(false);
            },
            () => { setGpsMsg("Location permission denied"); setGpsLoading(false); },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    }, [checkPin]);

    const submit = useCallback(() => {
        if (!form.name.trim()) return setFormError("Name is required");
        if (!/^[6-9]\d{9}$/.test(form.phone)) return setFormError("Enter valid 10-digit mobile number");
        if (!form.house.trim()) return setFormError("House / Flat number is required");
        if (!form.area.trim()) return setFormError("Area / Street is required");
        if (!/^\d{6}$/.test(form.pincode.trim())) return setFormError("Enter valid 6-digit pincode");
        if (!form.city.trim() || !form.state.trim()) return setFormError("City and State are required");
        onSave(form);
    }, [form, onSave]);

    return (
        <div className="ck-af">
            {/* Label + GPS */}
            <div className="ck-af-toprow">
                <div className="ck-af-labels">
                    {["Home", "Work", "Other"].map(l => (
                        <button key={l} type="button"
                            onClick={() => setForm(f => ({ ...f, label: l }))}
                            className={`ck-af-lbtn${form.label === l ? " on" : ""}`}>
                            {LABEL_ICONS[l]} {l}
                        </button>
                    ))}
                </div>
                <button onClick={handleGPS} disabled={gpsLoading} type="button" className="ck-af-gps">
                    {gpsLoading
                        ? <><FaSpinner size={9} className="spin" /> Detecting…</>
                        : <><FaLocationArrow size={9} /> Use GPS</>}
                </button>
            </div>

            {gpsMsg && <p className={`ck-af-gmsg${gpsMsg.startsWith("📍") ? " ok" : " er"}`}>{gpsMsg}</p>}

            <div className="ck-g2">
                <div>
                    <label className="ck-lbl">Full Name *</label>
                    <input name="name" value={form.name} onChange={set} placeholder="Rahul Verma" className="ck-inp" />
                </div>
                <div>
                    <label className="ck-lbl">Mobile *</label>
                    <input name="phone" value={form.phone} onChange={set} placeholder="10-digit" maxLength={10} className="ck-inp" />
                </div>
            </div>

            <div>
                <label className="ck-lbl">House / Flat / Building *</label>
                <input name="house" value={form.house} onChange={set} placeholder="42, 3rd Floor, Shiv Bhawan" className="ck-inp" />
            </div>

            <div>
                <label className="ck-lbl">Area / Street *</label>
                <input name="area" value={form.area} onChange={set} placeholder="Civil Lines, MG Road" className="ck-inp" />
            </div>

            <div>
                <label className="ck-lbl">Landmark <span className="ck-opt">Optional</span></label>
                <input name="landmark" value={form.landmark} onChange={set} placeholder="Near City Mall" className="ck-inp" />
            </div>

            <div>
                <label className="ck-lbl">
                    Pincode *
                    {pincodeLoad && <FaSpinner size={9} className="spin" style={{ marginLeft: 6, color: "var(--gold)" }} />}
                </label>
                <input
                    name="pincode" value={form.pincode} onChange={set}
                    placeholder="6-digit pincode" maxLength={6}
                    className={`ck-inp${pincodeMsg.ok === true ? " pin-ok" : pincodeMsg.ok === false ? " pin-er" : ""}`}
                />
                {pincodeMsg.text && (
                    <p className={`ck-af-pinmsg${pincodeMsg.ok ? " ok" : " er"}`}>
                        {pincodeMsg.ok ? <FaCheckCircle size={9} /> : <FaTimesCircle size={9} />} {pincodeMsg.text}
                    </p>
                )}
            </div>

            <div className="ck-g2">
                <div>
                    <label className="ck-lbl">City *</label>
                    <input name="city" value={form.city} onChange={set} placeholder="Auto-filled" className="ck-inp" />
                </div>
                <div>
                    <label className="ck-lbl">State *</label>
                    <input name="state" value={form.state} onChange={set} placeholder="Auto-filled" className="ck-inp" />
                </div>
            </div>

            {formError && <p className="ck-ferr">{formError}</p>}

            <div className="ck-af-acts">
                <button onClick={submit} disabled={saving} className="ck-btn-gold">
                    {saving
                        ? <><FaSpinner size={12} className="spin" /> Saving…</>
                        : <><FaBookmark size={11} /> Save Address</>}
                </button>
                <button onClick={onCancel} className="ck-btn-ghost">Cancel</button>
            </div>
        </div>
    );
});

AddressForm.displayName = "AddressForm";
export { emptyForm };
export default AddressForm;