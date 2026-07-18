/**
 * collectionController.js — Collection Engine API.
 *
 * Public:
 *   GET /api/collections              → active collections (for nav/home rails)
 *   GET /api/collections/:slug        → collection meta + paged products
 * Admin:
 *   POST   /api/collections/admin
 *   PUT    /api/collections/admin/:id
 *   DELETE /api/collections/admin/:id
 *
 * Collections are rule-based (see Collection model) — products populate
 * automatically, no manual curation.
 */
import Collection from "../models/Collection.js";
import Product from "../models/Product.js";
import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
import { buildCollectionFilter, resolveSort, SORT_MAP } from "../services/collectionService.js";

const safeGetCache = async (key) => { try { return await getCache(key); } catch { return null; } };
const safeSetCache = async (key, val, ttl) => { try { await setCache(key, val, ttl); } catch { /* cache down */ } };
const safeDelPrefix = async (prefix) => { try { await delCacheByPrefix(prefix); } catch { /* cache down */ } };

const clampInt = (v, def, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : def;
};

const PRODUCT_FIELDS =
    "name slug category brand price mrp images rating numReviews inStock stock isDeal dealEndsAt isFeatured tags productType vendorId colorVariants sizes";

/* ── PUBLIC — list active collections ── */
export const getCollections = async (req, res) => {
    try {
        const cacheKey = "collections:list";
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const collections = await Collection.find({ isActive: true })
            .select("name slug description image order")
            .sort({ order: 1, createdAt: -1 })
            .lean();

        const result = { success: true, collections };
        await safeSetCache(cacheKey, result, 300);
        res.json(result);
    } catch (err) {
        console.error("[getCollections]", err);
        res.status(500).json({ success: false, message: "Failed to fetch collections" });
    }
};

/* ── PUBLIC — collection detail + paged products ── */
export const getCollectionProducts = async (req, res) => {
    try {
        const { slug } = req.params;
        const page = clampInt(req.query.page, 1, 1, 1000);
        const limit = clampInt(req.query.limit, 24, 1, 50);
        const sortOverride = req.query.sort && SORT_MAP[req.query.sort] ? req.query.sort : "";

        const cacheKey = `collections:products:${slug}:p${page}:l${limit}:${sortOverride || "_"}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const collection = await Collection.findOne({ slug, isActive: true }).lean();
        if (!collection) return res.status(404).json({ success: false, message: "Collection not found" });

        const filter = buildCollectionFilter(collection.rules);
        const sortObj = resolveSort(sortOverride || collection.sort);
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter).select(PRODUCT_FIELDS).sort(sortObj).skip(skip).limit(limit).lean(),
            Product.countDocuments(filter),
        ]);

        const result = {
            success: true,
            collection: {
                name: collection.name,
                slug: collection.slug,
                description: collection.description,
                image: collection.image?.url || "",
                sort: collection.sort,
                seo: {
                    title: collection.seo?.title || `${collection.name} — Urbexon`,
                    description: collection.seo?.description ||
                        (collection.description || `Shop the ${collection.name} collection on Urbexon.`),
                },
            },
            products, total, page,
            totalPages: Math.ceil(total / limit),
        };

        await safeSetCache(cacheKey, result, 120);
        res.json(result);
    } catch (err) {
        console.error("[getCollectionProducts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch collection" });
    }
};

/* ── ADMIN — helpers ── */
const parseRules = (raw) => {
    let rules = raw;
    if (typeof raw === "string") { try { rules = JSON.parse(raw); } catch { rules = {}; } }
    if (!rules || typeof rules !== "object") rules = {};
    return {
        category: String(rules.category || "").trim().slice(0, 100),
        tags: (Array.isArray(rules.tags) ? rules.tags : String(rules.tags || "").split(","))
            .map((t) => String(t).trim()).filter(Boolean).slice(0, 20),
        brand: String(rules.brand || "").trim().slice(0, 100),
        isDeal: rules.isDeal === true || rules.isDeal === "true",
        isFeatured: rules.isFeatured === true || rules.isFeatured === "true",
        minRating: Math.min(5, Math.max(0, Number(rules.minRating) || 0)),
        minDiscount: Math.min(99, Math.max(0, Number(rules.minDiscount) || 0)),
        maxAgeDays: Math.min(3650, Math.max(0, Number(rules.maxAgeDays) || 0)),
    };
};

const applyBody = (doc, body) => {
    if (body.name !== undefined) doc.name = String(body.name).trim().slice(0, 100);
    if (body.description !== undefined) doc.description = String(body.description).trim().slice(0, 300);
    if (body.rules !== undefined) doc.rules = parseRules(body.rules);
    if (body.sort !== undefined) doc.sort = SORT_MAP[body.sort] ? body.sort : "newest";
    if (body.limit !== undefined) doc.limit = clampInt(body.limit, 24, 1, 100);
    if (body.isActive !== undefined) doc.isActive = body.isActive === true || body.isActive === "true";
    if (body.order !== undefined) doc.order = clampInt(body.order, 0, 0, 10000);
    if (body.seoTitle !== undefined || body.seoDescription !== undefined) {
        doc.seo = {
            title: String(body.seoTitle ?? doc.seo?.title ?? "").trim().slice(0, 120),
            description: String(body.seoDescription ?? doc.seo?.description ?? "").trim().slice(0, 200),
        };
    }
};

/* ── ADMIN — list all (incl. inactive) ── */
export const adminGetCollections = async (req, res) => {
    try {
        const collections = await Collection.find({}).sort({ order: 1, createdAt: -1 }).lean();
        res.json({ success: true, collections });
    } catch (err) {
        console.error("[adminGetCollections]", err);
        res.status(500).json({ success: false, message: "Failed to fetch collections" });
    }
};

/* ── ADMIN — create ── */
export const adminCreateCollection = async (req, res) => {
    try {
        if (!req.body.name?.trim()) {
            return res.status(400).json({ success: false, message: "Collection name is required" });
        }
        const doc = new Collection({});
        applyBody(doc, req.body);
        await doc.save();
        await safeDelPrefix("collections:");
        res.status(201).json({ success: true, collection: doc });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: "A collection with this name already exists" });
        }
        console.error("[adminCreateCollection]", err);
        res.status(500).json({ success: false, message: "Failed to create collection" });
    }
};

/* ── ADMIN — update ── */
export const adminUpdateCollection = async (req, res) => {
    try {
        const doc = await Collection.findById(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: "Collection not found" });
        applyBody(doc, req.body);
        await doc.save();
        await safeDelPrefix("collections:");
        res.json({ success: true, collection: doc });
    } catch (err) {
        console.error("[adminUpdateCollection]", err);
        res.status(500).json({ success: false, message: "Failed to update collection" });
    }
};

/* ── ADMIN — delete ── */
export const adminDeleteCollection = async (req, res) => {
    try {
        const doc = await Collection.findByIdAndDelete(req.params.id);
        if (!doc) return res.status(404).json({ success: false, message: "Collection not found" });
        await safeDelPrefix("collections:");
        res.json({ success: true, message: "Collection deleted" });
    } catch (err) {
        console.error("[adminDeleteCollection]", err);
        res.status(500).json({ success: false, message: "Failed to delete collection" });
    }
};
