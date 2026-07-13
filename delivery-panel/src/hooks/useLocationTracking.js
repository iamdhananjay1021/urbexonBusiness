/**
 * useLocationTracking.js — canonical rider GPS-reporting hook.
 *
 * BUG FIX: this exact logic used to be hand-duplicated (and had already
 * DRIFTED apart) between ActiveOrders.jsx and Dashboard.jsx — Dashboard's
 * copy tracked GPS only when there was an active order (the exact bug
 * ActiveOrders.jsx's copy had already been fixed for: Zepto/Swiggy-style
 * riders report location continuously while ONLINE, not just mid-delivery),
 * and Dashboard's copy also lacked the send-throttle (5s/20m) and GPS
 * accuracy filtering ActiveOrders.jsx had. One canonical hook means a fix
 * applied once can never silently fail to reach the other page again.
 */
import { useState, useEffect, useRef } from "react";
import api from "../api/axios";

// Haversine, meters — local to this file (no shared package between apps
// in this repo; see client/LiveTrackingMap.jsx's header comment for the
// same note).
const distanceMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useLocationTracking = (isOnline, activeOrderId) => {
    const [pos, setPos] = useState(null);
    // Throttle guard — watchPosition can fire multiple times per second
    // while moving. Only actually PATCH the backend when at least 5s have
    // passed since the last SENT update, OR the rider has moved more than
    // 20m — whichever comes first. The local map (setPos) still updates
    // immediately either way, so the rider's own screen stays responsive;
    // only the network write is throttled.
    const lastSentRef = useRef({ lat: null, lng: null, at: 0 });

    useEffect(() => {
        if (!isOnline || !navigator.geolocation) { setPos(null); lastSentRef.current = { lat: null, lng: null, at: 0 }; return; }

        const MIN_INTERVAL_MS = 5000;
        const MIN_MOVE_METERS = 20;
        // A GPS fix's own reported accuracy (meters of uncertainty) — a
        // low-confidence fix (weak signal indoors, cell-tower-only
        // fallback) gets rejected outright rather than sent identically to
        // a high-confidence one; `enableHighAccuracy: true` only REQUESTS a
        // good fix, it doesn't guarantee one.
        const MAX_ACCURACY_M = 100;
        const sendLocation = (lat, lng, timestamp, accuracy) => {
            if (accuracy != null && accuracy > MAX_ACCURACY_M) return;
            setPos({ lat, lng });

            const last = lastSentRef.current;
            const elapsed = Date.now() - last.at;
            const moved = last.lat == null ? Infinity : distanceMeters(last.lat, last.lng, lat, lng);
            if (last.at !== 0 && elapsed < MIN_INTERVAL_MS && moved < MIN_MOVE_METERS) return;

            lastSentRef.current = { lat, lng, at: Date.now() };
            // Sending the GPS fix's own timestamp lets the backend reject
            // whichever of watchPosition/the 15s fallback turns out to be
            // older, regardless of which HTTP request arrives at the
            // server last (previously caused the rider marker to visibly
            // jump backward on the customer's map).
            const body = { lat, lng, timestamp, accuracy };
            if (activeOrderId) body.orderId = activeOrderId;
            api.patch("/delivery/location", body).catch(() => { });
        };

        const watchId = navigator.geolocation.watchPosition(
            (p) => sendLocation(p.coords.latitude, p.coords.longitude, p.timestamp, p.coords.accuracy),
            () => { },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );

        // Fallback: force an update every 15s even if no movement detected
        const fallbackTimer = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (p) => sendLocation(p.coords.latitude, p.coords.longitude, p.timestamp, p.coords.accuracy),
                () => { },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
            );
        }, 15000);

        return () => {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(fallbackTimer);
        };
    }, [isOnline, activeOrderId]);

    return pos;
};

export default useLocationTracking;
