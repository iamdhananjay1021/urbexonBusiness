import express from "express";
import multer from "multer";
import {
    getCollections,
    getCollectionProducts,
    adminGetCollections,
    adminCreateCollection,
    adminUpdateCollection,
    adminDeleteCollection,
    adminPreviewCollectionCount,
} from "../controllers/collectionController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { imageFileFilter } from "../middlewares/imageFileFilter.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: imageFileFilter,
});

const router = express.Router();

/* ── Admin (specific paths before the :slug catch-all) ── */
router.get("/admin/all", protect, adminOnly, adminGetCollections);
router.post("/admin/preview", protect, adminOnly, adminPreviewCollectionCount);
router.post("/admin", protect, adminOnly, upload.single("image"), adminCreateCollection);
router.put("/admin/:id", protect, adminOnly, upload.single("image"), adminUpdateCollection);
router.delete("/admin/:id", protect, adminOnly, adminDeleteCollection);

/* ── Public ── */
router.get("/", getCollections);
router.get("/:slug", getCollectionProducts);

export default router;
