/**
 * LocationContext.jsx — Global location state for Urbexon
 * - Auto-detects on first visit via GPS + reverse geocoding
 * - Extracts clean structured address (locality, city, state, pincode)
 * - Filters out highway names and non-human-readable labels
 * - Fallback: manual pincode entry
 * - Persists in localStorage
 * - Provides global state for navbar, product filtering, delivery checks
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const LocationContext = createContext(null);
const STORAGE_KEY = "ux_location_v2";

/* ── Helpers ── */
const HIGHWAY_PATTERN = /^(NH|SH|MDR|ODR|MH|AH)\s*\d/i;
const ROAD_PATTERN = /^(National Highway|State Highway|Highway|Road No|Route)\s/i;

/** Filter unreadable address components */
const cleanLabel = (val) => {
    if (!val) return "";
    if (HIGHWAY_PATTERN.test(val)) return "";
    if (ROAD_PATTERN.test(val)) return "";
    if (/^\d{1,3}[A-Z]?$/.test(val)) return ""; // bare route numbers like "13A"
    return val.trim();
};

/** Extract structured address from Nominatim response */
const parseNominatimAddress = (data) => {
    const a = data?.address || {};

    // Locality: prefer suburb > neighbourhood > hamlet > village > town > city_district
    const localityRaw = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city_district || "";
    const locality = cleanLabel(localityRaw);

    // City
    const cityRaw = a.city || a.town || a.state_district || a.county || "";
    const city = cleanLabel(cityRaw) || "Unknown";

    // State
    const state = a.state || "";

    // Pincode (postcode)
    const pincode = a.postcode || "";

    // Build readable label
    const parts = [locality, city, state].filter(Boolean);
    const label = parts.length > 0 ? parts.join(", ") : "Your location";
    const fullLabel = pincode ? `${label}, ${pincode}` : label;

    return { locality, city, state, pincode, label, fullLabel };
};

/** Reverse geocode coordinates using Nominatim */
const reverseGeocode = async (lat, lng) => {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
            { headers: { "Accept-Language": "en" } }
        );
        const data = await res.json();
        return parseNominatimAddress(data);
    } catch {
        return { locality: "", city: "Unknown", state: "", pincode: "", label: "Your location", fullLabel: "Your location" };
    }
};

/** Validate Indian pincode format */
const isValidPincode = (p) => /^[1-9]\d{5}$/.test(String(p).trim());

export const LocationProvider = ({ children }) => {
    const [locationData, setLocationData] = useState(null); // { lat, lng, locality, city, state, pincode, label, fullLabel }
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setLocationData(JSON.parse(saved));
            } else {
                // Auto-detect on first visit
                detectLocation();
            }
        } catch {
            detectLocation();
        }
    }, []);

    /** Detect location via browser GPS */
    const detectLocation = useCallback(() => {
        if (!window.isSecureContext) {
            setError("Location works only on HTTPS or localhost");
            return;
        }
        if (!navigator.geolocation) {
            setError("Geolocation not supported by your browser");
            return;
        }

        setLoading(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                const parsed = await reverseGeocode(latitude, longitude);
                const data = { lat: latitude, lng: longitude, ...parsed };

                setLocationData(data);
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
                setLoading(false);
            },
            (err) => {
                const msg = err.code === 1 ? "Location permission denied" :
                    err.code === 2 ? "Location unavailable" :
                        err.code === 3 ? "Location request timed out" : "Could not get location";
                setError(msg);
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
        );
    }, []);

    /** Manually set pincode (fallback) */
    const setPincode = useCallback(async (pincode) => {
        if (!isValidPincode(pincode)) {
            setError("Enter a valid 6-digit pincode");
            return false;
        }
        setLoading(true);
        setError("");

        try {
            // Forward geocode pincode to get city/state
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&addressdetails=1&limit=1`,
                { headers: { "Accept-Language": "en" } }
            );
            const results = await res.json();
            if (results?.length > 0) {
                const a = results[0].address || {};
                const city = cleanLabel(a.city || a.town || a.state_district || a.county || "") || "Unknown";
                const state = a.state || "";
                const locality = cleanLabel(a.suburb || a.neighbourhood || a.village || a.town || "") || "";
                const parts = [locality, city, state].filter(Boolean);
                const label = parts.join(", ");

                const data = {
                    lat: parseFloat(results[0].lat),
                    lng: parseFloat(results[0].lon),
                    locality, city, state, pincode,
                    label, fullLabel: `${label}, ${pincode}`,
                };
                setLocationData(data);
                try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
                setLoading(false);
                return true;
            }
            // Pincode not found but still valid format — store it without geo data
            const data = { lat: null, lng: null, locality: "", city: "", state: "", pincode, label: `Pincode: ${pincode}`, fullLabel: `Pincode: ${pincode}` };
            setLocationData(data);
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
            setLoading(false);
            return true;
        } catch {
            setError("Could not verify pincode. Please try again.");
            setLoading(false);
            return false;
        }
    }, []);

    /** Set full location data directly (e.g., from saved addresses) */
    const setLocation = useCallback((data) => {
        setLocationData(data);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
    }, []);

    /** Clear location */
    const clearLocation = useCallback(() => {
        setLocationData(null);
        try { localStorage.removeItem(STORAGE_KEY); } catch { }
    }, []);

    const value = useMemo(() => ({
        locationData,
        loading,
        error,
        modalOpen,
        setModalOpen,
        detectLocation,
        setPincode,
        setLocation,
        clearLocation,
        isValidPincode,
    }), [locationData, loading, error, modalOpen, detectLocation, setPincode, setLocation, clearLocation]);

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation2 = () => {
    const ctx = useContext(LocationContext);
    if (!ctx) throw new Error("useLocation2 must be used within LocationProvider");
    return ctx;
};

export default LocationContext;
