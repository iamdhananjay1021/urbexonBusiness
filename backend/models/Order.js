/**
 * Order.js — Complete Production Schema
 * ✅ Payment logs (every event tracked)
 * ✅ Fraud detection fields (ip, flagged, flagReasons)
 * ✅ Full refund lifecycle (NONE→REQUESTED→PROCESSING→PROCESSED/FAILED/REJECTED)
 * ✅ Return system (7-day window, images, admin notes)
 * ✅ Shipping (Shiprocket AWB, courier, tracking)
 * ✅ Status timeline
 * ✅ selectedSize per item
 */

import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        /* ── ORDER MODE (MAIN ecommerce vs URBEXON_HOUR) ── */
        orderMode: {
            type: String,
            enum: ["ECOMMERCE", "URBEXON_HOUR"],
            default: "ECOMMERCE",
            index: true,
        },

        /* ── VENDOR (for URBEXON_HOUR orders) ── */
        vendorId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Vendor",
            default: null,
            index: true,
        },

        /* ── COUPON ── */
        coupon: {
            code: { type: String, default: "" },
            discount: { type: Number, default: 0 },
        },

        invoiceNumber: {
            type: String,
            unique: true,
            sparse: true,
        },

        /* ── ORDER ITEMS ── */
        items: [
            {
                productId: mongoose.Schema.Types.ObjectId,
                name: String,
                price: Number,
                qty: Number,
                image: String,
                selectedSize: { type: String, default: "" },
                hsnCode: { type: String, default: "91059990" },
                gstPercent: { type: Number, default: 0 },
                customization: {
                    text: { type: String, default: "" },
                    imageUrl: { type: String, default: "" },
                    note: { type: String, default: "" },
                },
            },
        ],

        /* ── CUSTOMER ── */
        customerName: String,
        phone: String,
        address: String,
        email: String,
        totalAmount: Number,
        platformFee: { type: Number, default: 0 },
        deliveryCharge: { type: Number, default: 0 },
        /* ── DELIVERY OTP (4-digit, for confirmed delivery) ── */
        deliveryOtp: {
            code: { type: String, default: null, select: false },
            expiresAt: { type: Date, default: null },
            verified: { type: Boolean, default: false },
        },

        delivery: {
            type: {
                type: String,
                enum: ["ECOMMERCE_STANDARD", "URBEXON_HOUR"],
                default: "ECOMMERCE_STANDARD",
            },
            distanceKm: { type: Number, default: 0 },
            provider: {
                type: String,
                enum: ["SHIPROCKET", "LOCAL_RIDER", "VENDOR_SELF"],
                default: "SHIPROCKET",
            },
            assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", default: null },
            riderName: { type: String, default: "" },
            riderPhone: { type: String, default: "" },
            note: { type: String, default: "" },
            assignedAt: { type: Date, default: null },
            pickedUpAt: { type: Date, default: null },
            eta: { type: String, default: "3–5 Business Days" },
            // ── Assignment engine fields ──
            status: {
                type: String,
                enum: [
                    "PENDING", "SEARCHING_RIDER", "ASSIGNED", "ARRIVING_VENDOR",
                    "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED",
                ],
                default: "PENDING",
            },
            assignmentAttempts: { type: Number, default: 0 },
            rejectedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy" }],
        },
        // ── Live rider location for this order (GeoJSON) ──
        deliveryLocation: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },
        latitude: Number,
        longitude: Number,
        cancellationReason: { type: String, default: "" },

        /* ── PAYMENT ── */
        payment: {
            method: {
                type: String,
                enum: ["RAZORPAY", "COD"],
                default: "COD",
            },
            status: {
                type: String,
                // PAID → COD on delivery or Razorpay captured
                // REFUNDED → after successful Razorpay refund
                enum: ["PENDING", "PAID", "FAILED", "REFUNDED"],
                default: "PENDING",
            },
            razorpayOrderId: { type: String },
            razorpayPaymentId: { type: String },
            paidAt: { type: Date },

            // Fraud detection fields
            ip: { type: String, default: "" },
            userAgent: { type: String, default: "" },
            flagged: { type: Boolean, default: false },
            flagReasons: [{ type: String }],
        },

        /* ── PAYMENT EVENT LOG ── */
        // Append-only log: ORDER_PLACED, PAYMENT_VERIFIED, REFUND_REQUESTED,
        // REFUND_PROCESSING, REFUND_PROCESSED, REFUND_FAILED, REFUND_REJECTED
        paymentLogs: [
            {
                event: { type: String },
                amount: { type: Number },
                method: { type: String },
                paymentId: { type: String },
                ip: { type: String },
                userAgent: { type: String },
                meta: { type: mongoose.Schema.Types.Mixed },
                at: { type: Date, default: Date.now },
            },
        ],

        /* ── REFUND ── */
        refund: {
            status: {
                type: String,
                // Flow:
                //   NONE → REQUESTED (user requests)
                //   REQUESTED → PROCESSING (admin approves, Razorpay call in progress)
                //   PROCESSING → PROCESSED (Razorpay success)
                //   PROCESSING → FAILED    (Razorpay error — admin can retry)
                //   REQUESTED → REJECTED   (admin rejects)
                enum: ["NONE", "REQUESTED", "PROCESSING", "PROCESSED", "FAILED", "REJECTED"],
                default: "NONE",
            },
            requested: { type: Boolean, default: false },   // convenience flag for older queries
            reason: { type: String, default: "" },
            amount: { type: Number, default: 0 },
            requestedAt: { type: Date },
            processedAt: { type: Date },
            rejectedAt: { type: Date },
            rejectionReason: { type: String, default: "" },
            adminNote: { type: String, default: "" },
            razorpayRefundId: { type: String, default: "" },
            processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        },

        /* ── RETURN (7-day window) ── */
        return: {
            status: {
                type: String,
                enum: ["NONE", "REQUESTED", "APPROVED", "REJECTED", "PICKED_UP", "REFUNDED"],
                default: "NONE",
            },
            requested: { type: Boolean, default: false },
            reason: { type: String, default: "" },
            images: [{ type: String }],
            requestedAt: { type: Date },
            deadlineAt: { type: Date },
            processedAt: { type: Date },
            processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            refundAmount: { type: Number, default: 0 },
            adminNote: { type: String, default: "" },
        },

        /* ── ORDER STATUS ── */
        orderStatus: {
            type: String,
            enum: [
                "PLACED",
                "CONFIRMED",
                "PACKED",
                "READY_FOR_PICKUP",
                "SHIPPED",
                "OUT_FOR_DELIVERY",
                "DELIVERED",
                "CANCELLED",
                "RETURN_REQUESTED",
                "RETURN_APPROVED",
            ],
            default: "PLACED",
        },

        /* ── SHIPPING (Shiprocket) ── */
        shipping: {
            shipmentId: { type: String, default: "" },
            awbCode: { type: String, default: "" },
            courierName: { type: String, default: "" },
            trackingUrl: { type: String, default: "" },
            labelUrl: { type: String, default: "" },
            status: { type: String, default: "" },
            mock: { type: Boolean, default: false },
            autoCreated: { type: Boolean, default: false },
            createdAt: { type: Date },
        },

        /* ── TIMELINE ── */
        statusTimeline: {
            placedAt: { type: Date, default: Date.now },
            confirmedAt: Date,
            packedAt: Date,
            readyForPickupAt: Date,
            pickedUpAt: Date,
            shippedAt: Date,
            outForDeliveryAt: Date,
            deliveredAt: Date,
            cancelledAt: Date,
            returnRequestedAt: Date,
        },
    },
    { timestamps: true }
);

/* ─────────────────────────────────────────────
   INDEXES for fast admin queries
───────────────────────────────────────────── */
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderMode: 1, createdAt: -1 });
orderSchema.index({ vendorId: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ "refund.status": 1 });
orderSchema.index({ "return.status": 1 });
orderSchema.index({ "payment.flagged": 1 });
orderSchema.index({ "payment.razorpayPaymentId": 1 }, { sparse: true });
orderSchema.index({ "delivery.assignedTo": 1 }, { sparse: true });
orderSchema.index({ "delivery.status": 1 });

/* ─────────────────────────────────────────────
   INVOICE NUMBER GENERATOR
   Format: INV-2026-03-00001
   Auto-increments per month, resets each month
───────────────────────────────────────────── */
export const generateInvoiceNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const startOfMonth = new Date(year, now.getMonth(), 1);
    const count = await mongoose.model("Order").countDocuments({
        createdAt: { $gte: startOfMonth },
    });
    return `INV-${year}-${month}-${String(count + 1).padStart(5, "0")}`;
};

export default mongoose.model("Order", orderSchema);
