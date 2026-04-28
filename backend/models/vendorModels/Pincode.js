import mongoose from "mongoose";

const waitlistEntrySchema = new mongoose.Schema(
    {
        name: { type: String, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, trim: true },
    },
    { timestamps: true, _id: false }
);

const pincodeSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, "Pincode is required"],
            unique: true,
            trim: true,
            match: [/^\d{6}$/, "Pincode must be exactly 6 digits"],
            index: true,
        },
        status: {
            type: String,
            enum: ["active", "coming_soon", "blocked"],
            default: "coming_soon",
            index: true,
        },
        area: { type: String, trim: true },
        city: { type: String, trim: true, index: true },
        district: { type: String, trim: true },
        state: { type: String, trim: true },
        country: { type: String, default: "India" },

        // ── Geo Coordinates (OPTIONAL — only set when lat/lng provided) ──
        // FIX: Don't store location at all if coordinates not provided
        // This prevents 2dsphere index failure on documents without coords
        location: {
            type: {
                type: String,
                enum: ["Point"],
            },
            coordinates: {
                type: [Number], // [longitude, latitude]
                default: undefined,
            },
        },

        assignedVendors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Vendor" }],

        expectedLaunchDate: { type: Date, default: null },
        launchedAt: { type: Date, default: null },

        waitlist: [waitlistEntrySchema],
        waitlistCount: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
        isServicable: { type: Boolean, default: false },
        note: { type: String, trim: true },
        priority: { type: Number, default: 0, index: true },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// ── 2dsphere index — sparse: true so docs WITHOUT location are not indexed
pincodeSchema.index({ location: "2dsphere" }, { sparse: true });
pincodeSchema.index({ status: 1, priority: -1 });

pincodeSchema.virtual("waitlistEmails").get(function () {
    return this.waitlist.map((w) => w.email);
});

pincodeSchema.pre("save", function (next) {
    this.isServicable = this.status === "active";
    if (this.status === "active" && !this.launchedAt) {
        this.launchedAt = new Date();
    }
    // FIX: If location.coordinates is empty/undefined, remove location field entirely
    // This prevents the 2dsphere index from failing
    if (this.location && (!this.location.coordinates || this.location.coordinates.length === 0)) {
        this.location = undefined;
    }
    next();
});

pincodeSchema.statics.getActiveCodes = function () {
    return this.find({ status: "active" }).select("code area city").lean();
};

const Pincode = mongoose.model("Pincode", pincodeSchema);
export default Pincode;
