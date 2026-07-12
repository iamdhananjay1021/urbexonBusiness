/**
 * Delivery Panel AuthContext — Production v4.1
 * FIXES:
 * - login() now accepts { identifier, password } (email OR phone)
 * - Server-side token validation on mount (not just localStorage)
 * - Role check: only delivery_boy allowed
 * - Login no longer fails with 403 just because the delivery application
 *   isn't approved yet. Backend always issues a token for a valid account
 *   and returns `deliveryApplicationStatus` separately, stored on
 *   `rider.applicationStatus`.
 * - ✅ FIX (v4.1): Rehydrate's merge now reads the LATEST value from
 *   localStorage at merge time, instead of the `savedRider` variable
 *   captured in a closure at the start of the async rehydrate call.
 *   Previously, if refreshApplicationStatus() ran (e.g. right after a
 *   successful /apply submission) WHILE the rehydrate's /delivery/status
 *   request was still in flight — or if that request resolved against an
 *   outdated backend that doesn't yet return `applicationStatus` — the
 *   stale closure value ("not_applied") could silently overwrite the
 *   freshly-set "pending" status, both in state and in localStorage. That
 *   sent an already-submitted rider back through Protected → /apply,
 *   which looked like "submission succeeded but I got bounced back to the
 *   form". Reading localStorage fresh at merge time closes that race.
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const STORAGE_KEY = "deliveryAuth";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
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

    if (originalRequest.url === '/auth/refresh') {
      window.dispatchEvent(new Event("auth:unauthorized"));
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // scope: "delivery" → refresh against the rt_delivery cookie only, so
        // a later login on another Urbexon panel in this browser can't swap
        // this session to a different account.
        const { data } = await api.post('/auth/refresh', { scope: "delivery" });
        const newAccessToken = data.token;

        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const updatedRider = { ...parsed.rider, ...data.user, token: newAccessToken };
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newAccessToken, rider: updatedRider }));
        }

        api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        originalRequest.headers['Authorization'] = 'Bearer ' + newAccessToken;

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

export const AuthProvider = ({ children }) => {
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  /* ── Listen for global auth events ── */
  useEffect(() => {
    const handleUnauthorized = () => logout();
    const handleRefreshed = (e) => {
      const { token, user } = e.detail;
      setRider(prev => {
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

        // Validate with server + refresh application status
        try {
          const { data } = await api.get("/delivery/status");
          if (!cancelled) {
            // ✅ FIX: read the CURRENT localStorage value here, not the
            // `savedRider` closure captured before this network call
            // started. If something else (e.g. refreshApplicationStatus
            // after a successful /apply submit) updated localStorage while
            // this request was in flight, we must merge on top of THAT,
            // not overwrite it with stale data.
            let currentRider = savedRider;
            try {
              const currentRaw = localStorage.getItem(STORAGE_KEY);
              if (currentRaw) {
                const currentParsed = JSON.parse(currentRaw);
                if (currentParsed?.rider) currentRider = currentParsed.rider;
              }
            } catch { /* fall back to savedRider */ }

            // /delivery/status returns `{ registered, applicationStatus, isOnline, rider }`
            // where `rider` is the DeliveryBoy document (its OWN _id, distinct
            // from the User _id) — never spread that over identity fields.
            const freshRider = {
              ...currentRider,
              // Only trust the server's applicationStatus if it actually sent one;
              // otherwise keep whatever the client already knows (never silently
              // downgrade to "not_applied" just because an older backend omitted the field).
              applicationStatus: data.applicationStatus ?? currentRider?.applicationStatus ?? "not_applied",
              isOnline: data.isOnline ?? currentRider?.isOnline,
            };
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
  const login = async (credentials) => {
    // Defensive check for credentials. This handles cases where the function
    // might be called incorrectly from the UI, e.g., login(identifier, password)
    // instead of the correct login({ identifier, password }).
    const identifier = credentials?.identifier;
    const password = credentials?.password;

    if (!identifier?.trim() || !password?.trim()) {
      throw new Error("Email/phone and password are required");
    }

    const isEmail = identifier.includes("@");

    const payload = isEmail
      ? { email: identifier.trim(), password }
      : { phone: identifier.trim(), password };

    // The delivery login route is defined under /delivery, not /auth.
    const { data } = await api.post("/delivery/login", payload);

    if (!data.success) {
      throw new Error(data.message || "Login failed");
    }

    // Role check is on the nested `user` object.
    if (data.user?.role !== "delivery_boy") {
      throw new Error("Access denied. This is not a delivery partner account.");
    }

    // applicationStatus comes back on every successful login (backend no
    // longer blocks login for unapproved/unapplied accounts).
    const riderData = {
      _id: data.user._id,
      name: data.user.name,
      email: data.user.email,
      phone: data.user.phone || "",
      role: data.user.role,
      applicationStatus: data.deliveryApplicationStatus || "not_applied",
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

  /* ── Call after a rider successfully submits the apply form, so the
     in-memory rider state reflects "pending" immediately without
     requiring a full page reload. ── */
  const refreshApplicationStatus = (status) => {
    setRider(prev => {
      if (!prev) return prev;
      const updated = { ...prev, applicationStatus: status };
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, rider: updated }));
        } catch { /* ignore */ }
      }
      return updated;
    });
  };

  const logout = () => {
    // Revoke the server-side refresh session (fire-and-forget) — local-only
    // logout left the httpOnly rt_delivery cookie alive on the server.
    api.post("/auth/logout", { scope: "delivery" }).catch(() => { });
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common["Authorization"];
    setRider(null);
  };

  return (
    <AuthContext.Provider value={{ rider, loading, login, logout, refreshApplicationStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};