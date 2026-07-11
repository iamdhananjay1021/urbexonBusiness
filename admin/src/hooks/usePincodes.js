import { useCallback, useRef, useState } from "react";
import * as vendorApi from "../api/vendorApi";

export const usePincodes = () => {
    const [pincodes, setPincodes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [error, setError] = useState("");
    // BUG FIX (kept): backend already paginates (default limit=50) and
    // returns total/pages, but nothing here tracked them — the admin list
    // silently truncated at 50 with no way to reach anything beyond that.
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    // NEW: per-status counts for the coverage bar. Falls back to null if
    // the backend doesn't send `stats` yet — UI treats null as "unknown"
    // rather than showing a misleading all-zero bar.
    const [stats, setStats] = useState(null);

    const requestIdRef = useRef(0);
    const lastParamsRef = useRef({});

    // NEW: guards against out-of-order responses. If filters/search change
    // quickly, an older slower request can resolve after a newer one and
    // clobber fresher data. Each fetch stamps a ticket; only the latest
    // ticket is allowed to write to state.
    const fetchPincodes = useCallback(async (params = {}) => {
        const ticket = ++requestIdRef.current;
        lastParamsRef.current = params;
        try {
            setLoading(true);
            setError("");
            const { data } = await vendorApi.fetchPincodes(params);
            if (ticket !== requestIdRef.current) return; // superseded, drop it
            setPincodes(data.pincodes || []);
            setTotal(data.total ?? (data.pincodes || []).length);
            setPage(data.page || 1);
            setPages(data.pages || 1);
            if (data.stats) setStats(data.stats);
        } catch (err) {
            if (ticket !== requestIdRef.current) return;
            setError(err.response?.data?.message || "Failed to load pincodes");
        } finally {
            if (ticket === requestIdRef.current) setLoading(false);
        }
    }, []);

    // NEW: re-run the last fetch with its original params (used after
    // bulk actions, or by a manual "refresh" button).
    const refresh = useCallback(() => fetchPincodes(lastParamsRef.current), [fetchPincodes]);

    const createPincode = useCallback(async (payload) => {
        setActionLoading("create");
        try {
            const { data } = await vendorApi.createPincode(payload);
            // Refetch instead of unshifting locally — the new row needs to
            // land wherever the active sort/filter says it belongs, not
            // always at the top.
            await fetchPincodes(lastParamsRef.current);
            return { success: true, data: data.pincode };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to create" };
        } finally {
            setActionLoading(null);
        }
    }, [fetchPincodes]);

    const updatePincode = useCallback(async (id, payload) => {
        setActionLoading(id);
        try {
            const { data } = await vendorApi.updatePincode(id, payload);
            setPincodes(prev => prev.map(p => p._id === id ? data.pincode : p));
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to update" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const deletePincode = useCallback(async (id) => {
        setActionLoading(id);
        try {
            await vendorApi.deletePincode(id);
            setPincodes(prev => prev.filter(p => p._id !== id));
            setTotal(prev => Math.max(0, prev - 1));
            return { success: true };
        } catch (err) {
            return { success: false, message: err.response?.data?.message || "Failed to delete" };
        } finally {
            setActionLoading(null);
        }
    }, []);

    // NEW: bulk status change. Implemented as parallel single-updates so it
    // works today without a new backend route. If/when a real
    // `vendorApi.bulkUpdatePincodes` endpoint exists, swap the Promise.all
    // below for a single call — same return shape, no page changes needed.
    const bulkUpdateStatus = useCallback(async (ids, status) => {
        setActionLoading("bulk");
        try {
            const results = await Promise.allSettled(
                ids.map(id => vendorApi.updatePincode(id, { status }))
            );
            const failed = results.filter(r => r.status === "rejected");
            setPincodes(prev => prev.map(p => ids.includes(p._id) ? { ...p, status } : p));
            if (failed.length) {
                return { success: false, message: `${failed.length} of ${ids.length} failed to update.` };
            }
            return { success: true };
        } finally {
            setActionLoading(null);
        }
    }, []);

    const bulkDelete = useCallback(async (ids) => {
        setActionLoading("bulk");
        try {
            const results = await Promise.allSettled(ids.map(id => vendorApi.deletePincode(id)));
            const failedIds = ids.filter((_, i) => results[i].status === "rejected");
            const okIds = ids.filter((_, i) => results[i].status === "fulfilled");
            setPincodes(prev => prev.filter(p => !okIds.includes(p._id)));
            setTotal(prev => Math.max(0, prev - okIds.length));
            if (failedIds.length) {
                return { success: false, message: `${failedIds.length} of ${ids.length} failed to delete.` };
            }
            return { success: true };
        } finally {
            setActionLoading(null);
        }
    }, []);

    return {
        pincodes, loading, actionLoading, error, total, page, pages, stats,
        fetchPincodes, refresh, createPincode, updatePincode, deletePincode,
        bulkUpdateStatus, bulkDelete,
    };
};