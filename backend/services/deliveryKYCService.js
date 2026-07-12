/**
 * deliveryKYCService.js — KYC Verification and Document Management
 */

import DeliveryKYC from "../models/deliveryModels/DeliveryKYC.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

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

        kyc.aadhaar = {
            number: `XXXX XXXX ${aadhaarNumber.slice(-4)}`,
            front: uploadedUrls.front || kyc.aadhaar?.front,
            back: uploadedUrls.back || kyc.aadhaar?.back,
            verificationStatus: "under_review",
            submittedAt: new Date(),
        };

        kyc.timeline.push({
            event: "aadhaar_submitted",
            timestamp: new Date(),
            note: "Aadhaar submitted for verification",
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

        let imageUrl = kyc.pan?.document;
        if (image) {
            const uploaded = await uploadToCloudinary(image, `kyc/${deliveryBoyId}/pan`);
            imageUrl = uploaded.secure_url;
        }

        kyc.pan = {
            number: panNumber,
            document: imageUrl,
            verificationStatus: "under_review",
            submittedAt: new Date(),
        };

        kyc.timeline.push({
            event: "pan_submitted",
            timestamp: new Date(),
            note: "PAN submitted for verification",
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

        kyc.drivingLicense = {
            number: licenseNumber,
            front: uploadedUrls.front || kyc.drivingLicense?.front,
            back: uploadedUrls.back || kyc.drivingLicense?.back,
            verificationStatus: "under_review",
            submittedAt: new Date(),
        };

        kyc.timeline.push({
            event: "license_submitted",
            timestamp: new Date(),
            note: "Driving License submitted for verification",
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

        kyc.vehicleRC = {
            number: rcNumber,
            front: uploadedUrls.front || kyc.vehicleRC?.front,
            back: uploadedUrls.back || kyc.vehicleRC?.back,
            verificationStatus: "under_review",
            submittedAt: new Date(),
        };

        kyc.timeline.push({
            event: "rc_submitted",
            timestamp: new Date(),
            note: "Vehicle RC submitted for verification",
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

        kyc.faceVerification = {
            selfieImage: imageUrl,
            matchScore: 0,
            livenessScore: 0,
            verificationStatus: "under_review",
            submittedAt: new Date(),
        };

        kyc.timeline.push({
            event: "selfie_submitted",
            timestamp: new Date(),
            note: "Selfie submitted for face verification",
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
        const kyc = await DeliveryKYC.findOneAndUpdate(
            { deliveryBoyId },
            {
                $set: {
                    overallStatus: "approved",
                    verifiedAt: new Date(),
                    verifiedBy: adminId,
                },
                $push: {
                    timeline: {
                        event: "kyc_approved",
                        timestamp: new Date(),
                        approvedBy: adminId,
                        note: notes,
                    },
                },
            },
            { new: true }
        );

        if (kyc) {
            await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                kycStatus: "approved",
                kycVerifiedAt: new Date(),
                kycVerifiedBy: adminId,
            });
        }

        return { success: true, message: "KYC approved", data: kyc };
    } catch (err) {
        throw new Error(`[KYCService] approveKYC failed: ${err.message}`);
    }
};

export const rejectKYC = async (deliveryBoyId, adminId, reason) => {
    try {
        const kyc = await DeliveryKYC.findOneAndUpdate(
            { deliveryBoyId },
            {
                $set: {
                    overallStatus: "rejected",
                    rejectedAt: new Date(),
                    rejectionReason: reason,
                },
                $push: {
                    timeline: {
                        event: "kyc_rejected",
                        timestamp: new Date(),
                        rejectedBy: adminId,
                        note: reason,
                    },
                },
            },
            { new: true }
        );

        if (kyc) {
            await DeliveryBoy.findByIdAndUpdate(deliveryBoyId, {
                kycStatus: "rejected",
            });
        }

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
