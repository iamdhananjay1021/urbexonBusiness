/**
 * addressController.js
 * ✅ COD available ONLY for pincode 224122 (1-day delivery)
 * ✅ All other pincodes → COD: false, status: "coming_soon"
 * ✅ Backend is source of truth — frontend only displays
 */

import User from "../models/User.js";
import Pincode from "../models/vendorModels/Pincode.js";
import {
    DELIVERY_CONFIG,
    getDeliveryETA,
} from "../config/deliveryConfig.js";

const { SHOP_LAT, SHOP_LNG } = DELIVERY_CONFIG;

/* ══════════════════════════════════════════════
   LOCAL PINCODE COORDS (known pincodes)
══════════════════════════════════════════════ */
const LOCAL_PINCODE_COORDS = {
    "224122": { lat: 26.4192, lng: 82.5359 },
    "224123": { lat: 26.4300, lng: 82.5500 },
    "224001": { lat: 26.4500, lng: 82.5200 },
    "224181": { lat: 26.3900, lng: 82.5600 },
    "224151": { lat: 26.4700, lng: 82.4500 },
    "224152": { lat: 26.4000, lng: 82.4700 },
    "224161": { lat: 26.3500, lng: 82.5900 },
    "224171": { lat: 26.5000, lng: 82.5700 },
    "224172": { lat: 26.3700, lng: 82.5100 },
};

/* ══════════════════════════════════════════════
   PINCODE CACHE (in-memory, 24h TTL)
   + in-flight lock to prevent parallel spam
══════════════════════════════════════════════ */
const pincodeCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

// FIX #2 — in-flight lock: prevents multiple simultaneous requests
// for the same pincode from all hitting external APIs at once
const inflightRequests = new Set();

