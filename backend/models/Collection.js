/**
 * Collection.js — rule-based dynamic product collections.
 *
 * A collection is a saved query, not a saved product list: "Festival
 * Collection" = { tags: ["festive"], minDiscount: 20, sort: "discount" }.
 * Products matching the rules populate the collection automatically, so
 * admin never curates item-by-item and new products appear on their own.
 */
import mongoose from "mongoose";
import slugify from "slugify";

const collectionSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 100, unique: true },
        slug: { type: String, unique: true, lowercase: true, index: true },
        description: { type: String, trim: true, default: "", maxlength: 300 },
        image: {
            url: { type: String, default: "" },
            public_id: { type: String, default: "" },
        },

        // ── Rules — every field optional; all present rules AND together ──
        rules: {
            category: { type: String, trim: true, default: "" },        // category slug/name
            tags: { type: [String], default: [] },                       // any-of match
            brand: { type: String, trim: true, default: "" },
            isDeal: { type: Boolean, default: false },
            isFeatured: { type: Boolean, default: false },
            minRating: { type: Number, default: 0, min: 0, max: 5 },
            minDiscount: { type: Number, default: 0, min: 0, max: 99 }, // % via mrp/price
            maxAgeDays: { type: Number, default: 0, min: 0 },            // 0 = no age limit
        },

        sort: { type: String, trim: true, default: "newest" },           // sortMap key
        limit: { type: Number, default: 24, min: 1, max: 100 },          // rail/preview size

        seo: {
            title: { type: String, trim: true, default: "" },
            description: { type: String, trim: true, default: "" },
        },

        isActive: { type: Boolean, default: true, index: true },
        order: { type: Number, default: 0 },                             // homepage/list priority
    },
    { timestamps: true }
);

collectionSchema.pre("save", async function (next) {
    if (!this.isModified("name") && this.slug) return next();
    const base = slugify(this.name, { lower: true, strict: true });
    let slug = base, n = 1;
    while (await mongoose.model("Collection").findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${base}-${n++}`;
    }
    this.slug = slug;
    next();
});

export default mongoose.model("Collection", collectionSchema);
