import Vendor from "../../models/vendorModels/Vendor.js";
import User from "../../models/User.js";
import { createNotification } from "../admin/notificationController.js";
import { notifyVendorApplicationApproved, notifyVendorApplicationRejected } from "../../services/notificationService.js";

/**
 * Updates a vendor's status and synchronizes the associated user's role.
 * @param {string} vendorId - The ID of the vendor to update.
 * @param {'approved' | 'rejected' | 'suspended'} newStatus - The new status.
 * @param {string} [rejectionReason] - Optional reason for rejection.
 * @returns {Promise<Vendor>} The updated vendor document.
 */
const updateVendorStatusAndRole = async (vendorId, newStatus, rejectionReason = "") => {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
        throw new Error("Vendor not found");
    }

    vendor.status = newStatus;
    if (newStatus === "rejected") {
        vendor.rejectionReason = rejectionReason;
    }
    await vendor.save();

    // Determine the new role based on the status
    const newRole = newStatus === "approved" ? "vendor" : "user";

    // Atomically update the user's role
    await User.findByIdAndUpdate(vendor.userId, { $set: { role: newRole } });

    // Send external notifications via the notification service
    if (newStatus === "approved") {
        notifyVendorApplicationApproved(vendor);
    } else if (newStatus === "rejected") {
        notifyVendorApplicationRejected(vendor);
    }

    // Create a notification for the vendor
    createNotification({
        type: "vendor_status",
        title: `Application ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        message: `Your vendor application has been ${newStatus}.`,
        userId: vendor.userId,
        link: "/vendor/dashboard", // Link to their dashboard
        meta: { status: newStatus, reason: rejectionReason },
    });

    return vendor;
};

/**
 * POST /api/admin/vendors/:id/approve
 * Approves a vendor application.
 */
export const approveVendor = async (req, res) => {
    try {
        const vendor = await updateVendorStatusAndRole(req.params.id, "approved");
        res.json({ success: true, message: "Vendor approved successfully.", vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * POST /api/admin/vendors/:id/reject
 * Rejects a vendor application.
 */
export const rejectVendor = async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ success: false, message: "Rejection reason is required." });
        const vendor = await updateVendorStatusAndRole(req.params.id, "rejected", reason);
        res.json({ success: true, message: "Vendor rejected successfully.", vendor });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};