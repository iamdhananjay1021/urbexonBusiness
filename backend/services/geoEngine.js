/**
 * geoEngine.js — single shared Geo Engine.
 *
 * Consolidates logic that was previously copy-pasted with identical math
 * across orderValidations.js, assignmentEngine.js, addressController.js,
 * deliveryController.js and vendorPublic.js (haversine distance), plus new
 * capabilities (dynamic ETA, coordinate/movement plausibility checks) that
 * every part of the platform — client, vendor, delivery, admin, checkout,
 * orders, tracking, vendor discovery, delivery assignment — shares.
 *
 * Pure utility module: no DB models, no app-specific imports, so nothing
 * else can end up circularly importing this file.
 */

/* ── Distance ─────────────────────────────────────────────────────── */
export const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/* ── Bearing (compass heading, 0-360°, 0 = due north) ────────────────
   Used by the live-tracking map to show which way a rider is facing —
   purely derived from two consecutive GPS fixes, no device compass. */
export const bearingDeg = (lat1, lng1, lat2, lng2) => {
    const toRad = (d) => (d * Math.PI) / 180;
    const toDeg = (r) => (r * 180) / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

/**
 * Instantaneous speed (km/h) + heading (degrees) between two consecutive
 * GPS fixes for the same rider. Returns nulls when there's no previous fix,
 * the clock didn't advance, or the two points are too close together for a
 * meaningful bearing (GPS jitter would otherwise make the heading flicker
 * wildly while a rider is stationary).
 */
const MIN_MOVEMENT_FOR_HEADING_KM = 0.01; // 10m — below this, GPS jitter dominates
export const computeSpeedAndHeading = (prevLat, prevLng, prevTimestampMs, lat, lng, timestampMs) => {
    if (prevLat == null || prevLng == null || !prevTimestampMs || !timestampMs) {
        return { speedKmph: null, headingDeg: null };
    }
    const dtHours = (timestampMs - prevTimestampMs) / 3_600_000;
    if (dtHours <= 0) return { speedKmph: null, headingDeg: null };

    const distKm = haversineKm(prevLat, prevLng, lat, lng);
    const speedKmph = Math.round((distKm / dtHours) * 10) / 10;
    const headingDeg = distKm >= MIN_MOVEMENT_FOR_HEADING_KM
        ? Math.round(bearingDeg(prevLat, prevLng, lat, lng))
        : null; // rider effectively stationary — keep last known heading client-side instead of flickering

    return { speedKmph, headingDeg };
};

/* ── Coordinate validation — never trust frontend coordinates blindly ── */
export const isPlausibleIndiaLatLng = (lat, lng) => {
    const latN = Number(lat);
    const lngN = Number(lng);
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return false;
    if (latN < -90 || latN > 90 || lngN < -180 || lngN > 180) return false;
    if (latN === 0 && lngN === 0) return false; // classic "no GPS fix" sentinel value
    return latN >= 6 && latN <= 38 && lngN >= 68 && lngN <= 98; // India bounding box
};

/**
 * Rejects a GPS update that implies an impossible travel speed since the
 * previous known fix for the same rider/user — catches spoofed or
 * teleported coordinates that pass basic range validation but are
 * physically impossible.
 */
export const MAX_PLAUSIBLE_SPEED_KMPH = 140;
export const isPlausibleMovement = (prevLat, prevLng, prevTimestampMs, lat, lng, timestampMs) => {
    if (prevLat == null || prevLng == null || !prevTimestampMs) return true; // nothing to compare against yet
    const dtHours = (timestampMs - prevTimestampMs) / 3_600_000;
    if (dtHours <= 0) return true; // clock skew / duplicate fix — not this function's concern
    const distKm = haversineKm(prevLat, prevLng, lat, lng);
    const impliedSpeedKmph = distKm / dtHours;
    return impliedSpeedKmph <= MAX_PLAUSIBLE_SPEED_KMPH;
};

/* ── Dynamic ETA — Blinkit/Zepto-style min–max minute window ──────────
   ETA = vendor prep time + dispatch buffer + travel time (distance/speed).
   Returns null when distance is genuinely unknown so callers can fall
   back to a static text estimate instead of pretending 0km. */
export const calculateETA = ({ distanceKm, preparationTimeMin = 15, avgSpeedKmph = 20, deliveryMode = "platform" } = {}) => {
    if (distanceKm === null || distanceKm === undefined) return null;
    const dist = Number(distanceKm);
    if (!Number.isFinite(dist) || dist < 0) return null;

    const prep = Math.max(0, Number(preparationTimeMin) || 0);
    const speed = Math.max(5, Number(avgSpeedKmph) || 20);

    // Self-delivery (vendor's own rider, not yet circulating in the platform
    // pool) tends to take a little longer to dispatch than a platform rider.
    const dispatchBufferMin = deliveryMode === "self" ? 5 : 2;
    const travelMinBase = (dist / speed) * 60;

    const etaMinMinutes = Math.max(10, Math.round(prep + dispatchBufferMin + travelMinBase * 0.85));
    const etaMaxMinutes = Math.max(etaMinMinutes + 5, Math.round(prep + dispatchBufferMin + travelMinBase * 1.4) + 5);

    return { etaMinMinutes, etaMaxMinutes };
};

export const formatEtaText = (eta) => (eta ? `${eta.etaMinMinutes}–${eta.etaMaxMinutes} mins` : null);
