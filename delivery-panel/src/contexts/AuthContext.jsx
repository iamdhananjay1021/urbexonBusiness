/**
 * Delivery Panel AuthContext — Production v3.0
 * FIXES:
 * - login() now accepts { identifier, password } (email OR phone)
 * - Server-side token validation on mount (not just localStorage)
 * - Role check: only delivery_boy allowed
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const STORAGE_KEY = "deliveryAuth";

export const AuthProvider = ({ children }) => {
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Rehydrate from localStorage + validate token ── */
  useEffect(() => {
    let cancelled = false;
    const rehydrate = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const parsed = JSON.parse(raw);
        if (!parsed?.token) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }

        // Set immediately for fast UI
        const savedRider = parsed.rider || parsed.user || null;
        if (savedRider) setRider(savedRider);

        // Set auth header
        api.defaults.headers.common["Authorization"] = `Bearer ${parsed.token}`;

        // Validate with server
        try {
          const { data } = await api.get("/delivery/status");
          if (!cancelled) {
            const freshRider = data.rider || savedRider;
            setRider(freshRider);
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
              token: parsed.token,
              rider: freshRider,
            }));
          }
        } catch {
          // Token invalid — clear auth
          if (!cancelled) {
            localStorage.removeItem(STORAGE_KEY);
            delete api.defaults.headers.common["Authorization"];
            setRider(null);
          }
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    rehydrate();
    return () => { cancelled = true; };
  }, []);

  /* ── Login — accepts email OR phone as identifier ── */
  const login = async ({ identifier, password }) => {
    if (!identifier?.trim() || !password?.trim()) {
      throw new Error("Email/phone and password are required");
    }

    const isEmail = identifier.includes("@");

    const payload = isEmail
      ? { email: identifier.trim(), password }
      : { phone: identifier.trim(), password };

    // ✅ FIX: The delivery login route is defined under /delivery, not /auth.
    // Using the correct endpoint to resolve the 404 Not Found error.
    const { data } = await api.post("/delivery/login", payload);

    if (!data.success) {
      throw new Error(data.message || "Login failed");
    }

    // ✅ FIX: Role check is on the nested `user` object.
    if (data.user?.role !== "delivery_boy") {
      throw new Error("Access denied. This is not a delivery partner account.");
    }

    // ✅ FIX: User data is nested in the `user` object from the API response.
    const riderData = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone || "",
      role: data.user.role,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: data.token,
        rider: riderData,
      })
    );

    api.defaults.headers.common.Authorization = `Bearer ${data.token}`;

    setRider(riderData);

    return data;
  };
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common["Authorization"];
    setRider(null);
  };

  return (
    <AuthContext.Provider value={{ rider, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};