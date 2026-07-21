import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        subtitle: {
            type: String,
            trim: true,
            maxlength: 400,
        },
        // Small uppercase pill shown above the title (e.g. "COMING SOON",
        // "LIMITED TIME") — client's HeroSlide already renders slide.tag,
        // this just gives admins a field to actually set it.
        tag: {
            type: String,
            trim: true,
            maxlength: 40,
            default: "",
        },
        // Second heading line rendered in the accent color below the title
        // (client's HeroSlide already renders slide.highlight) — e.g.
        // title "Something Big is" + highlight "Launching Soon".
        highlight: {
            type: String,
            trim: true,
            maxlength: 100,
            default: "",
        },
        description: {
            type: String,
            trim: true,
            maxlength: 600,
        },
        image: {
            url: { type: String, required: true },
            public_id: { type: String, required: true },
        },
        link: {
            type: String,
            trim: true,
            default: "",
        },
        linkType: {
            type: String,
            enum: ["route", "product", "category", "external", "none"],
            default: "none",
        },
        buttonText: {
            type: String,
            trim: true,
            maxlength: 50,
            default: "",
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
        },
        placement: {
            type: String,
            enum: ["hero", "mid"],
            default: "hero",
        },
        // Tile width for `mid` (editorial-grid) banners on the homepage.
        // Controls how many columns the tile spans in the Myntra-style
        // banner grid: full = whole row, half = 1/2, third = 1/3.
        // Ignored for `hero` banners (they are always full-bleed).
        span: {
            type: String,
            enum: ["full", "half", "third"],
            default: "half",
        },
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
);

// ── Indexes for common query patterns ──
bannerSchema.index({ isActive: 1, type: 1, placement: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

export default mongoose.model("Banner", bannerSchema);