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
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
                    );
                    const data = await res.json();
                    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "Unknown";
                    const state = data.address?.state || "";
                    resolve({ latitude, longitude, city, state });
                } catch { resolve(null); }
            },
            () => resolve(null),
            { timeout: 5000 }
        );
    });

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationAsked, setLocationAsked] = useState(false);

    /* ── Rehydrate on mount ── */
    useEffect(() => {
        try {
            const raw = localStorage.getItem("auth");
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.user && parsed?.token) {
                    setUser(parsed.user);
                    setToken(parsed.token);
                } else {
                    localStorage.removeItem("auth");
                }
            }
        } catch {
            localStorage.removeItem("auth");
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Listen for token refresh events from axios interceptor ── */
    useEffect(() => {
        const handler = (e) => {
            const data = e.detail;
            if (data?.token) {
                setToken(data.token);
                setUser({
                    _id: data._id,
                    name: data.name,
                    email: data.email,
                    role: data.role,
                });
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

    const ctxValue = useMemo(() => ({
        user, token, login, loginWithData, register, logout, loading
    }), [user, token, login, loginWithData, register, logout, loading]);

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
