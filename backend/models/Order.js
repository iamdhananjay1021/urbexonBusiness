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
            // Additive — old orders simply lack this. couponEngine.js's
            // unmarkCouponUsage/cancellation-reversal path prefers this when
            // present (unambiguous) and falls back to the code+user lookup
            // for pre-migration orders that don't have it, exactly as
            // cancellation rollback already worked before this field existed.
            couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
        },

        invoiceNumber: {
            type: String,
            unique: true,
            sparse: true,
        },

        /* ── ORDER ITEMS ── */
        items: [
            {
                productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
                name: String,
                price: Number,
                qty: Number,
                image: String,
                selectedSize: { type: String, default: "" },
                selectedColor: { type: String, default: "" },
                hsnCode: { type: String, default: "91059990" },
                gstPercent: { type: Number, default: 0 },
                customization: {
                    text: { type: String, default: "" },
                    imageUrl: { type: String, default: "" },
                    note: { type: String, default: "" },
                },
                /* ── Policy snapshot (copied from product at order time) ── */
                policy: {
                    isCancellable: { type: Boolean, default: true },
                    isReturnable: { type: Boolean, default: true },
                    isReplaceable: { type: Boolean, default: false },
                    returnWindow: { type: Number, default: 7 },
                    replacementWindow: { type: Number, default: 7 },
                    cancelWindow: { type: Number, default: 0 },
                    nonReturnableReason: { type: String, default: "" },
                    // Snapshotted from Product at order time (pricing.js) —
                    // same immutability guarantee as the fields above: a
                    // later product-policy edit never changes what applies
                    // to an already-placed order.
                    returnConditions: { type: [String], default: ["damaged", "wrong_product", "defective"] },
                    packagingRequired: { type: Boolean, default: false },
                    tagsRequired: { type: Boolean, default: false },
                    returnMethod: { type: String, default: "self_ship" },
                },
            },
        ],

        /* ── CUSTOMER ── */
        customerName: String,
        phone: String,
        address: String,
        email: String,
        /* ── Structured address for Shiprocket ── */
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "" },
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
            // BUG FIX: missing on this subdocument even though the sibling
            // `replacement` subdocument below has the identical field —
            // processReturn accepts a trackingUrl for the return pickup but,
            // same strict-mode issue as stockRestored, it was silently
            // dropped on every save and never actually persisted.
            trackingUrl: { type: String, default: "" },
            // BUG FIX: this path didn't exist on the schema before — under
            // Mongoose's default strict mode, both order.save() and
            // findByIdAndUpdate() silently drop writes to undeclared nested
            // paths. processReturn's "restore stock exactly once" guard
            // read/wrote this flag but it could never actually persist as
            // true, so a return that goes APPROVED→PICKED_UP→REFUNDED (stock
            // restore is triggered on both the "pickup" and "refund" actions)
            // silently double-restored stock on every such return.
            stockRestored: { type: Boolean, default: false },
        },

        /* ── REPLACEMENT ── */
        replacement: {
            status: {
                type: String,
                enum: ["NONE", "REQUESTED", "APPROVED", "REJECTED", "SHIPPED", "DELIVERED"],
                default: "NONE",
            },
            reason: { type: String, default: "" },
            images: [{ type: String }],
            requestedAt: { type: Date },
            processedAt: { type: Date },
            processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            adminNote: { type: String, default: "" },
            trackingUrl: { type: String, default: "" },
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
                "REPLACEMENT_REQUESTED",
                "REPLACEMENT_APPROVED",
            ],
            default: "PLACED",
        },

        // [FIX] Backing fields for jobs/databaseJobs.js::archiveOldOrders —
        // previously unset by any schema path, so Mongoose's default strict
        // mode silently dropped both fields on every updateMany() the job
        // ran, on top of the job also querying the wrong field name.
        isArchived: { type: Boolean, default: false },
        archivedAt: { type: Date, default: null },

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

        // Append-only, fully-auditable event log. Every status transition
        // through orderEngine.js's applyOrderTransition() pushes one entry
        // here with who/what/why/where — older entries predating this
        // (actor/role/source/location/reason all optional) simply have
        // those fields empty, which is fine since nothing reads them as
        // required.
        timeline: {
            type: [
                {
                    status: { type: String, default: "" },
                    timestamp: { type: Date, default: Date.now },
                    note: { type: String, default: "" },
                    // ── Audit fields (orderEngine.js) ──
                    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
                    role: { type: String, default: "" }, // customer | vendor | delivery | admin | system
                    source: { type: String, default: "" }, // api | webhook | assignment_engine | cron | admin_panel
                    reason: { type: String, default: "" },
                    location: {
                        lat: { type: Number, default: null },
                        lng: { type: Number, default: null },
                    },
                },
            ],
            default: [],
        },

        /* ── VENDOR REVIEW (Urbexon Hour orders only, post-delivery) ──
           BUG FIX: jobs/sellerJobs.js's updateVendorRatings() has always
           aggregated `Order.review.rating` to compute Vendor.rating, but
           this field was never declared on the schema (same class of bug
           as the missing User.refreshToken fields) — nothing could ever
           write it, so the aggregation always matched zero orders and
           vendor ratings never actually updated from real customer input. */
        review: {
            rating: { type: Number, min: 1, max: 5, default: null },
            comment: { type: String, trim: true, maxlength: 500, default: "" },
            createdAt: { type: Date, default: null },
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
orderSchema.index({ "replacement.status": 1 });
orderSchema.index({ "payment.flagged": 1 });
orderSchema.index({ "payment.razorpayPaymentId": 1 }, { sparse: true });
orderSchema.index({ "delivery.assignedTo": 1 }, { sparse: true });
orderSchema.index({ "delivery.status": 1 });
// Compound indexes for the queries the Order Engine's transition guard and
// admin/vendor listing screens filter on together constantly.
orderSchema.index({ orderMode: 1, orderStatus: 1 });
orderSchema.index({ orderStatus: 1, "delivery.status": 1 });
// [FIX] The single most common vendor-scoping query in the app
// ({"items.productId": {$in: vendorProductIds}} — vendorOrders.js,
// vendorEarnings.js, vendorReturnController.js, vendorReviewController.js)
// had no supporting index and was a full collection scan on every vendor
// dashboard/earnings/returns load.
orderSchema.index({ "items.productId": 1, createdAt: -1 });

/* ─────────────────────────────────────────────
   INVOICE NUMBER GENERATOR
   Format: INV-2026-03-00001
   Uses atomic findOneAndUpdate counter to avoid race conditions
───────────────────────────────────────────── */
const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 0 },
});
const InvoiceCounter = mongoose.model("InvoiceCounter", counterSchema);

export const generateInvoiceNumber = async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = `INV-${year}-${month}`;
    const counterId = prefix;

    // Sync counter with actual max invoice number in DB (first call / drift protection)
    const Order = mongoose.model("Order");
    const latest = await Order.findOne(
        { invoiceNumber: { $regex: `^${prefix}-` } },
        { invoiceNumber: 1 },
        { sort: { invoiceNumber: -1 } }
    ).lean();

    if (latest) {
        const existingSeq = parseInt(latest.invoiceNumber.split("-").pop(), 10) || 0;
        // Ensure counter is at least as high as existing max (no upsert — only update existing)
        await InvoiceCounter.updateOne(
            { _id: counterId, seq: { $lt: existingSeq } },
            { $set: { seq: existingSeq } }
        );
    }

    // Atomic increment
    const counter = await InvoiceCounter.findOneAndUpdate(
        { _id: counterId },
        { $inc: { seq: 1 } },
        { upsert: true, new: true }
    );
    return `${prefix}-${String(counter.seq).padStart(5, "0")}`;
};

export default mongoose.model("Order", orderSchema);
