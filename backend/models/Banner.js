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