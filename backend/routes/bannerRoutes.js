import express from "express";
import {
    getActiveBanners,
    getAllBanners,
    createBanner,
    updateBanner,
    deleteBanner,
} from "../controllers/bannerController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

/* Wrap multer to catch Cloudinary/upload errors gracefully */
const handleUpload = (req, res, next) => {
    upload.single("image")(req, res, (err) => {
        if (err) {
            console.error("[Banner Upload Error]", err.message, err.stack);
            const msg =
                err.code === "LIMIT_FILE_SIZE" ? "Image must be under 5MB" :
                    err.message || "Image upload failed";
            return res.status(400).json({ success: false, message: msg });
        }
        next();
    });
};

// Public
router.get("/", getActiveBanners);

// Admin
router.get("/all", protect, adminOnly, getAllBanners);
router.post("/", protect, adminOnly, handleUpload, createBanner);
router.put("/:id", protect, adminOnly, handleUpload, updateBanner);
router.delete("/:id", protect, adminOnly, deleteBanner);

export default router;