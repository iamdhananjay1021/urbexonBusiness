import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import { resolveNearestPincode } from "../api/pincodeApi";

const LocationContext = createContext(null);
const STORAGE_KEY = "ux_location_v5";

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURATION & CONSTANTS
   ═══════════════════════════════════════════════════════════════════════ */

const CONFIG = {
    // Accuracy thresholds (in meters)
    // Desktop: Stricter (requires better accuracy due to no GPS)
    // Mobile: Relaxed (GPS devices are less accurate in buildings)
    ACCURACY_THRESHOLD: {
        mobile: 150, // meters for mobile
        desktop: 5000, // ✅ FIX: Desktop uses IP/WiFi - accuracy can be very poor (km range), so threshold relaxed
    },

    // Geolocation timeout settings
    TIMEOUT_MS: 15000, // 15 seconds
    MAX_RETRIES: 2,

    // Reverse geocoding providers
    GEOCODING_PROVIDER: "google", // "google" or "nominatim"
    // Set GOOGLE_MAPS_API_KEY in .env.local or leave blank for Nominatim fallback
    GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
};

/* ═══════════════════════════════════════════════════════════════════════
   UTILITY HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Detect if device is mobile based on user agent and screen size
 */
const isMobileDevice = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobilePattern = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUA = mobilePattern.test(userAgent.toLowerCase());
    const isMobileSize = window.innerWidth < 768; // Tailwind md breakpoint
    return isMobileUA || isMobileSize;
};

/**
 * Validate Indian pincode format
 */
const isValidPincode = (p) => /^[1-9]\d{5}$/.test(String(p).trim());

/**
 * Clean address labels (remove highways, generic roads, etc.)
 */
const cleanLabel = (val) => {
    if (!val) return "";
    const highways = /^(NH|SH|MDR|ODR|MH|AH)\s*\d/i;
    const roads = /^(National Highway|State Highway|Highway|Road No|Route)\s/i;
    const numbers = /^\d{1,3}[A-Z]?$/;

    if (highways.test(val) || roads.test(val) || numbers.test(val)) return "";
    return val.trim();
};

/**
 * Parse address from Google Maps or Nominatim response
 */
const parseAddress = (data, source = "nominatim") => {
    if (source === "google") {
        return parseGoogleAddress(data);
    } else {
        return parseNominatimAddress(data);
    }
};

/**
 * Parse address from Google Maps Geocoding API
 */
const parseGoogleAddress = (results) => {
    if (!results || !results.length) {
        return {
            locality: "",
            city: "Unknown",
            state: "",
            pincode: "",
            label: "Your location",
            fullLabel: "Your location",
        };
    }

    const addressComponents = results[0].address_components || [];
    const componentMap = {};

    addressComponents.forEach((comp) => {
        const types = comp.types || [];
        if (types.includes("locality")) componentMap.locality = comp.long_name;
        if (types.includes("administrative_area_level_2")) componentMap.district = comp.long_name;
        if (types.includes("administrative_area_level_1")) componentMap.state = comp.short_name;
        if (types.includes("postal_code")) componentMap.pincode = comp.long_name;
    });

    const locality = cleanLabel(componentMap.locality || "");
    const city = componentMap.district || componentMap.locality || "Unknown";
    const state = componentMap.state || "";
    const pincode = componentMap.pincode || "";

    const parts = [locality, city, state].filter(Boolean);
    const label = parts.length ? parts.join(", ") : "Your location";
    const fullLabel = pincode ? `${label}, ${pincode}` : label;

    return { locality, city, state, pincode, label, fullLabel };
};

/**
 * Parse address from Nominatim response
 */
const parseNominatimAddress = (data) => {
    const a = data?.address || {};

    const locality = cleanLabel(
        a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city_district || ""
    );

    const city =
        cleanLabel(a.city || a.town || a.state_district || a.county || "") || "Unknown";

    const state = a.state || "";
    const pincode = a.postcode || "";

    const parts = [locality, city, state].filter(Boolean);
    const label = parts.length ? parts.join(", ") : "Your location";
    const fullLabel = pincode ? `${label}, ${pincode}` : label;

    return { locality, city, state, pincode, label, fullLabel };
};

