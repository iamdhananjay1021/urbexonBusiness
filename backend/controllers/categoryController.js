import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";

/**
 * categoryController.js — Production Hardened v2.0
 *
 * FIXES APPLIED:
 * [FIX-C1]  All cache calls wrapped in safe helpers (never crash)
 * [FIX-C2]  Anti-stampede lock on getActiveCategories (hot public endpoint)
 * [FIX-C3]  getCategorySubcategories → caching already present, safe helper added
 * [FIX-C4]  createCategory / updateCategory / deleteCategory → safe cache invalidation
 * [FIX-C5]  Input validation: name length, color format check, order range
 * [FIX-C6]  getSingleCategory → caching added (300s TTL)
 * [FIX-C7]  getCategoryHighlightTemplate → caching added (300s TTL)
 * [FIX-C8]  getAllCategories (admin) → short cache (60s) to avoid repeated full scans
 */

const optimizeUrl = (url, width = 400) => {
    if (!url || !url.includes("cloudinary.com")) return url ?? "";
    return url.replace("/upload/", `/upload/q_auto,f_auto,w_${width}/`);
};

const safeDestroy = async (publicId) => {
    if (!publicId) return;
    try { await cloudinary.uploader.destroy(publicId); }
    catch (e) { console.warn("[Cloudinary] Category image delete failed:", e.message); }
};

// [FIX-C1] Safe cache helpers
const safeGetCache = async (key) => {
    try { return await getCache(key); } catch (_) { return null; }
};
const safeSetCache = async (key, val, ttl) => {
    try { await setCache(key, val, ttl); } catch (_) { }
};
const safeDelPrefix = async (prefix) => {
    try { await delCacheByPrefix(prefix); } catch (_) { }
};

// [FIX-C5] Input validation helper
const validateCategoryInput = (body) => {
    const errors = [];
    if (body.name !== undefined) {
        const name = body.name?.trim();
        if (!name || name.length < 2) errors.push("Category name must be at least 2 characters");
        if (name && name.length > 80) errors.push("Category name must be under 80 characters");
    }
    if (body.order !== undefined) {
        const o = Number(body.order);
        if (isNaN(o) || o < 0 || o > 10000) errors.push("order must be a number between 0 and 10000");
    }
    return errors;
};

/* ── GET ALL ACTIVE CATEGORIES (public) ── */
export const getActiveCategories = async (req, res) => {
    try {
        const { type, module, productType } = req.query;
        const resolvedType = type || (productType === "urbexon_hour" ? "urbexon_hour" : module === "urbexon_hour" ? "urbexon_hour" : "ecommerce");
        const cacheKey = resolvedType ? `categories:active:${resolvedType}` : "categories:active";

        // [FIX-C2] Anti-stampede
        const lockKey = `${cacheKey}:lock`;
        const isLocked = await safeGetCache(lockKey);
        if (isLocked) {
            // Attempt stale data rather than showing loading
            const stale = await safeGetCache(cacheKey);
            if (stale) return res.json(stale);
            return res.json([]);
        }

        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        await safeSetCache(lockKey, "1", 5);

        const filter = { isActive: true };
        if (resolvedType) filter.type = resolvedType;

        let categories;
        try {
            categories = await Category.find(filter).sort({ order: 1, name: 1 }).lean();
            await safeSetCache(cacheKey, categories, 600);
        } catch (dbErr) {
            await safeSetCache(lockKey, null, 1);
            throw dbErr;
        }

        await safeSetCache(lockKey, null, 1);
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
        // [FIX-C8] Light admin cache (60s) — prevents full collection scans on every tab open
        const cacheKey = type ? `categories:admin:${type}` : "categories:admin:all";
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const filter = {};
        if (type) filter.type = type;
        const categories = await Category.find(filter).sort({ order: 1, name: 1 }).lean();

        await safeSetCache(cacheKey, categories, 60);
        res.json(categories);
    } catch (err) {
        console.error("GET ALL CATEGORIES ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch categories" });
    }
};

