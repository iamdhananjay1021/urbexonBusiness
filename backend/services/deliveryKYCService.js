/**
 * deliveryKYCService.js — KYC Verification and Document Management
 *
 * [FIX] Every write in this file previously used field names that don't
 * exist in the DeliveryKYC schema (models/deliveryModels/DeliveryKYC.js) —
 * e.g. "front"/"back" instead of "frontImage"/"backImage",
 * "verificationStatus" (string) instead of "verified" (Boolean),
 * "document" instead of "image", "number" instead of "registrationNumber"
 * on vehicleRC, and "matchScore"/"livenessScore" which don't exist on
 * faceVerification at all. Because Mongoose schemas are strict by
 * default, all of these were being silently dropped on save — no error,
 * no persisted data. All writes below now use the actual schema paths.
 *
 * [FIX] Document submission no longer disappears into a black hole:
 * each submit function now also nudges `overallStatus` from "pending" to
 * "under_review" (only on first submission), because
 * adminKYCController.listPendingKYC only queries overallStatus ===
 * "under_review" — without this, the admin review queue would stay
 * permanently empty no matter how many riders submitted documents.
 *
 * [FIX] Submission events are now recorded in the `timeline` array
 * (which DOES exist on the schema) instead of a non-existent
 * "submittedAt" sub-field.
 */

import DeliveryKYC from "../models/deliveryModels/DeliveryKYC.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

// Bump overallStatus into the admin review queue on first submission only —
// never downgrade an already-approved/rejected record just because a rider
// re-uploads one document.
const markUnderReviewIfPending = (kyc) => {
    if (kyc.overallStatus === "pending") {
        kyc.overallStatus = "under_review";
    }
};

export const verifyAadhaar = async (deliveryBoyId, aadhaarNumber, frontImage, backImage) => {
    try {
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return { success: false, message: "Invalid Aadhaar format" };
        }

        let kyc = await DeliveryKYC.findOne({ deliveryBoyId });
        if (!kyc) {
            kyc = new DeliveryKYC({ deliveryBoyId, overallStatus: "under_review" });
        }

        const uploadedUrls = {};
        if (frontImage) {
            const front = await uploadToCloudinary(frontImage, `kyc/${deliveryBoyId}/aadhaar_front`);
            uploadedUrls.front = front.secure_url;
        }
        if (backImage) {
            const back = await uploadToCloudinary(backImage, `kyc/${deliveryBoyId}/aadhaar_back`);
            uploadedUrls.back = back.secure_url;
        }

        // [FIX] frontImage/backImage (schema) — was front/back
        kyc.aadhaar = {
            ...(kyc.aadhaar?.toObject?.() || kyc.aadhaar || {}),
            number: `XXXX XXXX ${aadhaarNumber.slice(-4)}`,
            frontImage: uploadedUrls.front || kyc.aadhaar?.frontImage,
            backImage: uploadedUrls.back || kyc.aadhaar?.backImage,
            verified: false, // reset — awaiting fresh admin review
        };

        markUnderReviewIfPending(kyc);

        // [FIX] "submittedAt" isn't a real sub-field — log the event in timeline instead
        kyc.timeline.push({
            event: "aadhaar_submitted",
            timestamp: new Date(),
            status: "under_review",
            notes: "Aadhaar submitted for verification",
        });

        await kyc.save();

        return {
            success: true,
            message: "Aadhaar submitted for verification",
            data: kyc,
        };
    } catch (err) {
        throw new Error(`[KYCService] verifyAadhaar failed: ${err.message}`);
    }
};

export const verifyPAN = async (deliveryBoyId, panNumber, image) => {
    try {
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
            return { success: false, message: "Invalid PAN format" };
        }

        let kyc = await DeliveryKYC.findOne({ deliveryBoyId });
        if (!kyc) {
            kyc = new DeliveryKYC({ deliveryBoyId, overallStatus: "under_review" });
        }

        // [FIX] schema field is "image" — was being written to a nonexistent "document"
        let imageUrl = kyc.pan?.image;
        if (image) {
            const uploaded = await uploadToCloudinary(image, `kyc/${deliveryBoyId}/pan`);
            imageUrl = uploaded.secure_url;
        }

        kyc.pan = {
            ...(kyc.pan?.toObject?.() || kyc.pan || {}),
            number: panNumber,
            image: imageUrl,
            verified: false, // reset — awaiting fresh admin review
        };

        markUnderReviewIfPending(kyc);

        kyc.timeline.push({
            event: "pan_submitted",
            timestamp: new Date(),
            status: "under_review",
            notes: "PAN submitted for verification",
        });

        await kyc.save();

        return {
            success: true,
            message: "PAN submitted for verification",
            data: kyc,
        };
    } catch (err) {
        throw new Error(`[KYCService] verifyPAN failed: ${err.message}`);
    }
};

