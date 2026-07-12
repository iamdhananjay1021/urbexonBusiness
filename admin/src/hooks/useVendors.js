import { useState, useCallback, useRef, useEffect } from "react";
import * as vendorApi from "../api/vendorApi";
import { useAdminWsContext } from "../contexts/AdminWsContext";

const PAGE_LIMIT = 20;

/**
 * [FIX] Real-time vendor sync.
 * Backend (vendorApproval.js + venderProfile.js) broadcasts these events to
 * every connected admin via wsHub.js's broadcastToAdmins():
 *   - "vendor:status_changed"  → approve / reject / suspend
 *   - "vendor:updated"         → commission, subscription, profile edits,
 *                                 shop open/close toggle, location change
 *   - "vendor:deleted"         → soft delete
 *
 * Previously the admin Vendors page only ever refreshed on a manual action
 * or full page reload — a vendor closing their shop, or an admin action
 * from a second tab, never appeared until someone hit refresh. This hook
 * now also listens on the shared admin WebSocket and patches local state
 * live, matching the pattern the backend was already built to support.
 */
const VENDOR_WS_EVENTS = {
    STATUS_CHANGED: "vendor:status_changed",
    UPDATED: "vendor:updated",
    DELETED: "vendor:deleted",
};

export const useVendors = () => {
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null); // vendorId
    const [error, setError] = useState("");
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);

    // Track current filter/search so a live-inserted vendor (e.g. new
    // pending application) doesn't appear under a mismatched filter.
    const filtersRef = useRef({ status: "ALL", search: "" });

    const fetchVendors = useCallback(async ({ page = 1, status = "ALL", search = "" } = {}) => {
        filtersRef.current = { status, search };
        try {
            setLoading(true);
            setError("");
            const params = { page, limit: PAGE_LIMIT };
            if (status && status !== "ALL") params.status = status;
            if (search.trim()) params.search = search.trim();
            const { data } = await vendorApi.fetchVendors(params);
            setVendors(data.vendors || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setCurrentPage(data.page || 1);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to load vendors");
            setVendors([]);
        } finally {
            setLoading(false);
        }
    }, []);

    /* ── Live WebSocket patching ──────────────────────────────── */
    const handleWsMessage = useCallback((msg) => {
        if (!msg?.type) return;
        const { type, payload } = msg;

        if (type === VENDOR_WS_EVENTS.DELETED) {
            const vendorId = payload?.vendorId;
            if (!vendorId) return;
            setVendors(prev => {
                const existed = prev.some(v => v._id === vendorId);
                if (!existed) return prev;
                setTotal(t => Math.max(0, t - 1));
                return prev.filter(v => v._id !== vendorId);
            });
            return;
        }

        if (type === VENDOR_WS_EVENTS.STATUS_CHANGED || type === VENDOR_WS_EVENTS.UPDATED) {
            const updatedVendor = payload?.vendor;
            const vendorId = payload?.vendorId || updatedVendor?._id;
            if (!vendorId) return;

            setVendors(prev => {
                const idx = prev.findIndex(v => v._id === vendorId);
                // Vendor already visible on this page — patch it in place,
                // merging so we never drop fields the socket payload omits.
                if (idx !== -1) {
                    if (!updatedVendor) return prev;
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...updatedVendor };
                    return next;
                }
                return prev;
            });
        }
    }, []);

    // BUG FIX: this used to call useAdminWs(handleWsMessage) directly — its
    // own independent socket (a 4th duplicate connection alongside
    // Admin.jsx's shell, AdminOrders.jsx, and AdminLocalDelivery.jsx, all
    // making the same "shared connection" claim while each opening their
    // own). Consumes the real shared connection from AdminWsContext.
    const { lastMessage: adminWsMessage } = useAdminWsContext();
    useEffect(() => {
        if (adminWsMessage) handleWsMessage(adminWsMessage);
    }, [adminWsMessage, handleWsMessage]);

    const approveVendor = useCallback(async (id, payload) => {
        setActionLoading(id);
        try {
            const { data } = await vendorApi.approveVendor(id, payload);
            if (data.vendor) {
                setVendors(prev => prev.map(v => v._id === id ? data.vendor : v));
            } else {
                setVendors(prev => prev.map(v => v._id === id ? { ...v, status: "approved", rejectionReason: null } : v));
            }
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to approve" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const rejectVendor = useCallback(async (id, payload) => {
        setActionLoading(id);
        try {
            const { data } = await vendorApi.rejectVendor(id, payload);
            if (data.vendor) {
                setVendors(prev => prev.map(v => v._id === id ? data.vendor : v));
            } else {
                setVendors(prev => prev.map(v => v._id === id ? { ...v, status: "rejected", rejectionReason: payload.reason } : v));
            }
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to reject" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const suspendVendor = useCallback(async (id, payload) => {
        setActionLoading(id);
        try {
            const { data } = await vendorApi.suspendVendor(id, payload);
            if (data.vendor) {
                setVendors(prev => prev.map(v => v._id === id ? data.vendor : v));
            } else {
                setVendors(prev => prev.map(v => v._id === id ? { ...v, status: "suspended" } : v));
            }
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to suspend" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const updateCommission = useCallback(async (id, commissionRate) => {
        setActionLoading(id);
        try {
            await vendorApi.updateCommission(id, { commissionRate });
            setVendors(prev => prev.map(v => v._id === id ? { ...v, commissionRate } : v));
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to update commission" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const deleteVendor = useCallback(async (id) => {
        setActionLoading(id);
        try {
            await vendorApi.deleteVendor(id);
            setVendors(prev => prev.filter(v => v._id !== id));
            setTotal(t => t - 1);
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to delete" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    return {
        vendors, loading, actionLoading, error,
        total, totalPages, currentPage,
        fetchVendors, approveVendor, rejectVendor,
        suspendVendor, updateCommission, deleteVendor,
    };
};