import {
    createContext,
    useContext,
    useEffect,
    useState,
} from "react";

import adminApi from "../api/adminApi";

const STORAGE_KEY = "adminAuth";

const AdminAuthContext = createContext(null);

const VALID_ROLES = ["admin", "owner"];

export const AdminAuthProvider = ({ children }) => {
    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);

            if (!raw) {
                setLoading(false);
                return;
            }

            const parsed = JSON.parse(raw);

            if (
                parsed?.token &&
                VALID_ROLES.includes(parsed.role)
            ) {
                setAdmin(parsed);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handleRefresh = ({ detail }) => {
            const src = detail?.user || detail;

            if (!detail?.token || !src?._id) return;

            const updated = {
                _id: src._id,
                name: src.name,
                email: src.email,
                role: src.role,
                token: detail.token,
            };

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(updated)
            );

            setAdmin(updated);
        };

        window.addEventListener(
            "adminAuth:refreshed",
            handleRefresh
        );

        return () =>
            window.removeEventListener(
                "adminAuth:refreshed",
                handleRefresh
            );
    }, []);

    const login = async (email, password) => {
        const { data } = await adminApi.post(
            "/auth/admin/login",
            {
                email,
                password,
            }
        );

        if (
            !data?.success ||
            !data?.token ||
            !data?.user
        ) {
            throw new Error("Invalid login response");
        }

        const { user } = data;

        if (!VALID_ROLES.includes(user.role)) {
            throw new Error("Access denied");
        }

        const auth = {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: data.token,
        };

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(auth)
        );

        setAdmin(auth);
    };

    const logout = async () => {
        try {
            await adminApi.post("/auth/logout", { scope: "admin" });
        } catch {
            // Ignore logout API failures
        }

        localStorage.removeItem(STORAGE_KEY);
        setAdmin(null);
    };

    return (
        <AdminAuthContext.Provider
            value={{
                admin,
                loading,
                isAuthenticated: !!admin,
                login,
                logout,
            }}
        >
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => {
    const context = useContext(AdminAuthContext);

    if (!context) {
        throw new Error(
            "useAdminAuth must be used inside AdminAuthProvider"
        );
    }

    return context;
};