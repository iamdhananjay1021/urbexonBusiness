/**
 * vendorApproval.js — Admin vendor management, Production v3
 *
 * [FIX v2] User.role sync restored on approve/reject/suspend/delete.
 *   - approved  → User.role = "vendor"
 *   - rejected  → User.role = "user"   (safety: covers approved→rejected)
 *   - suspended → User.role = "user"   (revokes vendor-only access/login)
 *   - deleted   → User.role = "user"
 *   Wired notifyVendorApplicationApproved / notifyVendorApplicationRejected
 *   from notificationService.js — fire-and-forget, never blocks the response.
 *
 * [FIX v3] Real-time admin broadcast wired via wsHub.js's broadcastToAdmins().
 *   Every mutation an admin (or, later, a vendor) makes to vendor data now
 *   pushes a live event to every currently-connected admin so the Vendors
 *   list / detail page updates instantly without a manual refresh —
 *   matches the pattern already used for order/rider notifications.
 *   Fire-and-forget: broadcast failures are logged, never block the
 *   underlying DB operation or the HTTP response.
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Subscription from "../../models/vendorModels/Subscription.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import User from "../../models/User.js";
import { notifyVendorApplicationApproved, notifyVendorApplicationRejected } from "../../services/notificationService.js";
import { broadcastToAdmins, VENDOR_WS_EVENTS } from "../../utils/wsHub.js";

/* ── Get all vendors ───────────────────────────────────── */
export const getAllVendors = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const filter = { isDeleted: { $ne: true } };
        if (status && status !== "all") filter.status = status;
        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { shopName: { $regex: escaped, $options: "i" } },
                { ownerName: { $regex: escaped, $options: "i" } },
                { email: { $regex: escaped, $options: "i" } },
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [vendors, total] = await Promise.all([
            Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Vendor.countDocuments(filter),
        ]);
        res.json({ success: true, vendors, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error("[getAllVendors]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Get vendor detail ─────────────────────────────────── */
export const getVendorDetail = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).lean();
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });
        const sub = await Subscription.findOne({ vendorId: vendor._id }).lean();
        res.json({ success: true, vendor, subscription: sub });
    } catch (err) {
        console.error("[getVendorDetail]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/**
 * [FIX v2] Centralized, atomic-safe User.role sync helper.
 * Never throws — a role-sync failure must not roll back or block the
 * vendor status change itself; it's logged loudly instead so it's easy
 * to spot and reconcile manually if it ever happens.
 */
const syncUserRole = async (userId, role) => {
    if (!userId) return;
    try {
        await User.findByIdAndUpdate(userId, { $set: { role } });
    } catch (err) {
        console.error(`[syncUserRole] FAILED to set role="${role}" for user ${userId}:`, err.message);
    }
};

/**
 * [FIX v3] Fire-and-forget admin broadcast wrapper. Every call site below
 * uses this instead of calling broadcastToAdmins directly so a broadcast
 * failure can never throw inside a request handler.
 */
const notifyAdmins = (type, payload) => {
    broadcastToAdmins(type, payload).catch((err) =>
        console.error(`[notifyAdmins:${type}] Failed:`, err.message)
    );
};

/* ── Approve vendor ────────────────────────────────────── */
// FIX #2 + #3 (preserved): atomic status check + idempotency guard
// [FIX v2] + User.role sync + approval email notification
// [FIX v3] + real-time admin broadcast
export const approveVendor = async (req, res) => {
    try {
        // FIX #2 — Atomic: only update if currently pending/rejected, not already approved
        // Prevents double-approval race (two admin tabs clicking at once)
        const vendor = await Vendor.findOneAndUpdate(
            { _id: req.params.id, status: { $ne: "approved" } },
            {
                status: "approved",
                approvedAt: new Date(),
                approvedBy: req.user?._id || null,
                $unset: { rejectionReason: "" },
            },
            { new: true }
        );

        // FIX #3 — Idempotency: if null, vendor was already approved
        if (!vendor) {
            const existing = await Vendor.findById(req.params.id).lean();
            if (!existing) return res.status(404).json({ success: false, message: "Not found" });
            return res.status(409).json({ success: false, message: "Vendor is already approved" });
        }

        // [FIX v2] Sync linked User.role so vendor login/permissions actually
        // reflect approval immediately — this was silently missing.
        await syncUserRole(vendor.userId, "vendor");

        // Atomic upsert: create an inactive subscription so vendor must pay to start
        await Subscription.findOneAndUpdate(
            { vendorId: vendor._id, status: { $exists: false } }, // only if no sub at all
            {
                $setOnInsert: {
                    vendorId: vendor._id, plan: "basic",
                    monthlyFee: 499, maxProducts: 30,
                    status: "inactive", startDate: null,
                    expiryDate: null, isTrialActive: false,
                    payments: [],
                },
            },
            { upsert: true }
        ).catch(() => {
            // Silent: subscription may already exist, that's fine
        });

        // Sync embedded subscription only if no active sub exists
        const existingSub = await Subscription.findOne({ vendorId: vendor._id }).lean();
        if (!existingSub || !existingSub.status || existingSub.status !== "active") {
            vendor.subscription = { plan: "basic", isActive: false, autoRenew: false };
            await vendor.save();
        }

        const vendorObj = vendor.toObject();

        // [FIX v2] Fire-and-forget approval email — never blocks or fails the response
        notifyVendorApplicationApproved(vendorObj).catch(err =>
            console.error("[notifyVendorApplicationApproved]", err.message)
        );

        // [FIX v3] Real-time push to every connected admin
        notifyAdmins(VENDOR_WS_EVENTS.STATUS_CHANGED, {
            vendorId: vendorObj._id,
            status: "approved",
            vendor: vendorObj,
        });

        res.json({ success: true, vendor: vendorObj, message: "Vendor approved. Vendor must activate subscription to start." });
    } catch (err) {
        console.error("[approveVendor]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Reject vendor ─────────────────────────────────────── */
// [FIX v2] + User.role sync (safety net for approved→rejected) + rejection email
// [FIX v3] + real-time admin broadcast
export const rejectVendor = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { status: "rejected", rejectionReason: reason || "Application does not meet requirements" },
            { new: true }
        );
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });

        // [FIX v2] A rejected vendor must not retain vendor-level access —
        // covers both the fresh-application case and the approved→rejected case.
        await syncUserRole(vendor.userId, "user");

        const vendorObj = vendor.toObject();

        notifyVendorApplicationRejected(vendorObj).catch(err =>
            console.error("[notifyVendorApplicationRejected]", err.message)
        );

        notifyAdmins(VENDOR_WS_EVENTS.STATUS_CHANGED, {
            vendorId: vendorObj._id,
            status: "rejected",
            vendor: vendorObj,
        });

        res.json({ success: true, vendor: vendorObj, message: "Vendor rejected" });
    } catch (err) {
        console.error("[rejectVendor]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Suspend vendor ────────────────────────────────────── */
// [FIX v2] + User.role sync — a suspended vendor must lose vendor access
// immediately, not just show a "suspended" badge in the admin panel while
// still being able to log in with vendor privileges.
// [FIX v3] + real-time admin broadcast
export const suspendVendor = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { status: "suspended", rejectionReason: reason || "Account suspended by admin" },
            { new: true }
        );
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });

        // [FIX v2] Revoke vendor role on suspension
        await syncUserRole(vendor.userId, "user");

        const vendorObj = vendor.toObject();

        notifyAdmins(VENDOR_WS_EVENTS.STATUS_CHANGED, {
            vendorId: vendorObj._id,
            status: "suspended",
            vendor: vendorObj,
        });

        res.json({ success: true, vendor: vendorObj, message: "Vendor suspended" });
    } catch (err) {
        console.error("[suspendVendor]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Update commission ─────────────────────────────────── */
// [FIX v3] + real-time admin broadcast
export const updateCommission = async (req, res) => {
    try {
        const { commissionRate } = req.body;
        if (commissionRate < 0 || commissionRate > 50)
            return res.status(400).json({ success: false, message: "Commission must be 0-50%" });
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id, { commissionRate: Number(commissionRate) }, { new: true }
        );
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });

        const vendorObj = vendor.toObject();

        notifyAdmins(VENDOR_WS_EVENTS.UPDATED, {
            vendorId: vendorObj._id,
            vendor: vendorObj,
        });

        res.json({ success: true, vendor: vendorObj });
    } catch (err) {
        console.error("[updateCommission]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Delete vendor ─────────────────────────────────────── */
// [FIX v2] + User.role sync
// [FIX v3] + real-time admin broadcast
export const deleteVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findByIdAndUpdate(req.params.id, { isDeleted: true }, { new: true });
        // [FIX v2] A deleted vendor must also lose vendor-role access
        if (vendor) {
            await syncUserRole(vendor.userId, "user");
            notifyAdmins(VENDOR_WS_EVENTS.DELETED, { vendorId: String(vendor._id) });
        }
        res.json({ success: true, message: "Vendor deleted" });
    } catch (err) {
        console.error("[deleteVendor]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Activate subscription ─────────────────────────────── */
export const activateVendorSubscription = async (req, res) => {
    try {
        const { plan, months = 1 } = req.body;
        const PLANS = {
            starter: { monthlyFee: 0, maxProducts: 10 },
            basic: { monthlyFee: 499, maxProducts: 30 },
            standard: { monthlyFee: 999, maxProducts: 100 },
            premium: { monthlyFee: 1999, maxProducts: 500 },
        };
        if (!PLANS[plan]) return res.status(400).json({ success: false, message: "Invalid plan. Use: starter, basic, standard, premium" });

        const numMonths = Number(months);
        if (!Number.isInteger(numMonths) || numMonths < 1 || numMonths > 24)
            return res.status(400).json({ success: false, message: "months must be 1–24" });

        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const now = new Date();
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + numMonths);

        const sub = await Subscription.findOneAndUpdate(
            { vendorId: vendor._id },
            {
                vendorId: vendor._id, plan,
                monthlyFee: PLANS[plan].monthlyFee,
                maxProducts: PLANS[plan].maxProducts,
                status: "active", startDate: now,
                expiryDate: expiry, nextDueDate: expiry,
                lastPaymentDate: now, isTrialActive: false,
                $push: {
                    payments: {
                        amount: PLANS[plan].monthlyFee * numMonths,
                        method: "manual", months: numMonths, date: now,
                        reference: `ADMIN-${Date.now()}`, status: "success",
                    },
                },
            },
            { upsert: true, new: true }
        );

        vendor.subscription = { plan, startDate: now, expiryDate: expiry, isActive: true, autoRenew: false };
        await vendor.save();

        notifyAdmins(VENDOR_WS_EVENTS.UPDATED, {
            vendorId: String(vendor._id),
            vendor: vendor.toObject(),
        });

        res.json({ success: true, message: `${plan} plan activated for ${numMonths} month(s)`, subscription: sub });
    } catch (err) {
        console.error("[activateSubscription]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Deactivate subscription ───────────────────────────── */
export const deactivateVendorSubscription = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        // FIX #2 — Atomic: only deactivate if currently active
        const sub = await Subscription.findOneAndUpdate(
            { vendorId: vendor._id, status: { $ne: "cancelled" } },
            { status: "cancelled", expiryDate: new Date() },
            { new: true }
        );
        if (!sub) return res.status(404).json({ success: false, message: "No active subscription found" });

        vendor.subscription = { ...vendor.subscription?.toObject?.() || {}, isActive: false, expiryDate: new Date() };
        await vendor.save();

        notifyAdmins(VENDOR_WS_EVENTS.UPDATED, {
            vendorId: String(vendor._id),
            vendor: vendor.toObject(),
        });

        res.json({
            success: true,
            message: `Subscription deactivated${reason ? ": " + reason : ""}`,
            subscription: sub.toObject(),
        });
    } catch (err) {
        console.error("[deactivateSubscription]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Get all subscriptions ─────────────────────────────── */
export const adminGetAllSubscriptions = async (req, res) => {
    try {
        const { status, plan, page = 1, limit = 20, search } = req.query;
        const filter = {};
        if (status && status !== "all") filter.status = status;
        if (plan && plan !== "all") filter.plan = plan;

        const skip = (Number(page) - 1) * Number(limit);
        const [subs, total] = await Promise.all([
            Subscription.find(filter)
                .populate({ path: "vendorId", select: "shopName ownerName email phone status commissionRate" })
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Subscription.countDocuments(filter),
        ]);

        let filtered = subs;
        if (search) {
            const re = new RegExp(search, "i");
            filtered = subs.filter(s =>
                re.test(s.vendorId?.shopName) || re.test(s.vendorId?.ownerName) || re.test(s.vendorId?.email)
            );
        }

        const [activeCount, expiredCount, pendingCount, cancelledCount] = await Promise.all([
            Subscription.countDocuments({ status: "active" }),
            Subscription.countDocuments({ status: "expired" }),
            Subscription.countDocuments({ status: { $in: ["pending", "pending_payment", "inactive"] } }),
            Subscription.countDocuments({ status: "cancelled" }),
        ]);

        res.json({
            success: true,
            subscriptions: filtered,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            summary: { active: activeCount, expired: expiredCount, pending: pendingCount, cancelled: cancelledCount },
        });
    } catch (err) {
        console.error("[adminGetAllSubscriptions]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Get all delivery boys ─────────────────────────────── */
export const getAllDeliveryBoys = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const filter = {};
        if (status && status !== "all") filter.status = status;
        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.$or = [
                { name: { $regex: escaped, $options: "i" } },
                { phone: { $regex: escaped } },
            ];
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [deliveryBoys, total] = await Promise.all([
            DeliveryBoy.find(filter).populate("userId", "name email").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            DeliveryBoy.countDocuments(filter),
        ]);
        res.json({ success: true, deliveryBoys, total });
    } catch (err) {
        console.error("[getAllDeliveryBoys]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Get online approved riders ────────────────────────── */
export const getOnlineRiders = async (req, res) => {
    try {
        const riders = await DeliveryBoy.find({ status: "approved", isOnline: true })
            .select("name phone vehicleType location stats.totalDeliveries stats.rating")
            .lean();
        res.json({ success: true, riders });
    } catch (err) {
        console.error("[getOnlineRiders]", err);
        res.status(500).json({ success: false, message: "Failed to fetch online riders" });
    }
};

/* ── Update delivery boy status ────────────────────────── */
export const updateDeliveryBoyStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["pending", "approved", "rejected", "suspended"];
        if (!allowed.includes(status))
            return res.status(400).json({ message: `Invalid status. Use: ${allowed.join(", ")}` });

        const db = await DeliveryBoy.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!db) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, data: db });
    } catch (err) {
        console.error("[updateDeliveryBoyStatus]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Update per-document status ────────────────────────── */
export const updateDeliveryDocStatus = async (req, res) => {
    try {
        const { docKey, status, note } = req.body;
        const validKeys = ["aadhaarPhoto", "licensePhoto", "vehicleRc", "selfie"];
        const validStatus = ["pending", "approved", "rejected"];
        if (!validKeys.includes(docKey)) return res.status(400).json({ success: false, message: "Invalid document key" });
        if (!validStatus.includes(status)) return res.status(400).json({ success: false, message: "Invalid status" });

        const update = { [`documentStatus.${docKey}`]: status };
        if (note !== undefined) update[`documentNotes.${docKey}`] = note;

        const db = await DeliveryBoy.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
        if (!db) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, data: db });
    } catch (err) {
        console.error("[updateDeliveryDocStatus]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};