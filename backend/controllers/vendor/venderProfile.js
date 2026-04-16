/**
 * venderProfile.js — Production, fixed
 * Fixed: Uses req.vendor from vendorMiddleware (no double DB lookup)
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";

// GET /api/vendor/me
export const getMyProfile = async (req, res) => {
    try {
        // req.vendor is set by protectVendor middleware
        const vendor = req.vendor.toObject ? req.vendor.toObject() : req.vendor;
        res.json({ success: true, vendor });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch profile" });
    }
};

// PUT /api/vendor/me
export const updateMyProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const updatable = ["shopDescription", "shopCategory", "whatsapp", "alternatePhone", "address", "servicePincodes", "bankDetails", "deliveryMode", "acceptingOrders"];
        updatable.forEach((field) => {
            if (req.body[field] !== undefined) {
                let val = req.body[field];
                if (typeof val === "string" && (field === "address" || field === "bankDetails")) {
                    try { val = JSON.parse(val); } catch { /* use as-is */ }
                }
                if (field === "servicePincodes" && typeof val === "string") {
                    try { val = JSON.parse(val); } catch { val = []; }
                }
                vendor[field] = val;
            }
        });

        // Handle image uploads
        if (req.files?.shopLogo?.[0]) {
            const result = await uploadToCloudinary(req.files.shopLogo[0].buffer, "vendors/logos");
            vendor.shopLogo = result.secure_url;
        }
        if (req.files?.shopBanner?.[0]) {
            const result = await uploadToCloudinary(req.files.shopBanner[0].buffer, "vendors/banners");
            vendor.shopBanner = result.secure_url;
        }
        if (req.files?.ownerPhoto?.[0]) {
            const result = await uploadToCloudinary(req.files.ownerPhoto[0].buffer, "vendors/owners");
            if (!vendor.documents) vendor.documents = {};
            vendor.documents.ownerPhoto = result.secure_url;
            vendor.markModified("documents");
        }
        if (req.files?.shopPhoto?.[0]) {
            const result = await uploadToCloudinary(req.files.shopPhoto[0].buffer, "vendors/shops");
            if (!vendor.documents) vendor.documents = {};
            vendor.documents.shopPhoto = result.secure_url;
            vendor.markModified("documents");
        }

        await vendor.save();
        res.json({ success: true, vendor, message: "Profile updated" });
    } catch (err) {
        console.error("[updateMyProfile]", err);
        res.status(500).json({ success: false, message: err.message || "Failed to update profile" });
    }
};

// PATCH /api/vendor/toggle-shop
export const toggleShopOpen = async (req, res) => {
    try {
        if (!req.vendor || !req.vendor._id) {
            return res.status(400).json({ success: false, message: "Vendor context not found" });
        }

        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        vendor.isOpen = !vendor.isOpen;
        await vendor.save();

        res.json({
            success: true,
            isOpen: vendor.isOpen,
            message: vendor.isOpen ? "Shop is now open" : "Shop is now closed"
        });
    } catch (err) {
        console.error("[toggleShopOpen] Error:", err);
        res.status(500).json({
            success: false,
            message: "Failed to toggle shop status",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
};
