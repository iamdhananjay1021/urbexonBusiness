import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/axios";
import { store } from "../app/store";
import { clearCart } from "../features/cart/cartSlice";

const AuthContext = createContext(null);

const requestLocation = () =>
    new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            async ({ coords: { latitude, longitude } }) => {
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=18`,
                        { headers: { "Accept-Language": "en" } }
                    );
                    const data = await res.json();
                    const a = data.address || {};
                    const locality = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city_district || "";
                    const city = a.city || a.town || a.village || a.county || "Unknown";
                    const state = a.state || "";
                    const displayCity = locality ? `${locality}, ${city}` : city;
                    resolve({ latitude, longitude, city: displayCity, state });
                } catch { resolve(null); }
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationAsked, setLocationAsked] = useState(false);

    /* ── Rehydrate on mount + validate with server ── */
    useEffect(() => {
        let cancelled = false;
        const rehydrate = async () => {
            try {
                const raw = localStorage.getItem("auth");
                if (!raw) return;
                const parsed = JSON.parse(raw);
                if (!parsed?.user || !parsed?.token) {
                    localStorage.removeItem("auth");
                    return;
                }
                // Set immediately for fast UI
                setUser(parsed.user);
                setToken(parsed.token);
                // Validate with server & get fresh data
                try {
                    const { data } = await api.get("/auth/profile", {
                        headers: { Authorization: `Bearer ${parsed.token}` },
                    });
                    if (!cancelled && data?._id) {
                        const freshUser = {
                            _id: data._id,
                            name: data.name,
                            email: data.email,
                            phone: data.phone || "",
                            role: data.role,
                        };
                        setUser(freshUser);
                        localStorage.setItem("auth", JSON.stringify({ token: parsed.token, user: freshUser }));
                    }
                } catch {
                    // Token invalid — clear auth
                    if (!cancelled) {
                        localStorage.removeItem("auth");
                        setUser(null);
                        setToken(null);
                    }
                }
            } catch {
                localStorage.removeItem("auth");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        rehydrate();
        return () => { cancelled = true; };
    }, []);

    /* ── Listen for token refresh events from axios interceptor ── */
    useEffect(() => {
        const handler = (e) => {
            const data = e.detail;
            if (data?.token) {
                const refreshedUser = {
                    _id: data._id,
                    name: data.name,
                    email: data.email,
                    phone: data.phone || "",
                    role: data.role,
                };
                setToken(data.token);
                setUser(refreshedUser);
                localStorage.setItem("auth", JSON.stringify({ token: data.token, user: refreshedUser }));
            }
        };
        window.addEventListener("auth:refreshed", handler);
        return () => window.removeEventListener("auth:refreshed", handler);
    }, []);

    const saveUserLocation = useCallback(async () => {
        if (locationAsked) return;
        setLocationAsked(true);
        const location = await requestLocation();
        if (location) {
            try { await api.post("/auth/save-location", location); } catch { /* silent */ }
        }
    }, [locationAsked]);

    const _saveAuth = useCallback((data) => {
        const authData = {
            token: data.token,
            user: {
                _id: data._id,
                name: data.name,
                email: data.email,
                phone: data.phone || "",
                role: data.role,
            },
        };
        localStorage.setItem("auth", JSON.stringify(authData));
        setUser(authData.user);
        setToken(data.token);
    }, []);

    const login = useCallback(async (email, password) => {
        const { data } = await api.post("/auth/login", { email, password });
        _saveAuth(data);
        saveUserLocation();
    }, [_saveAuth, saveUserLocation]);

    const loginWithData = useCallback((data) => {
        _saveAuth(data);
        saveUserLocation();
    }, [_saveAuth, saveUserLocation]);

    const register = useCallback(async (name, email, password) => {
        await api.post("/auth/register", { name, email, password });
    }, []);

    const logout = useCallback(() => {
        store.dispatch(clearCart());
        const userId = user?._id || "guest";
        localStorage.removeItem("auth");
        localStorage.removeItem(`persist:cart_${userId}`);
        localStorage.removeItem("cartItems");
        setUser(null);
        setToken(null);
        setLocationAsked(false);
    }, [user?._id]);

    const updateUser = useCallback((data) => {
        const updated = {
            _id: data._id,
            name: data.name,
            email: data.email,
            phone: data.phone || "",
            role: data.role,
        };
        setUser(updated);
        // Sync localStorage
        try {
            const stored = JSON.parse(localStorage.getItem("auth") || "{}");
            stored.user = updated;
            localStorage.setItem("auth", JSON.stringify(stored));
        } catch { /* silent */ }
    }, []);

    const ctxValue = useMemo(() => ({
        user, token, login, loginWithData, register, logout, updateUser, loading
    }), [user, token, login, loginWithData, register, logout, updateUser, loading]);

    return (
        <AuthContext.Provider value={ctxValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};
