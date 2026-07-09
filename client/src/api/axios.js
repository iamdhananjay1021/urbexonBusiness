/**
 * axios.js — Production v2.1
 * ✅ Dynamic base URL from env
 * ✅ Auto token refresh on 401
 * ✅ Global error event dispatch for Toast notifications
 * ✅ Network error detection
 */
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: { "Content-Type": "application/json" },
    withCredentials: true,
});

const getStoredToken = () => {
    try {
        const raw = localStorage.getItem("auth");
        if (!raw) return null;
        return JSON.parse(raw)?.token || null;
    } catch { return null; }
};

// ── Request: attach token ──
api.interceptors.request.use(
    (config) => {
        const token = getStoredToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response: handle 401 + dispatch global error events ──
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalReq = error.config;
        const isNetworkErr = !error.response && error.code === "ERR_NETWORK";

        // Dispatch global event so components can show toast without prop drilling
        if (isNetworkErr) {
            window.dispatchEvent(new CustomEvent("api:error", { detail: { type: "network", message: "Network error — check your connection" } }));
        } else if (status === 429) {
            window.dispatchEvent(new CustomEvent("api:error", { detail: { type: "warning", message: "Too many requests — please slow down" } }));
        } else if (status >= 500) {
            window.dispatchEvent(new CustomEvent("api:error", { detail: { type: "error", message: "Server error — please try again shortly" } }));
        }

        // Auto refresh on 401
        if (status === 401 && !originalReq._retry) {
            originalReq._retry = true;
            try {
                const stored = localStorage.getItem("auth");
                if (stored) {
                    const parsed = JSON.parse(stored);
                    const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, {
                        withCredentials: true,
                        headers: { Authorization: `Bearer ${parsed.token}` },
                    });
                    if (data?.token) {
                        localStorage.setItem("auth", JSON.stringify({ ...parsed, token: data.token }));
                        originalReq.headers.Authorization = `Bearer ${data.token}`;
                        window.dispatchEvent(new CustomEvent("auth:refreshed", { detail: data }));
                        return api(originalReq);
                    }
                }
            } catch { /* fall through to logout */ }

            localStorage.removeItem("auth");
            localStorage.removeItem("persist:cart_guest");
            const path = window.location.pathname;
            if (!path.includes("/login") && !path.startsWith("/admin")) {
                window.location.replace("/login");
            }
        }

        return Promise.reject(error);
    }
);

export default api;