/**
 * Reverse geocode using Google Maps API
 */
const reverseGeocodeGoogle = async (lat, lng) => {
    try {
        if (!CONFIG.GOOGLE_MAPS_API_KEY) {
            console.warn("Google Maps API key not configured. Falling back to Nominatim.");
            return reverseGeocodeNominatim(lat, lng);
        }

        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CONFIG.GOOGLE_MAPS_API_KEY}&components=country:IN`,
            { headers: { "Accept-Language": "en" } }
        );

        const data = await response.json();

        if (data.status === "OK" && data.results?.length) {
            return parseAddress(data.results, "google");
        }

        return {
            locality: "",
            city: "Unknown",
            state: "",
            pincode: "",
            label: "Your location",
            fullLabel: "Your location",
        };
    } catch (error) {
        console.error("Google Maps reverse geocoding failed:", error);
        return reverseGeocodeNominatim(lat, lng);
    }
};

/**
 * Reverse geocode using Nominatim
 */
const reverseGeocodeNominatim = async (lat, lng) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`,
            {
                headers: { "Accept-Language": "en", "User-Agent": "LocationApp/1.0" },
            }
        );

        const data = await response.json();
        return parseAddress(data, "nominatim");
    } catch (error) {
        console.error("Nominatim reverse geocoding failed:", error);
        return {
            locality: "",
            city: "Unknown",
            state: "",
            pincode: "",
            label: "Your location",
            fullLabel: "Your location",
        };
    }
};

/**
 * Main reverse geocoding function
 */
const reverseGeocode = async (lat, lng) => {
    if (CONFIG.GEOCODING_PROVIDER === "google" && CONFIG.GOOGLE_MAPS_API_KEY) {
        return reverseGeocodeGoogle(lat, lng);
    }
    return reverseGeocodeNominatim(lat, lng);
};

/**
 * Lookup pincode using Nominatim
 */
