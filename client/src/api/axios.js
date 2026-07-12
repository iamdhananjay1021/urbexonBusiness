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
 * Refresh Queue
 * ----------------------------- */

let refreshPromise = null;

// BUG FIX: this used to send the (by-definition expired/expiring) access
// token as `Authorization: Bearer <token>` on the refresh call. The backend
// refresh controller never reads that header at all — it authenticates the
// refresh purely off the httpOnly `refreshToken` cookie — so the header was
// dead weight at best. At worst, if `/api/auth/refresh` is ever wrapped in
// the same `protect` middleware used for normal routes, that middleware
// would try to jwt.verify() this expired token BEFORE the request reaches
// the refresh controller, reject it with 401 "Token expired", and the
// refresh endpoint could never succeed once a token actually expired — a
// chicken-and-egg trap identical in shape to bugs already fixed elsewhere
// in this codebase. Refresh now relies solely on the cookie (withCredentials
// already sends it), matching what the backend actually authenticates with.
const performRefresh = async () => {
    const auth = getStoredAuth();

    if (!auth?.token) {
        throw new Error("No active session");
    }

    // `scope` tells the backend WHICH panel's session cookie to use — all
    // four Urbexon apps share this API origin, so without it the server
    // can't tell a client-app refresh from a vendor/admin/delivery one.
    const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        { scope: "client" },
        {
            timeout: 10000,
            withCredentials: true,
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

const getOrStartRefresh = () => {
    if (!refreshPromise) {
        refreshPromise = performRefresh().finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
};

/* -----------------------------
 * JWT helpers (local decode only — no server round-trip)
 * ----------------------------- */

// Access tokens are short-lived server-side — any tab left open past that,
// or reopened after a while, starts with an already-expired token. Decoding
// locally lets the request interceptor refresh PROACTIVELY instead of every
// on-mount request (profile, wishlist checks, unread-count, etc.) firing,
// failing with 401, and only THEN refreshing — which is exactly the flood
// of "jwt expired" 401s seen on first page load.
//
// BUG FIX: buffer was 10s. On first page load, several components fire
// their own request in the same tick (profile, cart, wishlist, unread
// count, notifications...) — with only a 10s window, a token sitting at
// e.g. 8s-to-live still looks "not expiring soon," so all of those requests
// go out on a token that then expires mid-flight (network latency + any
// client/server clock skew), and each comes back with a genuine 401 that
// only THEN triggers the reactive refresh path — visible to the user as a
// burst of failed requests before things settle. 60s gives real headroom
// for that whole first-load burst to be caught proactively instead.
const isExpiredOrExpiringSoon = (token, bufferSeconds = 60) => {
    try {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (!payload?.exp) return false; // no exp claim — nothing we can check locally
        return Date.now() >= (payload.exp * 1000) - bufferSeconds * 1000;
    } catch {
        return false; // malformed token — let the server reject it as usual
    }
};

/* -----------------------------
 * Request Interceptor
 * ----------------------------- */

api.interceptors.request.use(
    async (config) => {
        // The refresh call itself must never try to refresh-before-sending —
        // that would recurse forever.
        if (config.url?.includes("/auth/refresh")) return config;

        let auth = getStoredAuth();

        if (auth?.token && isExpiredOrExpiringSoon(auth.token)) {
            try {
                const freshToken = await getOrStartRefresh();
                auth = { ...auth, token: freshToken };
            } catch {
                // Refresh failed proactively — fall through with the stale
                // token; the response interceptor's reactive 401 handling
                // below is still there as a fallback (no regression).
            }
        }

        if (auth?.token) {
            config.headers.Authorization = `Bearer ${auth.token}`;
        }

        return config;
    },
    (error) => Promise.reject(error)
);


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
                const freshToken = await getOrStartRefresh();

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