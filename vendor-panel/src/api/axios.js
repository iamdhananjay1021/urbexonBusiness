/**
 * axios.js — Production v4.0 FINAL
 * ✅ Token auto-inject from localStorage
 * ✅ 401 → auto logout + redirect
 * ✅ Clean error handling
 */
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    headers: {
        "Content-Type": "application/json",
    },
});

// ✅ REQUEST: Auto-inject token
// ✅ FIXED: Register/public routes pe token inject mat karo
// axios.js — interceptor mein
api.interceptors.request.use((config) => {
    const publicRoutes = ["/vendor/register", "/login", "/register",
        "/verify-otp", "/forgot-password"];

    const isPublic = publicRoutes.some(r => config.url?.includes(r));
    if (isPublic) return config; // ← token inject skip

    try {
        const raw = localStorage.getItem("vendorAuth");
        const auth = JSON.parse(raw || "{}");
        if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`;
    } catch {
        localStorage.removeItem("vendorAuth");
    }
    return config;
});
// ✅ RESPONSE: Handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        // Network error
        if (!error.response) {
            console.error("[Axios] Network error");
            window.dispatchEvent(new CustomEvent("api:error", {
                detail: { type: "network", message: "Network error. Check your connection." },
            }));
            return Promise.reject(error);
        }

        // 401 Unauthorized → Auto logout (but NOT on public pages)
        if (status === 401) {
            console.warn("[Axios] 401 Unauthorized");
            localStorage.removeItem("vendorAuth");
            delete api.defaults.headers.common["Authorization"];

            // Only redirect to login if NOT on public pages
            const publicPages = ["/login", "/apply", "/forgot-password", "/reset-password"];
            const isPublicPage = publicPages.some(p => window.location.pathname.includes(p));

            if (!isPublicPage && !window.location.pathname.includes("/login")) {
                window.location.replace("/login");
            }
        }

        // 403 Forbidden (not approved vendor)
        if (status === 403) {
            const msg = error.response?.data?.message;
            if (msg?.includes("not approved")) {
                window.dispatchEvent(new CustomEvent("api:error", {
                    detail: { type: "warning", message: "Your vendor account is pending approval." },
                }));
            }
        }

        // 404 Not Found
        if (status === 404) {
            console.warn("[Axios] 404:", error.config?.url);
        }

        // 429 Rate Limit
        if (status === 429) {
            window.dispatchEvent(new CustomEvent("api:error", {
                detail: { type: "warning", message: "Too many requests. Please slow down." },
            }));
        }

        // 500+ Server Error
        if (status >= 500) {
            window.dispatchEvent(new CustomEvent("api:error", {
                detail: { type: "error", message: "Server error. Please try again later." },
            }));
        }

        return Promise.reject(error);
    }
);

export default api;