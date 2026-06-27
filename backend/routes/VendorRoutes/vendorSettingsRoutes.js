import express from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { vendorOnly } from "../../middlewares/vendorMiddleware.js";
import Vendor from "../../models/vendorModels/Vendor.js";
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
        if (deliveryRadius !== undefined) vendor.deliveryRadius = Number(deliveryRadius);
        if (servicePincodes !== undefined) vendor.servicePincodes = servicePincodes;

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
        res.json({ message: "Settings saved successfully.", vendor });
    } catch (error) {
        res.status(500).json({ message: "Server error saving settings." });
    }
});

// Note: Image uploads (logo/banner) should be handled in a separate, dedicated route
// using multer and your existing cloudinary setup. This file focuses on data fields.

export default router;