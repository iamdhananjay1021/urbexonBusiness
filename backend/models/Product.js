/**
 * Product.js — Production model
 * productType: "ecommerce" (admin) | "urbexon_hour" (vendor)
 */
import mongoose from "mongoose";
import slugify from "slugify";

const imageSchema = new mongoose.Schema({
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    alt: { type: String, default: "" },
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
    highlights: { type: Map, of: String, default: {} },
    // Structured highlights array: [{ title: "Weight", value: "1kg" }]
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

    // ── Stock ─────────────────────────────────────────────
    stock: { type: Number, default: 0, min: 0 },
    inStock: { type: Boolean, default: false, index: true },

    // ── Status ────────────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    isDeal: { type: Boolean, default: false, index: true },
    dealStartsAt: { type: Date, default: null },
    dealEndsAt: { type: Date, default: null },
    dealPriority: { type: Number, default: 0 }, // Higher = shown first
    discount: { type: Number, default: 0 }, // Manual discount percentage override

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
productSchema.pre("save", function (next) {
    this.inStock = this.stock > 0;
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

export default mongoose.model("Product", productSchema);
