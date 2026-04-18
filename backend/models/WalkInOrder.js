import mongoose from "mongoose";

const walkInItemSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    gstPercent: { type: Number, default: 0 },
});

const walkInOrderSchema = new mongoose.Schema(
    {
        billNumber: { type: String, unique: true, sparse: true },
        customerName: { type: String, default: "Walk-in Customer", trim: true },
        phone: { type: String, default: "" },
        items: [walkInItemSchema],
        subtotal: { type: Number, required: true },
        totalGST: { type: Number, default: 0 },
        grandTotal: { type: Number, required: true },
        paymentMode: { type: String, enum: ["CASH", "UPI", "CARD"], default: "CASH" },
        note: { type: String, default: "" },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// NO pre-save hook — billNumber is set manually in controller

export default mongoose.model("WalkInOrder", walkInOrderSchema);