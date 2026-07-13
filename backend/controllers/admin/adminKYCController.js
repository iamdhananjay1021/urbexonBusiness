/**
 * adminKYCController.js — Admin KYC Verification Management
 *
 * [FIX] verifyAadhaar/verifyPAN previously wrote "aadhaar.verificationStatus"
 * and "aadhaar.notes" (and the PAN equivalents) — neither path exists on
 * the DeliveryKYC schema (models/deliveryModels/DeliveryKYC.js), which has
 * "aadhaar.verified" (Boolean) and no "notes" sub-field at all. Under
 * Mongoose's default strict mode these writes were silently dropped —
 * the endpoint returned 200, but nothing about the actual pass/fail
 * decision was ever persisted, only verifiedAt/verifiedBy (which DO
 * exist on the schema) went through. Fixed to write "verified" (Boolean)
 * and log the reviewer's note in the `timeline` array, which is a real
 * schema field designed exactly for this.
 */

import DeliveryKYC from "../../models/deliveryModels/DeliveryKYC.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import { approveKYC, rejectKYC } from "../../services/deliveryKYCService.js";
import { sendNotification } from "../../utils/notificationQueue.js";

export const listPendingKYC = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const kycRecords = await DeliveryKYC.find({ overallStatus: "under_review" })
            .populate("deliveryBoyId", "name phone email city")
            .skip(skip)
            .limit(Number(limit))
            .sort({ createdAt: -1 })
            .lean();

        const total = await DeliveryKYC.countDocuments({ overallStatus: "under_review" });

        res.json({
            success: true,
            data: kycRecords,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        console.error("[listPendingKYC]", err);
        res.status(500).json({ success: false, message: "Failed to fetch KYC records" });
    }
};

export const getKYCDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const kyc = await DeliveryKYC.findById(id).populate(
            "deliveryBoyId",
            "name phone email city vehicleType vehicleNumber bankDetails documents documentStatus"
        );

        if (!kyc) {
            return res.status(404).json({ success: false, message: "KYC record not found" });
        }

        res.json({ success: true, data: kyc });
    } catch (err) {
        console.error("[getKYCDetails]", err);
        res.status(500).json({ success: false, message: "Failed to fetch KYC details" });
    }
};

export const verifyAadhaar = async (req, res) => {
    try {
        const { id } = req.params;
        const { verified, notes } = req.body;

        // [FIX] "verified" (Boolean) + "verificationMethod" are real schema
        // paths under aadhaar — was writing "verificationStatus" which
        // doesn't exist and was silently dropped on save.
        const kyc = await DeliveryKYC.findByIdAndUpdate(
            id,
            {
                $set: {
                    "aadhaar.verified": !!verified,
                    "aadhaar.verificationMethod": "manual",
                    "aadhaar.verifiedAt": new Date(),
                    "aadhaar.verifiedBy": req.user._id,
                },
                $push: {
                    // [FIX] the reviewer's note now goes into `timeline`
                    // (a real schema field) instead of the nonexistent
                    // "aadhaar.notes" path.
                    timeline: {
                        event: verified ? "aadhaar_verified" : "aadhaar_rejected",
                        timestamp: new Date(),
                        status: verified ? "approved" : "rejected",
                        verifiedBy: req.user._id,
                        notes: notes || "",
                    },
                },
            },
            { new: true }
        );

        if (!kyc) {
            return res.status(404).json({ success: false, message: "KYC record not found" });
        }

        res.json({ success: true, message: "Aadhaar verified", data: kyc });
    } catch (err) {
        console.error("[verifyAadhaar]", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};

export const verifyPAN = async (req, res) => {
    try {
        const { id } = req.params;
        const { verified, notes } = req.body;

        // [FIX] same class of bug as verifyAadhaar above — "pan.verified"
        // (Boolean) is the real schema path, not "pan.verificationStatus".
        const kyc = await DeliveryKYC.findByIdAndUpdate(
            id,
            {
                $set: {
                    "pan.verified": !!verified,
                    "pan.verificationMethod": "manual",
                    "pan.verifiedAt": new Date(),
                    "pan.verifiedBy": req.user._id,
                },
                $push: {
                    timeline: {
                        event: verified ? "pan_verified" : "pan_rejected",
                        timestamp: new Date(),
                        status: verified ? "approved" : "rejected",
                        verifiedBy: req.user._id,
                        notes: notes || "",
                    },
                },
            },
            { new: true }
        );

        if (!kyc) {
            return res.status(404).json({ success: false, message: "KYC record not found" });
        }

        res.json({ success: true, message: "PAN verified", data: kyc });
    } catch (err) {
        console.error("[verifyPAN]", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};

export const approveKYCRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const kyc = await DeliveryKYC.findById(id);
        if (!kyc) {
            return res.status(404).json({ success: false, message: "KYC record not found" });
        }

        const result = await approveKYC(kyc.deliveryBoyId, req.user._id, notes || "");

        const deliveryBoy = await DeliveryBoy.findById(kyc.deliveryBoyId);
        if (deliveryBoy) {
            sendNotification(String(deliveryBoy.userId), "delivery:kyc_approved", {
                message: "Your KYC has been successfully verified!",
            }).catch(() => { });
        }

        res.json(result);
    } catch (err) {
        console.error("[approveKYCRecord]", err);
        res.status(500).json({ success: false, message: "Failed to approve KYC" });
    }
};

export const rejectKYCRecord = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Rejection reason required" });
        }

        const kyc = await DeliveryKYC.findById(id);
        if (!kyc) {
            return res.status(404).json({ success: false, message: "KYC record not found" });
        }

        const result = await rejectKYC(kyc.deliveryBoyId, req.user._id, reason);

        const deliveryBoy = await DeliveryBoy.findById(kyc.deliveryBoyId);
        if (deliveryBoy) {
            sendNotification(String(deliveryBoy.userId), "delivery:kyc_rejected", {
                message: `KYC verification failed. Reason: ${reason}`,
            }).catch(() => { });
        }

        res.json(result);
    } catch (err) {
        console.error("[rejectKYCRecord]", err);
        res.status(500).json({ success: false, message: "Failed to reject KYC" });
    }
};

export default {
    listPendingKYC,
    getKYCDetails,
    verifyAadhaar,
    verifyPAN,
    approveKYCRecord,
    rejectKYCRecord,
};