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
        image: {
            url: { type: String, required: true },
            public_id: { type: String, required: true },
        },
        link: {
            type: String,
            trim: true,
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
    },
    { timestamps: true }
);

export default mongoose.model("Banner", bannerSchema);