export const verifyDrivingLicense = async (deliveryBoyId, licenseNumber, frontImage, backImage) => {
    try {
        let kyc = await DeliveryKYC.findOne({ deliveryBoyId });
        if (!kyc) {
            kyc = new DeliveryKYC({ deliveryBoyId, overallStatus: "under_review" });
        }

        const uploadedUrls = {};
        if (frontImage) {
            const front = await uploadToCloudinary(frontImage, `kyc/${deliveryBoyId}/license_front`);
            uploadedUrls.front = front.secure_url;
        }
        if (backImage) {
            const back = await uploadToCloudinary(backImage, `kyc/${deliveryBoyId}/license_back`);
            uploadedUrls.back = back.secure_url;
        }

        // [FIX] frontImage/backImage (schema) — was front/back
        kyc.drivingLicense = {
            ...(kyc.drivingLicense?.toObject?.() || kyc.drivingLicense || {}),
            number: licenseNumber,
            frontImage: uploadedUrls.front || kyc.drivingLicense?.frontImage,
            backImage: uploadedUrls.back || kyc.drivingLicense?.backImage,
            verified: false,
        };

        markUnderReviewIfPending(kyc);

        kyc.timeline.push({
            event: "license_submitted",
            timestamp: new Date(),
            status: "under_review",
            notes: "Driving License submitted for verification",
        });

        await kyc.save();

        return {
            success: true,
            message: "Driving License submitted for verification",
            data: kyc,
        };
    } catch (err) {
        throw new Error(`[KYCService] verifyDrivingLicense failed: ${err.message}`);
    }
};

export const verifyVehicleRC = async (deliveryBoyId, rcNumber, frontImage, backImage) => {
    try {
        let kyc = await DeliveryKYC.findOne({ deliveryBoyId });
        if (!kyc) {
            kyc = new DeliveryKYC({ deliveryBoyId, overallStatus: "under_review" });
        }

        const uploadedUrls = {};
        if (frontImage) {
            const front = await uploadToCloudinary(frontImage, `kyc/${deliveryBoyId}/rc_front`);
            uploadedUrls.front = front.secure_url;
        }
        if (backImage) {
            const back = await uploadToCloudinary(backImage, `kyc/${deliveryBoyId}/rc_back`);
            uploadedUrls.back = back.secure_url;
        }

        // [FIX] schema field is "registrationNumber" — was being written to "number".
        // [FIX] frontImage/backImage (schema) — was front/back
        kyc.vehicleRC = {
            ...(kyc.vehicleRC?.toObject?.() || kyc.vehicleRC || {}),
            registrationNumber: rcNumber,
            frontImage: uploadedUrls.front || kyc.vehicleRC?.frontImage,
            backImage: uploadedUrls.back || kyc.vehicleRC?.backImage,
            verified: false,
        };

        markUnderReviewIfPending(kyc);

        kyc.timeline.push({
            event: "rc_submitted",
            timestamp: new Date(),
            status: "under_review",
            notes: "Vehicle RC submitted for verification",
        });

        await kyc.save();

        return {
            success: true,
            message: "Vehicle RC submitted for verification",
            data: kyc,
        };
    } catch (err) {
        throw new Error(`[KYCService] verifyVehicleRC failed: ${err.message}`);
    }
};

