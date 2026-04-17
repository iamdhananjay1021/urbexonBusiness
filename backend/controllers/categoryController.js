import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
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
        const { type } = req.query;
        const cacheKey = type ? `categories:active:${type}` : "categories:active";
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const filter = { isActive: true };
        if (type) filter.type = type;

        const categories = await Category.find(filter)
            .sort({ order: 1, name: 1 })
            .lean();
        await setCache(cacheKey, categories, 600); // 10 min
        res.json(categories);
    } catch (err) {
        console.error("GET CATEGORIES ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
};

/* ── GET ALL CATEGORIES (admin) ── */
export const getAllCategories = async (req, res) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type) filter.type = type;
        const categories = await Category.find(filter).sort({ order: 1, name: 1 }).lean();
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

/* ── GET SUBCATEGORIES FOR A CATEGORY (public) ── */
export const getCategorySubcategories = async (req, res) => {
    try {
        const { slug } = req.params;
        const cacheKey = `categories:subcats:${slug}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const cat = await Category.findOne({ slug, isActive: true }).lean();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        // Aggregate product-level subcategories (with counts + sample images)
        const productSubcats = await Product.aggregate([
            { $match: { category: cat.name, isActive: true, subcategory: { $nin: [null, ""] } } },
            { $group: { _id: "$subcategory", count: { $sum: 1 }, image: { $first: "$images" } } },
            { $sort: { count: -1 } },
            { $limit: 20 },
            { $project: { _id: 0, name: "$_id", count: 1, image: { $arrayElemAt: ["$image.url", 0] } } },
        ]);

        // Merge with Category model's predefined subcategories
        const productSubcatMap = new Map(productSubcats.map(s => [s.name, s]));
        const modelSubcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];

        // Start with product-matched subcats, then add any model-defined ones missing from products
        const merged = [...productSubcats];
        for (const name of modelSubcats) {
            if (!productSubcatMap.has(name)) {
                merged.push({ name, count: 0, image: null });
            }
        }

        const result = { category: cat, subcategories: merged };
        await setCache(cacheKey, result, 600);
        res.json(result);
    } catch (err) {
        console.error("GET SUBCATEGORIES ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch subcategories" });
    }
};

/* ── CREATE CATEGORY (admin) ── */
export const createCategory = async (req, res) => {
    try {
        const { name, emoji, color, lightColor, isActive, order, type, subcategories } = req.body;

        if (!name?.trim()) return res.status(400).json({ success: false, message: "Category name is required" });

        const existing = await Category.findOne({ name: name.trim(), type: type || "ecommerce" });
        if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

        const image = req.file
            ? await (async () => {
                const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
                return { url: optimizeUrl(result.secure_url), public_id: result.public_id };
            })()
            : { url: "", public_id: "" };

        // Parse subcategories — accept JSON string or array
        let parsedSubcats = [];
        if (subcategories) {
            try {
                parsedSubcats = typeof subcategories === "string" ? JSON.parse(subcategories) : subcategories;
            } catch { parsedSubcats = []; }
        }
        parsedSubcats = (Array.isArray(parsedSubcats) ? parsedSubcats : []).map(s => String(s).trim()).filter(Boolean);

        const category = await Category.create({
            name: name.trim(),
            emoji: emoji || "🏷️",
            color: color || "#1a1740",
            lightColor: lightColor || "#f0eefb",
            isActive: isActive === "true" || isActive === true,
            order: Number(order) || 0,
            type: type || "ecommerce",
            image,
            subcategories: parsedSubcats,
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
        const cat = await Category.findOne({ slug: req.params.slug });
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        const { name, emoji, color, lightColor, isActive, order, type, subcategories } = req.body;

        if (name !== undefined) cat.name = name.trim();
        if (emoji !== undefined) cat.emoji = emoji;
        if (color !== undefined) cat.color = color;
        if (lightColor !== undefined) cat.lightColor = lightColor;
        if (isActive !== undefined) cat.isActive = isActive === "true" || isActive === true;
        if (order !== undefined) cat.order = Number(order) || 0;
        if (type !== undefined) cat.type = type;
        if (subcategories !== undefined) {
            let parsed = [];
            try { parsed = typeof subcategories === "string" ? JSON.parse(subcategories) : subcategories; } catch { parsed = []; }
            cat.subcategories = (Array.isArray(parsed) ? parsed : []).map(s => String(s).trim()).filter(Boolean);
        }

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
        const cat = await Category.findOne({ slug: req.params.slug });
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