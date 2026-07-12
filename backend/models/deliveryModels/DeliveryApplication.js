/**
 * DeliveryApplication.js — Delivery Partner Application Workflow
 * Tracks the complete application lifecycle from registration to approval
 */

import mongoose from "mongoose";

const deliveryApplicationSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null },

        // ── Application Status Flow ──
        status: {
            type: String,
            enum: [
                "form_incomplete",      // User started but didn't complete
                "submitted",             // All required documents submitted
                "under_review",         // Admin reviewing
                "document_rejected",    // Documents need resubmission
                "interview_pending",    // Scheduled for interview
                "interview_completed",  // Interview done
                "background_check",     // Background verification in progress
                "approved",             // Fully approved
                "rejected",             // Application rejected
                "withdrawn",            // User withdrew application
            ],
            default: "form_incomplete",
            index: true,
        },

        // ── Completion Status ──
        completionStatus: {
            personal: { status: "pending", completedAt: null, errors: [] },
            identity: { status: "pending", completedAt: null, errors: [] },
            address: { status: "pending", completedAt: null, errors: [] },
            vehicle: { status: "pending", completedAt: null, errors: [] },
            bank: { status: "pending", completedAt: null, errors: [] },
            preferences: { status: "pending", completedAt: null, errors: [] },
        },

        // ── Timeline ──
        timeline: [
            {
                event: String, // "submitted", "under_review", "approved", etc.
                timestamp: { type: Date, default: Date.now },
                note: String,
                reviewedBy: mongoose.Schema.Types.ObjectId,
            },
        ],

        // ── Personal Details ──
        personal: {
            fullName: String,
            dateOfBirth: Date,
            gender: { type: String, enum: ["male", "female", "other"], default: null },
            profilePhoto: String,
            emergencyContactName: String,
            emergencyContactPhone: String,
            bloodGroup: { type: String, default: null },
        },

        // ── Identity Verification ──
        identity: {
            aadhaarNumber: { type: String, default: null }, // Masked: XXXX XXXX 1234
            aadhaarFront: String,
            aadhaarBack: String,
            aadhaarVerified: { type: Boolean, default: false },
            aadhaarVerifiedAt: Date,

            panNumber: { type: String, default: null }, // Format: ABCDE1234F
            panImage: String,
            panVerified: { type: Boolean, default: false },
            panVerifiedAt: Date,

            liveSelfie: String,
            faceMatchScore: { type: Number, default: null }, // 0-100 for face match
            faceMatchVerified: { type: Boolean, default: false },
        },

        // ── Address ──
        address: {
            houseNumber: String,
            landmark: String,
            area: String,
            city: String,
            district: String,
            state: String,
            pincode: String,
            latitude: Number,
            longitude: Number,
            gpsAccuracy: Number, // meters
            nearestServiceableZone: mongoose.Schema.Types.ObjectId,
        },

        // ── Vehicle ──
        vehicle: {
            vehicleType: { type: String, enum: ["bicycle", "scooter", "motorcycle", "car", "ev"], default: null },
            vehicleNumber: String,
            vehiclePhoto: String,
            rcFront: String,
            rcBack: String,
            rcVerified: { type: Boolean, default: false },

            drivingLicenseNumber: String,
            drivingLicenseFront: String,
            drivingLicenseBack: String,
            licenseVerified: { type: Boolean, default: false },

            insuranceDocument: String,
            insuranceValidTill: Date,

            pucDocument: String,
            pucValidTill: Date,

            helmetPhoto: String,
            helmetVerified: { type: Boolean, default: false },
        },

        // ── Bank Details ──
        bank: {
            accountHolder: String,
            bankName: String,
            accountNumber: { type: String, default: null }, // Masked: XXXXXXXXX1234
            ifsc: String,
            branch: String,
            upiId: String,
            cancelledCheque: String,
            passbookImage: String,
            bankVerified: { type: Boolean, default: false },
            bankVerifiedAt: Date,
        },

        // ── Work Preferences ──
        preferences: {
            deliveryRadius: { type: Number, default: 5 }, // km
            preferredZones: [mongoose.Schema.Types.ObjectId],
            preferredShifts: { type: [String], default: [] }, // "morning", "afternoon", "evening", "night"
            workingDays: { type: [String], default: [] }, // "monday" to "sunday"
            employmentType: { type: String, enum: ["full_time", "part_time"], default: "part_time" },
            instantAvailability: { type: Boolean, default: false },
        },

        // ── Device Info ──
        device: {
            deviceName: String,
            deviceId: String,
            appVersion: String,
            androidVersion: String,
            batteryOptimizationDisabled: { type: Boolean, default: false },
            gpsPermissionGranted: { type: Boolean, default: false },
            backgroundLocationGranted: { type: Boolean, default: false },
            notificationPermissionGranted: { type: Boolean, default: false },
        },

        // ── Admin Review Notes ──
        adminNotes: {
            generalNotes: { type: String, default: "" },
            documentNotes: { type: String, default: "" },
            verificationNotes: { type: String, default: "" },
            rejectionReason: { type: String, default: "" },
        },

        // ── Flags ──
        flags: {
            isDuplicate: { type: Boolean, default: false },
            duplicateOf: mongoose.Schema.Types.ObjectId,
            requiresManualReview: { type: Boolean, default: false },
            manualReviewReason: String,
            flaggedAt: Date,
            flaggedBy: mongoose.Schema.Types.ObjectId,
        },

        // ── IP & Device Tracking ──
        ipAddress: String,
        userAgent: String,

        // ── Metadata ──
        formStartedAt: { type: Date, default: Date.now },
        formCompletedAt: Date,
        approvedAt: Date,
        approvedBy: mongoose.Schema.Types.ObjectId,
        rejectedAt: Date,
        rejectedBy: mongoose.Schema.Types.ObjectId,
    },
    { timestamps: true }
);

// Indexes for performance
deliveryApplicationSchema.index({ userId: 1, status: 1 });
deliveryApplicationSchema.index({ status: 1, createdAt: -1 });
deliveryApplicationSchema.index({ "identity.aadhaarNumber": 1 }, { sparse: true });
deliveryApplicationSchema.index({ "identity.panNumber": 1 }, { sparse: true });
deliveryApplicationSchema.index({ "vehicle.vehicleNumber": 1 }, { sparse: true });
deliveryApplicationSchema.index({ "address.pincode": 1 });

export default mongoose.model("DeliveryApplication", deliveryApplicationSchema);
