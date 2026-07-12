/**
 * deliveryLocationService.js — GPS Tracking, Validation, and Geofencing
 */

import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import DeliveryZone from "../models/deliveryModels/DeliveryZone.js";
import { getRedis, isRedisUp } from "../config/redis.js";

export const updateRiderLocation = async (deliveryBoyId, lat, lng, accuracy, timestamp = null) => {
    try {
        const rider = await DeliveryBoy.findByIdAndUpdate(
            deliveryBoyId,
            {
                "location.lat": lat,
                "location.lng": lng,
                "location.accuracy": accuracy,
                "location.updatedAt": new Date(),
                "location.gpsTimestamp": timestamp || Date.now(),
                geoLocation: {
                    type: "Point",
                    coordinates: [lng, lat],
                },
                lastActivityAt: new Date(),
            },
            { new: true }
        );

        if (isRedisUp()) {
            try {
                const redis = getRedis();
                await redis.setex(
                    `rider:location:${deliveryBoyId}`,
                    300,
                    JSON.stringify({ lat, lng, accuracy, timestamp: new Date().toISOString() })
                );
            } catch (err) {
                console.warn("[LocationService] Redis update failed:", err.message);
            }
        }

        return { success: true, data: rider };
    } catch (err) {
        throw new Error(`[LocationService] updateRiderLocation failed: ${err.message}`);
    }
};

export const getRiderLocation = async (deliveryBoyId) => {
    try {
        if (isRedisUp()) {
            try {
                const redis = getRedis();
                const cached = await redis.get(`rider:location:${deliveryBoyId}`);
                if (cached) {
                    return { success: true, source: "redis", data: JSON.parse(cached) };
                }
            } catch (err) {
                console.warn("[LocationService] Redis fetch failed:", err.message);
            }
        }

        const rider = await DeliveryBoy.findById(deliveryBoyId).select("location").lean();
        if (!rider) {
            return { success: false, message: "Rider not found" };
        }

        return { success: true, source: "mongodb", data: rider.location };
    } catch (err) {
        throw new Error(`[LocationService] getRiderLocation failed: ${err.message}`);
    }
};

export const checkGeofence = async (deliveryBoyId, zoneId) => {
    try {
        const zone = await DeliveryZone.findById(zoneId).lean();
        if (!zone || !zone.geometry) {
            return { success: false, message: "Zone not found or no geometry defined" };
        }

        const rider = await DeliveryBoy.findById(deliveryBoyId).select("location").lean();
        if (!rider || !rider.location.lat || !rider.location.lng) {
            return { success: false, message: "Invalid rider location" };
        }

        const point = {
            type: "Point",
            coordinates: [rider.location.lng, rider.location.lat],
        };

        const inZone = isPointInPolygon(point, zone.geometry);

        return {
            success: true,
            inZone,
            zone: zone.name,
            message: inZone ? "Rider is in zone" : "Rider is outside zone",
        };
    } catch (err) {
        throw new Error(`[LocationService] checkGeofence failed: ${err.message}`);
    }
};

const isPointInPolygon = (point, polygon) => {
    const [lng, lat] = point.coordinates;
    const coordinates = polygon.coordinates[0];

    let inside = false;
    for (let i = 0, j = coordinates.length - 1; i < coordinates.length; j = i++) {
        const [xi, yi] = coordinates[i];
        const [xj, yj] = coordinates[j];

        const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }

    return inside;
};

export const logZoneEntry = async (deliveryBoyId, zoneId) => {
    try {
        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            "address.nearestZone": zoneId,
        });

        if (isRedisUp()) {
            try {
                const redis = getRedis();
                await redis.setex(
                    `rider:zone:${deliveryBoyId}`,
                    3600,
                    JSON.stringify({ zoneId, enteredAt: new Date().toISOString() })
                );
            } catch (err) {
                console.warn("[LocationService] Zone entry log failed:", err.message);
            }
        }

        return { success: true, message: "Zone entry logged" };
    } catch (err) {
        throw new Error(`[LocationService] logZoneEntry failed: ${err.message}`);
    }
};

export const logZoneExit = async (deliveryBoyId) => {
    try {
        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            "address.nearestZone": null,
        });

        if (isRedisUp()) {
            try {
                const redis = getRedis();
                await redis.del(`rider:zone:${deliveryBoyId}`);
            } catch (err) {
                console.warn("[LocationService] Zone exit log failed:", err.message);
            }
        }

        return { success: true, message: "Zone exit logged" };
    } catch (err) {
        throw new Error(`[LocationService] logZoneExit failed: ${err.message}`);
    }
};

export const getLocationHistory = async (deliveryBoyId, limit = 100) => {
    try {
        const history = await DeliveryBoy.findById(deliveryBoyId)
            .select("location")
            .lean();

        return {
            success: true,
            data: history || { location: {} },
            limit,
        };
    } catch (err) {
        throw new Error(`[LocationService] getLocationHistory failed: ${err.message}`);
    }
};

export default {
    updateRiderLocation,
    getRiderLocation,
    checkGeofence,
    logZoneEntry,
    logZoneExit,
    getLocationHistory,
};
