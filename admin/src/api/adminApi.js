import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const STORAGE_KEY = "adminAuth";

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

const getAdminAuth = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};

const saveAdminAuth = (data) => {
    try {
        const current = getAdminAuth() || {};

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                ...current,
                token: data.token,
                user: data.user ?? current.user,
            })
        );

        window.dispatchEvent(
            new CustomEvent("adminAuth:refreshed", {
                detail: data,
            })
        );
    } catch (err) {
        console.error("Failed to save admin auth", err);
    }
};

api.interceptors.request.use(
    (config) => {
        const auth = getAdminAuth();

        if (auth?.token) {
            config.headers.Authorization = `Bearer ${auth.token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

let refreshPromise = null;

const refreshAccessToken = async () => {
    const auth = getAdminAuth();

    if (!auth?.token) {
        throw new Error("No admin session");
    }

    // scope: "admin" → backend refreshes against the rt_admin cookie, so an
    // admin session can never be swapped for another panel's account that
    // logged in later in the same browser.
    const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        { scope: "admin" },
        {
            withCredentials: true,
        }
    );

    if (!data?.token) {
        throw new Error("Refresh failed");
    }

    saveAdminAuth(data);

    return data.token;
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        if (!error.response && error.code === "ERR_NETWORK") {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "network",
                        message: "Network error. Check your connection.",
                    },
                })
            );
        } else if (status === 429) {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "warning",
                        message: "Too many requests.",
                    },
                })
            );
        } else if (status >= 500) {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "error",
                        message: "Server error. Please try again.",
                    },
                })
            );
        }

        if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = refreshAccessToken().finally(() => {
                        refreshPromise = null;
                    });
                }

                const token = await refreshPromise;

                originalRequest.headers.Authorization = `Bearer ${token}`;

                return api(originalRequest);
            } catch (refreshErr) {
                // BUG FIX: same issue as the customer-facing client's
                // axios.js — a transient network error/timeout during
                // refresh (e.g. backend restarting mid-deploy) was treated
                // identically to "your session is invalid," logging the
                // admin out even though the refresh token itself was fine.
                // Only a real 401/403 rejection from the refresh endpoint
                // means the session is actually invalid.
                const refreshStatus = refreshErr?.response?.status;
                const isAuthRejection = refreshStatus === 401 || refreshStatus === 403;

                if (isAuthRejection) {
                    localStorage.removeItem(STORAGE_KEY);

                    if (!window.location.pathname.startsWith("/admin/login")) {
                        window.location.replace("/admin/login");
                    }
                }
            }
        }

        return Promise.reject(error);
    }
);

export { saveAdminAuth };
export default api;