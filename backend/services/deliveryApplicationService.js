/**
 * deliveryApplicationService.js — Core Delivery Partner Application Service
 * Handles: Application workflow, KYC, Document management, Verification
 *
 * This is the single source of truth for all delivery partner applications
 */

import DeliveryApplication from "../models/deliveryModels/DeliveryApplication.js";
import DeliveryKYC from "../models/deliveryModels/DeliveryKYC.js";
import DeliveryWallet from "../models/deliveryModels/DeliveryWallet.js";
import DeliveryBoy from "../models/deliveryModels/DeliveryBoy.js";
import DeliveryZone from "../models/deliveryModels/DeliveryZone.js";
import User from "../models/User.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

/**
 * Create initial application when delivery partner starts registration
 */
export const createApplication = async (userId) => {
    try {
        const existing = await DeliveryApplication.findOne({ userId });
        if (existing) {
            return { success: false, message: "Application already exists", data: existing };
        }

        const application = new DeliveryApplication({
            userId,
            status: "form_incomplete",
            formStartedAt: new Date(),
        });

        await application.save();

        return { success: true, message: "Application created", data: application };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] createApplication failed: ${err.message}`);
    }
};

/**
 * Update personal details in application
 */
export const updatePersonalDetails = async (applicationId, personalData) => {
    try {
        const application = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    "personal": personalData,
                    "completionStatus.personal.status": "completed",
                    "completionStatus.personal.completedAt": new Date(),
                },
            },
            { new: true, runValidators: true }
        );

        if (!application) {
            throw new Error("Application not found");
        }

        return { success: true, data: application };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] updatePersonalDetails failed: ${err.message}`);
    }
};

/**
 * Upload and manage documents
 */
export const uploadDocument = async (applicationId, documentType, fileBuffer, fileName) => {
    try {
        // Validate document type
        const validTypes = ["aadhaarFront", "aadhaarBack", "panImage", "liveSelfie", "rcFront", "rcBack", "licenseRront", "licenseBack", "insuranceDoc", "pucDoc", "helmetPhoto", "cancelledCheque", "passbookImage"];
        if (!validTypes.includes(documentType)) {
            throw new Error(`Invalid document type: ${documentType}`);
        }

        // Upload to Cloudinary
        const uploadResult = await uploadToCloudinary(
            fileBuffer,
            `delivery-applications/${applicationId}/${documentType}`
        );

        if (!uploadResult) {
            throw new Error("Upload failed");
        }

        // Update application with document URL
        const updatePath = `identity.${documentType}`;
        const updateData = { $set: { [updatePath]: uploadResult.secure_url } };

        const application = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            updateData,
            { new: true }
        );

        return { success: true, data: { url: uploadResult.secure_url } };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] uploadDocument failed: ${err.message}`);
    }
};

/**
 * Verify Aadhaar (basic validation - in production, integrate with Aadhaar API)
 */
export const verifyAadhaar = async (applicationId, aadhaarNumber) => {
    try {
        // Basic format validation
        if (!/^\d{12}$/.test(aadhaarNumber)) {
            return { success: false, message: "Invalid Aadhaar format" };
        }

        // Check for duplicates (prevent multiple applications with same Aadhaar)
        const existing = await DeliveryApplication.findOne({
            "identity.aadhaarNumber": aadhaarNumber,
            _id: { $ne: applicationId },
            status: { $nin: ["rejected", "withdrawn"] },
        });

        if (existing) {
            return { success: false, message: "Aadhaar already registered", applicant: existing.userId };
        }

        // Mask Aadhaar for storage (show only last 4 digits)
        const maskedAadhaar = `XXXX XXXX ${aadhaarNumber.slice(-4)}`;

        const application = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    "identity.aadhaarNumber": maskedAadhaar,
                    "identity.aadhaarVerified": true,
                },
            },
            { new: true }
        );

        return { success: true, data: application };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] verifyAadhaar failed: ${err.message}`);
    }
};

/**
 * Verify PAN
 */
export const verifyPAN = async (applicationId, panNumber) => {
    try {
        // Basic format validation (PAN format: ABCDE1234F)
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
            return { success: false, message: "Invalid PAN format" };
        }

        // Check for duplicates
        const existing = await DeliveryApplication.findOne({
            "identity.panNumber": panNumber,
            _id: { $ne: applicationId },
            status: { $nin: ["rejected", "withdrawn"] },
        });

        if (existing) {
            return { success: false, message: "PAN already registered" };
        }

        const application = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    "identity.panNumber": panNumber,
                    "identity.panVerified": true,
                },
            },
            { new: true }
        );

        return { success: true, data: application };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] verifyPAN failed: ${err.message}`);
    }
};

/**
 * Verify vehicle for duplicates
 */
export const verifyVehicle = async (applicationId, vehicleNumber) => {
    try {
        // Basic validation
        if (!vehicleNumber || vehicleNumber.trim().length < 4) {
            return { success: false, message: "Invalid vehicle number" };
        }

        // Check for duplicates
        const existing = await DeliveryApplication.findOne({
            "vehicle.vehicleNumber": vehicleNumber.toUpperCase(),
            _id: { $ne: applicationId },
            status: { $nin: ["rejected", "withdrawn"] },
        });

        if (existing) {
            return { success: false, message: "Vehicle already registered" };
        }

        return { success: true };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] verifyVehicle failed: ${err.message}`);
    }
};

/**
 * Submit application for review
 */
