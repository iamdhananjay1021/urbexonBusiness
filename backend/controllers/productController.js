import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
/**
 * productController.js — Production Hardened v2.0
 *
 * FIXES APPLIED:
 * [FIX-P1]  Cache keys: NO JSON.stringify → deterministic flat keys
 * [FIX-P2]  Anti-stampede lock releases on DB error (was leaking)
 * [FIX-P3]  Input validation: page, limit, search (max 50 chars), prices
 * [FIX-P4]  getDeals → caching added (120s TTL) + input validation
 * [FIX-P5]  getRelatedProducts → caching added (60s TTL)
 * [FIX-P6]  getUrbexonHourProducts → caching added (60s TTL)
 * [FIX-P7]  adminGetAllProducts → input validation added
 * [FIX-P8]  Cache helper calls wrapped in try/catch (never crash on cache fail)
 * [FIX-P9]  getSuggestions → search length guard added
 * [FIX-P10] getProductBySlug → caching added (60s TTL)
 */
import Product from "../models/Product.js";
import { uploadToCloudinary } from "../config/cloudinary.js";
import { sendRestockNotifications } from "./stockNotificationController.js";
import { handlePriceChange, handleBackInStock } from "../services/productReminders.js";

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Category slug → regex matcher
const slugToRegex = (slug) => {
    if (!slug) return null;
    const str = slug.replace(/-/g, "[\\s-]");
    return new RegExp(str, "i");
};

// [FIX-P3] Safe param parsers
const safeInt = (val, def, min, max) => {
    const n = parseInt(val);
    if (isNaN(n)) return def;
    return Math.min(max, Math.max(min, n));
};

// [FIX-P8] Safe cache get — never throws, returns null on failure
const safeGetCache = async (key) => {
    try {
        const cached = await getCache(key);
        if (cached) {
            console.log(`[Cache] ✅ HIT: ${key}`);
        }
        return cached;
    } catch (err) {
        console.warn(`[Cache] ⚠️  GET failed for "${key}": ${err.message}, using DB`);
        return null;
    }
};

// [FIX-P8] Safe cache set — never throws
const safeSetCache = async (key, val, ttl) => {
    try {
        await setCache(key, val, ttl);
    } catch (err) {
        console.warn(`[Cache] ⚠️  SET failed for "${key}": ${err.message}`);
    }
};

// [FIX-P8] Safe cache delete by prefix — never throws
const safeDelPrefix = async (prefix) => {
    try {
        await delCacheByPrefix(prefix);
    } catch (err) {
        console.warn(`[Cache] ⚠️  DEL PREFIX failed for "${prefix}": ${err.message}`);
    }
};

// [FIX] Safe cache delete single key — for proper cache invalidation
const safeDelCache = async (key) => {
    try {
        const { delCache } = await import("../utils/Cache.js");
        await delCache(key);
    } catch (err) {
        console.warn(`[Cache] ⚠️  DEL failed for "${key}": ${err.message}`);
    }
};