const lookupPincode = async (pincode) => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${pincode}&country=India&format=json&addressdetails=1&limit=1`,
            { headers: { "User-Agent": "LocationApp/1.0" } }
        );

        const results = await response.json();

        if (results?.length) {
            const a = results[0].address || {};

            const city =
                cleanLabel(a.city || a.town || a.state_district || a.county || "") ||
                "Unknown";

            const state = a.state || "";
            const locality =
                cleanLabel(a.suburb || a.neighbourhood || a.village || a.town || "") ||
                "";

            const label = [locality, city, state].filter(Boolean).join(", ");

            return {
                lat: parseFloat(results[0].lat),
                lng: parseFloat(results[0].lon),
                locality,
                city,
                state,
                pincode,
                label,
                fullLabel: `${label}, ${pincode}`,
            };
        }

        return {
            lat: null,
            lng: null,
            locality: "",
            city: "",
            state: "",
            pincode,
            label: `Pincode: ${pincode}`,
            fullLabel: `Pincode: ${pincode}`,
        };
    } catch (error) {
        console.error("Pincode lookup failed:", error);
        return null;
    }
};

/* ═══════════════════════════════════════════════════════════════════════
   LOCATION PROVIDER COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */

export const LocationProvider = ({ children }) => {
    // ──────── State ────────
    const [locationData, setLocationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("idle"); // idle | detecting | success | failed
    const [modalOpen, setModalOpen] = useState(false);
    const [deviceType, setDeviceType] = useState("desktop"); // mobile | desktop

    // ──────── Refs for guards ────────
    const isDetectingRef = useRef(false);

    /* ═════════════════════════════════════════════════════════════════════
       STORAGE OPERATIONS
       ═════════════════════════════════════════════════════════════════════ */

    const saveToStorage = useCallback((data) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn("Failed to save location to storage:", error);
        }
    }, []);

    const loadFromStorage = useCallback(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.warn("Failed to load location from storage:", error);
            return null;
        }
    }, []);

    /* ═════════════════════════════════════════════════════════════════════
       GEOLOCATION DETECTION WITH RETRY LOGIC
       ═════════════════════════════════════════════════════════════════════ */

    /**
     * Fetch location from browser.
     *
     * Mobile: GPS — accuracy filtered against CONFIG.ACCURACY_THRESHOLD.mobile.
     * Desktop: WiFi/network-based (navigator.geolocation still works without
     *          GPS hardware, resolved via the browser's own location service)
     *          — accuracy filtered against the more relaxed
     *          CONFIG.ACCURACY_THRESHOLD.desktop instead of skipped outright.
     * Both retry up to CONFIG.MAX_RETRIES before falling back to pincode entry.
     */
    const fetchAccurateLocation = useCallback(
        (attempt = 1) => {
            // ──── Guard: Browser support check ────
            if (!navigator.geolocation) {
                setStatus("failed");
                setError("Geolocation not supported on this browser");
                setLoading(false);
                isDetectingRef.current = false;
                return;
            }

            // ──── Guard: HTTPS check ────
            if (!window.isSecureContext) {
                setStatus("failed");
                setError("Location requires HTTPS connection");
                setLoading(false);
                isDetectingRef.current = false;
                return;
            }

            const isMobile = isMobileDevice();

            // ──── Retry exhausted → show pincode fallback ────
            if (attempt > CONFIG.MAX_RETRIES) {
                setStatus("failed");
                setLoading(false);
                isDetectingRef.current = false;

                if (!locationData) {
                    setError("Unable to detect location accurately. Please enter your pincode.");
                    setModalOpen(true);
                }

                return;
            }

            // ──── Setup geolocation options ────
            // Desktop: enableHighAccuracy false → faster IP-based result
            // Mobile:  enableHighAccuracy true  → uses GPS
            const geoOptions = {
                enableHighAccuracy: isMobile,
                timeout: CONFIG.TIMEOUT_MS,
                maximumAge: 0,
            };

            // ──── Request current position ────
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const { latitude, longitude, accuracy } = pos.coords;

                    console.log(
                        `Location detected (attempt ${attempt}): ${accuracy.toFixed(2)}m accuracy ` +
                        `(device: ${isMobile ? "mobile" : "desktop"})`
                    );

                    // ──── Accuracy filter — mobile uses the tight GPS threshold,
                    // desktop uses the relaxed WiFi/network threshold ────
                    const accuracyThreshold = isMobile ? CONFIG.ACCURACY_THRESHOLD.mobile : CONFIG.ACCURACY_THRESHOLD.desktop;
                    if (accuracy > accuracyThreshold) {
                        console.log(`Accuracy too low (${accuracy}m > ${accuracyThreshold}m, device: ${isMobile ? "mobile" : "desktop"}). Retrying...`);
                        fetchAccurateLocation(attempt + 1);
                        return;
                    }

                    // ──── Success: Reverse geocode ────
                    try {
                        const parsed = await reverseGeocode(latitude, longitude);

                        // ──── Backend is the single source of truth for the final pincode ────
                        // Nominatim/Google's postal_code is patchy near pincode boundaries
                        // (a genuinely-224122 GPS fix can come back tagged something else).
                        // Cross-check against our own serviceable-pincode geo index and prefer
                        // it when a close-enough match exists — this only ever CORRECTS the
                        // reverse geocoder's guess, never blocks the result on failure.
                        try {
                            const { data: nearest } = await resolveNearestPincode(latitude, longitude);
                            if (nearest?.success && nearest.found && nearest.code) {
                                parsed.pincode = nearest.code;
                                parsed.fullLabel = parsed.label ? `${parsed.label}, ${nearest.code}` : `Pincode: ${nearest.code}`;
                            }
                        } catch (nearestErr) {
                            console.warn("resolveNearestPincode failed, using reverse geocoder pincode:", nearestErr);
                        }

                        const locationPayload = {
                            lat: latitude,
                            lng: longitude,
                            accuracy: Math.round(accuracy),
                            timestamp: new Date().toISOString(),
                            source: isMobile ? "gps" : "ip",
                            ...parsed,
                        };

                        // Verification log — confirms both halves of the feature
                        // (GPS coordinates AND the resolved pincode) actually
                        // landed in state together, not just one silently.
                        console.log("[LocationContext] Location + pincode resolved:", {
                            device: isMobile ? "mobile" : "desktop",
                            lat: locationPayload.lat,
                            lng: locationPayload.lng,
                            accuracy: locationPayload.accuracy,
                            pincode: locationPayload.pincode || "(none returned)",
                            label: locationPayload.label,
                        });

                        setLocationData(locationPayload);
                        saveToStorage(locationPayload);
                        setStatus("success");
                        setError("");
                        setModalOpen(false);
                        setLoading(false);
                        isDetectingRef.current = false;
                    } catch (geocodeError) {
                        console.error("Reverse geocoding failed:", geocodeError);
                        setError("Failed to identify location. Please try again.");
                        setLoading(false);
                        isDetectingRef.current = false;
                    }
                },

                // ──── Error handler ────
                (error) => {
                    const errorMessage = getGeolocationErrorMessage(error, deviceType);
                    console.warn(`Geolocation error (attempt ${attempt}):`, error.message);

                    // ──── Permission denied: Show pincode fallback immediately ────
                    if (error.code === error.PERMISSION_DENIED) {
                        setStatus("failed");
                        setError(errorMessage);
                        setLoading(false);
                        setModalOpen(true);
                        isDetectingRef.current = false;
                        return;
                    }

                    // ──── Timeout or unavailable: Retry ────
                    if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
                        console.log(`Geolocation ${error.code === error.TIMEOUT ? "timeout" : "unavailable"}. Retrying (${attempt}/${CONFIG.MAX_RETRIES})...`);
                        fetchAccurateLocation(attempt + 1);
                        return;
                    }

                    // ──── Unknown error: Retry ────
                    console.log(`Unknown error: ${error.message}. Retrying (${attempt}/${CONFIG.MAX_RETRIES})...`);
                    fetchAccurateLocation(attempt + 1);
                },

                geoOptions
            );
        },
        [locationData, deviceType, saveToStorage]
    );

    /**
     * User-facing function to initiate location detection.
     *
     * Attempts real browser geolocation on EVERY device — mobile resolves via
     * GPS, desktop resolves via the browser's own WiFi/network location
     * service (navigator.geolocation works on desktop too; it does not
     * require GPS hardware). Only falls back to manual pincode entry if
     * detection genuinely fails (denied/unsupported/insecure context/too
     * inaccurate after retries) — it no longer skips detection outright for
     * non-mobile devices, which previously meant "Detect my location" did
     * nothing on desktop besides showing an error.
     */
    const detectLocation = useCallback(() => {
        // ──── Guard: Already detecting ────
        if (isDetectingRef.current) {
            console.warn("Location detection already in progress");
            return;
        }

        // ──── Preliminary checks (all devices) ────
        if (!window.isSecureContext) {
            setError("Location requires HTTPS connection");
            setStatus("failed");
            setModalOpen(true);
            return;
        }

        if (!navigator.geolocation) {
            setError("Geolocation not supported on this browser");
            setStatus("failed");
            setModalOpen(true);
            return;
        }

        // ──── Begin detection (GPS on mobile, WiFi/network-based on desktop) ────
        isDetectingRef.current = true;
        setStatus("detecting");
        setLoading(true);
        setError("");

        fetchAccurateLocation(1);
    }, [fetchAccurateLocation]);

    /* ═════════════════════════════════════════════════════════════════════
       FALLBACK: PINCODE DETECTION
       ═════════════════════════════════════════════════════════════════════ */

    const setPincode = useCallback(
        async (pincode) => {
            if (!isValidPincode(pincode)) {
                setError("Invalid pincode. Please enter a valid 6-digit Indian pincode.");
                return false;
            }

            setLoading(true);
            setError("");

            try {
                const locationPayload = await lookupPincode(pincode);

                if (!locationPayload) {
                    throw new Error("Pincode lookup failed");
                }

                locationPayload.timestamp = new Date().toISOString();
                locationPayload.source = "pincode";
                locationPayload.accuracy = null;

                setLocationData(locationPayload);
                saveToStorage(locationPayload);
                setStatus("success");
                setLoading(false);
                setModalOpen(false);

                return true;
            } catch (error) {
                console.error("Pincode lookup error:", error);
                setError("Could not find location for this pincode. Please try another.");
                setLoading(false);
                return false;
            }
        },
        [saveToStorage]
    );

    /* ═════════════════════════════════════════════════════════════════════
       MANUAL LOCATION CONTROL
       ═════════════════════════════════════════════════════════════════════ */

    const setLocation = useCallback(
        (data) => {
            const locationPayload = {
                ...data,
                timestamp: new Date().toISOString(),
                source: data.source || "manual",
            };

            setLocationData(locationPayload);
            saveToStorage(locationPayload);
            setStatus("success");
            setError("");
        },
        [saveToStorage]
    );

    const clearLocation = useCallback(() => {
        setLocationData(null);
        setStatus("idle");
        setError("");

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.warn("Failed to clear location storage:", error);
        }
    }, []);

    /* ═════════════════════════════════════════════════════════════════════
       INITIALIZATION
       ═════════════════════════════════════════════════════════════════════ */

    useEffect(() => {
        const mobile = isMobileDevice();
        setDeviceType(mobile ? "mobile" : "desktop");

        const saved = loadFromStorage();

        if (saved) {
            // Saved location exists — use silently, don't open modal
            setLocationData(saved);
            setStatus("success");
            setModalOpen(false);
        } else {
            // No saved location — open modal to get user location
            setStatus("idle");
            setModalOpen(true);
        }
    }, [loadFromStorage]);

    /* ═════════════════════════════════════════════════════════════════════
       CONTEXT VALUE & EXPORT
       ═════════════════════════════════════════════════════════════════════ */

    const value = useMemo(
        () => ({
            locationData,
            loading,
            error,
            status,
            modalOpen,
            deviceType,

            setModalOpen,

            detectLocation,
            setPincode,
            setLocation,
            clearLocation,

            isValidPincode,
            isMobileDevice,
        }),
        [
            locationData,
            loading,
            error,
            status,
            modalOpen,
            deviceType,
            detectLocation,
            setPincode,
            setLocation,
            clearLocation,
        ]
    );

    return (
        <LocationContext.Provider value={value}>
            {children}
        </LocationContext.Provider>
    );
};

/* ═══════════════════════════════════════════════════════════════════════
   CUSTOM HOOK
   ═════════════════════════════════════════════════════════════════════ */

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (!context) {
        throw new Error("useLocation must be used within LocationProvider");
    }
    return context;
};

export const useLocation2 = useLocation;

export default LocationContext;

/* ═══════════════════════════════════════════════════════════════════════
   ERROR MESSAGE HELPER
   ═════════════════════════════════════════════════════════════════════ */

function getGeolocationErrorMessage(error, deviceType) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return deviceType === "mobile"
                ? "Location permission denied. Please enable it in Settings > Apps > [AppName] and try again."
                : "Location permission denied. Please enter pincode manually.";

        case error.POSITION_UNAVAILABLE:
            return deviceType === "mobile"
                ? "Location services unavailable. Check if GPS and WiFi location are enabled in Settings."
                : "Location unavailable. Please enter pincode.";

        case error.TIMEOUT:
            return deviceType === "mobile"
                ? "Location detection timed out. Please ensure GPS has a clear view and try again."
                : "Location detection timed out. Please enter pincode.";

        default:
            return "Unable to detect location. Please enter pincode manually.";
    }
}