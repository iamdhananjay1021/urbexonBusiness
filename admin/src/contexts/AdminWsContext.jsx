/**
 * AdminWsContext — the ONE shared admin WebSocket connection.
 *
 * BUG FIX: before this file existed, useAdminWs (hooks/useAdminWs.js) was
 * called independently in FOUR places — Admin.jsx (the always-mounted
 * shell), AdminOrders.jsx, AdminLocalDelivery.jsx, and useVendors.js (used
 * by AdminVendors.jsx). Since Admin.jsx's shell stays mounted for every
 * admin route (it renders <Outlet/>), visiting e.g. /admin/orders opened
 * TWO simultaneous sockets to the same backend at once — the shell's and
 * the page's — both auto-joined to the "admins" room, doubling every
 * broadcast (duplicate toasts/sounds/refreshes) and doubling connection
 * count for no reason. Admin.jsx already had a `window.dispatchEvent`
 * escape hatch for this ("so child pages can react") but no page actually
 * used it — they each called useAdminWs again instead.
 *
 * This provider calls useAdminWs exactly ONCE, mounted alongside
 * Admin.jsx's shell, and exposes {connected, send, lastMessage} via
 * context so every descendant page consumes the same connection instead
 * of opening its own.
 */
import { createContext, useContext, useState, useCallback, useMemo } from "react";
import useAdminWs from "../hooks/useAdminWs";

const AdminWsContext = createContext(null);

export const AdminWsProvider = ({ children }) => {
    const [lastMessage, setLastMessage] = useState(null);
    const { connected, send } = useAdminWs(useCallback((msg) => {
        setLastMessage(msg);
    }, []));

    const value = useMemo(
        () => ({ connected, send, lastMessage }),
        [connected, send, lastMessage]
    );

    return (
        <AdminWsContext.Provider value={value}>
            {children}
        </AdminWsContext.Provider>
    );
};

export const useAdminWsContext = () => {
    const ctx = useContext(AdminWsContext);
    if (!ctx) throw new Error("useAdminWsContext must be used inside AdminWsProvider");
    return ctx;
};

export default AdminWsContext;
