import { createContext, useContext, useEffect, useState } from "react";
import adminApi from "../api/adminApi";

const AdminAuthContext = createContext(null);

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("adminAuth");
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.token && parsed?.role) {
                    setAdmin(parsed);
                } else {
                    localStorage.removeItem("adminAuth");
                }
            }
        } catch {
            localStorage.removeItem("adminAuth");
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Listen for token refresh from axios interceptor ── */
    useEffect(() => {
        const handler = (e) => {
            const data = e.detail;
            // [FIX] Refresh payload can arrive either flat ({_id, role, ...})
            // or nested under `user` ({ user: { _id, role, ... } }) depending
            // on which endpoint issued it — support both shapes safely.
            const src = data?.user || data;
            if (data?.token && src?._id) {
                const updated = {
                    _id: src._id,
                    name: src.name,
                    email: src.email,
                    role: src.role,
                    token: data.token,
                };
                localStorage.setItem("adminAuth", JSON.stringify(updated));
                setAdmin(updated);
            }
        };
        window.addEventListener("adminAuth:refreshed", handler);
        return () => window.removeEventListener("adminAuth:refreshed", handler);
    }, []);

    const login = async (email, password) => {
        const { data } = await adminApi.post("/auth/admin/login", { email, password });

        // [FIX] Backend (authController.js -> authenticateByRole) returns the
        // user's identity fields nested inside a `user` object, not flat on
        // the response root:
        //   { success, token, user: { _id, name, email, phone, role } }
        // Previously this read data._id / data.role directly, which are
        // always undefined -> always threw "Invalid server response" even
        // on a fully successful login.
        if (!data?.success || !data?.token || !data?.user?._id || !data?.user?.role) {
            throw new Error("Invalid server response");
        }

        const { user } = data;

        if (!["admin", "owner"].includes(user.role)) {
            throw new Error("Access denied. Admin or Owner only.");
        }

        const adminData = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: data.token,
        };
        localStorage.setItem("adminAuth", JSON.stringify(adminData));
        setAdmin(adminData);
    };

    const logout = () => {
        localStorage.removeItem("adminAuth");
        setAdmin(null);
    };

    return (
        <AdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, login, logout, loading }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);