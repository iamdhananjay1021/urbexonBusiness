/**
 * DeliveryKYC.js — KYC Verification & Document Management
 * Handles detailed verification status for each document type
 */

import mongoose from "mongoose";

const deliveryKYCSchema = new mongoose.Schema(
    {
        deliveryBoyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true, unique: true, index: true },
        applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryApplication", default: null },

        // ── Overall KYC Status ──
        overallStatus: {
            type: String,
            enum: ["pending", "under_review", "approved", "rejected", "expired"],
            default: "pending",
            index: true,
        },

        // ── Aadhaar Verification ──
        aadhaar: {
            number: { type: String, default: null }, // Masked
            verified: { type: Boolean, default: false },
            verificationMethod: { type: String, enum: ["manual", "ekyc", "api"], default: null },
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            frontImage: String,
            backImage: String,
            expiryDate: Date,
            extractedData: {
                name: String,
                dob: Date,
                gender: String,
                address: String,
            },
        },

        // ── PAN Verification ──
        pan: {
            number: { type: String, default: null },
            verified: { type: Boolean, default: false },
            verificationMethod: { type: String, enum: ["manual", "api"], default: null },
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            image: String,
            matchesAadhaar: { type: Boolean, default: false },
            extractedData: {
                name: String,
                dob: Date,
                fatherName: String,
            },
        },

        // ── Driving License Verification ──
        drivingLicense: {
            number: { type: String, default: null },
            verified: { type: Boolean, default: false },
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            frontImage: String,
            backImage: String,
            issueDate: Date,
            expiryDate: Date,
            state: String,
            vehicleClass: String,
        },

        // ── Vehicle RC Verification ──
        vehicleRC: {
            registrationNumber: { type: String, default: null },
            verified: { type: Boolean, default: false },
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            frontImage: String,
            backImage: String,
            registrationDate: Date,
            validTill: Date,
            ownerName: String,
            vehicleType: String,
        },

        // ── Face Verification ──
        faceVerification: {
            status: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
            selfieImage: String,
            aadhaarMatchScore: { type: Number, default: null }, // 0-100
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            failureReason: String,
            attempts: { type: Number, default: 0 },
            maxAttemptsReached: { type: Boolean, default: false },
        },

        // ── Background Check ──
        backgroundCheck: {
            status: { type: String, enum: ["pending", "cleared", "failed"], default: "pending" },
            completedAt: Date,
            completedBy: mongoose.Schema.Types.ObjectId,
            findings: String,
            flagged: { type: Boolean, default: false },
            flagReason: String,
        },

        // ── Address Verification ──
        addressVerification: {
            status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            method: { type: String, enum: ["gps", "pincode", "manual"], default: null },
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            coordinates: {
                latitude: Number,
                longitude: Number,
                accuracy: Number,
            },
        },

        // ── Bank Account Verification ──
        bankVerification: {
            status: { type: String, enum: ["pending", "verified", "failed"], default: "pending" },
            accountNumber: { type: String, default: null }, // Masked
            ifsc: String,
            verifiedAt: Date,
            verifiedBy: mongoose.Schema.Types.ObjectId,
            verificationMethod: { type: String, enum: ["manual", "api"], default: null },
            cancelledChequeImage: String,
            passbookImage: String,
            verified: { type: Boolean, default: false },
        },

        // ── Verification Timeline ──
        timeline: [
            {
                event: String, // "aadhaar_verified", "pan_verified", "face_verified", etc.
                timestamp: { type: Date, default: Date.now },
                status: String,
                verifiedBy: mongoose.Schema.Types.ObjectId,
                notes: String,
            },
        ],

        // ── Risk Assessment ──
        riskAssessment: {
            riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
            riskFactors: [String],
            assessedAt: Date,
            assessedBy: mongoose.Schema.Types.ObjectId,
        },

        // ── Expiry & Renewal ──
        expiryDate: Date,
        expiryNotificationSentAt: Date,
        renewalRequired: { type: Boolean, default: false },
        renewalDeadline: Date,

        // ── Admin Review ──
        adminNotes: { type: String, default: "" },
        manualVerificationRequired: { type: Boolean, default: false },
        manualVerificationReason: String,

        // ── Metadata ──
        approvedAt: Date,
        approvedBy: mongoose.Schema.Types.ObjectId,
        rejectedAt: Date,
        rejectedBy: mongoose.Schema.Types.ObjectId,
        rejectionReason: String,
    },
    { timestamps: true }
);

// Indexes
deliveryKYCSchema.index({ deliveryBoyId: 1 });
deliveryKYCSchema.index({ overallStatus: 1, expiryDate: 1 });
deliveryKYCSchema.index({ "aadhaar.verified": 1 });
deliveryKYCSchema.index({ "pan.verified": 1 });
deliveryKYCSchema.index({ expiryDate: 1 }); // For renewal reminders

export default mongoose.model("DeliveryKYC", deliveryKYCSchema);
