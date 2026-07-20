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
        // ✅ NEW: Profile.jsx (frontend) already had a Website input field and
        // sent it on every save, but this field never existed on the schema
        // — updateMyProfile's whitelist also never included it — so the
        // value was silently dropped on every save. Added here + whitelisted
        // in updateMyProfile.js so it now actually persists.
        website: { type: String, trim: true },

        // ── Business Details ─────────────────────────────────
        // [FIX] No uniqueness constraint existed at all — multiple vendor
        // accounts could register with an identical GST/PAN, undermining
        // the identity guarantee these fields are meant to provide.
        // vendorAuth.js's registration defaults both to "" (not undefined)
        // when a vendor skips them — a plain `sparse` index does NOT skip
        // empty strings, only genuinely-missing fields, so it would have
        // broken registration for every GST-less vendor after the first.
        // A partial filter on non-empty values is the correct guard here
        // (same pattern as Product.sku's index just below).
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

        // ── Location (GeoJSON for nearby queries) ─────────────
        location: {
            type: { type: String, enum: ["Point"], default: "Point" },
            coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
        },

        // ── Service Area ─────────────────────────────────────
        servicePincodes: [{ type: String, trim: true }],
        deliveryRadius: { type: Number, default: 5, min: 1, max: 50 }, // km

        // ── Documents ────────────────────────────────────────
        documents: {
            gstCertificate: { type: String, default: null },
            panCard: { type: String, default: null },
            shopPhoto: { type: String, default: null },
            ownerPhoto: { type: String, default: null },
            cancelledCheque: { type: String, default: null },
            addressProof: { type: String, default: null },
        },

        // KYC verification lifecycle — direct structural mirror of
        // DeliveryBoy.js's documentStatus/documentNotes (same pattern,
        // already proven in production for delivery riders). Re-upload
        // (venderProfile.js::reuploadKycDocument) resets a key back to
        // "pending"; admin review (vendorApproval.js::updateVendorDocStatus)
        // sets "verified"/"rejected" + an optional reviewer note.
        documentStatus: {
            gstCertificate: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            panCard: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            shopPhoto: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            ownerPhoto: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            cancelledCheque: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
            addressProof: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" },
        },
        documentNotes: {
            gstCertificate: { type: String, default: "" },
            panCard: { type: String, default: "" },
            shopPhoto: { type: String, default: "" },
            ownerPhoto: { type: String, default: "" },
            cancelledCheque: { type: String, default: "" },
            addressProof: { type: String, default: "" },
        },

        // ── Status ───────────────────────────────────────────
        // [FIX] Standalone `index: true` removed — the compound
        // vendorSchema.index({status:1, isDeleted:1}) below already covers
        // any query that filters on status alone (status is its prefix
        // field), so the standalone index was pure redundant overhead.
        status: {
            type: String,
            enum: ["pending", "under_review", "approved", "rejected", "suspended"],
            default: "pending",
        },
        rejectionReason: { type: String, default: null },
        adminNote: { type: String, default: null },
        approvedAt: { type: Date, default: null },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
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

        // ── Push notification token — additive; no client registration
        // flow exists yet, ready for notificationEngine.js to use once one does. ──
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

        // ── Stats (denormalized for speed) ───────────────────
        totalOrders: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        pendingSettlement: { type: Number, default: 0 },

        // ── Wallet Ledger (approved design) ───────────────────
        // Materialized cache of VendorWalletTransaction's running sum —
        // the Immutable Ledger + Calculated Balance strategy (Step 3).
        // Reconstructable at any time by summing the ledger; the
        // reconciliation job (sellerJobs.js::reconcileVendorWallets)
        // checks the two never drift, without ever auto-correcting.
        // Distinct from totalEarnings above: totalEarnings is a
        // historical lifetime-paid counter that only ever grows;
        // walletBalance is the vendor's actual current spendable
        // balance (goes up on credit, down on withdrawal/adjustment).
        walletBalance: { type: Number, default: 0 },

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
// [FIX] userId already gets a unique index from `unique: true` on the
// field itself above — the duplicate `.index({userId:1})` created a
// second, redundant index on the same field.
vendorSchema.index({ status: 1, isDeleted: 1 });
vendorSchema.index({ servicePincodes: 1 });
vendorSchema.index({ "subscription.expiryDate": 1 });
vendorSchema.index({ location: "2dsphere" });
vendorSchema.index({ gstNumber: 1 }, { unique: true, partialFilterExpression: { gstNumber: { $gt: "" } } });
vendorSchema.index({ panNumber: 1 }, { unique: true, partialFilterExpression: { panNumber: { $gt: "" } } });

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
    const now = new Date();
    return this.find({
        servicePincodes: pincode,
        status: "approved",
        isOpen: true,
        acceptingOrders: true,
        isDeleted: false,
        "subscription.isActive": true,
        "subscription.expiryDate": { $gt: now },
    }).select("shopName shopLogo shopCategory rating totalOrders preparationTime deliveryMode");
};

// ── Static: find nearby vendors by geo (maxDist in meters) ───
vendorSchema.statics.findNearby = function (lng, lat, maxDistMeters = 10000, { category, limit = 30 } = {}) {
    const now = new Date();
    const filter = {
        location: {
            $nearSphere: {
                $geometry: { type: "Point", coordinates: [lng, lat] },
                $maxDistance: maxDistMeters,
            },
        },
        status: "approved",
        isOpen: true,
        acceptingOrders: true,
        isDeleted: false,
        "location.coordinates": { $ne: [0, 0] },
        "subscription.isActive": true,
        "subscription.expiryDate": { $gt: now },
    };
    if (category) filter.shopCategory = category;
    return this.find(filter)
        .limit(limit)
        .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove");
};

const Vendor = mongoose.model("Vendor", vendorSchema);
export default Vendor;