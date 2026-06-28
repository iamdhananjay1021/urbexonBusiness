/**
 * AuthContext.jsx — Production v5.0
 * FIXES:
 * - login() now accepts { email/phone, password } object format
 * - Uses /auth/vendor/login endpoint (role-specific)
 * - Role guard: only vendor allowed
 * - Register link → client app /register
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

/* ── Axios: always attach token from localStorage ── */
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem("vendorAuth");
      if (raw) {
        const { token } = JSON.parse(raw);
        if (token) config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      console.error("[Axios] Auth token parsing error:", e);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ── Axios: handle 401 globally ── */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext(null);
const STORAGE_KEY = "vendorAuth";

export const AuthProvider = ({ children }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Listen for global 401 → logout ── */
  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  /* ── Rehydrate from localStorage + validate with server ── */
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const { token, vendor: cachedVendor } = JSON.parse(raw);
        if (!token) { localStorage.removeItem(STORAGE_KEY); return; }

        // Set immediately for fast UI
        if (cachedVendor) setVendor(cachedVendor);
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        // Validate with server
        try {
          const { data } = await api.get("/vendor/me");
          if (!cancelled && data.success && data.vendor) {
            const updated = { ...data.vendor, token };
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: updated }));
            setVendor(updated);
          }
        } catch (err) {
          if (!cancelled) {
            if (err.response?.status === 404) {
              // Vendor profile not created yet — keep cached user data
              setVendor(cachedVendor);
            } else {
              // Token invalid — clear auth
              localStorage.removeItem(STORAGE_KEY);
              delete api.defaults.headers.common["Authorization"];
              setVendor(null);
            }
          }
        }
      } catch (err) {
        console.error("[Auth] Init failed:", err);
        localStorage.removeItem(STORAGE_KEY);
        setVendor(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  /* ── LOGIN — accepts { identifier, password } ── */
  const login = async ({ identifier, password }) => {
    if (!identifier?.trim() || !password?.trim()) {
      throw new Error("Email/phone and password are required");
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes("@");
    const payload = isEmail
      ? { email: identifier.trim(), password }
      : { phone: identifier.trim(), password };

    // ✅ FIX: Use vendor-specific login endpoint
    const { data } = await api.post("/auth/vendor/login", payload);

    if (!data.success) throw new Error(data.message || "Login failed");

    // Role guard
    if (data.role !== "vendor") {
      throw new Error("Access denied. This is not a vendor account.");
    }

    const token = data.token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Base vendor profile from auth response
    let vendorProfile = {
      _id: data._id,
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      role: data.role,
      token,
    };

    // Save immediately so user is authenticated
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: vendorProfile }));
    setVendor(vendorProfile);

    // Try to fetch full vendor profile
    try {
      const { data: vData } = await api.get("/vendor/me");
      if (vData.success && vData.vendor) {
        vendorProfile = { ...vData.vendor, token };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: vendorProfile }));
        setVendor(vendorProfile);
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // First time login — vendor profile not created yet, stay on base profile
        console.warn("[Auth] Vendor profile not found — needs to apply");
      }
      // Don't throw — user is still authenticated
    }

    return vendorProfile;
  };

  /* ── LOGOUT ── */
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common["Authorization"];
    setVendor(null);
  };

  /* ── REFRESH VENDOR (after profile updates) ── */
  const refreshVendor = async () => {
    try {
      const { data } = await api.get("/vendor/me");
      if (data.success && data.vendor) {
        const raw = localStorage.getItem(STORAGE_KEY);
        const { token } = raw ? JSON.parse(raw) : {};
        const updated = { ...data.vendor, token };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: updated }));
        setVendor(updated);
      }
    } catch (err) {
      console.error("[Auth] Refresh failed:", err);
      if (err.response?.status === 401) logout();
    }
  };

  return (
    <AuthContext.Provider value={{ vendor, loading, login, logout, refreshVendor }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};