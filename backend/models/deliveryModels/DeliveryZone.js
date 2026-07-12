/**
 * DeliveryZone.js — Delivery Zone & Service Area Management
 * Defines service zones, coverage areas, and delivery preferences
 */

import mongoose from "mongoose";

const deliveryZoneSchema = new mongoose.Schema(
    {
        // ── Zone Identification ──
        name: { type: String, required: true, trim: true, unique: true, index: true },
        code: { type: String, required: true, unique: true, index: true }, // e.g., "LKO_SOUTH_01"
        city: { type: String, required: true, index: true },
        district: String,
        state: String,

        // ── Geographic Coverage ──
        geometry: {
            type: {
                type: String,
                enum: ["Polygon"],
                default: "Polygon",
            },
            coordinates: {
                type: [[[Number]]], // GeoJSON format: [[[lng, lat], ...]]
            },
        },
        center: {
            latitude: Number,
            longitude: Number,
        },

        // ── Zone Details ──
        pincodes: [{ type: String, index: true }], // Pincodes in this zone
        areas: [String], // Area names/localities
        landmarks: [String],
        population: Number, // Estimated population for demand planning

        // ── Service Parameters ──
        deliveryFeatures: {
            standardDeliveryTime: { type: Number, default: 45 }, // minutes
            expressDeliveryTime: { type: Number, default: 30 }, // minutes
            maxDeliveryDistance: { type: Number, default: 5 }, // km
            baseDeliveryCharge: { type: Number, default: 40 }, // rupees
            perKmCharge: { type: Number, default: 5 }, // rupees per km
            peakHourMultiplier: { type: Number, default: 1.5 },
        },

        // ── Operating Hours ──
        operatingHours: {
            monday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            tuesday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            wednesday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            thursday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            friday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            saturday: { open: { type: String, default: "06:00" }, close: { type: String, default: "23:00" } },
            sunday: { open: { type: String, default: "07:00" }, close: { type: String, default: "22:00" } },
        },
        peakHours: [
            { start: { type: String }, end: { type: String }, name: { type: String } },
        ],

        // ── Delivery Partner Management ──
        assignedPartners: [
            {
                deliveryBoyId: mongoose.Schema.Types.ObjectId,
                assignedAt: Date,
                status: { type: String, enum: ["active", "inactive", "on_break"], default: "active" },
                preference: { type: String, enum: ["primary", "secondary"], default: "primary" },
            },
        ],
        minDeliveryPartners: { type: Number, default: 3 }, // Minimum partners needed for zone
        optimalDeliveryPartners: { type: Number, default: 5 }, // Target partners

        // ── Demand & Performance ──
        demand: {
            averageDailyOrders: { type: Number, default: 0 },
            peakDayOrders: { type: Number, default: 0 },
            averageDeliveryTime: { type: Number, default: 45 }, // minutes
            onTimeDeliveryRate: { type: Number, default: 95 }, // percentage
            customerSatisfactionScore: { type: Number, default: 4.5 }, // 1-5
        },

        // ── Zone Status ──
        status: {
            type: String,
            enum: ["active", "inactive", "suspended", "expansion_in_progress"],
            default: "active",
            index: true,
        },
        launchedAt: Date,
        suspendedAt: Date,
        suspensionReason: String,

        // ── Vendor Coverage ──
        vendors: [
            {
                vendorId: mongoose.Schema.Types.ObjectId,
                status: { type: String, enum: ["active", "inactive"], default: "active" },
                addedAt: Date,
            },
        ],

        // ── Restrictions & Rules ──
        restrictions: {
            maxOrderValue: { type: Number, default: null }, // null = no limit
            minOrderValue: { type: Number, default: 0 },
            allowedVehicleTypes: { type: [String], default: ["bicycle", "scooter", "motorcycle"] },
            allowedDeliveryMethods: { type: [String], default: ["standard", "express"] },
            specialInstructions: String,
        },

        // ── Pricing Overrides ──
        pricingOverrides: {
            baseCharge: { type: Number, default: null }, // null = use default
            perKmCharge: { type: Number, default: null },
            peakHourMultiplier: { type: Number, default: null },
        },

        // ── Performance Metrics ──
        metrics: {
            totalDeliveries: { type: Number, default: 0 },
            totalCancelledDeliveries: { type: Number, default: 0 },
            totalFailedDeliveries: { type: Number, default: 0 },
            averageDeliveryRating: { type: Number, default: 4.5 },
            lastUpdatedAt: Date,
        },

        // ── Admin Management ──
        managedBy: [mongoose.Schema.Types.ObjectId], // Admin user IDs who manage this zone
        adminNotes: String,

        // ── Coverage Map ──
        mapImage: String, // URL to zone map image
        coveragePercentage: { type: Number, default: 100 }, // % of city covered

        // ── Metadata ──
        createdBy: mongoose.Schema.Types.ObjectId,
        updatedBy: mongoose.Schema.Types.ObjectId,
    },
    { timestamps: true }
);

// Indexes
deliveryZoneSchema.index({ city: 1, status: 1 });
deliveryZoneSchema.index({ code: 1 });
deliveryZoneSchema.index({ pincodes: 1 });
deliveryZoneSchema.index({ "geometry": "2dsphere" });
deliveryZoneSchema.index({ status: 1 });

export default mongoose.model("DeliveryZone", deliveryZoneSchema);
