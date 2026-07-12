/**
 * DeliveryBoy_Enhanced.js — Complete Production Delivery Partner Model
 *
 * This is the enhanced version with all production-grade fields.
 * Replace the existing DeliveryBoy.js with this version after review.
 *
 * Relationships:
 * - applicationId: DeliveryApplication
 * - kycId: DeliveryKYC
 * - walletId: DeliveryWallet
 * - assignedZones: DeliveryZone
 */

import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
    {
        // ── User Reference ──
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
        applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryApplication", default: null },
        kycId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryKYC", default: null },
        walletId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryWallet", default: null },

        // ── Personal Information ──
        name: { type: String, required: true, trim: true, maxlength: 100 },
        phone: { type: String, required: true, trim: true, unique: true, index: true },
        email: { type: String, trim: true, lowercase: true, default: null },
        dateOfBirth: Date,
        gender: { type: String, enum: ["male", "female", "other"], default: null },
        profilePhoto: String,
        emergencyContactName: String,
        emergencyContactPhone: String,
        bloodGroup: String,

        // ── Identity Documents ──
        identityDocuments: {
            aadhaarNumber: { type: String, default: null }, // Masked
            aadhaarVerified: { type: Boolean, default: false },
            panNumber: { type: String, default: null }, // Masked
            panVerified: { type: Boolean, default: false },
        },

        // ── Current Address ──
        address: {
            houseNumber: String,
            area: String,
            landmark: String,
            city: { type: String, index: true },
            district: String,
            state: String,
            pincode: { type: String, index: true },
            latitude: Number,
            longitude: Number,
            nearestZone: mongoose.Schema.Types.ObjectId, // Reference to DeliveryZone
        },

        // ── Vehicle Information ──
        vehicle: {
            vehicleType: {
                type: String,
                enum: ["bicycle", "scooter", "motorcycle", "car", "ev"],
                default: "motorcycle",
                index: true,
            },
            vehicleNumber: { type: String, default: "", unique: true, sparse: true, index: true },
            vehicleModel: { type: String, default: "" },
            vehiclePhoto: String,
            vehicleColor: String,

            // RC Details
            rcNumber: String,
            rcFront: String,
            rcBack: String,
            rcVerified: { type: Boolean, default: false },
            rcValidTill: Date,

            // Driving License
            drivingLicenseNumber: String,
            drivingLicenseFront: String,
            drivingLicenseBack: String,
            licenseVerified: { type: Boolean, default: false },
            licenseValidTill: Date,

            // Insurance & PUC
            insuranceDocument: String,
            insuranceValidTill: Date,
            pucDocument: String,
            pucValidTill: Date,
            pucVerified: { type: Boolean, default: false },

            // Helmet Verification
            helmetPhoto: String,
            helmetVerified: { type: Boolean, default: false },
        },

        // ── Bank & Payment Details ──
        bankDetails: {
            accountHolder: { type: String, trim: true, default: "" },
            accountNumber: { type: String, trim: true, default: null }, // Masked
            ifsc: { type: String, trim: true, uppercase: true, default: "" },
            bankName: { type: String, trim: true, default: "" },
            branch: { type: String, trim: true, default: "" },
            upiId: { type: String, trim: true, default: "" },
            cancelledCheque: String,
            passbookImage: String,
            bankVerified: { type: Boolean, default: false },
        },

        // ── Wallet & Balance ──
        wallet: {
            balance: { type: Number, default: 0 },
            totalEarned: { type: Number, default: 0 },
            pendingSettlement: { type: Number, default: 0 },
            lastEarningAt: Date,
        },

        // ── Work Preferences ──
        workPreferences: {
            preferredDeliveryRadius: { type: Number, default: 5 }, // km
            preferredZones: [mongoose.Schema.Types.ObjectId], // Reference to DeliveryZone
            preferredShifts: [String], // "morning", "afternoon", "evening", "night"
            workingDays: [String], // "monday" to "sunday"
            employmentType: { type: String, enum: ["full_time", "part_time"], default: "part_time" },
            instantAvailability: { type: Boolean, default: false },
            maxDeliveriesPerDay: { type: Number, default: 20 },
        },

        // ── Device Information ──
        device: {
            deviceName: String,
            deviceId: String,
            appVersion: String,
            androidVersion: String,
            lastAppUpdateAt: Date,
            batteryOptimizationDisabled: { type: Boolean, default: false },
            gpsPermissionGranted: { type: Boolean, default: false },
            backgroundLocationGranted: { type: Boolean, default: false },
            notificationPermissionGranted: { type: Boolean, default: false },
            fcmTokens: [{ token: String, registeredAt: Date }], // Multiple devices support
        },

        // ── Live Location & Tracking ──
        location: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
            updatedAt: { type: Date, default: null },
            gpsTimestamp: { type: Number, default: null },
            accuracy: { type: Number, default: null }, // meters
            speed: { type: Number, default: null }, // km/h
            heading: { type: Number, default: null }, // degrees
        },

        // ── GeoJSON Location for Geo Queries ──
        geoLocation: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },

        // ── Status Management ──
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "suspended", "inactive", "deleted"],
            default: "pending",
            index: true,
        },
        applicationStatus: {
            type: String,
            enum: [
                "form_incomplete",
                "submitted",
                "under_review",
                "document_rejected",
                "interview_pending",
                "interview_completed",
                "background_check",
                "approved",
                "rejected",
                "withdrawn",
            ],
            default: "form_incomplete",
        },
        isOnline: { type: Boolean, default: false, index: true },
        onlineStatus: {
            type: String,
            enum: ["online", "offline", "busy", "on_break", "on_delivery"],
            default: "offline",
        },

        // ── Performance Metrics ──
        performance: {
            totalDeliveries: { type: Number, default: 0, index: true },
            completedDeliveries: { type: Number, default: 0 },
            cancelledDeliveries: { type: Number, default: 0 },
            failedDeliveries: { type: Number, default: 0 },

            // Ratings
            rating: { type: Number, default: 5.0, min: 1, max: 5, index: true },
            totalRatings: { type: Number, default: 0 },
            ratingBreakdown: {
                five_star: { type: Number, default: 0 },
                four_star: { type: Number, default: 0 },
                three_star: { type: Number, default: 0 },
                two_star: { type: Number, default: 0 },
                one_star: { type: Number, default: 0 },
            },

            // Completion Rates
            acceptanceRate: { type: Number, default: 100 }, // %
            completionRate: { type: Number, default: 100 }, // %
            onTimeDeliveryRate: { type: Number, default: 100 }, // %
            customerSatisfactionScore: { type: Number, default: 4.5 },

            // Earnings (moved to wallet for separation of concerns)
            todayDeliveries: { type: Number, default: 0 },
            todayEarnings: { type: Number, default: 0 },
            weekDeliveries: { type: Number, default: 0 },
            weekEarnings: { type: Number, default: 0 },
            monthDeliveries: { type: Number, default: 0 },
            monthEarnings: { type: Number, default: 0 },
        },

        // ── Active Orders ──
        activeOrders: { type: Number, default: 0, index: true },
        maxActiveOrders: { type: Number, default: 1 }, // Configurable by admin

        // ── Documents & Verification ──
        documents: {
            aadhaarPhoto: { type: String, default: null },
            licensePhoto: { type: String, default: null },
            vehicleRc: { type: String, default: null },
            selfie: { type: String, default: null },
        },
        documentStatus: {
            aadhaarPhoto: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
            licensePhoto: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
            vehicleRc: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
            selfie: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
        },
        documentNotes: {
            aadhaarPhoto: { type: String, default: "" },
            licensePhoto: { type: String, default: "" },
            vehicleRc: { type: String, default: "" },
            selfie: { type: String, default: "" },
        },

        // ── KYC Status ──
        kycStatus: {
            type: String,
            enum: ["pending", "under_review", "approved", "rejected", "expired"],
            default: "pending",
        },
        kycVerifiedAt: Date,
        kycVerifiedBy: mongoose.Schema.Types.ObjectId,

        // ── Service Pincodes ──
        servicePincodes: [{ type: String, index: true }],
        serviceZones: [mongoose.Schema.Types.ObjectId], // References to DeliveryZone

        // ── Notifications ──
        fcmToken: { type: String, default: null }, // Primary FCM token (deprecated - use device.fcmTokens)
        notificationPreferences: {
            sound: { type: Boolean, default: true },
            muted: { type: Boolean, default: false },
            push: { type: Boolean, default: true },
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            marketing: { type: Boolean, default: true },
            transactional: { type: Boolean, default: true },
        },

        // ── Penalties & Compliance ──
        penalties: [
            {
                type: String,
                reason: String,
                amount: Number,
                createdAt: Date,
                status: { type: String, enum: ["active", "waived"], default: "active" },
            },
        ],
        suspensions: [
            {
                reason: String,
                startDate: Date,
                endDate: Date,
                suspendedBy: mongoose.Schema.Types.ObjectId,
            },
        ],

        // ── Admin Management ──
        adminNote: { type: String, default: "" },
        rejectionReason: { type: String, default: "" },
        managedBy: mongoose.Schema.Types.ObjectId, // Assigned admin manager
        flags: {
            isDuplicate: { type: Boolean, default: false },
            duplicateOf: mongoose.Schema.Types.ObjectId,
            requiresManualReview: { type: Boolean, default: false },
            flagReason: String,
        },

        // ── IP & Security ──
        registrationIP: String,
        lastLoginIP: String,
        userAgent: String,
        loginAttempts: { type: Number, default: 0 },
        lockedUntil: Date,

        // ── Metadata ──
        registeredAt: { type: Date, default: Date.now },
        approvedAt: Date,
        approvedBy: mongoose.Schema.Types.ObjectId,
        rejectedAt: Date,
        rejectedBy: mongoose.Schema.Types.ObjectId,
        suspendedAt: Date,
        deactivatedAt: Date,
        lastActivityAt: Date,
        lastDeliveryAt: Date,
    },
    { timestamps: true }
);

// ── Indexes for Production Performance ──
deliveryBoySchema.index({ status: 1, isOnline: 1 });
deliveryBoySchema.index({ geoLocation: "2dsphere" });
deliveryBoySchema.index({ "performance.rating": -1, status: 1 });
deliveryBoySchema.index({ city: 1, status: 1 });
deliveryBoySchema.index({ servicePincodes: 1 });
deliveryBoySchema.index({ userId: 1 });
deliveryBoySchema.index({ phone: 1 });
deliveryBoySchema.index({ status: 1, createdAt: -1 });
deliveryBoySchema.index({ applicationStatus: 1 });
deliveryBoySchema.index({ "performance.totalDeliveries": -1 });

// ── TTL Index for auto-deletion of inactive records ──
// Users inactive for 2 years are deleted
deliveryBoySchema.index(
    { lastActivityAt: 1 },
    { expireAfterSeconds: 63072000, sparse: true } // 2 years
);

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
