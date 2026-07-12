/**
 * DeliveryBoy.js — Production model
 * Fixed: Added location, totalEarnings, weekDeliveries fields
 */
import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        phone: { type: String, required: true, trim: true },
        email: { type: String, trim: true, lowercase: true },

        // ── Vehicle ──
        vehicleType: {
            type: String,
            enum: ["bicycle", "scooter", "motorcycle", "car", "other"],
            default: "motorcycle",
        },
        vehicleNumber: { type: String, trim: true, default: "" },
        vehicleModel: { type: String, trim: true, default: "" },

        // ── Status ──
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "suspended"],
            default: "pending",
            index: true,
        },
        isOnline: { type: Boolean, default: false, index: true },

        // ── Location (live GPS) ──
        location: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
            updatedAt: { type: Date, default: null },
            // Device-clock timestamp of the GPS fix itself (from
            // GeolocationPosition.timestamp), distinct from `updatedAt`
            // (server-write time) — lets the backend reject an update whose
            // underlying GPS reading is actually OLDER than one already
            // stored, even if its HTTP request happens to arrive later.
            gpsTimestamp: { type: Number, default: null },
        },

        // ── GeoJSON location for $nearSphere queries ──
        geoLocation: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },

        // ── FCM push notifications ──
        fcmToken: { type: String, default: null },
        notificationPreferences: {
            sound: { type: Boolean, default: true },
            muted: { type: Boolean, default: false },
            push: { type: Boolean, default: true },
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            marketing: { type: Boolean, default: true },
            transactional: { type: Boolean, default: true },
        },

        // ── Active orders count (for assignment engine) ──
        activeOrders: { type: Number, default: 0 },

        // ── Stats ──
        todayDeliveries: { type: Number, default: 0 },
        todayEarnings: { type: Number, default: 0 },
        weekDeliveries: { type: Number, default: 0 },
        totalDeliveries: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        rating: { type: Number, default: 5.0, min: 1, max: 5 },
        totalRatings: { type: Number, default: 0 },

        // ── Documents ──
        documents: {
            aadhaarPhoto: { type: String, default: null },
            licensePhoto: { type: String, default: null },
            vehicleRc: { type: String, default: null },
            selfie: { type: String, default: null },
        },

        // ── Per-document verification status ──
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

        // ── Bank / Payout Details ──
        bankDetails: {
            accountHolder: { type: String, trim: true, default: "" },
            accountNumber: { type: String, trim: true, default: "" },
            ifsc: { type: String, trim: true, uppercase: true, default: "" },
            bankName: { type: String, trim: true, default: "" },
            branch: { type: String, trim: true, default: "" },
            upiId: { type: String, trim: true, default: "" },
        },

        // ── Area ──
        city: { type: String, trim: true, default: "" },
        servicePincodes: [{ type: String }],

        // ── Admin ──
        adminNote: { type: String, default: "" },
        rejectionReason: { type: String, default: "" },
    },
    { timestamps: true }
);

deliveryBoySchema.index({ status: 1, isOnline: 1 });
deliveryBoySchema.index({ geoLocation: "2dsphere" });

export default mongoose.model("DeliveryBoy", deliveryBoySchema);
