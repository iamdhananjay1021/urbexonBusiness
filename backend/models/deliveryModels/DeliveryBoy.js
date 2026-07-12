/**
 * DeliveryBoy.js — Production Delivery Partner Model
 *
 * FIX: Reverted from a nested (vehicle{}/address{}/performance{}) schema
 * that was migrated in isolation and broke every other call site still
 * reading/writing flat fields — assignmentEngine.js (rider.location,
 * rider.activeOrders, rider.geoLocation), deliveryController.js earnings
 * functions (db.todayDeliveries, db.totalEarnings, db.rating), and
 * vendorApproval.js (getOnlineRiders' .select()) all assume flat paths.
 * This schema restores that flat shape (confirmed against production data)
 * and ADDS the fields the registration form already collects but the old
 * schema/controller silently dropped: email, dateOfBirth, gender, full
 * address, and emergency contact.
 */
import mongoose from "mongoose";

const deliveryBoySchema = new mongoose.Schema(
    {
        // ── User Reference ──
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

        // ── Personal Information ──
        name: { type: String, required: true, trim: true, maxlength: 100 },
        phone: { type: String, required: true, trim: true, unique: true, index: true },
        email: { type: String, trim: true, lowercase: true, default: "" },
        dateOfBirth: { type: Date, default: null },
        gender: { type: String, enum: ["male", "female", "other", null], default: null },

        // ── Vehicle Information ──
        vehicleType: {
            type: String,
            enum: ["bicycle", "scooter", "motorcycle", "car", "other"],
            default: "bicycle",
            index: true,
        },
        vehicleNumber: { type: String, default: "" },
        vehicleModel: { type: String, default: "" },

        // ── Registered / Home Address ──
        houseNumber: { type: String, default: "" },
        landmark: { type: String, default: "" },
        area: { type: String, default: "" },
        city: { type: String, default: "", index: true },
        district: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "", index: true },
        // Captured once at registration (rider's base address) — distinct
        // from `location`/`geoLocation` below, which track LIVE GPS while
        // the rider is online/on a delivery.
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },

        // ── Emergency Contact ──
        emergencyContactName: { type: String, default: "" },
        emergencyContactPhone: { type: String, default: "" },

        // ── Bank & Payment Details ──
        bankDetails: {
            accountHolder: { type: String, trim: true, default: "" },
            accountNumber: { type: String, trim: true, default: "" },
            ifsc: { type: String, trim: true, uppercase: true, default: "" },
            bankName: { type: String, trim: true, default: "" },
            branch: { type: String, trim: true, default: "" },
            upiId: { type: String, trim: true, default: "" },
        },

        // ── Live Location & Tracking (updated continuously while online) ──
        location: {
            lat: { type: Number, default: null },
            lng: { type: Number, default: null },
            updatedAt: { type: Date, default: null },
            gpsTimestamp: { type: Number, default: null },
        },
        geoLocation: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] },
        },

        // ── Status ──
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "suspended"],
            default: "pending",
            index: true,
        },
        isOnline: { type: Boolean, default: false, index: true },

        // ── Performance / Earnings (flat — matches assignmentEngine.js,
        //     deliveryController.js earnings calculations, and every
        //     existing $inc call site) ──
        activeOrders: { type: Number, default: 0, index: true },
        todayDeliveries: { type: Number, default: 0 },
        todayEarnings: { type: Number, default: 0 },
        weekDeliveries: { type: Number, default: 0 },
        weekEarnings: { type: Number, default: 0 },
        totalDeliveries: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        rating: { type: Number, default: 5, min: 1, max: 5 },
        totalRatings: { type: Number, default: 0 },
        acceptanceRate: { type: Number, default: 100 },

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

        // ── Service Area ──
        servicePincodes: [{ type: String, index: true }],

        // ── Notifications ──
        fcmToken: { type: String, default: null },

        // ── Admin Management ──
        adminNote: { type: String, default: "" },
        rejectionReason: { type: String, default: "" },
    },
    { timestamps: true }
);

// ── Indexes ──
deliveryBoySchema.index({ status: 1, isOnline: 1 });
deliveryBoySchema.index({ geoLocation: "2dsphere" });
deliveryBoySchema.index({ rating: -1, status: 1 });
deliveryBoySchema.index({ city: 1, status: 1 });
deliveryBoySchema.index({ servicePincodes: 1 });
deliveryBoySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("DeliveryBoy", deliveryBoySchema);