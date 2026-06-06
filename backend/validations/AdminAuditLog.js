import mongoose from "mongoose";

/**
 * Enterprise-Grade Admin Audit Log
 * Immutably tracks all mutative actions performed by admin users.
 */
const adminAuditLogSchema = new mongoose.Schema({
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, required: true },
    action: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    method: { type: String, required: true },
    targetId: { type: mongoose.Schema.Types.Mixed },
    previousState: { type: mongoose.Schema.Types.Mixed },
    newState: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
    requestId: { type: String, index: true },
}, {
    timestamps: true,
    capped: { size: 1073741824, max: 5000000 } // 1GB cap to prevent infinite growth / DB Bloat
});

// Optimized indexes for enterprise querying
adminAuditLogSchema.index({ createdAt: -1 });
adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetId: 1 });

const AdminAuditLog = mongoose.model("AdminAuditLog", adminAuditLogSchema);
export default AdminAuditLog;