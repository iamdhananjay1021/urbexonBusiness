/**
 * deliveryZoneService.js — Zone Management and Coverage
 */

import DeliveryZone from "../models/deliveryModels/DeliveryZone.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";

export const createZone = async (zoneData) => {
    try {
        const zone = new DeliveryZone({
            ...zoneData,
            createdAt: new Date(),
            status: "active",
        });

        await zone.save();

        return { success: true, message: "Zone created", data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] createZone failed: ${err.message}`);
    }
};

export const updateZone = async (zoneId, updates) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(zoneId, updates, {
            new: true,
            runValidators: true,
        });

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        return { success: true, message: "Zone updated", data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] updateZone failed: ${err.message}`);
    }
};

export const getZone = async (zoneId) => {
    try {
        const zone = await DeliveryZone.findById(zoneId);

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        return { success: true, data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] getZone failed: ${err.message}`);
    }
};

export const listZonesByCity = async (city) => {
    try {
        const zones = await DeliveryZone.find({ city, status: "active" }).lean();

        return { success: true, data: zones };
    } catch (err) {
        throw new Error(`[ZoneService] listZonesByCity failed: ${err.message}`);
    }
};

export const assignDeliveryPartner = async (zoneId, deliveryBoyId, preference = "primary") => {
    try {
        const zone = await DeliveryZone.findById(zoneId);
        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        const existing = zone.assignedPartners.find((p) => String(p.deliveryBoyId) === String(deliveryBoyId));
        if (existing) {
            return { success: false, message: "Partner already assigned to zone" };
        }

        zone.assignedPartners.push({
            deliveryBoyId,
            assignedAt: new Date(),
            preference,
            status: "active",
        });

        await zone.save();

        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $addToSet: { serviceZones: zoneId },
        });

        return { success: true, message: "Partner assigned to zone", data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] assignDeliveryPartner failed: ${err.message}`);
    }
};

export const removeDeliveryPartner = async (zoneId, deliveryBoyId) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(
            zoneId,
            {
                $pull: { assignedPartners: { deliveryBoyId } },
            },
            { new: true }
        );

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
            $pull: { serviceZones: zoneId },
        });

        return { success: true, message: "Partner removed from zone", data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] removeDeliveryPartner failed: ${err.message}`);
    }
};

export const getZonePartners = async (zoneId, status = "active") => {
    try {
        const zone = await DeliveryZone.findById(zoneId).populate({
            path: "assignedPartners.deliveryBoyId",
            select: "name phone isOnline performance rating",
        });

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        const partners = status ? zone.assignedPartners.filter((p) => p.status === status) : zone.assignedPartners;

        return { success: true, data: partners };
    } catch (err) {
        throw new Error(`[ZoneService] getZonePartners failed: ${err.message}`);
    }
};

export const updateZoneDemand = async (zoneId, demandData) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(
            zoneId,
            {
                $set: {
                    "demand.averageDailyOrders": demandData.averageDailyOrders || 0,
                    "demand.peakDayOrders": demandData.peakDayOrders || 0,
                    "demand.averageDeliveryTime": demandData.averageDeliveryTime || 45,
                    "demand.onTimeDeliveryRate": demandData.onTimeDeliveryRate || 95,
                    "demand.customerSatisfactionScore": demandData.customerSatisfactionScore || 4.5,
                },
            },
            { new: true }
        );

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        return { success: true, message: "Zone demand updated", data: zone };
    } catch (err) {
        throw new Error(`[ZoneService] updateZoneDemand failed: ${err.message}`);
    }
};

export const getZoneMetrics = async (zoneId) => {
    try {
        const zone = await DeliveryZone.findById(zoneId).lean();

        if (!zone) {
            return { success: false, message: "Zone not found" };
        }

        return { success: true, data: zone.metrics || {} };
    } catch (err) {
        throw new Error(`[ZoneService] getZoneMetrics failed: ${err.message}`);
    }
};

export default {
    createZone,
    updateZone,
    getZone,
    listZonesByCity,
    assignDeliveryPartner,
    removeDeliveryPartner,
    getZonePartners,
    updateZoneDemand,
    getZoneMetrics,
};
