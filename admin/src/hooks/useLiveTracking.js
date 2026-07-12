/**
 * useLiveTracking.js — canonical live rider-tracking hook.
 *
 * WS-primary + polling-fallback, reusing whatever WebSocket connection the
 * host app already has — this hook never opens a socket itself. Each app's
 * WS integration is wired differently (client has an always-on
 * GlobalWebSocket + a per-page useWebSocket hook; delivery-panel/admin/
 * vendor-panel each manage their own `ws` ref inline) — the caller feeds
 * this hook whatever the latest parsed WS message is, plus a `joinRoom`
 * callback and a `fetchLocation` REST fallback, and this hook owns: joining
 * the order's tracking room, staleness detection, and running the polling
 * fallback ONLY when WS hasn't delivered a fresh update recently (so a
 * healthy socket always wins over the slower poll, but a dead one is never
 * silently stuck).
 */
import { useEffect, useRef, useState, useCallback } from "react";

const POLL_INTERVAL_MS = 15000;
const WS_FRESHNESS_MS = 20000; // no WS message in this long → trust the poll instead

export const useLiveTracking = ({
    orderId,
    enabled = true,
    wsMessage, // latest parsed message object from the caller's own WS hook (or null)
    joinRoom, // () => void — called on mount / whenever orderId changes / on reconnect
    fetchLocation, // async () => { available, stale, rider, leg, distanceKm, etaText, vendorLat, vendorLng, destLat, destLng, ... }
    connected = true, // caller's WS connected state — defaults true so callers that don't pass it keep the old mount-only behavior
}) => {
    const [state, setState] = useState({
        riderPos: null, riderName: "", vendorPos: null, destPos: null,
        leg: "TO_CUSTOMER", distanceKm: null, etaText: null, status: null,
        stale: true, lastUpdated: null, source: null,
        speedKmph: null, headingDeg: null,
    });
    const lastWsAtRef = useRef(0);
    const pollRef = useRef(null);

    // Join the tracking room whenever we have an orderId — the room itself
    // is authorized server-side (customer/vendor/rider/admin only).
    //
    // BUG FIX: this used to only depend on [orderId, joinRoom] — rooms are
    // NOT auto-rejoined server-side after a WebSocket reconnect (confirmed:
    // wsHub.js's room membership is wiped on disconnect and only restored
    // by the client re-sending join_room). A dropped connection (phone
    // locked, brief network blip) silently lost this order's tracking room
    // forever until the page was fully reloaded. Including `connected` here
    // re-joins every time it flips false→true, not just once on mount.
    useEffect(() => {
        if (!enabled || !orderId || !joinRoom || !connected) return;
        joinRoom();
    }, [enabled, orderId, joinRoom, connected]);

    // React to WS pushes.
    useEffect(() => {
        if (!wsMessage || wsMessage.type !== "rider_location") return;
        const p = wsMessage.payload || wsMessage;
        if (orderId && String(p.orderId) !== String(orderId)) return;
        lastWsAtRef.current = Date.now();
        setState((prev) => ({
            ...prev,
            riderPos: p.lat != null && p.lng != null ? [p.lat, p.lng] : prev.riderPos,
            riderName: p.riderName || prev.riderName,
            vendorPos: p.vendorLat != null && p.vendorLng != null ? [p.vendorLat, p.vendorLng] : prev.vendorPos,
            destPos: p.destLat != null && p.destLng != null ? [p.destLat, p.destLng] : prev.destPos,
            leg: p.leg || prev.leg,
            distanceKm: p.distanceKm ?? prev.distanceKm,
            etaText: p.etaText ?? prev.etaText,
            // headingDeg is intentionally null from the backend while the
            // rider is effectively stationary (avoids jitter) — keep
            // showing the last real heading instead of blanking it.
            speedKmph: p.speedKmph ?? prev.speedKmph,
            headingDeg: p.headingDeg ?? prev.headingDeg,
            stale: false,
            lastUpdated: p.updatedAt || new Date().toISOString(),
            source: "ws",
        }));
    }, [wsMessage, orderId]);

    // Polling fallback — always scheduled, but only APPLIES its result when
    // WS hasn't delivered anything fresh recently.
    const poll = useCallback(async () => {
        if (!enabled || !orderId || !fetchLocation) return;
        try {
            const data = await fetchLocation();
            const wsFresh = Date.now() - lastWsAtRef.current < WS_FRESHNESS_MS;
            if (wsFresh || !data?.available) return;
            setState((prev) => ({
                ...prev,
                riderPos: data.rider?.lat != null && data.rider?.lng != null ? [data.rider.lat, data.rider.lng] : prev.riderPos,
                riderName: data.rider?.name || prev.riderName,
                vendorPos: data.vendorLat != null && data.vendorLng != null ? [data.vendorLat, data.vendorLng] : prev.vendorPos,
                destPos: data.destLat != null && data.destLng != null ? [data.destLat, data.destLng] : prev.destPos,
                leg: data.leg || prev.leg,
                distanceKm: data.distanceKm ?? prev.distanceKm,
                etaText: data.etaText ?? prev.etaText,
                stale: !!data.stale,
                lastUpdated: data.rider?.updatedAt || prev.lastUpdated,
                source: "poll",
            }));
        } catch (err) {
            // A 403 here means the identity attached to this request is no
            // longer authorized for this order (e.g. localStorage's auth
            // token is shared across every tab of the browser and a
            // different account logged in elsewhere while this tab stayed
            // open). Retrying on a loop with that same wrong identity can
            // never succeed — stop instead of polling forever.
            if (err?.response?.status === 403) clearInterval(pollRef.current);
        }
    }, [enabled, orderId, fetchLocation]);

    useEffect(() => {
        if (!enabled || !orderId) return;
        poll();
        pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [enabled, orderId, poll]);

    return state;
};

export default useLiveTracking;
