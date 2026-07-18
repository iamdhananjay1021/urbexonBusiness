/**
 * liveTrackingEngine.js — single source of truth for "where is the rider
 * relative to this order, right now" — distance + live ETA to whichever
 * waypoint is currently relevant (the vendor before pickup, the customer
 * after). Used by BOTH the WebSocket push (wsHub.js's handleRiderLocationWs)
 * and the REST polling fallback (deliveryController.js's
 * getRiderLocationForOrder) so a customer/vendor/admin gets an identical
 * answer regardless of which transport delivered it.
 */
import Order from "../models/Order.js";
import Vendor from "../models/vendorModels/Vendor.js";
import { DELIVERY_CONFIG } from "../config/deliveryConfig.js";
import { haversineKm, calculateETA, formatEtaText, computeSpeedAndHeading, isPlausibleIndiaLatLng } from "./geoEngine.js";

const NOT_YET_PICKED_UP = ["PENDING", "SEARCHING_RIDER", "ASSIGNED", "ARRIVING_VENDOR"];

/**
 * @param prevFix — optional { lat, lng, gpsTimestamp } from the rider's
 *   previous stored fix (caller already has this in hand right before
 *   overwriting it, e.g. deliveryController.js's staleness check) — used
 *   together with currentGpsTimestamp to derive instantaneous
 *   speed/heading. Omit either if unavailable; the returned
 *   speedKmph/headingDeg are simply null in that case.
 * @param currentGpsTimestamp — the NEW fix's own timestamp (ms). Defaults
 *   to Date.now() when the caller doesn't have a device-reported one.
 * @returns null if the order/coords aren't available, otherwise:
 * { leg: "TO_VENDOR"|"TO_CUSTOMER", targetLabel, vendorLat, vendorLng,
 *   destLat, destLng, distanceKm, etaMinMinutes, etaMaxMinutes, etaText,
 *   speedKmph, headingDeg }
 */
export const computeLiveTrackingInfo = async (orderId, riderLat, riderLng, prevFix = null, currentGpsTimestamp = null) => {
    if (riderLat == null || riderLng == null) return null;

    const order = await Order.findById(orderId)
        .select("latitude longitude vendorId delivery.status delivery.provider")
        .lean();
    if (!order) return null;

    let vendorLat = null, vendorLng = null, prepTime = null;
    if (order.vendorId) {
        const vendor = await Vendor.findById(order.vendorId).select("location preparationTime").lean();
        const coords = vendor?.location?.coordinates;
        // BUG FIX: Vendor.location.coordinates defaults to the GeoJSON
        // schema sentinel [0,0] (models/vendorModels/Vendor.js) until a
        // vendor explicitly saves their real shop location via Settings —
        // registerVendor() never captures it at signup. Treating that [0,0]
        // as a real coordinate made the "TO_VENDOR" leg compute
        // haversineKm(riderLat, riderLng, 0, 0) — ~9200-9300km from
        // anywhere in India — which is exactly the bogus "~9230 km"
        // distance shown right after READY_FOR_PICKUP (the transition that
        // kicks off rider assignment, whose first leg is rider→vendor).
        // Reuses the same "is this a real, set coordinate" check already
        // used for rider GPS fixes elsewhere in this codebase instead of
        // re-deriving the [0,0] check here.
        if (coords?.length === 2 && isPlausibleIndiaLatLng(coords[1], coords[0])) {
            vendorLng = coords[0]; vendorLat = coords[1];
        }
        prepTime = vendor?.preparationTime ?? null;
    }

    const destLat = order.latitude ?? null;
    const destLng = order.longitude ?? null;

    const pickedUp = !NOT_YET_PICKED_UP.includes(order.delivery?.status);
    const leg = pickedUp ? "TO_CUSTOMER" : "TO_VENDOR";
    const targetLat = leg === "TO_VENDOR" ? vendorLat : destLat;
    const targetLng = leg === "TO_VENDOR" ? vendorLng : destLng;
    const targetLabel = leg === "TO_VENDOR" ? "Pickup Point" : "Delivery Address";

    let distanceKm = null;
    let etaText = null;
    let etaMinMinutes = null;
    let etaMaxMinutes = null;

    if (targetLat != null && targetLng != null) {
        distanceKm = Math.round(haversineKm(riderLat, riderLng, targetLat, targetLng) * 10) / 10;
        // Live in-transit ETA — no prep-time component (the rider is
        // already moving), just distance/speed with the same min-max
        // buffer band calculateETA already uses elsewhere in the platform.
        const eta = calculateETA({
            distanceKm,
            preparationTimeMin: 0,
            avgSpeedKmph: DELIVERY_CONFIG.URBEXON_HOUR.AVG_RIDER_SPEED_KMPH,
            deliveryMode: order.delivery?.provider === "VENDOR_SELF" ? "self" : "platform",
        });
        etaMinMinutes = eta?.etaMinMinutes ?? null;
        etaMaxMinutes = eta?.etaMaxMinutes ?? null;
        etaText = formatEtaText(eta);
    }

    const { speedKmph, headingDeg } = prevFix
        ? computeSpeedAndHeading(prevFix.lat, prevFix.lng, prevFix.gpsTimestamp, riderLat, riderLng, currentGpsTimestamp || Date.now())
        : { speedKmph: null, headingDeg: null };

    return {
        leg,
        targetLabel,
        vendorLat, vendorLng,
        destLat, destLng,
        distanceKm, etaMinMinutes, etaMaxMinutes, etaText,
        preparationTime: prepTime,
        speedKmph, headingDeg,
    };
};
