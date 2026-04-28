/**
 * AuthContext.jsx — Production v4.0 FINAL
 * ✅ Proper vendor detection
 * ✅ Token persistence
 * ✅ Auto-refresh on mount
 * ✅ Handles pending/approved states
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const STORAGE_KEY = "vendorAuth";

export const AuthProvider = ({ children }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Initialize: Load from localStorage and verify with backend
  useEffect(() => {
    const init = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          setLoading(false);
          return;
        }

        const { token, vendor: cachedVendor } = JSON.parse(raw);
        if (!token) {
          localStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // Set token in axios
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        // Verify token is still valid by fetching fresh vendor data
        try {
          const { data } = await api.get("/vendor/me");
          if (data.success && data.vendor) {
            const updatedVendor = { ...data.vendor, token };
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: updatedVendor }));
            setVendor(updatedVendor);
          } else {
            throw new Error("Invalid vendor response");
          }
        } catch (err) {
          console.error("[Auth] Failed to verify token:", err.response?.data);

          // If 404, user hasn't applied as vendor yet - use cached data
          if (err.response?.status === 404) {
            setVendor(cachedVendor);
          } else {
            // Token expired/invalid - clear auth
            localStorage.removeItem(STORAGE_KEY);
            delete api.defaults.headers.common["Authorization"];
            setVendor(null);
          }
        }
      } catch (err) {
        console.error("[Auth] Init failed:", err);
        localStorage.removeItem(STORAGE_KEY);
        setVendor(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // ✅ LOGIN
  const login = async (email, password) => {
    try {
      // Step 1: Login via /auth/login
      const { data } = await api.post("/auth/login", { email, password });

      // If email verification required, throw error with response attached
      if (!data.token && data.requiresVerification) {
        const err = new Error(data.message);
        err.response = { status: 403, data: { requiresVerification: true, email: data.email, message: data.message } };
        throw err;
      }

      if (!data.token) {
        throw new Error("No token received from server");
      }

      const token = data.token;
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Step 2: Try to fetch vendor profile
      let vendorProfile = null;
      try {
        const vRes = await api.get("/vendor/me");
        if (vRes.data.success && vRes.data.vendor) {
          vendorProfile = { ...vRes.data.vendor, token };
        }
      } catch (err) {
        console.warn("[Auth] Vendor profile not found:", err.response?.data);

        // If 404, user hasn't applied as vendor
        if (err.response?.status === 404) {
          throw new Error("Please complete vendor registration first. Go to /apply");
        }

        // Other errors - create basic profile from login response
        vendorProfile = {
          ...data.user,
          email: data.email || email,
          role: data.role,
          token,
        };
      }

      // Step 3: Save to localStorage and state
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, vendor: vendorProfile }));
      setVendor(vendorProfile);

      return vendorProfile;
    } catch (err) {
      console.error("[Auth] Login failed:", err.message);
      throw err;
    }
  };



  // ✅ LOGOUT
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common["Authorization"];
    setVendor(null);
  };

  // ✅ REFRESH VENDOR (after profile updates)
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

      // If 401, logout
      if (err.response?.status === 401) {
        logout();
      }
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
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
};