/* ════════════════════════════════════════
   PUBLIC — Get products (ecommerce only by default)
════════════════════════════════════════ */
export const getProducts = async (req, res) => {
    try {
        const {
            category, subcategory, search, sort = "createdAt", order = "desc",
            productType, vendorId, featured, minPrice, maxPrice, deal,
        } = req.query;

        // [FIX-P3] Validate and clamp numeric params
        const page = safeInt(req.query.page, 1, 1, 1000);
        const limit = safeInt(req.query.limit, 20, 1, 50);

        // [FIX-P3] Search length guard
        const searchRaw = search?.trim() || "";
        if (searchRaw.length > 50) {
            return res.status(400).json({ success: false, message: "Search query too long (max 50 characters)" });
        }

        // [FIX-P3] Price validation
        if (minPrice !== undefined && (isNaN(Number(minPrice)) || Number(minPrice) < 0)) {
            return res.status(400).json({ success: false, message: "minPrice must be a non-negative number" });
        }
        if (maxPrice !== undefined && (isNaN(Number(maxPrice)) || Number(maxPrice) < 0)) {
            return res.status(400).json({ success: false, message: "maxPrice must be a non-negative number" });
        }
        if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
            return res.status(400).json({ success: false, message: "minPrice cannot exceed maxPrice" });
        }

        // [FIX-P1] Deterministic flat cache key — NO JSON.stringify
        const cacheKey = [
            "products",
            `p${page}`,
            `l${limit}`,
            category || "_",
            subcategory || "_",
            searchRaw ? `q${searchRaw.slice(0, 30)}` : "_",
            sort,
            order,
            productType || "_",
            vendorId || "_",
            featured || "0",
            minPrice || "0",
            maxPrice || "0",
            deal || "0",
        ].join(":");

        const lockKey = `${cacheKey}:lock`;

        // Anti-stampede: check lock
        const isLocked = await safeGetCache(lockKey);
        if (isLocked) return res.json({ loading: true });

        // Check cache before locking
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        // CACHE MISS - proceed to DB
        console.log(`[Cache] ⚠️  MISS: ${cacheKey} (will fetch from DB)`);

        // Set lock
        await safeSetCache(lockKey, "1", 5);

        const filter = { isActive: true };

        if (productType) {
            filter.productType = productType;
        } else if (!searchRaw) {
            filter.productType = "ecommerce";
        }

        if (vendorId) filter.vendorId = vendorId;
        if (featured === "true") filter.isFeatured = true;
        if (deal === "true") {
            filter.isDeal = true;
            filter.$or = [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }];
        }
        if (category) {
            const rx = slugToRegex(category);
            if (rx) filter.category = rx;
        }
        if (subcategory) {
            filter.subcategory = {
                $regex: new RegExp(`^${subcategory.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i"),
            };
        }
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
        if (searchRaw) {
            const rx = { $regex: escapeRegex(searchRaw), $options: "i" };
            filter.$or = [
                { name: rx }, { category: rx },
                { brand: rx }, { tags: { $elemMatch: rx } },
            ];
            if (!productType) filter.productType = "ecommerce";
        }

        const sortMap = {
            price_asc: { price: 1 },
            price_desc: { price: -1 },
            rating: { rating: -1, createdAt: -1 },
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            discount: { mrp: -1, price: 1, createdAt: -1 },
        };
        const sortObj = sortMap[sort] || { [sort]: order === "asc" ? 1 : -1 };
        const skip = (page - 1) * limit;

        let result;
        try {
            const [products, total] = await Promise.all([
                Product.find(filter)
                    .select("name slug category brand price mrp images rating numReviews inStock stock isDeal dealEndsAt isFeatured tags productType vendorId")
                    .sort(sortObj).skip(skip).limit(limit).lean(),
                Product.countDocuments(filter),
            ]);

            result = { products, total, page, totalPages: Math.ceil(total / limit) };
            await safeSetCache(cacheKey, result, 60);
        } catch (dbErr) {
            // [FIX-P2] Release lock on DB failure so next request isn't blocked
            await safeDelPrefix(lockKey);
            throw dbErr;
        }

        // Release lock (set TTL-0 equivalent by overwriting with expired TTL)
        await safeSetCache(lockKey, "0", 1);

        res.json(result);
    } catch (err) {
        console.error("[getProducts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch products" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Homepage data
════════════════════════════════════════ */
export const getHomepageProducts = async (req, res) => {
    try {
        const CACHE_KEY = "homepage:products";
        const cached = await safeGetCache(CACHE_KEY);
        if (cached) return res.json(cached);

        // CACHE MISS - proceed to DB
        console.log(`[Cache] ⚠️  MISS: ${CACHE_KEY} (will fetch from DB)`);

        const base = { isActive: true, productType: "ecommerce" };

        const [featured, newArrivals, deals, productCount, cats] = await Promise.all([
            Product.find({ ...base, isFeatured: true })
                .select("name slug price mrp images category rating isDeal inStock stock")
                .sort({ createdAt: -1 }).limit(8).lean(),

            Product.find(base)
                .select("name slug price mrp images category rating isDeal inStock stock")
                .sort({ createdAt: -1 }).limit(12).lean(),

            Product.find({
                ...base,
                isDeal: true,
                $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }],
            })
                .select("name slug price mrp images category rating isDeal dealEndsAt inStock stock")
                .sort({ createdAt: -1 }).limit(8).lean(),

            Product.countDocuments({ isActive: true }),
            Product.distinct("category", { isActive: true, productType: "ecommerce" }),
        ]);

        const result = {
            featured,
            newArrivals,
            deals,
            stats: { products: productCount, categories: cats.length },
        };

        await safeSetCache(CACHE_KEY, result, 300);
        res.json(result);
    } catch (err) {
        console.error("[getHomepageProducts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch homepage data" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Search suggestions (lightweight)
════════════════════════════════════════ */
export const getSuggestions = async (req, res) => {
    try {
        const { q, productType } = req.query;
        if (!q || q.trim().length < 2) return res.json([]);

        // [FIX-P9] Guard suggestion query length
        if (q.trim().length > 50) return res.json([]);

        const regex = { $regex: escapeRegex(q.trim()), $options: "i" };
        const typeFilter = productType === "urbexon_hour" ? "urbexon_hour" : "ecommerce";

        // [FIX-P6] Light cache for suggestions (30s — fast but not stale)
        const cacheKey = `suggestions:${typeFilter}:${q.trim().slice(0, 30)}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        // CACHE MISS - proceed to DB
        console.log(`[Cache] ⚠️  MISS: ${cacheKey} (will fetch from DB)`);

        const products = await Product.find({
            isActive: true, inStock: true, productType: typeFilter,
            $or: [{ name: regex }, { category: regex }, { brand: regex }],
        }).select("name category brand slug images price mrp").limit(8).lean();

        await safeSetCache(cacheKey, products, 30);
        res.json(products);
    } catch (err) {
        console.error("[getSuggestions]", err);
        res.json([]);
    }
};

/* ════════════════════════════════════════
   PUBLIC — Deals page
════════════════════════════════════════ */
export const getDeals = async (req, res) => {
    try {
        const { category, sort = "newest", productType } = req.query;

        // [FIX-P3] Validated params
        const page = safeInt(req.query.page, 1, 1, 500);
        const limit = safeInt(req.query.limit, 20, 1, 50);

        const typeFilter = productType === "urbexon_hour" ? "urbexon_hour" : "ecommerce";

        // [FIX-P4] Cache deals at 120s TTL
        const cacheKey = `deals:${typeFilter}:${category || "_"}:${sort}:p${page}:l${limit}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        // CACHE MISS - proceed to DB
        console.log(`[Cache] ⚠️  MISS: ${cacheKey} (will fetch from DB)`);

        const filter = {
            isActive: true,
            isDeal: true,
            productType: typeFilter,
            $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }],
        };
        if (category) { const rx = slugToRegex(category); if (rx) filter.category = rx; }

        const sortMap = {
            newest: { createdAt: -1 },
            price_asc: { price: 1 },
            price_desc: { price: -1 },
            discount: { mrp: -1 },
        };
        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            Product.find(filter)
                .select("name slug price mrp images category rating isDeal dealEndsAt inStock stock isFeatured")
                .sort(sortMap[sort] || { createdAt: -1 })
                .skip(skip).limit(limit).lean(),
            Product.countDocuments(filter),
        ]);

        const result = { products, total, page, totalPages: Math.ceil(total / limit) };
        await safeSetCache(cacheKey, result, 120);
        res.json(result);
    } catch (err) {
        console.error("[getDeals]", err);
        res.status(500).json({ success: false, message: "Failed to fetch deals" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Urbexon Hour products (vendor only)
════════════════════════════════════════ */
export const getUrbexonHourProducts = async (req, res) => {
    try {
        const { vendorId, category, search } = req.query;

        // [FIX-P3] Validated params
        const page = safeInt(req.query.page, 1, 1, 500);
        const limit = safeInt(req.query.limit, 20, 1, 50);

        // [FIX-P3] Search guard
        const searchRaw = search?.trim().slice(0, 50) || "";
        if (search?.trim().length > 50) {
            return res.status(400).json({ success: false, message: "Search query too long (max 50 characters)" });
        }

        // [FIX-P6] Cache UH products listing
        const cacheKey = `uh:products:${vendorId || "_"}:${category || "_"}:${searchRaw || "_"}:p${page}:l${limit}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const filter = { productType: "urbexon_hour", isActive: true };
        if (vendorId) filter.vendorId = vendorId;
        if (category) { const rx = slugToRegex(category); if (rx) filter.category = rx; }
        if (searchRaw) filter.name = { $regex: escapeRegex(searchRaw), $options: "i" };

        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate("vendorId", "shopName shopLogo rating isOpen city")
                .select("name slug price mrp images brand inStock stock rating tag prepTimeMinutes isDeal dealEndsAt category isFeatured")
                .sort({ isFeatured: -1, createdAt: -1 })
                .skip(skip).limit(limit).lean(),
            Product.countDocuments(filter),
        ]);

        const result = { products, total, page, totalPages: Math.ceil(total / limit) };
        await safeSetCache(cacheKey, result, 60);
        res.json(result);
    } catch (err) {
        console.error("[getUrbexonHourProducts]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Urbexon Hour Homepage Data (single-call)
════════════════════════════════════════ */
export const getUrbexonHourHomepage = async (req, res) => {
    try {
        const CACHE_KEY = "uh:homepage";
        const cached = await safeGetCache(CACHE_KEY);
        if (cached) return res.json(cached);

        const base = { isActive: true, productType: "urbexon_hour" };
        const selectFields = "name slug price mrp images category rating numReviews isFeatured brand inStock stock vendorId isDeal dealEndsAt tag prepTimeMinutes";

        const [bestSellers, recommended, topDeals, trending, budgetPicks, categories, totalProducts, totalVendors] = await Promise.all([
            Product.find({ ...base, $or: [{ isFeatured: true }, { rating: { $gte: 4 } }] })
                .populate("vendorId", "shopName shopLogo")
                .select(selectFields)
                .sort({ rating: -1, numReviews: -1, createdAt: -1 })
                .limit(14).lean(),

            Product.find(base)
                .populate("vendorId", "shopName shopLogo")
                .select(selectFields)
                .sort({ createdAt: -1 })
                .limit(14).lean(),

            Product.find({
                ...base,
                isDeal: true,
                $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }],
            })
                .populate("vendorId", "shopName shopLogo")
                .select(selectFields)
                .sort({ createdAt: -1 })
                .limit(14).lean(),

            Product.find({ ...base, numReviews: { $gte: 1 } })
                .populate("vendorId", "shopName shopLogo")
                .select(selectFields)
                .sort({ numReviews: -1, rating: -1 })
                .limit(14).lean(),

            Product.find({ ...base, price: { $lte: 500 } })
                .populate("vendorId", "shopName shopLogo")
                .select(selectFields)
                .sort({ price: 1 })
                .limit(14).lean(),

            Product.aggregate([
                { $match: base },
                { $group: { _id: "$category", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 20 },
            ]),

            Product.countDocuments(base),
            Product.distinct("vendorId", base).then(ids => ids.length),
        ]);

        const byCategory = {};
        recommended.forEach(p => {
            if (!p.category) return;
            if (!byCategory[p.category]) byCategory[p.category] = [];
            if (byCategory[p.category].length < 8) byCategory[p.category].push(p);
        });

        const result = {
            bestSellers, recommended, topDeals, trending, budgetPicks,
            categorySections: byCategory,
            categoryStats: categories,
            stats: { totalProducts, totalVendors },
        };

        await safeSetCache(CACHE_KEY, result, 180);
        res.json(result);
    } catch (err) {
        console.error("[getUrbexonHourHomepage]", err);
        res.status(500).json({ success: false, message: "Failed to fetch UH homepage data" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Urbexon Hour Flash Deals (BACKEND-MANAGED)
════════════════════════════════════════ */
export const getUrbexonHourDeals = async (req, res) => {
    try {
        const limit = safeInt(req.query.limit, 12, 1, 50);
        const { refresh = false } = req.query;
        const cacheKey = "uh_flash_deals";

        if (!refresh) {
            const cached = await safeGetCache(cacheKey);
            if (cached) return res.json(cached);
        }

        const now = new Date();
        const filter = {
            productType: "urbexon_hour",
            isActive: true,
            isDeal: true,
            inStock: true,
            stock: { $gt: 0 },
            $and: [
                { $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: now } }] },
                { $or: [{ dealStartsAt: null }, { dealStartsAt: { $lte: now } }] },
            ],
        };

        const products = await Product.find(filter)
            .select("+dealStartsAt +dealEndsAt +views +sales +discount")
            .populate("vendorId", "shopName shopLogo rating isOpen city")
            .sort({
                dealPriority: -1,
                discount: -1,
                dealEndsAt: 1,
                sales: -1,
                views: -1,
                createdAt: -1,
            })
            .limit(limit)
            .lean();

        const enrichedDeals = products.map(p => ({
            ...p,
            timeRemaining: p.dealEndsAt ? Math.max(0, new Date(p.dealEndsAt) - now) : null,
            urgencyScore: p.dealEndsAt
                ? Math.min(100, Math.max(0, (30 * 60 * 1000 - (new Date(p.dealEndsAt) - now)) / (30 * 60 * 1000) * 100))
                : 0,
            discountPercent: p.mrp && p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
            dealStatus: p.dealEndsAt && (new Date(p.dealEndsAt) - now) < 60 * 60 * 1000 ? "ending-soon" : "hot-deal",
        }));

        const response = {
            success: true,
            products: enrichedDeals,
            totalDeals: enrichedDeals.length,
            lastUpdated: new Date().toISOString(),
            cacheValidUntil: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
            meta: {
                hotDealsCount: enrichedDeals.filter(p => p.dealStatus === "hot-deal").length,
                endingSoonCount: enrichedDeals.filter(p => p.dealStatus === "ending-soon").length,
                avgDiscount: Math.round(enrichedDeals.reduce((sum, p) => sum + p.discountPercent, 0) / (enrichedDeals.length || 1)),
            },
        };

        let cacheTTL = 300;
        if (enrichedDeals.length > 0) {
            const nearestEndTime = enrichedDeals
                .filter(p => p.timeRemaining !== null && p.timeRemaining > 0)
                .map(p => p.timeRemaining)
                .sort((a, b) => a - b)[0];
            if (nearestEndTime) {
                cacheTTL = Math.min(300, Math.ceil((nearestEndTime + 60000) / 1000));
            }
        }

        await safeSetCache(cacheKey, response, cacheTTL);
        res.json(response);
    } catch (err) {
        console.error("[getUrbexonHourDeals]", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch flash deals",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Single product by slug or id
════════════════════════════════════════ */
export const getProductBySlug = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: "Product ID or slug required" });

        // [FIX-P10] Cache individual product pages (60s)
        const cacheKey = `product:${id}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const isObjectId = /^[a-f\d]{24}$/i.test(id);
        const product = await Product.findOne({
            ...(isObjectId ? { _id: id } : { slug: id }),
            isActive: true,
        }).populate("vendorId", "shopName shopLogo rating isOpen city").lean();

        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        await safeSetCache(cacheKey, product, 60);
        res.json(product);
    } catch (err) {
        console.error("[getProductBySlug]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Related products by category/tags
════════════════════════════════════════ */
export const getRelatedProducts = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: "Product ID or slug required" });

        // [FIX-P5] Cache related products (60s)
        const cacheKey = `related:${id}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const isObjectId = /^[a-f\d]{24}$/i.test(id);
        const product = await Product.findOne({
            ...(isObjectId ? { _id: id } : { slug: id }),
            isActive: true,
        }).select("_id category tags productType").lean();

        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const orConditions = [{ category: product.category }];
        if (product.tags?.length) {
            orConditions.push({ tags: { $in: product.tags } });
        }

        const related = await Product.find({
            _id: { $ne: product._id },
            isActive: true,
            productType: product.productType || "ecommerce",
            $or: orConditions,
        })
            .select("name slug price mrp images category rating isFeatured inStock stock isDeal")
            .populate("vendorId", "shopName shopLogo rating isOpen city")
            .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
            .limit(10).lean();

        await safeSetCache(cacheKey, related, 60);
        res.json(related);
    } catch (err) {
        console.error("[getRelatedProducts]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Get all products
════════════════════════════════════════ */
export const adminGetAllProducts = async (req, res) => {
    try {
        const { search, productType, category, inStock } = req.query;

        // [FIX-P7] Validate admin query params
        const page = safeInt(req.query.page, 1, 1, 10000);
        const limit = safeInt(req.query.limit, 20, 1, 100);

        const searchRaw = search?.trim() || "";
        if (searchRaw.length > 50) {
            return res.status(400).json({ success: false, message: "Search too long (max 50 chars)" });
        }

        const filter = { isActive: { $ne: false } };
        if (productType) filter.productType = productType;
        if (category) filter.category = { $regex: escapeRegex(category), $options: "i" };
        if (inStock === "true") filter.inStock = true;
        if (inStock === "false") filter.inStock = false;
        if (searchRaw) filter.$or = [
            { name: { $regex: escapeRegex(searchRaw), $options: "i" } },
            { category: { $regex: escapeRegex(searchRaw), $options: "i" } },
            { sku: { $regex: escapeRegex(searchRaw), $options: "i" } },
        ];

        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate("vendorId", "shopName")
                .select("name slug category brand price mrp stock inStock isActive isDeal isFeatured productType vendorId createdAt")
                .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[adminGetAllProducts]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Create product
════════════════════════════════════════ */
export const adminCreateProduct = async (req, res) => {
    try {
        let body = { ...req.body };

        const safeParse = (val, fallback) => {
            try { return typeof val === "string" ? JSON.parse(val) : val; }
            catch { return fallback; }
        };

        body.sizes = safeParse(body.sizes, []);
        body.highlights = safeParse(body.highlights, {});
        body.highlightsArray = safeParse(body.highlightsArray, []);
        body.customizationConfig = safeParse(body.customizationConfig, null);

        if (!body.name?.trim() || !body.price || !body.category) {
            return res.status(400).json({ success: false, message: "Name, price and category are required" });
        }

        const parseBool = (v) => v === "true" || v === true;
        const toNum = (v, def = 0) => { const n = Number(v); return isNaN(n) ? def : n; };

        const isFeatured = parseBool(body.isFeatured);
        const isDeal = parseBool(body.isDeal);
        const isCustomizable = parseBool(body.isCustomizable);
        const price = toNum(body.price);
        const mrp = body.mrp ? toNum(body.mrp) : null;
        const cost = toNum(body.cost);
        const stock = toNum(body.stock);
        const gstPercent = toNum(body.gstPercent);

        if (price <= 0) {
            return res.status(400).json({ success: false, message: "Invalid price value" });
        }

        const tags = body.tags
            ? Array.isArray(body.tags) ? body.tags : body.tags.split(",").map(t => t.trim()).filter(Boolean)
            : [];

        const sizes = Array.isArray(body.sizes)
            ? body.sizes.map(s => {
                if (typeof s === "string") return { size: s, stock: 0 };
                if (typeof s === "object" && s.size) return { size: String(s.size), stock: toNum(s.stock) };
                return null;
            }).filter(Boolean)
            : [];

        const images = [];
        const imageErrors = [];

        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            console.warn(`[adminCreateProduct] ⚠️ No image files received.`);
        } else {
            console.log(`[adminCreateProduct] 📁 Processing ${req.files.length} image file(s)`);
            for (let i = 0; i < Math.min(6, req.files.length); i++) {
                const file = req.files[i];
                try {
                    if (!file || !file.buffer) throw new Error(`File ${i + 1} is invalid or missing buffer`);
                    const result = await uploadToCloudinary(file.buffer, "products");
                    if (result?.secure_url) {
                        images.push({
                            url: result.secure_url,
                            publicId: result.public_id || "",
                            alt: body.name?.trim() || "product-image",
                            fileName: file.originalname || `image-${i + 1}`,
                        });
                    } else {
                        throw new Error(`Cloudinary did not return secure_url`);
                    }
                } catch (err) {
                    imageErrors.push(`Image ${i + 1}: ${err.message}`);
                    console.error(`[adminCreateProduct] ❌ Image ${i + 1}: ${err.message}`);
                }
            }
        }

        if (images.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least 1 image is required. Check file format and size (max 5MB).",
                errors: imageErrors,
            });
        }

        let dealEndsAt = null;
        if (isDeal && body.dealEndsAt) {
            const d = new Date(body.dealEndsAt);
            if (!isNaN(d.getTime())) dealEndsAt = d;
        }

        const product = await Product.create({
            name: body.name.trim(),
            description: body.description?.trim() || "",
            price, mrp, cost,
            category: body.category,
            subcategory: body.subcategory || "",
            brand: body.brand || "",
            sku: body.sku || "",
            weight: body.weight || "",
            origin: body.origin || "",
            returnPolicy: body.returnPolicy || "",
            shippingInfo: body.shippingInfo || "",
            color: body.color || "",
            material: body.material || "",
            occasion: body.occasion || "",
            tags, sizes,
            highlights: body.highlights || {},
            highlightsArray: Array.isArray(body.highlightsArray) ? body.highlightsArray : [],
            images,
            stock,
            inStock: stock > 0,
            isFeatured, isDeal, dealEndsAt,
            gstPercent, isCustomizable,
            ...(isCustomizable && body.customizationConfig ? { customizationConfig: body.customizationConfig } : {}),
            isCancellable: body.isCancellable !== "false" && body.isCancellable !== false,
            isReturnable: body.isReturnable !== "false" && body.isReturnable !== false,
            isReplaceable: body.isReplaceable === "true" || body.isReplaceable === true,
            returnWindow: Math.min(30, Math.max(0, Number(body.returnWindow) || 7)),
            replacementWindow: Math.min(30, Math.max(0, Number(body.replacementWindow) || 7)),
            cancelWindow: Math.min(72, Math.max(0, Number(body.cancelWindow) || 0)),
            nonReturnableReason: (body.nonReturnableReason || "").trim().slice(0, 200),
            productType: "ecommerce",
            vendorId: null,
            isActive: true,
        });

        // [FIX-P8] Safe cache invalidation - clear all related caches
        await Promise.all([
            safeDelPrefix("homepage:"),
            safeDelPrefix("products:"),
            safeDelPrefix("deals:"),
            safeDelPrefix("suggestions:"),
            safeDelPrefix("related:"),
            safeDelPrefix("urbexon_hour:"),
        ]);

        return res.status(201).json({ success: true, product });
    } catch (err) {
        console.error("[adminCreateProduct]", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to create product" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Update product
════════════════════════════════════════ */
export const adminUpdateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const body = req.body;
        const oldPrice = product.price;

        const parseBool = (val) => val === "true" || val === true;
        const safeNumber = (val, fallback = 0) => { const num = Number(val); return isNaN(num) ? fallback : num; };

        if (req.files?.length) {
            const newImages = [];
            for (const file of req.files.slice(0, 6)) {
                try {
                    const result = await uploadToCloudinary(file.buffer, "products");
                    if (result?.secure_url) {
                        newImages.push({ url: result.secure_url, publicId: result.public_id || "", alt: body.name?.trim() || product.name });
                    }
                } catch { console.warn("⚠️ Image upload failed, skipping file"); }
            }
            if (newImages.length) product.images = newImages;
        }

        const fieldMap = {
            name: (v) => v?.trim(),
            description: (v) => v?.trim(),
            price: (v) => safeNumber(v),
            mrp: (v) => (v ? safeNumber(v) : null),
            cost: (v) => safeNumber(v),
            category: (v) => v,
            subcategory: (v) => v,
            brand: (v) => v,
            sku: (v) => v,
            weight: (v) => v,
            origin: (v) => v,
            returnPolicy: (v) => v,
            shippingInfo: (v) => v,
            color: (v) => v,
            material: (v) => v,
            occasion: (v) => v,
            gstPercent: (v) => safeNumber(v),
            stock: (v) => safeNumber(v),
        };

        for (const key in fieldMap) {
            if (body[key] !== undefined) product[key] = fieldMap[key](body[key]);
        }

        if (body.isFeatured !== undefined) product.isFeatured = parseBool(body.isFeatured);
        if (body.isDeal !== undefined) product.isDeal = parseBool(body.isDeal);
        if (body.isActive !== undefined) product.isActive = parseBool(body.isActive);
        if (body.isCustomizable !== undefined) product.isCustomizable = parseBool(body.isCustomizable);

        if (body.isCancellable !== undefined) product.isCancellable = parseBool(body.isCancellable);
        if (body.isReturnable !== undefined) product.isReturnable = parseBool(body.isReturnable);
        if (body.isReplaceable !== undefined) product.isReplaceable = parseBool(body.isReplaceable);
        if (body.returnWindow !== undefined) product.returnWindow = Math.min(30, Math.max(0, safeNumber(body.returnWindow, 7)));
        if (body.replacementWindow !== undefined) product.replacementWindow = Math.min(30, Math.max(0, safeNumber(body.replacementWindow, 7)));
        if (body.cancelWindow !== undefined) product.cancelWindow = Math.min(72, Math.max(0, safeNumber(body.cancelWindow, 0)));
        if (body.nonReturnableReason !== undefined) product.nonReturnableReason = (body.nonReturnableReason || "").trim().slice(0, 200);

        if (body.customizationConfig !== undefined) {
            try {
                const raw = typeof body.customizationConfig === 'string' ? JSON.parse(body.customizationConfig) : body.customizationConfig;
                if (raw && typeof raw === 'object') product.customizationConfig = raw;
            } catch { /* ignore bad JSON */ }
        }

        if (body.highlights !== undefined) {
            try {
                const raw = typeof body.highlights === 'string' ? JSON.parse(body.highlights) : body.highlights;
                if (raw && typeof raw === 'object') product.highlights = raw;
            } catch { /* ignore */ }
        }

        if (body.highlightsArray !== undefined) {
            try {
                const raw = typeof body.highlightsArray === 'string' ? JSON.parse(body.highlightsArray) : body.highlightsArray;
                product.highlightsArray = Array.isArray(raw) ? raw : [];
            } catch { product.highlightsArray = []; }
        }

        if (body.dealEndsAt !== undefined) {
            const d = new Date(body.dealEndsAt);
            product.dealEndsAt = !isNaN(d.getTime()) ? d : null;
        }
        if (!product.isDeal) product.dealEndsAt = null;

        if (body.tags !== undefined) {
            const rawTags = Array.isArray(body.tags) ? body.tags : body.tags.split(",");
            product.tags = rawTags.map(t => t.trim()).filter(Boolean);
        }

        if (body.sizes !== undefined) {
            try {
                const rawSizes = typeof body.sizes === "string" ? JSON.parse(body.sizes) : body.sizes;
                if (Array.isArray(rawSizes)) {
                    product.sizes = rawSizes.map(s => {
                        if (typeof s === "string") return { size: s, stock: 0 };
                        if (typeof s === "object") return { size: String(s.size || s.label || "").trim(), stock: safeNumber(s.stock) };
                        return null;
                    }).filter(s => s && s.size);
                } else {
                    product.sizes = [];
                }
            } catch { product.sizes = []; }
        }

        if (product.sizes.length > 0) {
            product.stock = product.sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
        }

        const wasOutOfStock = !product.inStock;
        product.inStock = product.stock > 0;

        await product.save();

        if (wasOutOfStock && product.inStock) {
            sendRestockNotifications(product._id, product.name, product.slug);
            handleBackInStock(product);
        }

        if (product.price !== oldPrice && product.price < oldPrice) {
            handlePriceChange(product, oldPrice, product.price, req.user?._id);
        }

        // [FIX-P8] Invalidate product-specific cache + listing cache
        await Promise.all([
            safeDelPrefix("homepage:"),
            safeDelPrefix("products:"),
            safeDelPrefix("deals:"),
            safeDelPrefix("suggestions:"),
            safeDelCache(`product:${product._id}`),
            safeDelCache(`product:${product.slug}`),
            safeDelPrefix("related:"),
            safeDelPrefix("urbexon_hour:"),
        ]);

        return res.json({ success: true, product });
    } catch (err) {
        console.error("[adminUpdateProduct]", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to update product" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Delete (soft)
════════════════════════════════════════ */
export const adminDeleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        // [FIX] Comprehensive cache invalidation
        await Promise.all([
            safeDelPrefix("homepage:"),
            safeDelPrefix("products:"),
            safeDelPrefix("deals:"),
            safeDelPrefix("suggestions:"),
            safeDelCache(`product:${product._id}`),
            safeDelCache(`product:${product.slug}`),
            safeDelPrefix("related:"),
            safeDelPrefix("urbexon_hour:"),
        ]);

        res.json({ success: true, message: "Product removed" });
    } catch (err) {
        console.error("[adminDeleteProduct]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   VENDOR — Create product (urbexon_hour)
════════════════════════════════════════ */
export const vendorCreateProduct = async (req, res) => {
    try {
        const vendor = req.vendor;
        const body = req.body;

        if (!body.name?.trim() || !body.price || !body.category)
            return res.status(400).json({ success: false, message: "Name, price and category required" });

        // [FIX-P3] Validate price
        if (isNaN(Number(body.price)) || Number(body.price) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid price value" });
        }

        const { default: Subscription } = await import("../models/vendorModels/Subscription.js");
        const sub = await Subscription.findOne({ vendorId: vendor._id, status: "active" }).lean();
        const maxProducts = sub?.maxProducts ?? 30;
        const currentCount = await Product.countDocuments({ vendorId: vendor._id, isActive: true });
        if (currentCount >= maxProducts)
            return res.status(403).json({
                success: false,
                message: `Product limit reached (${maxProducts}/${maxProducts}). Upgrade subscription.`,
            });

        const images = [];
        if (req.files?.length) {
            for (const file of req.files.slice(0, 4)) {
                try {
                    const result = await uploadToCloudinary(file.buffer, `vendor_products/${vendor._id}`);
                    if (result?.secure_url) images.push({ url: result.secure_url, alt: body.name });
                } catch { /* skip */ }
            }
        }

        const stock = Number(body.stock) || 0;

        let highlightsArray = [];
        try {
            const raw = typeof body.highlightsArray === 'string' ? JSON.parse(body.highlightsArray) : body.highlightsArray;
            highlightsArray = Array.isArray(raw) ? raw : [];
        } catch { highlightsArray = []; }

        const product = await Product.create({
            name: body.name.trim(),
            description: body.description?.trim() || "",
            price: Number(body.price),
            mrp: body.mrp ? Number(body.mrp) : null,
            category: body.category,
            subcategory: body.subcategory || "",
            tags: body.tags ? body.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
            images,
            stock,
            inStock: stock > 0,
            highlightsArray,
            prepTimeMinutes: Number(body.prepTimeMinutes) || 10,
            maxOrderQty: Number(body.maxOrderQty) || 10,
            productType: "urbexon_hour",
            vendorId: vendor._id,
            isActive: true,
            isDeal: body.isDeal === "true" || body.isDeal === true,
            dealEndsAt: body.dealEndsAt ? new Date(body.dealEndsAt) : null,
        });

        // [FIX] Invalidate UH caches (Urbexon Hour)
        await Promise.all([
            safeDelPrefix("uh:"),
            safeDelPrefix("uh_flash_deals"),
            safeDelPrefix("uh_products:"),
            safeDelPrefix("suggestions:"),
            safeDelPrefix("products:"),
        ]);

        res.status(201).json({ success: true, product });
    } catch (err) {
        console.error("[vendorCreateProduct]", err);
        res.status(500).json({ success: false, message: err.message || "Failed" });
    }
};

/* ════════════════════════════════════════
   VENDOR — Get my products
════════════════════════════════════════ */
export const vendorGetMyProducts = async (req, res) => {
    try {
        const { search } = req.query;
        const page = safeInt(req.query.page, 1, 1, 1000);
        const limit = safeInt(req.query.limit, 20, 1, 100);

        const searchRaw = search?.trim().slice(0, 50) || "";
        if (search?.trim().length > 50) {
            return res.status(400).json({ success: false, message: "Search too long" });
        }

        const filter = { vendorId: req.vendor._id };
        if (searchRaw) filter.name = { $regex: escapeRegex(searchRaw), $options: "i" };

        const skip = (page - 1) * limit;
        const [products, total] = await Promise.all([
            Product.find(filter)
                .select("name slug price mrp category stock inStock isActive isDeal isFeatured images createdAt")
                .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({ products, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[vendorGetMyProducts]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   VENDOR — Update my product
════════════════════════════════════════ */
export const vendorUpdateProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id, vendorId: req.vendor._id });
        if (!product) return res.status(404).json({ success: false, message: "Product not found or not yours" });

        const body = req.body;
        const oldPrice = product.price;
        const fields = ["name", "description", "price", "mrp", "category", "prepTimeMinutes", "maxOrderQty"];
        for (const f of fields) {
            if (body[f] !== undefined) {
                product[f] = ["price", "mrp", "prepTimeMinutes", "maxOrderQty"].includes(f)
                    ? Number(body[f]) : body[f];
            }
        }

        if (body.stock !== undefined) {
            const wasOutOfStock = !product.inStock;
            product.stock = Number(body.stock);
            product.inStock = product.stock > 0;
            if (wasOutOfStock && product.inStock) {
                sendRestockNotifications(product._id, product.name, product.slug);
                handleBackInStock(product);
            }
        }

        if (body.isActive !== undefined) product.isActive = body.isActive === "true" || body.isActive === true;
        if (body.tags) product.tags = body.tags.split(",").map(t => t.trim()).filter(Boolean);
        if (body.subcategory !== undefined) product.subcategory = body.subcategory;

        if (body.highlightsArray !== undefined) {
            try {
                const raw = typeof body.highlightsArray === 'string' ? JSON.parse(body.highlightsArray) : body.highlightsArray;
                product.highlightsArray = Array.isArray(raw) ? raw : [];
            } catch { product.highlightsArray = []; }
        }

        if (body.isDeal !== undefined) {
            product.isDeal = body.isDeal === "true" || body.isDeal === true;
            if (!product.isDeal) product.dealEndsAt = null;
        }
        if (body.dealEndsAt !== undefined) {
            product.dealEndsAt = body.dealEndsAt ? new Date(body.dealEndsAt) : null;
        }

        if (req.files?.length) {
            const newImages = [];
            for (const file of req.files.slice(0, 4)) {
                try {
                    const result = await uploadToCloudinary(file.buffer, `vendor_products/${req.vendor._id}`);
                    if (result?.secure_url) {
                        newImages.push({ url: result.secure_url, publicId: result.public_id || "", alt: body.name || product.name });
                    }
                } catch { /* skip */ }
            }
            if (newImages.length) product.images = newImages;
        }

        await product.save();

        if (product.price !== oldPrice && product.price < oldPrice) {
            handlePriceChange(product, oldPrice, product.price, req.vendor?.userId);
        }

        // [FIX] Invalidate related caches with proper cache deletion
        await Promise.all([
            safeDelPrefix("uh:"),
            safeDelPrefix("uh_products:"),
            safeDelPrefix("suggestions:"),
            safeDelCache(`product:${product._id}`),
            safeDelCache(`product:${product.slug}`),
            safeDelPrefix("related:"),
            safeDelPrefix("products:"),
        ]);

        res.json({ success: true, product });
    } catch (err) {
        console.error("[vendorUpdateProduct]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   VENDOR — Delete my product
════════════════════════════════════════ */
export const vendorDeleteProduct = async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { _id: req.params.id, vendorId: req.vendor._id },
            { isActive: false },
            { new: true }
        );
        if (!product) return res.status(404).json({ success: false, message: "Not found" });

        // [FIX] Comprehensive cache invalidation
        await Promise.all([
            safeDelPrefix("uh:"),
            safeDelPrefix("uh_products:"),
            safeDelPrefix("suggestions:"),
            safeDelCache(`product:${product._id}`),
            safeDelCache(`product:${product.slug}`),
            safeDelPrefix("related:"),
            safeDelPrefix("products:"),
        ]);

        res.json({ success: true, message: "Product removed" });
    } catch (err) {
        console.error("[vendorDeleteProduct]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Get dealable products
════════════════════════════════════════ */
export const adminGetDealableProducts = async (req, res) => {
    try {
        const { search } = req.query;
        const limit = safeInt(req.query.limit, 50, 1, 200);

        const searchRaw = search?.trim().slice(0, 50) || "";

        const filter = {
            productType: "urbexon_hour",
            isActive: true,
            inStock: true,
            stock: { $gt: 0 },
        };

        if (searchRaw) {
            const searchRegex = new RegExp(escapeRegex(searchRaw), "i");
            filter.$or = [{ name: searchRegex }, { brand: searchRegex }, { category: searchRegex }];
        }

        const products = await Product.find(filter)
            .select("name brand price mrp category stock inStock isDeal dealEndsAt")
            .limit(limit).lean();

        res.json({ success: true, products });
    } catch (err) {
        console.error("[adminGetDealableProducts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch products" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Create or update flash deal
════════════════════════════════════════ */
export const adminCreateOrUpdateDeal = async (req, res) => {
    try {
        const { productId, durationHours = 24, priority = 0, discount = 0 } = req.body;

        if (!productId) return res.status(400).json({ success: false, message: "Product ID required" });

        // [FIX-P3] Validate durationHours
        const durHours = Math.min(168, Math.max(1, Number(durationHours) || 24)); // max 7 days
        if (isNaN(durHours)) return res.status(400).json({ success: false, message: "Invalid durationHours" });

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const now = new Date();
        product.isDeal = true;
        product.dealStartsAt = now;
        product.dealEndsAt = new Date(now.getTime() + durHours * 60 * 60 * 1000);
        product.dealPriority = Number(priority) || 0;
        product.discount = Number(discount) || 0;

        await product.save();

        await safeDelPrefix("uh_flash_deals");

        res.json({
            success: true,
            message: `Deal created for ${product.name}`,
            product: {
                _id: product._id,
                name: product.name,
                dealStartsAt: product.dealStartsAt,
                dealEndsAt: product.dealEndsAt,
                priority: product.dealPriority,
                durationHours: durHours,
            },
        });
    } catch (err) {
        console.error("[adminCreateOrUpdateDeal]", err);
        res.status(500).json({ success: false, message: "Failed to create deal" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Remove deal
════════════════════════════════════════ */
export const adminRemoveDeal = async (req, res) => {
    try {
        const { productId } = req.params;
        const product = await Product.findByIdAndUpdate(
            productId,
            { isDeal: false, dealEndsAt: null, dealStartsAt: null, dealPriority: 0 },
            { new: true }
        );
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        await safeDelPrefix("uh_flash_deals");
        res.json({ success: true, message: `Deal removed for ${product.name}` });
    } catch (err) {
        console.error("[adminRemoveDeal]", err);
        res.status(500).json({ success: false, message: "Failed to remove deal" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Flash deals metrics
════════════════════════════════════════ */
export const adminGetFlashDealsMetrics = async (req, res) => {
    try {
        const now = new Date();
        const deals = await Product.find({
            productType: "urbexon_hour",
            isDeal: true,
            dealEndsAt: { $gt: now },
        })
            .select("name price mrp discount dealEndsAt dealPriority sales views stock vendorId")
            .populate("vendorId", "shopName")
            .lean();

        const metrics = deals.map(d => ({
            _id: d._id,
            name: d.name,
            vendor: d.vendorId?.shopName || "Unknown",
            price: d.price,
            mrp: d.mrp,
            discount: d.discount || Math.round(((d.mrp - d.price) / d.mrp) * 100),
            priority: d.dealPriority || 0,
            stock: d.stock,
            sales: d.sales || 0,
            views: d.views || 0,
            conversionRate: d.views > 0 ? ((d.sales / d.views) * 100).toFixed(2) + "%" : "0%",
            timeRemaining: Math.ceil((new Date(d.dealEndsAt) - now) / (60 * 1000)) + " min",
            endsAt: d.dealEndsAt,
        }));

        res.json({
            success: true,
            totalActiveDeals: metrics.length,
            deals: metrics.sort((a, b) => (b.priority - a.priority) || (b.sales - a.sales)),
            totalImpressions: deals.reduce((sum, d) => sum + (d.views || 0), 0),
            totalConversions: deals.reduce((sum, d) => sum + (d.sales || 0), 0),
        });
    } catch (err) {
        console.error("[adminGetFlashDealsMetrics]", err);
        res.status(500).json({ success: false, message: "Failed to fetch metrics" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Refresh flash deals
════════════════════════════════════════ */
export const adminRefreshFlashDeals = async (req, res) => {
    try {
        await safeDelPrefix("uh_flash_deals");

        const now = new Date();
        const expiredDeals = await Product.find({
            productType: "urbexon_hour",
            isDeal: true,
            dealEndsAt: { $lte: now },
        }).select("_id").lean();

        if (expiredDeals.length > 0) {
            await Product.updateMany(
                { _id: { $in: expiredDeals.map(d => d._id) } },
                { isDeal: false, dealEndsAt: null }
            );
        }

        res.json({
            success: true,
            message: "Flash deals refreshed",
            expiredDealsRemoved: expiredDeals.length,
        });
    } catch (err) {
        console.error("[adminRefreshFlashDeals]", err);
        res.status(500).json({ success: false, message: "Failed to refresh deals" });
    }
};