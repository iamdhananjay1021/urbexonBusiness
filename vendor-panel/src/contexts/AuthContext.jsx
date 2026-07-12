/**
 * AuthContext.jsx — Production, final (v6.0)
 *
 * [FIX v6] Consolidated fixes on top of v5.0:
 *   1. STORAGE_KEY moved above the interceptors that reference it — was
 *      previously used before its `const` declaration further down the
 *      file. Harmless in practice (module fully evaluates before any
 *      interceptor callback can fire) but fragile and confusing; fixed
 *      for correctness and clarity.
 *   2. Login/register requests are now excluded from the refresh-retry
 *      interceptor. Previously, a 401 from "wrong password" on
 *      /vendor/login would ALSO trigger a refresh-token attempt; since no
 *      valid session exists yet, the refresh always failed and its error
 *      replaced the real "Invalid credentials" message — the login page
 *      showed the wrong error entirely. Now these auth endpoints just
 *      reject with their real error, untouched.
 *   3. login() now accepts BOTH call styles:
 *        login({ identifier, password })   (original)
 *        login(identifier, password)       (positional — what some Login
 *                                            pages call it with)
 *      Silently normalizes to avoid a repeat of the "throws required-field
 *      error even with correct credentials" bug seen on the admin panel.
 *   4. logout() now also calls POST /auth/logout (fire-and-forget) so the
 *      httpOnly refreshToken cookie is invalidated server-side too, not
 *      just cleared from localStorage. A stolen/cached refresh token can
 *      no longer be replayed after logout.
 *   5. Refresh response is validated (data.token must exist) before being
 *      treated as success — a malformed 200 response no longer gets
 *      treated as a valid refresh.
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const STORAGE_KEY = "vendorAuth";

// Endpoints that must NEVER trigger the refresh-retry flow — either
// because they're what's ISSUING the session (login/register), or because
// triggering a refresh from within them would recurse.
const NO_REFRESH_PATHS = ["/vendor/login", "/vendor/register", "/auth/refresh"];

const isNoRefreshUrl = (url) =>
  !!url && NO_REFRESH_PATHS.some((p) => url.includes(p));

/* ── Axios: always attach token from localStorage ── */
api.interceptors.request.use(
  (config) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
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

/* ── Axios: handle 401 globally with token refresh ── */
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // [FIX] Login/register/refresh itself must never enter the retry flow —
    // their own errors are the real, meaningful ones for the UI to show.
    if (isNoRefreshUrl(originalRequest?.url)) {
      if (originalRequest?.url?.includes("/auth/refresh")) {
        window.dispatchEvent(new Event("auth:unauthorized"));
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers["Authorization"] = "Bearer " + token;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // scope: "vendor" → refresh against the rt_vendor cookie only, so a
        // later login on another Urbexon panel in this browser can't swap
        // this session to a different account.
        const { data } = await api.post("/auth/refresh", { scope: "vendor" });
        const newAccessToken = data?.token;
        if (!newAccessToken) throw new Error("Refresh response missing token");

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const updatedVendor = { ...parsed.vendor, ...data.user, token: newAccessToken };
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newAccessToken, vendor: updatedVendor }));
        }

        api.defaults.headers.common["Authorization"] = "Bearer " + newAccessToken;
        originalRequest.headers["Authorization"] = "Bearer " + newAccessToken;

        window.dispatchEvent(new CustomEvent("auth:refreshed", { detail: { token: newAccessToken, user: data.user } }));

        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.dispatchEvent(new Event("auth:unauthorized"));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Listen for global auth events ── */
  useEffect(() => {
    const handleUnauthorized = () => logout();
    const handleRefreshed = (e) => {
      const { token, user } = e.detail;
      setVendor((prev) => {
        if (!prev) return null;
        return { ...prev, ...user, token };
      });
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    window.addEventListener("auth:refreshed", handleRefreshed);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
      window.removeEventListener("auth:refreshed", handleRefreshed);
    };
  }, []);

  /* ── Rehydrate from localStorage + validate with server ── */
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const { token, vendor: cachedVendor } = JSON.parse(raw);
        if (!token) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }

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
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * [FIX] LOGIN — accepts BOTH call styles:
   *   login({ identifier, password })
   *   login(identifier, password)
   * so it doesn't matter which convention the Login page component uses.
   */
  const login = async (identifierOrCreds, maybePassword) => {
    let identifier;
    let password;

    if (identifierOrCreds && typeof identifierOrCreds === "object") {
      identifier = identifierOrCreds.identifier ?? identifierOrCreds.email ?? identifierOrCreds.phone;
      password = identifierOrCreds.password;
    } else {
      identifier = identifierOrCreds;
      password = maybePassword;
    }

    if (!identifier?.trim() || !password?.trim()) {
      throw new Error("Email/phone and password are required");
    }

    const isEmail = identifier.includes("@");
    const payload = isEmail
      ? { email: identifier.trim(), password }
      : { phone: identifier.trim(), password };

    const { data } = await api.post("/vendor/login", payload);

    if (!data.success) throw new Error(data.message || "Login failed");

    if (data.user?.role !== "vendor") {
      throw new Error("Access denied. This is not a vendor account.");
    }

    const token = data.token;
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    let vendorProfile = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone || "",
      role: data.user.role,
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

  /**
   * [FIX] LOGOUT — now also tells the backend to clear the httpOnly
   * refreshToken cookie (POST /auth/logout), not just local state. Fire-
   * and-forget: local logout must succeed instantly regardless of network.
   */
  const logout = () => {
    api.post("/auth/logout", { scope: "vendor" }).catch(() => {
      // Non-fatal — local session is cleared below either way
    });
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