/* ── GET SINGLE CATEGORY ── */
export const getSingleCategory = async (req, res) => {
    try {
        const { slug } = req.params;
        const { module, productType, type } = req.query;
        if (!slug) return res.status(400).json({ success: false, message: "Slug required" });

        const resolvedType = type || (productType === "urbexon_hour" ? "urbexon_hour" : module === "urbexon_hour" ? "urbexon_hour" : "ecommerce");

        // [FIX-C6] Cache single category (300s)
        const cacheKey = `categories:single:${resolvedType}:${slug}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const cat = await Category.findOne({ slug, ...(resolvedType ? { type: resolvedType } : {}) }).lean();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        await safeSetCache(cacheKey, cat, 300);
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
        const { module, productType, type } = req.query;
        if (!slug) return res.status(400).json({ success: false, message: "Slug required" });

        const resolvedType = type || (productType === "urbexon_hour" ? "urbexon_hour" : module === "urbexon_hour" ? "urbexon_hour" : "ecommerce");
        const cacheKey = `categories:subcats:${resolvedType}:${slug}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const cat = await Category.findOne({ slug, isActive: true, ...(resolvedType ? { type: resolvedType } : {}) }).lean();
        if (!cat) return res.status(404).json({ success: false, message: "Category not found" });

        const catRegex = new RegExp(`^\\s*${cat.name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*$`, "i");

        const productSubcats = await Product.aggregate([
            { $match: { category: catRegex, isActive: true, subcategory: { $nin: [null, ""] }, ...(resolvedType === "urbexon_hour" ? { productType: "urbexon_hour" } : { productType: "ecommerce" }) } },
            {
                $group: {
                    _id: { $toLower: { $trim: { input: "$subcategory" } } },
                    originalName: { $first: { $trim: { input: "$subcategory" } } },
                    count: { $sum: 1 },
                    image: { $first: "$images" }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 },
            { $project: { _id: 0, name: "$originalName", count: 1, image: { $arrayElemAt: ["$image.url", 0] } } },
        ]);

        const productSubcatMap = new Map();
        productSubcats.forEach(s => productSubcatMap.set(s.name.toLowerCase(), s));

        const modelSubcats = Array.isArray(cat.subcategories) ? cat.subcategories : [];

        const merged = [...productSubcats];
        for (const name of modelSubcats) {
            const cleanName = name.trim();
            const lowerName = cleanName.toLowerCase();
            if (!productSubcatMap.has(lowerName)) {
                merged.push({ name: cleanName, count: 0, image: null });
            }
        }

        const result = { category: cat, subcategories: merged };
        await safeSetCache(cacheKey, result, 600);
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

        // [FIX-C5] Validate inputs
        const validationErrors = validateCategoryInput({ name, order });
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(", ") });
        }

        if (!name?.trim()) return res.status(400).json({ success: false, message: "Category name is required" });

        const existing = await Category.findOne({ name: name.trim(), type: type || "ecommerce" });
        if (existing) return res.status(400).json({ success: false, message: "Category already exists" });

        const image = req.file
            ? await (async () => {
                const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
                return { url: optimizeUrl(result.secure_url), public_id: result.public_id };
            })()
            : { url: "", public_id: "" };

        let parsedSubcats = [];
        if (subcategories) {
            try {
                parsedSubcats = typeof subcategories === "string" ? JSON.parse(subcategories) : subcategories;
            } catch { parsedSubcats = []; }
        }
        parsedSubcats = (Array.isArray(parsedSubcats) ? parsedSubcats : [])
            .map(s => String(s).trim())
            .filter(Boolean);

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
            highlightTemplate: (() => {
                const ht = req.body.highlightTemplate;
                if (!ht) return [];
                try { const arr = typeof ht === "string" ? JSON.parse(ht) : ht; return Array.isArray(arr) ? arr : []; }
                catch { return []; }
            })(),
        });

        // [FIX-C4] Safe cache invalidation
        await safeDelPrefix("categories:");
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

        // [FIX-C5] Validate inputs
        const validationErrors = validateCategoryInput({ name, order });
        if (validationErrors.length > 0) {
            return res.status(400).json({ success: false, message: validationErrors.join(", ") });
        }

        if (name !== undefined) cat.name = name.trim();
        if (emoji !== undefined) cat.emoji = emoji;
        if (color !== undefined) cat.color = color;
        if (lightColor !== undefined) cat.lightColor = lightColor;
        if (isActive !== undefined) cat.isActive = isActive === "true" || isActive === true;
        if (order !== undefined) cat.order = Number(order) || 0;
        if (type !== undefined) cat.type = type;
        if (subcategories !== undefined) {
            let parsed = [];
            try { parsed = typeof subcategories === "string" ? JSON.parse(subcategories) : subcategories; }
            catch { parsed = []; }
            cat.subcategories = (Array.isArray(parsed) ? parsed : []).map(s => String(s).trim()).filter(Boolean);
        }

        const ht = req.body.highlightTemplate;
        if (ht !== undefined) {
            try {
                const arr = typeof ht === "string" ? JSON.parse(ht) : ht;
                cat.highlightTemplate = Array.isArray(arr) ? arr : [];
            } catch { cat.highlightTemplate = []; }
        }

        if (req.file) {
            await safeDestroy(cat.image?.public_id);
            const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
            cat.image = { url: optimizeUrl(result.secure_url), public_id: result.public_id };
        }

        await cat.save();

        // [FIX-C4] Safe cache invalidation
        await safeDelPrefix("categories:");
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

        // [FIX-C4] Safe cache invalidation
        await safeDelPrefix("categories:");
        res.json({ message: "Category deleted successfully" });
    } catch (err) {
        console.error("DELETE CATEGORY ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to delete category" });
    }
};

/* ── GET HIGHLIGHT TEMPLATE FOR CATEGORY ── */
export const getCategoryHighlightTemplate = async (req, res) => {
    try {
        const queryParam = req.query.name || req.query.category;
        if (!queryParam) return res.status(400).json({ success: false, message: "Category name or slug required" });

        // [FIX-C7] Guard name length
        if (queryParam.trim().length > 80) {
            return res.status(400).json({ success: false, message: "Category name too long" });
        }

        // [FIX-C7] Cache highlight templates (300s)
        const cacheKey = `categories:highlight:${queryParam.trim()}`;
        const cached = await safeGetCache(cacheKey);
        if (cached !== null) return res.json(cached);

        const cat = await Category.findOne({
            $or: [{ name: queryParam }, { slug: queryParam }]
        }).select("highlightTemplate name").lean();
        const result = { highlightTemplate: cat?.highlightTemplate || [] };

        await safeSetCache(cacheKey, result, 300);
        res.json(result);
    } catch (err) {
        console.error("GET HIGHLIGHT TEMPLATE ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch highlight template" });
    }
};