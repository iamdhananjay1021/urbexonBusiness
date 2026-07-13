/**
 * ActiveOrdersReconciliationLog — audit trail for the scheduled
 * reconcileActiveOrders maintenance job (jobs/deliveryJobs.js).
 *
 * DeliveryBoy.activeOrders is an incrementally-maintained counter (separate
 * $inc/$set writes at accept/cancel/deliver time, never computed on read),
 * so it can drift from the real count of actively-assigned orders on a
 * process crash or interrupted deploy between the two paired writes, a
 * replica-set rollover affecting one write but not the other, or a direct
 * manual DB edit — backend/fixRiderCounter.js (a leftover one-off manual
 * fix for a specific rider) is evidence this has already happened once.
 * This log exists so every reconciliation run is auditable after the fact,
 * independent of the process logger's own retention.
 */
import mongoose from "mongoose";

const mismatchSchema = new mongoose.Schema(
    {
        riderId: { type: mongoose.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true },
        riderName: { type: String, default: "" },
        before: { type: Number, required: true },
        after: { type: Number, required: true },
    },
    { _id: false }
);

const activeOrdersReconciliationLogSchema = new mongoose.Schema(
    {
        runAt: { type: Date, default: Date.now, index: true },
        ridersChecked: { type: Number, required: true },
        mismatchCount: { type: Number, required: true, default: 0 },
        mismatches: { type: [mismatchSchema], default: [] },
        adminsNotified: { type: Boolean, default: false },
        durationMs: { type: Number },
    },
    { timestamps: true }
);

export default mongoose.models.ActiveOrdersReconciliationLog ||
    mongoose.model("ActiveOrdersReconciliationLog", activeOrdersReconciliationLogSchema);
