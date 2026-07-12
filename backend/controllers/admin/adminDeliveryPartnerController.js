/**
 * adminDeliveryPartnerController.js — Admin Delivery Partner Management
 */

import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import DeliveryApplication from "../../models/deliveryModels/DeliveryApplication.js";
import { approveApplication, rejectApplication } from "../../services/deliveryApplicationService.js";
import { sendNotification } from "../../utils/notificationQueue.js";

export const listDeliveryPartners = async (req, res) => {
    try {
        const { status, city, page = 1, limit = 20, search } = req.query;

        const query = {};
        if (status) query.status = status;
        if (city) query.city = city;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: "i" } },
                { phone: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (page - 1) * limit;
        const partners = await DeliveryBoy.find(query)
            .select("userId name phone email status isOnline performance city applicationStatus")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 })
            .lean();

        const total = await DeliveryBoy.countDocuments(query);

        res.json({
            success: true,
            data: partners,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listDeliveryPartners]", err);
        res.status(500).json({ success: false, message: "Failed to fetch partners" });
    }
};

export const getDeliveryPartnerDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const partner = await DeliveryBoy.findById(id)
            .populate("applicationId", "status personal identity address vehicle bank")
            .populate("kycId", "overallStatus timeline")
            .populate("walletId", "balance totalEarned");

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        res.json({ success: true, data: partner });
    } catch (err) {
        console.error("[getDeliveryPartnerDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch partner details" });
    }
};

export const updateDeliveryPartnerStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        if (!["pending", "approved", "rejected", "suspended", "inactive"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const partner = await DeliveryBoy.findByIdAndUpdate(
            id,
            { status, rejectionReason: reason || "" },
            { new: true }
        );

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        sendNotification(String(partner.userId), "delivery:status_update", {
            status,
            message: `Your delivery partner status has been updated to ${status}`,
        }).catch(() => {});

        res.json({ success: true, message: "Status updated", data: partner });
    } catch (err) {
        console.error("[updateDeliveryPartnerStatus]", err);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};

export const blockDeliveryPartner = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const partner = await DeliveryBoy.findByIdAndUpdate(
            id,
            {
                status: "suspended",
                suspendedAt: new Date(),
                $push: {
                    suspensions: {
                        reason: reason || "Blocked by admin",
                        startDate: new Date(),
                        suspendedBy: req.user._id,
                    },
                },
            },
            { new: true }
        );

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        sendNotification(String(partner.userId), "delivery:blocked", {
            message: `Your account has been suspended. Reason: ${reason || "Not specified"}`,
        }).catch(() => {});

        res.json({ success: true, message: "Partner blocked", data: partner });
    } catch (err) {
        console.error("[blockDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Failed to block partner" });
    }
};

export const unblockDeliveryPartner = async (req, res) => {
    try {
        const { id } = req.params;

        const partner = await DeliveryBoy.findByIdAndUpdate(
            id,
            {
                status: "approved",
                $set: { "suspensions.$[].endDate": new Date() },
            },
            { new: true }
        );

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        sendNotification(String(partner.userId), "delivery:unblocked", {
            message: "Your account has been reactivated",
        }).catch(() => {});

        res.json({ success: true, message: "Partner unblocked", data: partner });
    } catch (err) {
        console.error("[unblockDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Failed to unblock partner" });
    }
};

export const forceLogoutDeliveryPartner = async (req, res) => {
    try {
        const { id } = req.params;

        const partner = await DeliveryBoy.findByIdAndUpdate(id, { isOnline: false }, { new: true });

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        sendNotification(String(partner.userId), "delivery:force_logout", {
            message: "You have been logged out by admin",
        }).catch(() => {});

        res.json({ success: true, message: "Partner logged out", data: partner });
    } catch (err) {
        console.error("[forceLogoutDeliveryPartner]", err);
        res.status(500).json({ success: false, message: "Failed to logout partner" });
    }
};

export const getPartnerMetrics = async (req, res) => {
    try {
        const { id } = req.params;

        const partner = await DeliveryBoy.findById(id).select("performance").lean();

        if (!partner) {
            return res.status(404).json({ success: false, message: "Partner not found" });
        }

        res.json({ success: true, data: partner.performance });
    } catch (err) {
        console.error("[getPartnerMetrics]", err);
        res.status(500).json({ success: false, message: "Failed to fetch metrics" });
    }
};

export default {
    listDeliveryPartners,
    getDeliveryPartnerDetails,
    updateDeliveryPartnerStatus,
    blockDeliveryPartner,
    unblockDeliveryPartner,
    forceLogoutDeliveryPartner,
    getPartnerMetrics,
};
