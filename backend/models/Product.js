/**
 * Product.js — Production model v2.1
 * productType: "ecommerce" (admin) | "urbexon_hour" (vendor)
 *
 * CHANGES v2.1:
 * - colorVariants: Mixed → properly typed schema
 *   Each variant now has: name, hex, price (optional override), stock, images
 * - colorVariants are now queryable / indexable
 */
import mongoose from "mongoose";
import slugify from "slugify";

const imageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    alt: { type: String, default: "" },
}, { _id: false });

/* ── Color Variant Sub-Schema ────────────────────────────── */
const colorVariantSchema = new mongoose.Schema({
    name: { type: String, trim: true, default: "" },        // "Navy Blue", "Crimson Red"
    hex: { type: String, default: "#000000" },              // "#1a1a2e"
    price: { type: Number, default: null, min: 0 },         // null = use product base price
    mrp: { type: Number, default: null, min: 0 },           // null = use product base mrp
    stock: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
    images: { type: [imageSchema], default: [] },
}, { _id: false });

const productSchema = new mongoose.Schema({
    // ── Core ──────────────────────────────────────────────
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, lowercase: true, index: true },
    description: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    cost: { type: Number, default: 0, select: false },

    // ── Classification ────────────────────────────────────
    category: { type: String, trim: true, index: true },
    subcategory: { type: String, trim: true, default: "" },
    brand: { type: String, trim: true, default: "" },
    sku: { type: String, trim: true, default: "" },
    tags: [{ type: String, trim: true }],

    // ── Physical ──────────────────────────────────────────
    weight: { type: String, default: "" },
    color: { type: String, default: "" },
    material: { type: String, default: "" },
    occasion: { type: String, default: "" },
    origin: { type: String, default: "" },
    sizes: [
        {
            size: { type: String, required: true },
            stock: { type: Number, default: 0 }
        }
    ],

    // ── Business ──────────────────────────────────────────
    returnPolicy: { type: String, default: "7 days return" },
    shippingInfo: { type: String, default: "" },
    gstPercent: { type: Number, default: 0 },
    hsn: { type: String, trim: true, default: "" },
    barcode: { type: String, trim: true, default: "" },
    lowStockThreshold: { type: Number, default: 5, min: 0 },

    // ── SEO (admin-editable; falls back to name/description) ──
    seo: {
        metaTitle: { type: String, trim: true, default: "", maxlength: 120 },
        metaDescription: { type: String, trim: true, default: "", maxlength: 200 },
    },

    // ── Shipping package (for courier rate calculation) ───
    shipping: {
        lengthCm: { type: Number, default: 0, min: 0 },
        widthCm: { type: Number, default: 0, min: 0 },
        heightCm: { type: Number, default: 0, min: 0 },
    },

    // ── Cancellation / Return / Replacement Policy ────────
    isCancellable: { type: Boolean, default: true },
    isReturnable: { type: Boolean, default: true },
    isReplaceable: { type: Boolean, default: false },
    returnWindow: { type: Number, default: 7, min: 0, max: 30 },
    replacementWindow: { type: Number, default: 7, min: 0, max: 30 },
    cancelWindow: { type: Number, default: 0, min: 0, max: 72 },
    nonReturnableReason: { type: String, default: "" },
    // ── Return conditions — vendor selects within the admin-configured
    // marketplace master list (DeliveryConfig.productPolicyLimits.
    // allowedReturnConditions), clamped/filtered server-side in
    // productController.js via config/deliveryConfig.js::clampProductPolicy ──
    returnConditions: {
        type: [{ type: String, enum: ["damaged", "wrong_product", "defective", "missing_items", "other"] }],
        default: ["damaged", "wrong_product", "defective"],
    },
    packagingRequired: { type: Boolean, default: false },
    tagsRequired: { type: Boolean, default: false },
    returnMethod: { type: String, enum: ["self_ship", "pickup"], default: "self_ship" },
    isCustomizable: { type: Boolean, default: false },
    customizationConfig: {
        allowText: { type: Boolean, default: true },
        allowImage: { type: Boolean, default: true },
        allowNote: { type: Boolean, default: true },
        textLabel: { type: String, default: "Name / Message", trim: true },
        textPlaceholder: { type: String, default: "", trim: true },
        textMaxLength: { type: Number, default: 100, min: 1, max: 500 },
        imageLabel: { type: String, default: "Upload Design", trim: true },
        noteLabel: { type: String, default: "Special Instructions", trim: true },
        notePlaceholder: { type: String, default: "", trim: true },
        extraPrice: { type: Number, default: 0, min: 0 },
    },
    // ── Dynamic filter attributes ─────────────────────────
    // Free-form key→value pairs ("fabric": "Cotton", "fit": "Slim",
    // "ram": "8 GB", …). Admin/vendor panels can introduce ANY new
    // attribute without a schema change — GET /products/filters
    // aggregates whatever keys exist into facets automatically.
    attributes: { type: Map, of: String, default: {} },

    highlights: { type: Map, of: String, default: {} },
    highlightsArray: {
        type: [
            {
                title: { type: String, required: true, trim: true },
                value: { type: String, required: true, trim: true },
            },
        ],
        default: [],
    },

    // ── Images ────────────────────────────────────────────
    images: { type: [imageSchema], default: [] },

    // ── Color Variants ────────────────────────────────────
    // v2.1: Properly typed (was Mixed). Each variant has its own
    // price/stock/images. price=null means "use product base price".
    colorVariants: { type: [colorVariantSchema], default: [] },

    // ── Stock ─────────────────────────────────────────────
    // Base stock (used when no colorVariants, or as fallback)
    stock: { type: Number, default: 0, min: 0 },
    inStock: { type: Boolean, default: false, index: true },

    // ── Status ────────────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isDeal: { type: Boolean, default: false, index: true },
    dealStartsAt: { type: Date, default: null },
    dealEndsAt: { type: Date, default: null },
    dealPriority: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },

    // ── Analytics ─────────────────────────────────────────
    views: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },

    // ── Ratings ───────────────────────────────────────────
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },

    // ── Type separation ───────────────────────────────────
    productType: {
        type: String,
        enum: ["ecommerce", "urbexon_hour"],
        default: "ecommerce",
        index: true,
    },
    vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Vendor",
        default: null,
        index: true,
    },

    // ── Urbexon Hour specific ─────────────────────────────
    prepTimeMinutes: { type: Number, default: 10 },
    maxOrderQty: { type: Number, default: 10 },

}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

