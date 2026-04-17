import express from "express";
import multer from "multer";
import {
   getActiveCategories,
   getAllCategories,
   getSingleCategory,
   getCategorySubcategories,
   createCategory,
   updateCategory,
   deleteCategory,
} from "../controllers/categoryController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 5 * 1024 * 1024 },
   fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) return cb(new Error("Only image files allowed"), false);
      cb(null, true);
   },
});

const router = express.Router();

/* ─────────────────────────────────────────────
   PUBLIC ROUTES
───────────────────────────────────────────── */
router.get("/", getActiveCategories);

/* ─────────────────────────────────────────────
   ADMIN ROUTES — specific pehle, dynamic baad mein
───────────────────────────────────────────── */
router.get("/admin/all", protect, adminOnly, getAllCategories);  // ✅ specific pehle

router.post("/", protect, adminOnly, upload.single("image"), createCategory);
router.put("/:slug", protect, adminOnly, upload.single("image"), updateCategory);
router.delete("/:slug", protect, adminOnly, deleteCategory);

/* ─────────────────────────────────────────────
   DYNAMIC ROUTE — sabse baad mein
───────────────────────────────────────────── */
router.get("/:slug/subcategories", getCategorySubcategories);
router.get("/:slug", getSingleCategory);  // ✅ No mongoose auto ObjectId cast

export default router;