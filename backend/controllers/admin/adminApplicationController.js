/**
 * adminApplicationController.js — Admin Application Queue Management
 */

import DeliveryApplication from "../../models/deliveryModels/DeliveryApplication.js";
import { approveApplication, rejectApplication } from "../../services/deliveryApplicationService.js";
import { sendNotification } from "../../utils/notificationQueue.js";

export const listApplications = async (req, res) => {
    try {
        const { status = "submitted", page = 1, limit = 20, city } = req.query;

        const query = { status };
        if (city) query["address.city"] = city;

        const skip = (page - 1) * limit;

        const applications = await DeliveryApplication.find(query)
            .select("-adminNotes")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 })
            .populate("userId", "name phone email")
            .lean();

        const total = await DeliveryApplication.countDocuments(query);

        res.json({
            success: true,
            data: applications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listApplications]", err);
        res.status(500).json({ success: false, message: "Failed to fetch applications" });
    }
};

export const getApplicationDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const application = await DeliveryApplication.findById(id).populate(
            "userId",
            "name phone email"
        );

        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found" });
        }

        res.json({ success: true, data: application });
    } catch (err) {
        console.error("[getApplicationDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch application" });
    }
};

export const approveDeliveryApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const application = await DeliveryApplication.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found" });
        }

        const result = await approveApplication(id, req.user._id, notes || "");

        if (!result.success) {
            return res.status(400).json(result);
        }

        sendNotification(String(application.userId), "delivery:application_approved", {
            message: "Your delivery partner application has been approved!",
            deliveryBoyId: result.data.deliveryBoy._id,
        }).catch(() => {});

        res.json(result);
    } catch (err) {
        console.error("[approveDeliveryApplication]", err);
        res.status(500).json({ success: false, message: "Failed to approve application" });
    }
};

export const rejectDeliveryApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Rejection reason required" });
        }

        const application = await DeliveryApplication.findById(id);
        if (!application) {
            return res.status(404).json({ success: false, message: "Application not found" });
        }

        const result = await rejectApplication(id, req.user._id, reason);

        sendNotification(String(application.userId), "delivery:application_rejected", {
            message: `Your application was not approved. Reason: ${reason}`,
        }).catch(() => {});

        res.json(result);
    } catch (err) {
        console.error("[rejectDeliveryApplication]", err);
        res.status(500).json({ success: false, message: "Failed to reject application" });
    }
};

export const bulkApproveApplications = async (req, res) => {
    try {
        const { applicationIds } = req.body;

        if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
            return res.status(400).json({ success: false, message: "No applications provided" });
        }

        const results = [];
        for (const appId of applicationIds) {
            try {
                const result = await approveApplication(appId, req.user._id, "Bulk approved");
                if (result.success) {
                    results.push({ appId, status: "approved" });
                } else {
                    results.push({ appId, status: "failed", error: result.message });
                }
            } catch (err) {
                results.push({ appId, status: "failed", error: err.message });
            }
        }

        res.json({ success: true, message: "Bulk approval completed", results });
    } catch (err) {
        console.error("[bulkApproveApplications]", err);
        res.status(500).json({ success: false, message: "Bulk approval failed" });
    }
};

export const getApplicationStats = async (req, res) => {
    try {
        const stats = {
            submitted: await DeliveryApplication.countDocuments({ status: "submitted" }),
            under_review: await DeliveryApplication.countDocuments({ status: "under_review" }),
            approved: await DeliveryApplication.countDocuments({ status: "approved" }),
            rejected: await DeliveryApplication.countDocuments({ status: "rejected" }),
        };

        res.json({ success: true, data: stats });
    } catch (err) {
        console.error("[getApplicationStats]", err);
        res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
};

export default {
    listApplications,
    getApplicationDetails,
    approveDeliveryApplication,
    rejectDeliveryApplication,
    bulkApproveApplications,
    getApplicationStats,
};