/* ──────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────── */
const getDistanceKm = (lat1, lng1, lat2, lng2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchLatLng = async (pincode) => {
    if (LOCAL_PINCODE_COORDS[pincode]) return LOCAL_PINCODE_COORDS[pincode];
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&limit=1`,
            { headers: { "User-Agent": "Urbexon/2.0" }, signal: AbortSignal.timeout(4000) }
        );
        const data = await res.json();
        if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch (err) {
        // FIX #1 — log geocode failure properly instead of silent fail
        console.warn(`[Pincode] Geocode failed for ${pincode}:`, err.message);
    }
    // FIX #1 — return explicit nulls, caller handles fallback
    return { lat: null, lng: null };
};

/* ══════════════════════════════════════════════
   GET /api/addresses
══════════════════════════════════════════════ */
export const getAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("addresses").lean();
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json(user.addresses || []);
    } catch (err) {
        console.error("GET ADDRESSES:", err);
        res.status(500).json({ success: false, message: "Failed to fetch addresses" });
    }
};

/* ══════════════════════════════════════════════
   POST /api/addresses
══════════════════════════════════════════════ */
export const addAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.addresses.length >= 5)
            return res.status(400).json({ success: false, message: "Maximum 5 addresses allowed. Delete one to add new." });

        const { label, name, phone, house, area, landmark, city, state, pincode, isDefault, lat, lng } = req.body;

        if (!name?.trim() || !phone?.trim() || !house?.trim() || !area?.trim() || !city?.trim() || !state?.trim() || !pincode?.trim())
            return res.status(400).json({ success: false, message: "All required fields must be filled" });
        if (!/^[6-9]\d{9}$/.test(phone.trim()))
            return res.status(400).json({ success: false, message: "Invalid phone number" });
        if (!/^\d{6}$/.test(pincode.trim()))
            return res.status(400).json({ success: false, message: "Invalid pincode" });

        if (isDefault) user.addresses.forEach(a => { a.isDefault = false; });
        const makeDefault = isDefault || user.addresses.length === 0;

        user.addresses.push({
            label: (label?.trim() || "Home").slice(0, 30),
            name: name.trim().slice(0, 100),
            phone: phone.trim(),
            house: house.trim().slice(0, 200),
            area: area.trim().slice(0, 200),
            landmark: (landmark?.trim() || "").slice(0, 100),
            city: city.trim().slice(0, 100),
            state: state.trim().slice(0, 100),
            pincode: pincode.trim(),
            isDefault: makeDefault,
            lat: lat || null,
            lng: lng || null,
        });

        await user.save({ validateModifiedOnly: true });
        res.status(201).json({ success: true, message: "Address saved successfully", addresses: user.addresses });
    } catch (err) {
        console.error("ADD ADDRESS:", err);
        if (err.name === "ValidationError")
            return res.status(400).json({ message: Object.values(err.errors)[0].message });
        res.status(500).json({ success: false, message: "Failed to save address" });
    }
};

/* ══════════════════════════════════════════════
   PUT /api/addresses/:addressId
══════════════════════════════════════════════ */
export const updateAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const address = user.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ success: false, message: "Address not found" });

        const { label, name, phone, house, area, landmark, city, state, pincode, isDefault, lat, lng } = req.body;

        if (phone && !/^[6-9]\d{9}$/.test(phone.trim()))
            return res.status(400).json({ success: false, message: "Invalid phone number" });
        if (pincode && !/^\d{6}$/.test(pincode.trim()))
            return res.status(400).json({ success: false, message: "Invalid pincode" });

        if (label !== undefined) address.label = label.trim().slice(0, 30);
        if (name !== undefined) address.name = name.trim().slice(0, 100);
        if (phone !== undefined) address.phone = phone.trim();
        if (house !== undefined) address.house = house.trim().slice(0, 200);
        if (area !== undefined) address.area = area.trim().slice(0, 200);
        if (landmark !== undefined) address.landmark = landmark.trim().slice(0, 100);
        if (city !== undefined) address.city = city.trim().slice(0, 100);
        if (state !== undefined) address.state = state.trim().slice(0, 100);
        if (pincode !== undefined) address.pincode = pincode.trim();
        if (lat !== undefined) address.lat = lat || null;
        if (lng !== undefined) address.lng = lng || null;
        if (isDefault === true) {
            user.addresses.forEach(a => { a.isDefault = false; });
            address.isDefault = true;
        }

        await user.save({ validateModifiedOnly: true });
        res.json({ success: true, message: "Address updated", addresses: user.addresses });
    } catch (err) {
        console.error("UPDATE ADDRESS:", err);
        if (err.name === "ValidationError")
            return res.status(400).json({ message: Object.values(err.errors)[0].message });
        res.status(500).json({ success: false, message: "Failed to update address" });
    }
};

/* ══════════════════════════════════════════════
   DELETE /api/addresses/:addressId
══════════════════════════════════════════════ */
export const deleteAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const address = user.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ success: false, message: "Address not found" });

        const wasDefault = address.isDefault;
        address.deleteOne();
        if (wasDefault && user.addresses.length > 0)
            user.addresses[0].isDefault = true;

        await user.save({ validateModifiedOnly: true });
        res.json({ success: true, message: "Address deleted", addresses: user.addresses });
    } catch (err) {
        console.error("DELETE ADDRESS:", err);
        res.status(500).json({ success: false, message: "Failed to delete address" });
    }
};

/* ══════════════════════════════════════════════
   PUT /api/addresses/:addressId/default
══════════════════════════════════════════════ */
export const setDefaultAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const address = user.addresses.id(req.params.addressId);
        if (!address) return res.status(404).json({ success: false, message: "Address not found" });

        user.addresses.forEach(a => { a.isDefault = false; });
        address.isDefault = true;
        await user.save({ validateModifiedOnly: true });

        res.json({ success: true, message: "Default address updated", addresses: user.addresses });
    } catch (err) {
        console.error("SET DEFAULT:", err);
        res.status(500).json({ success: false, message: "Failed to set default address" });
    }
};

/* ══════════════════════════════════════════════
   GET /api/addresses/pincode/:pin
══════════════════════════════════════════════ */
export const verifyPincode = async (req, res) => {
    try {
        const { pin } = req.params;
        if (!/^\d{6}$/.test(pin))
            return res.status(400).json({ success: false, message: "Invalid pincode format" });

        // Cache hit
        const cached = pincodeCache.get(pin);
        if (cached && Date.now() - cached.ts < CACHE_TTL)
            return res.json(cached.data);

        // FIX #2 — if this pincode is already being fetched by another request,
        // wait briefly then serve from cache to avoid duplicate external API calls
        if (inflightRequests.has(pin)) {
            await new Promise(r => setTimeout(r, 800));
            const cachedNow = pincodeCache.get(pin);
            if (cachedNow && Date.now() - cachedNow.ts < CACHE_TTL)
                return res.json(cachedNow.data);
        }

        inflightRequests.add(pin);

        // Postal API for city/state
        let city = "", state = "", country = "India";
        try {
            const postalRes = await fetch(`https://api.postalpincode.in/pincode/${pin}`, {
                signal: AbortSignal.timeout(5000),
            });
            const postalData = await postalRes.json();
            if (postalData[0]?.Status === "Success" && postalData[0]?.PostOffice?.length) {
                const po = postalData[0].PostOffice[0];
                city = po.District || "";
                state = po.State || "";
                country = po.Country || "India";
            }
        } catch (err) {
            // FIX #1 — log postal API failure, continue with empty city/state
            console.warn(`[Pincode] Postal API failed for ${pin}:`, err.message);
        }

        // Lat/Lng
        const { lat, lng } = await fetchLatLng(pin);

        // FIX #1 — if geocode failed, distanceKm is null but we still respond
        // with a valid result — caller gets null distance, not a broken response
        let distanceKm = null;
        if (lat !== null && lng !== null)
            distanceKm = Math.round(getDistanceKm(SHOP_LAT, SHOP_LNG, lat, lng) * 10) / 10;

        const pincodeDoc = await Pincode.findOne({ code: pin }).lean();
        let codAllowed = false;
        let codStatus = "unavailable";
        if (pincodeDoc) {
            if (pincodeDoc.status === "active") {
                codAllowed = true;
                codStatus = "available";
            } else if (pincodeDoc.status === "coming_soon") {
                codStatus = "coming_soon";
            } else {
                codStatus = "blocked";
            }
        }
        const deliveryETA = getDeliveryETA();

        const result = {
            city,
            state,
            country,
            pincode: pin,
            serviceable: true,
            lat,
            lng,
            distanceKm,
            codAllowed,
            codStatus,
            deliveryETA,
        };

        pincodeCache.set(pin, { data: result, ts: Date.now() });
        inflightRequests.delete(pin);
        res.json(result);
    } catch (err) {
        // FIX #1 — always clean up lock on error
        inflightRequests.delete(req.params.pin);
        console.error("PINCODE VERIFY:", err.message);
        res.status(503).json({ success: false, message: "Pincode service temporarily unavailable", serviceable: null });
    }
};