export const submitApplication = async (applicationId) => {
    try {
        const application = await DeliveryApplication.findById(applicationId);
        if (!application) {
            throw new Error("Application not found");
        }

        // Verify all required sections are completed
        const required = ["personal", "identity", "address", "vehicle", "bank"];
        for (const section of required) {
            if (application.completionStatus[section].status !== "completed") {
                return {
                    success: false,
                    message: `Please complete ${section} section`,
                };
            }
        }

        // Update status
        const updated = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    status: "submitted",
                    formCompletedAt: new Date(),
                },
                $push: {
                    timeline: {
                        event: "submitted",
                        timestamp: new Date(),
                        note: "Application submitted by applicant",
                    },
                },
            },
            { new: true }
        );

        return { success: true, data: updated };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] submitApplication failed: ${err.message}`);
    }
};

/**
 * Admin review and approve application
 */
export const approveApplication = async (applicationId, adminId, notes = "") => {
    try {
        const application = await DeliveryApplication.findById(applicationId);
        if (!application) {
            throw new Error("Application not found");
        }

        // Create DeliveryBoy record
        const user = await User.findById(application.userId);
        const deliveryBoy = await DeliveryBoy.create({
            userId: application.userId,
            name: application.personal.fullName || user.name,
            phone: user.phone,
            email: user.email,
            dateOfBirth: application.personal.dateOfBirth,
            gender: application.personal.gender,
            profilePhoto: application.personal.profilePhoto,
            status: "approved",
            address: {
                houseNumber: application.address.houseNumber,
                area: application.address.area,
                landmark: application.address.landmark,
                city: application.address.city,
                state: application.address.state,
                pincode: application.address.pincode,
                latitude: application.address.latitude,
                longitude: application.address.longitude,
            },
            geoLocation: {
                type: "Point",
                coordinates: [application.address.longitude || 0, application.address.latitude || 0],
            },
            vehicle: {
                vehicleType: application.vehicle.vehicleType,
                vehicleNumber: application.vehicle.vehicleNumber,
                vehiclePhoto: application.vehicle.vehiclePhoto,
            },
            bankDetails: {
                accountHolder: application.bank.accountHolder,
                accountNumber: application.bank.accountNumber,
                ifsc: application.bank.ifsc,
                bankName: application.bank.bankName,
                upiId: application.bank.upiId,
            },
            city: application.address.city,
        });

        // Create KYC record
        await DeliveryKYC.create({
            deliveryBoyId: deliveryBoy._id,
            applicationId,
            overallStatus: "approved",
            aadhaar: {
                number: application.identity.aadhaarNumber,
                verified: application.identity.aadhaarVerified,
            },
            pan: {
                number: application.identity.panNumber,
                verified: application.identity.panVerified,
            },
        });

        // Create Wallet
        await DeliveryWallet.create({
            deliveryBoyId: deliveryBoy._id,
        });

        // Update application
        const updated = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    status: "approved",
                    deliveryBoyId: deliveryBoy._id,
                    approvedAt: new Date(),
                    approvedBy: adminId,
                    "adminNotes.generalNotes": notes,
                },
                $push: {
                    timeline: {
                        event: "approved",
                        timestamp: new Date(),
                        reviewedBy: adminId,
                        note: notes,
                    },
                },
            },
            { new: true }
        );

        return {
            success: true,
            message: "Application approved",
            data: { application: updated, deliveryBoy },
        };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] approveApplication failed: ${err.message}`);
    }
};

/**
 * Admin reject application
 */
export const rejectApplication = async (applicationId, adminId, reason) => {
    try {
        const updated = await DeliveryApplication.findByIdAndUpdate(
            applicationId,
            {
                $set: {
                    status: "rejected",
                    rejectedAt: new Date(),
                    rejectedBy: adminId,
                    "adminNotes.rejectionReason": reason,
                },
                $push: {
                    timeline: {
                        event: "rejected",
                        timestamp: new Date(),
                        reviewedBy: adminId,
                        note: reason,
                    },
                },
            },
            { new: true }
        );

        return { success: true, data: updated };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] rejectApplication failed: ${err.message}`);
    }
};

/**
 * Get application details
 */
export const getApplication = async (applicationId) => {
    try {
        const application = await DeliveryApplication.findById(applicationId)
            .populate("deliveryBoyId", "name phone status isOnline performance")
            .lean();

        if (!application) {
            throw new Error("Application not found");
        }

        return { success: true, data: application };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] getApplication failed: ${err.message}`);
    }
};

/**
 * Get all applications with filters
 */
export const listApplications = async (filters = {}, page = 1, limit = 20) => {
    try {
        const query = {};

        if (filters.status) query.status = filters.status;
        if (filters.city) query["address.city"] = filters.city;
        if (filters.applicationStatus) query.applicationStatus = filters.applicationStatus;

        const skip = (page - 1) * limit;

        const applications = await DeliveryApplication.find(query)
            .select("-adminNotes -flags")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await DeliveryApplication.countDocuments(query);

        return {
            success: true,
            data: applications,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        };
    } catch (err) {
        throw new Error(`[DeliveryApplicationService] listApplications failed: ${err.message}`);
    }
};

export default {
    createApplication,
    updatePersonalDetails,
    uploadDocument,
    verifyAadhaar,
    verifyPAN,
    verifyVehicle,
    submitApplication,
    approveApplication,
    rejectApplication,
    getApplication,
    listApplications,
};