export const verifyFaceMatch = async (deliveryBoyId, selfieImage) => {
    try {
        let kyc = await DeliveryKYC.findOne({ deliveryBoyId });
        if (!kyc) {
            kyc = new DeliveryKYC({ deliveryBoyId, overallStatus: "under_review" });
        }

        let imageUrl = kyc.faceVerification?.selfieImage;
        if (selfieImage) {
            const uploaded = await uploadToCloudinary(selfieImage, `kyc/${deliveryBoyId}/selfie`);
            imageUrl = uploaded.secure_url;
        }

        // [FIX] schema has "status" (enum pending/verified/failed) and
        // "aadhaarMatchScore" — was writing nonexistent "matchScore",
        // "livenessScore", and "verificationStatus".
        kyc.faceVerification = {
            ...(kyc.faceVerification?.toObject?.() || kyc.faceVerification || {}),
            selfieImage: imageUrl,
            status: "pending",
            aadhaarMatchScore: null,
        };

        markUnderReviewIfPending(kyc);

        kyc.timeline.push({
            event: "selfie_submitted",
            timestamp: new Date(),
            status: "under_review",
            notes: "Selfie submitted for face verification",
        });

        await kyc.save();

        return {
            success: true,
            message: "Selfie submitted for face verification",
            data: kyc,
        };
    } catch (err) {
        throw new Error(`[KYCService] verifyFaceMatch failed: ${err.message}`);
    }
};

export const approveKYC = async (deliveryBoyId, adminId, notes = "") => {
    try {
        // [FIX] schema has approvedAt/approvedBy — was writing nonexistent
        // top-level "verifiedAt"/"verifiedBy" (those names only exist
        // nested inside aadhaar/pan/etc, not at the KYC document root).
        const kyc = await DeliveryKYC.findOneAndUpdate(
            { deliveryBoyId },
            {
                $set: {
                    overallStatus: "approved",
                    approvedAt: new Date(),
                    approvedBy: adminId,
                    adminNotes: notes || "",
                },
                $push: {
                    // [FIX] timeline sub-schema fields are event/timestamp/status/
                    // verifiedBy/notes — was pushing nonexistent "approvedBy"/"note"
                    timeline: {
                        event: "kyc_approved",
                        timestamp: new Date(),
                        status: "approved",
                        verifiedBy: adminId,
                        notes,
                    },
                },
            },
            { new: true }
        );

        // [FIX] DeliveryBoy schema (models/deliveryModels/DeliveryBoy.js) has no
        // kycStatus/kycVerifiedAt/kycVerifiedBy fields — that update was a
        // silent no-op every time. DeliveryKYC.overallStatus is the single
        // source of truth for KYC state; removed the dead write rather than
        // inventing fields on DeliveryBoy that nothing else reads.
        // If you want DeliveryBoy to mirror KYC status, add those fields to
        // the DeliveryBoy schema first, then reinstate this sync here.

        return { success: true, message: "KYC approved", data: kyc };
    } catch (err) {
        throw new Error(`[KYCService] approveKYC failed: ${err.message}`);
    }
};

export const rejectKYC = async (deliveryBoyId, adminId, reason) => {
    try {
        // [FIX] schema has rejectedAt/rejectedBy/rejectionReason at the KYC
        // document root — was writing nonexistent "verifiedAt"/"verifiedBy".
        const kyc = await DeliveryKYC.findOneAndUpdate(
            { deliveryBoyId },
            {
                $set: {
                    overallStatus: "rejected",
                    rejectedAt: new Date(),
                    rejectedBy: adminId,
                    rejectionReason: reason,
                },
                $push: {
                    timeline: {
                        event: "kyc_rejected",
                        timestamp: new Date(),
                        status: "rejected",
                        verifiedBy: adminId,
                        notes: reason,
                    },
                },
            },
            { new: true }
        );

        // [FIX] see approveKYC — DeliveryBoy has no kycStatus field, dead
        // write removed rather than left silently failing.

        return { success: true, message: "KYC rejected", data: kyc };
    } catch (err) {
        throw new Error(`[KYCService] rejectKYC failed: ${err.message}`);
    }
};

export const getKYCStatus = async (deliveryBoyId) => {
    try {
        const kyc = await DeliveryKYC.findOne({ deliveryBoyId }).lean();
        return { success: true, data: kyc };
    } catch (err) {
        throw new Error(`[KYCService] getKYCStatus failed: ${err.message}`);
    }
};

export default {
    verifyAadhaar,
    verifyPAN,
    verifyDrivingLicense,
    verifyVehicleRC,
    verifyFaceMatch,
    approveKYC,
    rejectKYC,
    getKYCStatus,
};