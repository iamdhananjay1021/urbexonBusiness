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
        <div className="flex flex-col gap-4">
            {/* Label + GPS */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-2">
                    {["Home", "Work", "Other"].map(l => (
                        <button key={l} type="button"
                            onClick={() => setForm(f => ({ ...f, label: l }))}
                            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold border transition-colors duration-200
                                ${form.label === l
                                    ? "bg-accent-tint border-[var(--accent-primary)] text-accent"
                                    : "bg-white border-neutral-300 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700"}`}>
                            {LABEL_ICONS[l]} {l}
                        </button>
                    ))}
                </div>
                <button onClick={handleGPS} disabled={gpsLoading} type="button"
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-bold
                               border border-[var(--accent-primary)] text-accent bg-white
                               hover:bg-accent-tint transition-colors duration-200 disabled:opacity-60">
                    {gpsLoading
                        ? <><FaSpinner size={9} className="animate-spin" /> Detecting…</>
                        : <><FaLocationArrow size={9} /> Use GPS</>}
                </button>
            </div>

            {gpsMsg && <p className={`text-[11px] font-semibold ${gpsMsg.startsWith("📍") ? "text-success" : "text-error"}`} role="status">{gpsMsg}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">Full Name *</label>
                    <input name="name" value={form.name} onChange={set} placeholder="Rahul Verma" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
                </div>
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">Mobile *</label>
                    <input name="phone" value={form.phone} onChange={set} placeholder="10-digit" maxLength={10} className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
                </div>
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">House / Flat / Building *</label>
                <input name="house" value={form.house} onChange={set} placeholder="42, 3rd Floor, Shiv Bhawan" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">Area / Street *</label>
                <input name="area" value={form.area} onChange={set} placeholder="Civil Lines, MG Road" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">Landmark <span className="ml-1 text-[10px] font-medium normal-case tracking-normal text-neutral-400">Optional</span></label>
                <input name="landmark" value={form.landmark} onChange={set} placeholder="Near City Mall" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
            </div>

            <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">
                    Pincode *
                    {pincodeLoad && <FaSpinner size={9} className="animate-spin inline-block ml-1.5 text-accent" />}
                </label>
                <input
                    name="pincode" value={form.pincode} onChange={set}
                    placeholder="6-digit pincode" maxLength={6}
                    className={`w-full h-11 px-3.5 rounded-xl border bg-white text-sm text-neutral-900 outline-none transition-all duration-200
                        placeholder:text-neutral-400
                        focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]
                        ${pincodeMsg.ok === true ? "border-[var(--icon-success)]" : pincodeMsg.ok === false ? "border-[var(--icon-error)]" : "border-neutral-300"}`}
                />
                {pincodeMsg.text && (
                    <p className={`flex items-center gap-1 text-[11px] font-semibold mt-1.5 ${pincodeMsg.ok ? "text-success" : "text-error"}`} role="status">
                        {pincodeMsg.ok ? <FaCheckCircle size={9} /> : <FaTimesCircle size={9} />} {pincodeMsg.text}
                    </p>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">City *</label>
                    <input name="city" value={form.city} onChange={set} placeholder="Auto-filled" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
                </div>
                <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.06em] text-neutral-500 mb-1.5">State *</label>
                    <input name="state" value={form.state} onChange={set} placeholder="Auto-filled" className="w-full h-11 px-3.5 rounded-xl border border-neutral-300 bg-white text-sm text-neutral-900 outline-none transition-all duration-200 placeholder:text-neutral-400 focus:border-[var(--accent-primary)] focus:shadow-[0_0_0_3px_var(--focus-ring)]" />
                </div>
            </div>

            {formError && (
                <p className="text-[12px] font-semibold text-error bg-error-tint rounded-lg px-3 py-2" role="alert">
                    {formError}
                </p>
            )}

            <div className="flex gap-3 pt-1">
                <button onClick={submit} disabled={saving} type="button"
                    className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl
                               bg-accent hover:bg-accent-hover text-white text-sm font-bold
                               transition-colors duration-200 disabled:opacity-60">
                    {saving
                        ? <><FaSpinner size={12} className="animate-spin" /> Saving…</>
                        : <><FaBookmark size={11} /> Save Address</>}
                </button>
                <button onClick={onCancel} type="button"
                    className="h-11 px-5 rounded-xl border border-neutral-300 bg-white text-sm font-semibold
                               text-neutral-600 hover:border-neutral-400 hover:text-neutral-900
                               transition-colors duration-200">
                    Cancel
                </button>
            </div>
        </div>
    );
});

AddressForm.displayName = "AddressForm";
export { emptyForm };
export default AddressForm;