// ── Slug auto-generate ────────────────────────────────────
productSchema.pre("save", async function (next) {
    if (!this.isModified("name") && this.slug) return next();
    const base = slugify(this.name, { lower: true, strict: true });
    let slug = base, n = 1;
    while (await mongoose.model("Product").findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${base}-${n++}`;
    }
    this.slug = slug;
    next();
});

// ── Auto inStock ──────────────────────────────────────────
// Source of truth for base stock:
//   colorVariants exist → sum of variant stocks
//   else sizes exist with maintained stock (sum > 0) → sum of size stocks
//     (BUG FIX: sizes were ignored before — a product whose stock lived
//      only in sizes[].stock could sit at base stock 0 / inStock false and
//      vanish from every listing despite being purchasable)
//   else → admin-entered base stock (legacy products with unmaintained
//     per-size stocks keep working unchanged)
productSchema.pre("save", function (next) {
    if (this.colorVariants && this.colorVariants.length > 0) {
        const totalVariantStock = this.colorVariants.reduce((s, v) => s + (v.stock || 0), 0);
        this.stock = totalVariantStock;
        this.inStock = totalVariantStock > 0;
    } else if (this.sizes && this.sizes.length > 0) {
        const totalSizeStock = this.sizes.reduce((s, x) => s + (Number(x.stock) || 0), 0);
        if (totalSizeStock > 0) this.stock = totalSizeStock;
        this.inStock = this.stock > 0;
    } else {
        this.inStock = this.stock > 0;
    }
    next();
});

// ── Virtuals ──────────────────────────────────────────────
productSchema.virtual("discountPercent").get(function () {
    if (!this.mrp || this.mrp <= this.price) return 0;
    return Math.round(((this.mrp - this.price) / this.mrp) * 100);
});

productSchema.virtual("isDealActive").get(function () {
    if (!this.isDeal) return false;
    if (!this.dealEndsAt) return true;
    return new Date(this.dealEndsAt) > new Date();
});

// ── Indexes ───────────────────────────────────────────────
productSchema.index({ productType: 1, isActive: 1, inStock: 1 });
productSchema.index({ isDeal: 1, isActive: 1, inStock: 1 });
productSchema.index({ isFeatured: 1, isActive: 1, inStock: 1 });
productSchema.index({ vendorId: 1, isActive: 1 });
productSchema.index({ name: "text", description: "text", brand: "text", tags: "text" });
// Wildcard index so ANY dynamic attribute key is queryable without
// knowing attribute names ahead of time (attributes.fabric, attributes.ram, …).
productSchema.index({ "attributes.$**": 1 });
productSchema.index({ brand: 1, isActive: 1 });
// SKU lookups (duplicate-check + admin search). Sparse-style partial: only
// docs that actually have a non-empty sku. Uniqueness enforced in the
// controller (409) so legacy duplicates never crash writes.
// [FIX] Was a non-unique index — SKU uniqueness was enforced only by a
// findOne-then-write check in the controller, a real TOCTOU race between
// two concurrent creates/edits with the same SKU. The partial filter keeps
// products with no SKU set (the common default) from colliding with each
// other under a blanket unique constraint.
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { sku: { $gt: "" } } });

export default mongoose.model("Product", productSchema);