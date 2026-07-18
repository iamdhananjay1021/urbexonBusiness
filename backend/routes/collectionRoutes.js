import express from "express";
import {
    getCollections,
    getCollectionProducts,
    adminGetCollections,
    adminCreateCollection,
    adminUpdateCollection,
    adminDeleteCollection,
} from "../controllers/collectionController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

/* ── Admin (specific paths before the :slug catch-all) ── */
router.get("/admin/all", protect, adminOnly, adminGetCollections);
router.post("/admin", protect, adminOnly, adminCreateCollection);
router.put("/admin/:id", protect, adminOnly, adminUpdateCollection);
router.delete("/admin/:id", protect, adminOnly, adminDeleteCollection);

/* ── Public ── */
router.get("/", getCollections);
router.get("/:slug", getCollectionProducts);

export default router;
