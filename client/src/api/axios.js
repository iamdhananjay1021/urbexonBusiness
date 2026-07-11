import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const STORAGE_KEY = "auth";

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

/* -----------------------------
 * Local Storage Helpers
 * ----------------------------- */

const getStoredAuth = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
};

const saveStoredAuth = (token, user = null) => {
    const current = getStoredAuth() || {};

    const auth = {
        ...current,
        token,
        ...(user ? { user } : {}),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));

    window.dispatchEvent(
        new CustomEvent("auth:refreshed", {
            detail: {
                token,
                user: auth.user,
            },
        })
    );
};

/* -----------------------------
 * Request Interceptor
 * ----------------------------- */

api.interceptors.request.use(
    (config) => {
        const auth = getStoredAuth();

        if (auth?.token) {
            config.headers.Authorization = `Bearer ${auth.token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

/* -----------------------------
 * Refresh Queue
 * ----------------------------- */

let refreshPromise = null;

const performRefresh = async () => {
    const auth = getStoredAuth();

    if (!auth?.token) {
        throw new Error("No active session");
    }

    const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        {
            timeout: 10000,
            withCredentials: true,
            headers: {
                Authorization: `Bearer ${auth.token}`,
            },
        }
    );

    if (!data?.token) {
        throw new Error("Refresh response missing token");
    }
    const refreshedUser = data.user ?? auth.user ?? null;

    saveStoredAuth(
        data.token,
        refreshedUser
    );

    return data.token;
};


/* -----------------------------
 * Response Interceptor
 * ----------------------------- */

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        const isNetworkError =
            !error.response ||
            error.code === "ERR_NETWORK" ||
            error.code === "ECONNABORTED";

        if (isNetworkError) {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "network",
                        message: "Network error. Check your internet connection.",
                    },
                })
            );
        } else if (status === 429) {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "warning",
                        message: "Too many requests. Please try again shortly.",
                    },
                })
            );
        } else if (status >= 500) {
            window.dispatchEvent(
                new CustomEvent("api:error", {
                    detail: {
                        type: "error",
                        message: "Server error. Please try again later.",
                    },
                })
            );
        }

        if (
            status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !originalRequest.url?.includes("/auth/login") &&
            !originalRequest.url?.includes("/auth/register") &&
            !originalRequest.url?.includes("/auth/refresh")
        ) {
            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = performRefresh().finally(() => {
                        refreshPromise = null;
                    });
                }

                const freshToken = await refreshPromise;

                originalRequest.headers = {
                    ...originalRequest.headers,
                    Authorization: `Bearer ${freshToken}`,
                };

                return api(originalRequest);
            } catch (refreshErr) {
                // BUG FIX: any failure here — including a transient network
                // error/timeout (e.g. the backend restarting mid-deploy, or
                // a brief connection drop) — used to be treated identically
                // to "your refresh token is invalid," wiping the session and
                // forcing a re-login even though the token itself was still
                // fine and would have refreshed successfully on the very
                // next attempt. Only a real rejection from the refresh
                // endpoint (401/403) means the session is actually invalid.
                const refreshStatus = refreshErr?.response?.status;
                const isAuthRejection = refreshStatus === 401 || refreshStatus === 403;

                if (isAuthRejection) {
                    localStorage.removeItem(STORAGE_KEY);

                    window.dispatchEvent(new Event("auth:unauthorized"));

                    const currentPath = window.location.pathname;

                    if (!currentPath.startsWith("/login")) {
                        window.location.replace("/login");
                    }
                }
            }
        }

        return Promise.reject(error);
    }
);

export default api;