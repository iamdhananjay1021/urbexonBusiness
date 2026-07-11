import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { vendorOnly } from "../../middlewares/vendorMiddleware.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import { delCacheByPrefix } from "../../utils/Cache.js";
import { HARD_MAX_RADIUS_KM } from "../../validations/orderValidations.js";
import slugify from "slugify";

const router = express.Router();
router.use(protect, vendorOnly);

// GET /api/vendor/settings
router.get("/settings", async (req, res) => {
    try {
        const vendor = await Vendor.findOne({ userId: req.user._id }).select(
            "shopName shopDescription shopCategory isOpen deliveryRadius servicePincodes location shopLat shopLng shopLogo shopBanner"
        );
        if (!vendor) return res.status(404).json({ message: "Vendor profile not found." });
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ message: "Server error." });
    }
});

// PUT /api/vendor/settings
router.put("/settings", async (req, res) => {
    try {
        const { shopName, shopDescription, isOpen, deliveryRadius, servicePincodes, lat, lng } = req.body;
        const vendor = await Vendor.findOne({ userId: req.user._id });
        if (!vendor) return res.status(404).json({ message: "Vendor profile not found." });

        if (shopName !== undefined && shopName.trim() !== vendor.shopName) {
            vendor.shopName = shopName.trim();
            // Regenerate slug if shop name changes
            let baseSlug = slugify(vendor.shopName, { lower: true, strict: true });
            let slug = baseSlug;
            let count = 0;
            while (await Vendor.findOne({ shopSlug: slug, _id: { $ne: vendor._id } })) {
                slug = `${baseSlug}-${++count}`;
            }
            vendor.shopSlug = slug;
        }
        if (shopDescription !== undefined) vendor.shopDescription = shopDescription;
        if (isOpen !== undefined) vendor.isOpen = isOpen;
        // BUG FIX: this route accepted any deliveryRadius with zero validation
        // (no NaN/negative/absurd-value guard) — checkout never honors more
        // than HARD_MAX_RADIUS_KM anyway, so clamp to the same real ceiling
        // used everywhere else instead of trusting raw client input.
        if (deliveryRadius !== undefined) {
            const num = Number(deliveryRadius);
            if (Number.isFinite(num)) vendor.deliveryRadius = Math.min(Math.max(num, 1), HARD_MAX_RADIUS_KM);
        }
        // BUG FIX: servicePincodes was assigned as-is with no existence check
        // against the real Pincode collection — a vendor could "serve" a
        // pincode that doesn't exist or was delisted by admin.
        if (servicePincodes !== undefined) {
            const arr = Array.isArray(servicePincodes) ? servicePincodes : [];
            if (arr.length > 0) {
                const found = await Pincode.find({
                    code: { $in: arr },
                    status: { $in: ["active", "coming_soon"] },
                }).select("code").lean();
                vendor.servicePincodes = found.map((p) => p.code);
            } else {
                vendor.servicePincodes = [];
            }
        }

        if (lat !== undefined && lng !== undefined) {
            const latitude = parseFloat(lat);
            const longitude = parseFloat(lng);
            if (!isNaN(latitude) && !isNaN(longitude)) {
                vendor.shopLat = latitude;
                vendor.shopLng = longitude;
                vendor.location = {
                    type: "Point",
                    coordinates: [longitude, latitude],
                };
            }
        }

        await vendor.save();

        // BUG FIX: this route never invalidated the pincode/UH caches that
        // updateMyProfile (the parallel /vendor/me route) does — a vendor
        // closing their shop or changing service pincodes here could still
        // show as open/serviceable to customers for up to the cache's TTL.
        try {
            await delCacheByPrefix("pincode:");
            await delCacheByPrefix("uh:");
        } catch { /* non-fatal */ }

        res.json({ message: "Settings saved successfully.", vendor });
    } catch (error) {
        res.status(500).json({ message: "Server error saving settings." });
    }
});

// Note: Image uploads (logo/banner) should be handled in a separate, dedicated route
// using multer and your existing cloudinary setup. This file focuses on data fields.

export default router;