import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
import Category from "../models/Category.js";
import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";

const optimizeUrl = (url, width = 400) => {
    if (!url || !url.includes("cloudinary.com")) return url ?? "";
    return url.replace("/upload/", `/upload/q_auto,f_auto,w_${width}/`);
};

const safeDestroy = async (publicId) => {
    if (!publicId) return;
    try { await cloudinary.uploader.destroy(publicId); }
    catch (e) { console.warn("[Cloudinary] Category image delete failed:", e.message); }
};

/* ── GET ALL ACTIVE CATEGORIES (public) ── */
export const getActiveCategories = async (req, res) => {
    try {
        const cached = await getCache("categories:active");
        if (cached) return res.json(cached);

        const categories = await Category.find({ isActive: true })
            .sort({ order: 1, name: 1 })
            .lean();
        await setCache("categories:active", categories, 600); // 10 min
        res.json(categories);
    } catch (err) {
        console.error("GET CATEGORIES ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
};

/* ── GET ALL CATEGORIES (admin) ── */
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find().sort({ order: 1, name: 1 }).lean();
        res.json(categories);
    } catch (err) {
        console.error("GET ALL CATEGORIES ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
};

/* ── GET SINGLE CATEGORY ── */
export const getSingleCategory = async (req, res) => {
    try {
        const cat = await Category.findOne({ slug: req.params.slug }).lean();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });
        res.json(cat);
    } catch (err) {
        console.error("GET CATEGORY ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch category" });
    }
};

/* ── CREATE CATEGORY (admin) ── */
export const createCategory = async (req, res) => {
    try {
        const { name, emoji, color, lightColor, isActive, order } = req.body;

        if (!name?.trim()) return res.status(400).json({ success: false, message: "Category name is required" });

        const existing = await Category.findOne({ name: name.trim() });
        if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

        const image = req.file
            ? await (async () => {
                const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
                return { url: optimizeUrl(result.secure_url), public_id: result.public_id };
            })()
            : { url: "", public_id: "" };

        const category = await Category.create({
            name: name.trim(),
            emoji: emoji || "🏷️",
            color: color || "#1a1740",
            lightColor: lightColor || "#f0eefb",
            isActive: isActive === "true" || isActive === true,
            order: Number(order) || 0,
            image,
        });

        await delCacheByPrefix("categories:");
        res.status(201).json(category);
    } catch (err) {
        console.error("CREATE CATEGORY ERROR:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to create category" });
    }
};

/* ── UPDATE CATEGORY (admin) ── */
export const updateCategory = async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        const { name, emoji, color, lightColor, isActive, order } = req.body;

        if (name !== undefined) cat.name = name.trim();
        if (emoji !== undefined) cat.emoji = emoji;
        if (color !== undefined) cat.color = color;
        if (lightColor !== undefined) cat.lightColor = lightColor;
        if (isActive !== undefined) cat.isActive = isActive === "true" || isActive === true;
        if (order !== undefined) cat.order = Number(order) || 0;

        if (req.file) {
            await safeDestroy(cat.image?.public_id);
            const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
            cat.image = {
                url: optimizeUrl(result.secure_url),
                public_id: result.public_id,
            };
        }

        await cat.save();
        await delCacheByPrefix("categories:");
        res.json(cat);
    } catch (err) {
        console.error("UPDATE CATEGORY ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to update category" });
    }
};

/* ── DELETE CATEGORY (admin) ── */
export const deleteCategory = async (req, res) => {
    try {
        const cat = await Category.findById(req.params.id);
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        await safeDestroy(cat.image?.public_id);
        await cat.deleteOne();
        await delCacheByPrefix("categories:");

        res.json({ message: "Category deleted successfully" });
    } catch (err) {
        console.error("DELETE CATEGORY ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to delete category" });
    }
};