/**
 * adminZoneController.js — Admin Zone Management
 */

import DeliveryZone from "../../models/deliveryModels/DeliveryZone.js";
import { createZone, updateZone, assignDeliveryPartner, removeDeliveryPartner, getZonePartners } from "../../services/deliveryZoneService.js";

export const listZones = async (req, res) => {
    try {
        const { city, status = "active", page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const query = {};
        if (city) query.city = city;
        if (status) query.status = status;

        const zones = await DeliveryZone.find(query)
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 })
            .lean();

        const total = await DeliveryZone.countDocuments(query);

        res.json({
            success: true,
            data: zones,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listZones]", err);
        res.status(500).json({ success: false, message: "Failed to fetch zones" });
    }
};

export const createDeliveryZone = async (req, res) => {
    try {
        const zoneData = req.body;
        const result = await createZone(zoneData);
        res.status(201).json(result);
    } catch (err) {
        console.error("[createDeliveryZone]", err);
        res.status(500).json({ success: false, message: "Failed to create zone" });
    }
};

export const getZoneDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const zone = await DeliveryZone.findById(id).populate(
            "assignedPartners.deliveryBoyId",
            "name phone isOnline performance"
        );

        if (!zone) {
            return res.status(404).json({ success: false, message: "Zone not found" });
        }

        res.json({ success: true, data: zone });
    } catch (err) {
        console.error("[getZoneDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch zone" });
    }
};

export const updateDeliveryZone = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const result = await updateZone(id, updates);
        res.json(result);
    } catch (err) {
        console.error("[updateDeliveryZone]", err);
        res.status(500).json({ success: false, message: "Failed to update zone" });
    }
};

export const assignPartnerToZone = async (req, res) => {
    try {
        const { id } = req.params;
        const { deliveryBoyId, preference } = req.body;

        const result = await assignDeliveryPartner(id, deliveryBoyId, preference || "primary");
        res.json(result);
    } catch (err) {
        console.error("[assignPartnerToZone]", err);
        res.status(500).json({ success: false, message: "Failed to assign partner" });
    }
};

export const removePartnerFromZone = async (req, res) => {
    try {
        const { id, partnerId } = req.params;

        const result = await removeDeliveryPartner(id, partnerId);
        res.json(result);
    } catch (err) {
        console.error("[removePartnerFromZone]", err);
        res.status(500).json({ success: false, message: "Failed to remove partner" });
    }
};

export const getZonePartnersList = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.query;

        const result = await getZonePartners(id, status);
        res.json(result);
    } catch (err) {
        console.error("[getZonePartnersList]", err);
        res.status(500).json({ success: false, message: "Failed to fetch partners" });
    }
};

export default {
    listZones,
    createDeliveryZone,
    getZoneDetails,
    updateDeliveryZone,
    assignPartnerToZone,
    removePartnerFromZone,
    getZonePartnersList,
};
