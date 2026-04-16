import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema(
    {
        // ── Linked User ──────────────────────────────────────
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },

        // ── Shop Info ────────────────────────────────────────
        shopName: {
            type: String,
            required: [true, "Shop name is required"],
            trim: true,
            maxlength: [100, "Shop name max 100 chars"],
        },
        shopDescription: { type: String, trim: true, maxlength: 1000 },
        shopSlug: { type: String, unique: true, lowercase: true, index: true },
        shopLogo: { type: String, default: null },      // Cloudinary URL
        shopBanner: { type: String, default: null },    // Cloudinary URL
        shopCategory: { type: String, trim: true },

        // ── Owner Info ───────────────────────────────────────
        ownerName: {
            type: String,
            required: [true, "Owner name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            lowercase: true,
            trim: true,
        },
        phone: {
            type: String,
            required: [true, "Phone is required"],
            trim: true,
        },
        whatsapp: { type: String, trim: true },
        alternatePhone: { type: String, trim: true },

        // ── Business Details ─────────────────────────────────
        gstNumber: { type: String, trim: true, uppercase: true },
        panNumber: { type: String, trim: true, uppercase: true },
        businessType: {
            type: String,
            enum: ["individual", "partnership", "pvtltd", "proprietorship"],
            default: "individual",
        },

        // ── Bank Details ─────────────────────────────────────
        bankDetails: {
            accountHolder: { type: String, trim: true },
            accountNumber: { type: String, trim: true },
            ifsc: { type: String, trim: true, uppercase: true },
            bankName: { type: String, trim: true },
            branch: { type: String, trim: true },
            upiId: { type: String, trim: true },
        },

        // ── Address ──────────────────────────────────────────
        address: {
            line1: { type: String, trim: true },
            line2: { type: String, trim: true },
            city: { type: String, trim: true },
            state: { type: String, trim: true },
            pincode: { type: String, trim: true },
            landmark: { type: String, trim: true },
        },

        // ── Service Area ─────────────────────────────────────
        servicePincodes: [{ type: String, trim: true }],
        deliveryRadius: { type: Number, default: 5 }, // km

        // ── Documents ────────────────────────────────────────
        documents: {
            gstCertificate: { type: String, default: null },
            panCard: { type: String, default: null },
            shopPhoto: { type: String, default: null },
            ownerPhoto: { type: String, default: null },
            cancelledCheque: { type: String, default: null },
            addressProof: { type: String, default: null },
        },

        // ── Status ───────────────────────────────────────────
        status: {
            type: String,
            enum: ["pending", "under_review", "approved", "rejected", "suspended"],
            default: "pending",
            index: true,
        },
        rejectionReason: { type: String, default: null },
        adminNote: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
            default: null,
        },

        // ── Subscription ─────────────────────────────────────
        subscription: {
            plan: {
                type: String,
                enum: ["starter", "basic", "standard", "premium"],
                default: "basic",
            },
            startDate: { type: Date, default: null },
            expiryDate: { type: Date, default: null },
            isActive: { type: Boolean, default: false },
            autoRenew: { type: Boolean, default: false },
            transactionId: { type: String, default: null },
        },

        // ── Commission ───────────────────────────────────────
        commissionRate: { type: Number, default: 18, min: 0, max: 50 },
        commissionOverride: { type: Boolean, default: false },

        // ── Delivery Settings ────────────────────────────────
        deliveryMode: {
            type: String,
            enum: ["self", "platform", "both"],
            default: "both",
        },
        deliveryChargePerKm: { type: Number, default: 0 },
        freeDeliveryAbove: { type: Number, default: 0 },

        // ── Shop Settings ────────────────────────────────────
        isOpen: { type: Boolean, default: true },
        acceptingOrders: { type: Boolean, default: true },
        minOrderAmount: { type: Number, default: 0 },
        maxOrderAmount: { type: Number, default: 0 },
        preparationTime: { type: Number, default: 30 }, // minutes

        // ── Stats (denormalized for speed) ───────────────────
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        pendingSettlement: { type: Number, default: 0 },
        rating: { type: Number, default: 0, min: 0, max: 5 },
        ratingCount: { type: Number, default: 0 },

        // ── Soft Delete ──────────────────────────────────────
        isDeleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ── Indexes ──────────────────────────────────────────────────
vendorSchema.index({ userId: 1 });
vendorSchema.index({ status: 1, isDeleted: 1 });
vendorSchema.index({ servicePincodes: 1 });
vendorSchema.index({ "subscription.expiryDate": 1 });

// ── Virtual: subscription expired? ───────────────────────────
vendorSchema.virtual("isSubscriptionExpired").get(function () {
    if (!this.subscription?.expiryDate) return true;
    return new Date() > new Date(this.subscription.expiryDate);
});

// ── Pre-save: auto generate slug ─────────────────────────────
vendorSchema.pre("save", function (next) {
    if (this.isModified("shopName") && !this.shopSlug) {
        this.shopSlug =
            this.shopName
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-")
                .replace(/-+/g, "-") +
            "-" +
            Date.now().toString(36);
    }
    next();
});

// ── Static: find active vendors for a pincode ────────────────
vendorSchema.statics.findActiveForPincode = function (pincode) {
    return this.find({
        servicePincodes: pincode,
        status: "approved",
        isOpen: true,
        acceptingOrders: true,
        isDeleted: false,
        "subscription.isActive": true,
        "subscription.expiryDate": { $gt: new Date() },
    }).select("shopName shopLogo shopCategory rating totalOrders preparationTime deliveryMode");
};

const Vendor = mongoose.model("Vendor", vendorSchema);
export default Vendor;
