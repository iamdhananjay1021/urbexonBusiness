import express from "express";
import multer from "multer";
import {
    getActiveBanners,
    getAllBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    toggleBanner,
} from "../controllers/bannerController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

/* Buffer-based upload (same approach as products/vendors — works in production) */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Only image files allowed"), false);
        }
        cb(null, true);
    },
});

// Public
router.get("/", getActiveBanners);

// Admin
router.get("/all", protect, adminOnly, getAllBanners);
router.post("/", protect, adminOnly, upload.single("image"), createBanner);
router.put("/:id", protect, adminOnly, upload.single("image"), updateBanner);
router.patch("/:id/toggle", protect, adminOnly, toggleBanner);
router.delete("/:id", protect, adminOnly, deleteBanner);

export default router;