/**
 * vendorApproval.js — Admin vendor management
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Subscription from "../../models/vendorModels/Subscription.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";

/* ── Get all vendors ───────────────────────────────────── */
export const getAllVendors = async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;
        const filter = { isDeleted: { $ne: true } };
        if (status && status !== "all") filter.status = status;
        if (search) filter.$or = [
            { shopName: { $regex: search, $options: "i" } },
            { ownerName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
        ];
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
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Approve vendor ────────────────────────────────────── */
export const approveVendor = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });
        vendor.status = "approved";
        vendor.approvedAt = new Date();
        vendor.approvedBy = req.user?._id || null;
        vendor.rejectionReason = undefined;

        // Auto-create basic free trial (30 days)
        const existing = await Subscription.findOne({ vendorId: vendor._id });
        const now = new Date();
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);

        if (!existing) {
            await Subscription.create({
                vendorId: vendor._id, plan: "basic",
                monthlyFee: 0, maxProducts: 30,
                status: "active", startDate: now,
                expiryDate: expiry, isTrialActive: true, trialEndsAt: expiry,
                payments: [{ amount: 0, method: "free_trial", months: 1, date: now, reference: "TRIAL-" + Date.now() }],
            });
        }

        // Sync embedded subscription field
        vendor.subscription = {
            plan: "basic",
            startDate: now,
            expiryDate: expiry,
            isActive: true,
            autoRenew: false,
        };
        await vendor.save();

        res.json({ success: true, vendor: vendor.toObject(), message: "Vendor approved with 30-day free trial" });
    } catch (err) {
        console.error("[approveVendor]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Reject vendor ─────────────────────────────────────── */
export const rejectVendor = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { status: "rejected", rejectionReason: reason || "Application does not meet requirements" },
            { new: true }
        ).lean();
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, vendor, message: "Vendor rejected" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Suspend vendor ────────────────────────────────────── */
export const suspendVendor = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id,
            { status: "suspended", rejectionReason: reason || "Account suspended by admin" },
            { new: true }
        ).lean();
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, vendor, message: "Vendor suspended" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Update commission (kept for future) ───────────────── */
export const updateCommission = async (req, res) => {
    try {
        const { commissionRate } = req.body;
        if (commissionRate < 0 || commissionRate > 50)
            return res.status(400).json({ success: false, message: "Commission must be 0-50%" });
        const vendor = await Vendor.findByIdAndUpdate(
            req.params.id, { commissionRate: Number(commissionRate) }, { new: true }
        );
        if (!vendor) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, vendor });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Delete vendor ─────────────────────────────────────── */
export const deleteVendor = async (req, res) => {
    try {
        await Vendor.findByIdAndUpdate(req.params.id, { isDeleted: true });
        res.json({ success: true, message: "Vendor deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Activate subscription ─────────────────────────────── */
export const activateVendorSubscription = async (req, res) => {
    try {
        const { plan, months = 1 } = req.body;
        const PLANS = {
            basic: { monthlyFee: 499, maxProducts: 30 },
            standard: { monthlyFee: 999, maxProducts: 100 },
            premium: { monthlyFee: 1999, maxProducts: 500 },
        };
        if (!PLANS[plan]) return res.status(400).json({ success: false, message: "Invalid plan. Use: basic, standard, premium" });

        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const now = new Date();
        const expiry = new Date(now);
        expiry.setMonth(expiry.getMonth() + Number(months));

        const sub = await Subscription.findOneAndUpdate(
            { vendorId: vendor._id },
            {
                vendorId: vendor._id,
                plan,
                monthlyFee: PLANS[plan].monthlyFee,
                maxProducts: PLANS[plan].maxProducts,
                status: "active",
                startDate: now,
                expiryDate: expiry,
                nextDueDate: expiry,
                lastPaymentDate: now,
                isTrialActive: false,
                $push: {
                    payments: {
                        amount: PLANS[plan].monthlyFee * Number(months),
                        method: "manual",
                        months: Number(months),
                        date: now,
                        reference: `ADMIN-${Date.now()}`,
                        status: "success",
                    },
                },
            },
            { upsert: true, new: true }
        );

        // Sync embedded subscription on vendor doc
        vendor.subscription = {
            plan,
            startDate: now,
            expiryDate: expiry,
            isActive: true,
            autoRenew: false,
        };
        await vendor.save();

        res.json({ success: true, message: `${plan} plan activated for ${months} month(s)`, subscription: sub });
    } catch (err) {
        console.error("[activateSubscription]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Deactivate subscription (admin) ───────────────────── */
export const deactivateVendorSubscription = async (req, res) => {
    try {
        const { reason } = req.body;
        const vendor = await Vendor.findById(req.params.id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const sub = await Subscription.findOne({ vendorId: vendor._id });
        if (!sub) return res.status(404).json({ success: false, message: "No subscription found" });

        sub.status = "cancelled";
        sub.expiryDate = new Date(); // expire immediately
        await sub.save();

        vendor.subscription = {
            ...vendor.subscription,
            isActive: false,
            expiryDate: new Date(),
        };
        await vendor.save();

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

/* ── Get all subscriptions (admin overview) ────────────── */
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

        // Filter by search after populate (search vendor name)
        let filtered = subs;
        if (search) {
            const re = new RegExp(search, "i");
            filtered = subs.filter(s =>
                re.test(s.vendorId?.shopName) || re.test(s.vendorId?.ownerName) || re.test(s.vendorId?.email)
            );
        }

        // Summary counts
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
        if (search) filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search } },
        ];
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

/* ── Get online approved riders (for admin dispatch assign modal) ── */
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
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ── Update per-document status for a delivery boy ──────── */
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