/* ══════════════════════════════════════════════
   EXPORTED HELPER — used by orderController
══════════════════════════════════════════════ */
export const checkCODEligibility = async (pincode) => {
    if (!/^\d{6}$/.test(pincode))
        return { allowed: false, reason: "Invalid pincode", codStatus: "unavailable" };

    const pincodeDoc = await Pincode.findOne({ code: pincode.trim() }).lean();

    if (!pincodeDoc)
        return { allowed: false, reason: "COD not available for this pincode", codStatus: "unavailable", deliveryETA: "3–5 Business Days" };

    if (pincodeDoc.status === "active")
        return { allowed: true, reason: null, codStatus: "available", deliveryETA: "3–5 Business Days" };

    if (pincodeDoc.status === "coming_soon")
        return { allowed: false, reason: "COD coming soon to your area", codStatus: "coming_soon", deliveryETA: "3–5 Business Days" };

    return { allowed: false, reason: "COD not available in your area", codStatus: "blocked", deliveryETA: "3–5 Business Days" };
};

/* ══════════════════════════════════════════════
   SAVE UH PINCODE
   POST /api/addresses/uh-pincode
══════════════════════════════════════════════ */
export const saveUHPincode = async (req, res) => {
    try {
        const { code, area, city, state } = req.body;
        if (!code || !/^\d{6}$/.test(code.trim()))
            return res.status(400).json({ success: false, message: "Valid 6-digit pincode required" });

        await User.findByIdAndUpdate(req.user._id, {
            uhPincode: {
                code: code.trim(),
                area: area?.trim() || null,
                city: city?.trim() || null,
                state: state?.trim() || null,
                savedAt: new Date(),
            },
        });

        res.json({ success: true, message: "Pincode saved" });
    } catch (err) {
        console.error("[saveUHPincode]", err);
        res.status(500).json({ success: false, message: "Failed to save pincode" });
    }
};

/* ══════════════════════════════════════════════
   GET SAVED UH PINCODE
   GET /api/addresses/uh-pincode
══════════════════════════════════════════════ */
export const getUHPincode = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("uhPincode").lean();
        res.json({ success: true, uhPincode: user?.uhPincode || null });
    } catch (err) {
        console.error("[getUHPincode]", err);
        res.status(500).json({ success: false, message: "Failed to fetch pincode" });
    }
};