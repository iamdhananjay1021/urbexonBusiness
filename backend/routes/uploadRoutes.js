import express from "express";
import multer from "multer";
import { protect } from "../middlewares/authMiddleware.js";
import { uploadToCloudinary } from "../config/cloudinary.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files allowed"), false);
        cb(null, true);
    },
});

const router = express.Router();

/* =============================================
   POST /api/uploads/custom-image
   Customer apna photo upload kare
============================================= */
router.post(
    "/custom-image",
    protect,
    upload.single("image"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No image uploaded" });
            }
            const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
            res.json({
                success: true,
                url: result.secure_url,
                public_id: result.public_id,
            });
        } catch (error) {
            console.error("UPLOAD ERROR:", error);
            res.status(500).json({ message: "Upload failed" });
        }
    }
);

export default router;