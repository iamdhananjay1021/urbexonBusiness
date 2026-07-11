/**
 * venderProfile.js — Production, fixed
 * Fixed: Uses req.vendor from vendorMiddleware (no double DB lookup)
 *
 * FIX (this version): updateMyProfile's whitelist was missing three fields
 * that the Vendor model actually supports and the frontend Profile.jsx
 * already sends: `website`, `isOpen`, and `deliveryRadius`. Previously:
 *  - `website` didn't even exist on the schema (fixed separately in Vendor.js)
 *    and was silently dropped here even after adding it to the schema.
 *  - `isOpen` could only be changed via the separate PATCH /toggle-shop route
 *    (a pure flip, no explicit value) — sending it through PUT /vendor/me
 *    was silently ignored, which is why the Shop-Open toggle looked broken
 *    when wired to this endpoint.
 *  - `deliveryRadius` only existed on the separate (parallel) PUT
 *    /vendor/settings route, so the main profile form couldn't save it at
 *    all even if a field were added for it.
 * All three are now part of the single source of truth here so the vendor
 * Profile page can update everything through one PUT /vendor/me call.
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { delCacheByPrefix } from "../../utils/Cache.js";
import { HARD_MAX_RADIUS_KM } from "../../validations/orderValidations.js";

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
// ✅ BUG6 FIX: email, phone, ownerName are READ-ONLY — tied to User account.
// Only shop-level fields can be updated here.
export const updateMyProfile = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        // Whitelist only safe, updatable vendor-profile fields.
        // email / phone / ownerName deliberately excluded — those belong to the User model.
        // ✅ FIX: added "website", "isOpen", "deliveryRadius" — previously
        // missing here, so the frontend form could set them locally but they
        // never actually persisted (or, for isOpen, silently no-opped).
        const updatable = [
            "shopDescription", "shopCategory", "whatsapp", "alternatePhone",
            "website", "address", "servicePincodes", "bankDetails",
            "deliveryMode", "acceptingOrders", "isOpen", "deliveryRadius",
        ];
        updatable.forEach((field) => {
            if (req.body[field] === undefined) return;
            let val = req.body[field];

            if (typeof val === "string" && (field === "address" || field === "bankDetails")) {
                try { val = JSON.parse(val); } catch { /* use as-is */ }
            }
            if (field === "servicePincodes" && typeof val === "string") {
                try { val = JSON.parse(val); } catch { val = []; }
            }
            if (field === "isOpen" || field === "acceptingOrders") {
                // FormData sends booleans as the strings "true"/"false"
                val = val === true || val === "true";
            }
            if (field === "deliveryRadius") {
                const num = Number(val);
                if (!Number.isFinite(num)) return; // skip invalid values instead of crashing
                // BUG FIX: was clamped to the schema's raw min/max (1-50), but
                // checkout (validateDeliveryServiceability) never honors more
                // than HARD_MAX_RADIUS_KM regardless — vendors could set/see
                // e.g. 30km "saved" here while every order beyond 10km was
                // silently rejected at checkout with no explanation in the panel.
                val = Math.min(Math.max(num, 1), HARD_MAX_RADIUS_KM);
            }

            vendor[field] = val;
        });

        // BUG FIX: servicePincodes was only ever checked against the real
        // Pincode collection at vendor signup (vendorAuth.js) — editing it
        // later via this endpoint accepted any string as-is, letting a
        // vendor "serve" a pincode that doesn't exist or was delisted.
        if (Array.isArray(vendor.servicePincodes) && vendor.servicePincodes.length > 0) {
            const found = await Pincode.find({
                code: { $in: vendor.servicePincodes },
                status: { $in: ["active", "coming_soon"] },
            }).select("code").lean();
            vendor.servicePincodes = found.map((p) => p.code);
        }

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

        // Invalidate pincode caches so changes to service areas appear instantly
        try {
            await delCacheByPrefix("pincode:");
            await delCacheByPrefix("uh:"); // UH products & homepage might change
        } catch (e) {
            console.warn("[Cache] Failed to invalidate pincode cache on vendor update");
        }

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

// PATCH /api/vendor/location — update vendor lat/lng
export const updateLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const latitude = parseFloat(lat);
        const longitude = parseFloat(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ success: false, message: "Valid lat and lng are required" });
        }
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            return res.status(400).json({ success: false, message: "Coordinates out of range" });
        }

        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        vendor.location = { type: "Point", coordinates: [longitude, latitude] };
        await vendor.save();

        res.json({ success: true, message: "Location updated", location: vendor.location });
    } catch (err) {
        console.error("[updateLocation]", err);
        res.status(500).json({ success: false, message: "Failed to update location" });
    }
};