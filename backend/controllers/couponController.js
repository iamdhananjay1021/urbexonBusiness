/**
 * couponController.js — Full coupon management
 */
import Coupon from "../models/Coupon.js";

// POST /api/coupons/validate  (user validates at checkout)
export const validateCoupon = async (req, res) => {
    try {
        const { code, orderTotal, orderType } = req.body;
        if (!code?.trim()) return res.status(400).json({ success: false, message: "Coupon code required" });

        const coupon = await Coupon.findOne({ code: code.trim().toUpperCase(), isActive: true }).lean();
        if (!coupon) return res.status(404).json({ success: false, message: "Invalid or expired coupon code" });

        // Check expiry
        if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt))
            return res.status(400).json({ success: false, message: "This coupon has expired" });

        // Check usage limit
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit)
            return res.status(400).json({ success: false, message: "Coupon usage limit reached" });

        // Check per-user usage (one per user)
        const alreadyUsed = coupon.usedBy?.some(u => u.userId?.toString() === req.user._id.toString());
        if (alreadyUsed) return res.status(400).json({ success: false, message: "You have already used this coupon" });

        // Check min order value
        if (orderTotal < coupon.minOrderValue)
            return res.status(400).json({ success: false, message: `Minimum order value ₹${coupon.minOrderValue} required` });

        // Check applicable to
        if (coupon.applicableTo !== "ALL") {
            const type = orderType === "urbexon_hour" ? "URBEXON_HOUR" : "ECOMMERCE";
            if (coupon.applicableTo !== type)
                return res.status(400).json({ success: false, message: `This coupon is only for ${coupon.applicableTo === "URBEXON_HOUR" ? "Urbexon Hour" : "regular"} orders` });
        }

        // Calculate discount
        let discount = 0;
        if (coupon.discountType === "PERCENT") {
            discount = Math.round((orderTotal * coupon.discountValue) / 100);
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
        } else {
            discount = Math.min(coupon.discountValue, orderTotal);
        }

        res.json({
            success: true,
            valid: true,
            couponId: coupon._id,
            code: coupon.code,
            description: coupon.description,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discount,
            minOrderValue: coupon.minOrderValue || 0,
            finalTotal: Math.max(0, orderTotal - discount),
        });
    } catch (err) {
        console.error("[validateCoupon]", err);
        res.status(500).json({ success: false, message: "Failed to validate coupon" });
    }
};

// ─── ADMIN CRUD ───────────────────────────────────────────

// GET /api/coupons/admin
export const adminGetCoupons = async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const filter = {};
        if (search) {
            const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.code = { $regex: escaped, $options: "i" };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [coupons, total] = await Promise.all([
            Coupon.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Coupon.countDocuments(filter),
        ]);
        res.json({ coupons, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// POST /api/coupons/admin
export const adminCreateCoupon = async (req, res) => {
    try {
        const { code, description, discountType, discountValue, maxDiscount, minOrderValue, usageLimit, applicableTo, expiresAt } = req.body;
        if (!code?.trim() || !discountValue)
            return res.status(400).json({ success: false, message: "Code and discount value required" });
        if ((discountType || "PERCENT") === "PERCENT" && Number(discountValue) > 100)
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });

        const coupon = await Coupon.create({
            code: code.trim().toUpperCase(),
            description: description?.trim() || "",
            discountType: discountType || "PERCENT",
            discountValue: Number(discountValue),
            maxDiscount: maxDiscount ? Number(maxDiscount) : null,
            minOrderValue: minOrderValue ? Number(minOrderValue) : 0,
            usageLimit: usageLimit ? Number(usageLimit) : null,
            applicableTo: applicableTo || "ALL",
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy: req.user._id,
        });
        res.status(201).json({ success: true, coupon });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: "Coupon code already exists" });
        res.status(500).json({ success: false, message: err.message || "Failed to create coupon" });
    }
};

// PUT /api/coupons/admin/:id
export const adminUpdateCoupon = async (req, res) => {
    try {
        // Whitelist allowed fields — never allow usedCount/usedBy overwrite
        const allowed = ["code", "description", "discountType", "discountValue", "maxDiscount", "minOrderValue", "usageLimit", "applicableTo", "expiresAt", "isActive"];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (updates.code) updates.code = String(updates.code).trim().toUpperCase();
        if (updates.discountType === "PERCENT" && Number(updates.discountValue) > 100) {
            return res.status(400).json({ success: false, message: "Percentage discount cannot exceed 100%" });
        }
        const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
        if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });
        res.json({ success: true, coupon });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update" });
    }
};

// DELETE /api/coupons/admin/:id
export const adminDeleteCoupon = async (req, res) => {
    try {
        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};

// PATCH /api/coupons/admin/:id/toggle
export const adminToggleCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ success: false, message: "Not found" });
        coupon.isActive = !coupon.isActive;
        await coupon.save();
        res.json({ success: true, isActive: coupon.isActive });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed" });
    }
};
