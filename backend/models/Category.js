import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            maxlength: 100,
        },
        slug: {
            type: String,
            unique: true,
            index: true,
        },
        emoji: {
            type: String,
            default: "🏷️",
        },
        image: {
            url: { type: String, default: "" },
            public_id: { type: String, default: "" },
        },
        color: {
            type: String,
            default: "#1a1740",
        },
        lightColor: {
            type: String,
            default: "#f0eefb",
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        order: {
            type: Number,
            default: 0,
        },
        type: {
            type: String,
            enum: ["ecommerce", "urbexon_hour"],
            default: "ecommerce",
            index: true,
        },
        subcategories: {
            type: [String],
            default: [],
        },
        // Category-based product highlight templates
        // Defines which highlight fields are relevant for products in this category
        highlightTemplate: {
            type: [
                {
                    title: { type: String, required: true, trim: true },
                    required: { type: Boolean, default: false },
                },
            ],
            default: [],
        },

        // ── Discovery metadata (Product Discovery Engine) ─────
        // Defines which dynamic attributes products of this category carry.
        // Drives: vendor/admin product forms (auto-generated fields),
        // filter sidebar ordering & labels, and spec display. Adding a new
        // category with its own attributes requires ZERO code changes.
        attributeSchema: {
            type: [
                {
                    key: { type: String, required: true, trim: true },      // "fabric", "ram"
                    label: { type: String, trim: true, default: "" },        // "Fabric" (falls back to key)
                    type: { type: String, enum: ["select", "text"], default: "text" },
                    options: { type: [String], default: [] },                // for type=select
                    required: { type: Boolean, default: false },
                    filterable: { type: Boolean, default: true },            // show in filter sidebar
                    order: { type: Number, default: 0 },                     // sidebar priority
                },
            ],
            default: [],
        },

        // Per-category SEO — used by the client's category page head tags.
        seo: {
            title: { type: String, trim: true, default: "" },
            description: { type: String, trim: true, default: "" },
        },

        // Default sort for this category's listing ("newest", "popularity", …)
        defaultSort: { type: String, trim: true, default: "" },
    },
    { timestamps: true }
);

// Auto slug from name
categorySchema.pre("save", function () {
    if (this.isModified("name") || !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/['''`]/g, "")
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-");
    }
});

export default mongoose.model("Category", categorySchema);