import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";

import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { protectVendor, requireApprovedVendor, requireActiveSubscription } from "../middlewares/vendorMiddleware.js";

import {
    getProducts,
    getHomepageProducts,
    getDeals,
    getUrbexonHourProducts,
    getUrbexonHourDeals,
    getUrbexonHourHomepage,
    getProductBySlug,
    getRelatedProducts,
    getSuggestions,
    adminGetAllProducts,
    adminCreateProduct,
    adminUpdateProduct,
    adminDeleteProduct,
    adminGetDealableProducts,
    adminCreateOrUpdateDeal,
    adminRemoveDeal,
    adminGetFlashDealsMetrics,
    adminRefreshFlashDeals,
    vendorGetMyProducts,
    vendorCreateProduct,
    vendorUpdateProduct,
    vendorDeleteProduct,
} from "../controllers/productController.js";

import { validate } from "../middlewares/zodValidate.js";
import { createProductSchema, updateProductSchema } from "../validations/product.schema.js";

/* ───────────────────────────────────────────────
   📦 MULTER CONFIG (SECURE)
─────────────────────────────────────────────── */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 6,
    },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files allowed"), false);
        }
        cb(null, true);
    },
});

/* ───────────────────────────────────────────────
   🔍 FILE LOGGING MIDDLEWARE (DEBUGGING)
─────────────────────────────────────────────── */
const logFiles = (req, res, next) => {
    if (req.files && req.files.length > 0) {
        console.log(`[🖼️ Files Parsed] ${req.files.length} file(s):`);
        req.files.forEach((f, i) => {
            console.log(`  [${i + 1}] ${f.originalname || 'unknown'} - ${f.mimetype} - ${f.size} bytes - Buffer: ${f.buffer ? '✅' : '❌'}`);
        });
    } else {
        console.log(`[🖼️ Files Parsed] No files received. req.files: ${typeof req.files}`);
    }
    next();
};

/* ───────────────────────────────────────────────
   🚫 RATE LIMITING (WRITE APIs)
─────────────────────────────────────────────── */
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many requests, try again later",
});

/* ───────────────────────────────────────────────
   🧠 ROUTER
─────────────────────────────────────────────── */
const router = express.Router();

/* ── Public Routes ───────────────────────────── */
router.get("/", getProducts);
router.get("/homepage", getHomepageProducts);
router.get("/deals", getDeals);
router.get("/suggestions", getSuggestions);
router.get("/urbexon-hour", getUrbexonHourProducts);
router.get("/urbexon-hour/deals", getUrbexonHourDeals);
router.get("/urbexon-hour/homepage", getUrbexonHourHomepage);

/* ── Admin Routes ────────────────────────────── */
router.get(
    "/admin/all",
    protect,
    adminOnly,
    adminGetAllProducts
);

router.post(
    "/admin",
    protect,
    adminOnly,
    writeLimiter,
    upload.array("images", 6),
    logFiles,
    validate(createProductSchema),
    adminCreateProduct
);

router.put(
    "/admin/:id",
    protect,
    adminOnly,
    writeLimiter,
    upload.array("images", 6),
    logFiles,
    validate(updateProductSchema),
    adminUpdateProduct
);

router.delete(
    "/admin/:id",
    protect,
    adminOnly,
    writeLimiter,
    adminDeleteProduct
);

/* ── Vendor Routes ───────────────────────────── */
router.get(
    "/vendor/mine",
    protectVendor,
    requireApprovedVendor,
    vendorGetMyProducts
);

router.post(
    "/vendor",
    protectVendor,
    requireApprovedVendor,
    requireActiveSubscription,
    writeLimiter,
    upload.array("images", 4),
    vendorCreateProduct
);

router.put(
    "/vendor/:id",
    protectVendor,
    requireApprovedVendor,
    requireActiveSubscription,
    writeLimiter,
    upload.array("images", 4),
    vendorUpdateProduct
);

router.delete(
    "/vendor/:id",
    protectVendor,
    requireApprovedVendor,
    requireActiveSubscription,
    writeLimiter,
    vendorDeleteProduct
);

/* ── Flash Deals Management Routes ────────────── */
router.get(
    "/admin/deals/available-products",
    protect,
    adminOnly,
    adminGetDealableProducts
);

router.post(
    "/admin/deals/create",
    protect,
    adminOnly,
    writeLimiter,
    adminCreateOrUpdateDeal
);

router.delete(
    "/admin/deals/:productId",
    protect,
    adminOnly,
    writeLimiter,
    adminRemoveDeal
);

router.get(
    "/admin/deals/metrics",
    protect,
    adminOnly,
    adminGetFlashDealsMetrics
);

router.post(
    "/admin/deals/refresh",
    protect,
    adminOnly,
    writeLimiter,
    adminRefreshFlashDeals
);

/* ── Dynamic Routes (ALWAYS LAST) ───────────── */
router.get("/:id/related", getRelatedProducts);
router.get("/:id", getProductBySlug);

export default router;