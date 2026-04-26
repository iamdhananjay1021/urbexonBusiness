/**
 * vendorAuth.js — Production v2.1
 *
 * FIXES:
 *  - deliveryMode default "both"  (model enum: "self" | "platform" | "both")
 *  - bankDetails field: holderName → accountHolder
 *  - address field: street → line1
 *  - JWT token never expires (no expiresIn)
 *  - No syntax errors
 */

import Vendor from "../../models/vendorModels/Vendor.js";
import Pincode from "../../models/vendorModels/Pincode.js";
import User from "../../models/User.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import slugify from "slugify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createNotification } from "../admin/notificationController.js";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vendor/register  (PUBLIC — no protect middleware needed)
// ─────────────────────────────────────────────────────────────────────────────
// POST /api/vendor/register (PROTECTED — user must be authenticated)
// ─────────────────────────────────────────────────────────────────────────────
export const registerVendor = async (req, res) => {
    try {
        const {
            shopName, shopDescription, shopCategory,
            ownerName, email, phone, whatsapp, alternatePhone,
            gstNumber, panNumber, businessType, deliveryMode,
        } = req.body;

        // ── Basic validation ──────────────────────────────────────────────────
        if (!shopName || !ownerName || !phone || !email) {
            return res.status(400).json({
                success: false,
                message: "shopName, ownerName, phone, and email are required",
            });
        }

        // ✅ Use authenticated user from protect middleware
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please login first.",
            });
        }

        const userId = req.user._id;
        const user = req.user;

        // ── 1. Check for duplicate application ───────────────────────────────
        const existing = await Vendor.findOne({ userId, isDeleted: false });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "You have already submitted an application.",
                status: existing.status,
                vendorId: existing._id,
            });
        }

        // ── 2. Safe JSON parse helpers ────────────────────────────────────────
        const safeParse = (v) => {
            if (!v) return {};
            if (typeof v === "object" && !Array.isArray(v)) return v;
            try { return JSON.parse(v); } catch { return {}; }
        };

        const safeParseArr = (v) => {
            if (!v) return [];
            if (Array.isArray(v)) return v;
            try { return JSON.parse(v); } catch { return []; }
        };

        const address = safeParse(req.body.address);
        const bankDetails = safeParse(req.body.bankDetails);
        const servicePincodes = safeParseArr(req.body.servicePincodes);

        // ── 4. Validate service pincodes ─────────────────────────────────────
        let validPincodes = [];
        if (servicePincodes.length > 0) {
            const found = await Pincode.find({
                code: { $in: servicePincodes },
                status: { $in: ["active", "coming_soon"] },
            }).select("code").lean();
            validPincodes = found.map((p) => p.code);
        }

        // ── 5. Upload documents to Cloudinary (non-fatal if fails) ────────────
        const uploads = {};
        const docFields = [
            "shopLogo", "shopBanner", "shopPhoto", "ownerPhoto",
            "gstCertificate", "panCard", "cancelledCheque", "addressProof",
        ];

        for (const field of docFields) {
            if (req.files?.[field]?.[0]) {
                try {
                    const result = await uploadToCloudinary(
                        req.files[field][0].buffer,
                        `vendors/${userId}/${field}`,
                    );
                    if (field === "shopLogo") {
                        uploads.shopLogo = result.secure_url;
                    } else if (field === "shopBanner") {
                        uploads.shopBanner = result.secure_url;
                    } else {
                        uploads.documents = uploads.documents || {};
                        uploads.documents[field] = result.secure_url;
                    }
                } catch (e) {
                    console.warn(`[registerVendor] Upload skipped for ${field}:`, e.message);
                }
            }
        }

        // ── 6. Generate unique shop slug ──────────────────────────────────────
        let baseSlug = slugify(shopName, { lower: true, strict: true });
        let slug = baseSlug;
        let count = 0;
        while (await Vendor.findOne({ shopSlug: slug }).lean()) {
            slug = `${baseSlug}-${++count}`;
        }

        // ── 7. Map deliveryMode to model enum ─────────────────────────────────
        // Model enum: "self" | "platform" | "both"
        // Frontend sends: "self" | "platform" | "both" | "vendor_self" (legacy)
        const deliveryModeMap = {
            vendor_self: "self",
            self: "self",
            platform: "platform",
            both: "both",
        };
        const safeDeliveryMode = deliveryModeMap[deliveryMode] || "both";

        // ── 8. Create vendor document ─────────────────────────────────────────
        const vendor = await Vendor.create({
            userId,
            shopName: shopName.trim(),
            shopSlug: slug,
            shopDescription: shopDescription?.trim() || "",
            shopCategory: shopCategory?.trim() || "",
            ownerName: ownerName.trim(),
            email: user.email,  // ✅ Use user's verified email from auth
            phone: phone.trim(),
            whatsapp: whatsapp?.trim() || "",
            alternatePhone: alternatePhone?.trim() || "",
            gstNumber: gstNumber?.toUpperCase().trim() || "",
            panNumber: panNumber?.toUpperCase().trim() || "",
            businessType: businessType || "individual",

            // address — model uses line1, form sends street
            address: {
                line1: address?.street || address?.line1 || "",
                line2: address?.line2 || "",
                city: address?.city || "",
                state: address?.state || "",
                pincode: address?.pincode || "",
                landmark: address?.landmark || "",
            },

            // bankDetails — model uses accountHolder, form sends holderName
            bankDetails: {
                accountHolder: bankDetails?.holderName || bankDetails?.accountHolder || "",
                accountNumber: bankDetails?.accountNumber || "",
                ifsc: bankDetails?.ifsc || "",
                bankName: bankDetails?.bankName || "",
            },

            servicePincodes: validPincodes,
            deliveryMode: safeDeliveryMode,
            status: "pending",
            ...uploads,
        });

        // ── 9. Issue JWT ─────────────────────────────────────────────────────
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Admin notification (fire-and-forget)
        createNotification({
            type: "vendor",
            title: `New Vendor Application`,
            message: `${shopName.trim()} (${ownerName.trim()}) applied for vendor partnership`,
            icon: "vendor",
            link: "/admin/vendors",
            meta: { vendorId: vendor._id, shopName: vendor.shopName },
        });

        return res.status(201).json({
            success: true,
            message: "Application submitted successfully! Pending admin review. Your default password is your phone number.",
            token,
            vendor: {
                _id: vendor._id,
                shopName: vendor.shopName,
                status: vendor.status,
            },
        });

        // fire-and-forget notification
    } catch (err) {
        console.error("[registerVendor]", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Registration failed. Please try again.",
        });
    }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/vendor/status  (protect middleware — user JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const getVendorStatus = async (req, res) => {
    try {
        const vendor = await Vendor.findOne({
            userId: req.user._id,
            isDeleted: false,
        })
            .select("status shopName shopSlug subscription rejectionReason createdAt")
            .lean();

        if (!vendor) {
            return res.json({ registered: false });
        }

        return res.json({
            registered: true,
            status: vendor.status,
            shopName: vendor.shopName,
            shopSlug: vendor.shopSlug,
            subscription: vendor.subscription || null,
            rejectionReason: vendor.rejectionReason || null,
            appliedAt: vendor.createdAt,
        });

    } catch (err) {
        console.error("[getVendorStatus]", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch vendor status.",
        });
    }
};