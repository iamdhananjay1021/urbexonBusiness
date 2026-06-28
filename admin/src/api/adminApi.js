/**
 * adminApi.js — Production
 * Fixed: Dynamic baseURL from env variable
 */
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:9000/api";

const api = axios.create({
    baseURL: API_URL,
    timeout: 60_000,
});

const getAdminAuth = () => {
    try {
        const raw = localStorage.getItem("adminAuth");
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem("adminAuth");
        return null;
    }
};

const saveAdminAuth = (data) => {
    try {
        const current = getAdminAuth() || {};
        localStorage.setItem("adminAuth", JSON.stringify({
            ...current,
            token: data.token,
            user: { _id: data._id, name: data.name, email: data.email, role: data.role },
        }));
    } catch { /* ignore */ }
};

// Request: attach token
api.interceptors.request.use(
    (config) => {
        const auth = getAdminAuth();
        if (auth?.token) config.headers.Authorization = `Bearer ${auth.token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

// Response: handle 401 with single-flight refresh
let _refreshing = null;
api.interceptors.response.use(
    (res) => res,
    async (error) => {
        const status = error.response?.status;
        const originalRequest = error.config;

        if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            const auth = getAdminAuth();
            if (auth?.token) {
                try {
                    if (!_refreshing) {
                        // ✅ FIX: Send token in header, not body, to match backend `refreshToken` controller
                        _refreshing = axios.post(`${API_URL}/auth/refresh`, {}, {
                            headers: { Authorization: `Bearer ${auth.token}` }
                        })
                            .finally(() => { _refreshing = null; });
                    }
                    const { data } = await _refreshing;
                    if (data?.token) {
                        saveAdminAuth(data);
                        originalRequest.headers.Authorization = `Bearer ${data.token}`;
                        return api(originalRequest);
                    }
                } catch { /* fall through */ }
            }
            localStorage.removeItem("adminAuth");
            if (!window.location.pathname.includes("/login")) window.location.replace("/admin/login");
        }

        return Promise.reject(error);
    }
);

export { saveAdminAuth };
export default api;
