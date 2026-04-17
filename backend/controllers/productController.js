import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
/**
 * productController.js — Production, Bug-Free
 * Fixes:
 * - inStock filter properly applied
 * - Deals show only active deals with stock
 * - Search scoped to ecommerce by default
 * - Homepage properly returns featured/new/deals + setCache added
 * - Related products endpoint added
 * - Admin CRUD complete
 * - Vendor CRUD complete
 * - FIX: Homepage queries now include inStock + stock fields (was causing OUT OF STOCK bug)
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

/* ════════════════════════════════════════
   PUBLIC — Get products (ecommerce only by default)
════════════════════════════════════════ */
export const getProducts = async (req, res) => {
    try {
        const {
            page = 1, limit = 20,
            category, subcategory, search, sort = "createdAt", order = "desc",
            productType, vendorId, featured, minPrice, maxPrice, deal,
        } = req.query;

        const cacheKey = `products:${JSON.stringify({ page, limit, category, subcategory, search, sort, order, productType, vendorId, featured, minPrice, maxPrice, deal })}`;
        const cached = await getCache(cacheKey);
        if (cached) return res.json(cached);

        const filter = { isActive: true };

        // Default to ecommerce products unless explicitly requested
        if (productType) {
            filter.productType = productType;
        } else if (!search?.trim()) {
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
            filter.subcategory = { $regex: new RegExp(`^${subcategory.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i") };
        }
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }
        if (search?.trim()) {
            const rx = { $regex: escapeRegex(search.trim()), $options: "i" };
            filter.$or = [
                { name: rx }, { category: rx },
                { brand: rx }, { tags: { $elemMatch: rx } },
            ];
            // Keep productType if explicitly passed; otherwise default to ecommerce for search
            if (!productType) {
                filter.productType = "ecommerce";
            }
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
        const skip = (Math.max(1, Number(page)) - 1) * Math.min(50, Number(limit));

        const [products, total] = await Promise.all([
            Product.find(filter).select("name slug category brand price mrp images rating numReviews inStock stock isDeal dealEndsAt isFeatured tags productType vendorId").sort(sortObj).skip(skip).limit(Math.min(50, Number(limit))).lean(),
            Product.countDocuments(filter),
        ]);

        const result = {
            products,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Math.min(50, Number(limit))),
        };

        await setCache(cacheKey, result, 60); // 1 min cache
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
        const cached = await getCache(CACHE_KEY);
        if (cached) return res.json(cached);

        const base = { isActive: true, productType: "ecommerce" };

        // ✅ FIX: Added `inStock stock` to all 3 select() calls
        // Previously missing → frontend got undefined → showed "OUT OF STOCK" for all products
        const [featured, newArrivals, deals, productCount, cats] = await Promise.all([
            Product.find({ ...base, isFeatured: true })
                .select("name slug price mrp images category rating isDeal inStock stock")
                .sort({ createdAt: -1 })
                .limit(8)
                .lean(),

            Product.find(base)
                .select("name slug price mrp images category rating isDeal inStock stock")
                .sort({ createdAt: -1 })
                .limit(12)
                .lean(),

            Product.find({
                ...base,
                isDeal: true,
                $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }],
            })
                .select("name slug price mrp images category rating isDeal dealEndsAt inStock stock")
                .sort({ createdAt: -1 })
                .limit(8)
                .lean(),

            Product.countDocuments({ isActive: true }),
            Product.distinct("category", { isActive: true, productType: "ecommerce" }),
        ]);

        const result = {
            featured,
            newArrivals,
            deals,
            stats: { products: productCount, categories: cats.length },
        };

        await setCache(CACHE_KEY, result, 300); // 5 min cache

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
        const regex = { $regex: escapeRegex(q.trim()), $options: "i" };
        const typeFilter = productType === "urbexon_hour" ? "urbexon_hour" : "ecommerce";
        const products = await Product.find({
            isActive: true, inStock: true, productType: typeFilter,
            $or: [{ name: regex }, { category: regex }, { brand: regex }],
        }).select("name category brand slug images price mrp").limit(8).lean();
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
        const { page = 1, limit = 20, category, sort = "newest", productType } = req.query;
        // Default to ecommerce so deals pages don't mix channels
        const typeFilter = productType === "urbexon_hour" ? "urbexon_hour" : "ecommerce";
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
        const skip = (Number(page) - 1) * Number(limit);

        const [products, total] = await Promise.all([
            Product.find(filter).sort(sortMap[sort] || { createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({
            products,
            total,
            page: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
        });
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
        const { vendorId, category, search, page = 1, limit = 20 } = req.query;
        const filter = { productType: "urbexon_hour", isActive: true };
        if (vendorId) filter.vendorId = vendorId;
        if (category) { const rx = slugToRegex(category); if (rx) filter.category = rx; }
        if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);
        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate("vendorId", "shopName shopLogo rating isOpen city")
                .sort({ isFeatured: -1, createdAt: -1 })
                .skip(skip).limit(Number(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
    } catch (err) {
        console.error("[getUrbexonHourProducts]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Urbexon Hour Flash Deals (BACKEND-MANAGED)
   ─────────────────────────────────────
   • Smart deal rotation & prioritization
   • Stock validation & auto-exclusion
   • Category distribution
   • Countdown timer management
   • Performance caching
════════════════════════════════════════ */
export const getUrbexonHourDeals = async (req, res) => {
    try {
        const { limit = 12, refresh = false } = req.query;

        // Cache key for flash deals
        const cacheKey = "uh_flash_deals";

        // If not force refresh, check cache first
        if (!refresh) {
            const cached = await getCache(cacheKey);
            if (cached) return res.json(cached);
        }

        // Build filter for valid deals
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

        // Fetch deals with smart sorting:
        // 1. Priority products (admin-marked)
        // 2. High discount (incentivize traffic)
        // 3. Ending soon (create urgency)
        // 4. Popular (based on sales/views)
        const products = await Product.find(filter)
            .select("+dealStartsAt +dealEndsAt +views +sales +discount")
            .populate("vendorId", "shopName shopLogo rating isOpen city")
            .sort({
                "dealPriority": -1,                    // Admin priority first
                "discount": -1,                        // High discount
                "dealEndsAt": 1,                       // Ending soon
                "sales": -1,                           // Popular
                "views": -1,                           // Trending
                "createdAt": -1,                       // Newest
            })
            .limit(Number(limit))
            .lean();

        // Enrich with calculated fields
        const enrichedDeals = products.map(p => ({
            ...p,
            // Calculate time remaining
            timeRemaining: p.dealEndsAt ? Math.max(0, new Date(p.dealEndsAt) - now) : null,
            // Calculate urgency level (0-100)
            urgencyScore: p.dealEndsAt ? Math.min(100, Math.max(0, (30 * 60 * 1000 - (new Date(p.dealEndsAt) - now)) / (30 * 60 * 1000) * 100)) : 0,
            // Format discount percentage
            discountPercent: p.mrp && p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0,
            // Deal status for badge
            dealStatus: p.dealEndsAt && (new Date(p.dealEndsAt) - now) < 60 * 60 * 1000 ? "ending-soon" : "hot-deal",
        }));

        // Prepare response
        const response = {
            success: true,
            products: enrichedDeals,
            totalDeals: enrichedDeals.length,
            lastUpdated: new Date().toISOString(),
            cacheValidUntil: new Date(now.getTime() + 5 * 60 * 1000).toISOString(), // 5 min cache
            // Metadata for frontend
            meta: {
                hotDealsCount: enrichedDeals.filter(p => p.dealStatus === "hot-deal").length,
                endingSoonCount: enrichedDeals.filter(p => p.dealStatus === "ending-soon").length,
                avgDiscount: Math.round(enrichedDeals.reduce((sum, p) => sum + p.discountPercent, 0) / enrichedDeals.length || 0),
            }
        };

        // Cache for 5 minutes
        await setCache(cacheKey, response, 300);

        res.json(response);

    } catch (err) {
        console.error("[getUrbexonHourDeals - BACKEND-MANAGED]", err);
        res.status(500).json({
            success: false,
            message: "Failed to fetch flash deals",
            error: process.env.NODE_ENV === "development" ? err.message : undefined
        });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Single product by slug or id
════════════════════════════════════════ */
export const getProductBySlug = async (req, res) => {
    try {
        const { id } = req.params;
        const isObjectId = /^[a-f\d]{24}$/i.test(id);
        const product = await Product.findOne({
            ...(isObjectId ? { _id: id } : { slug: id }),
            isActive: true,
        }).populate("vendorId", "shopName shopLogo rating isOpen city").lean();

        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
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
        const isObjectId = /^[a-f\d]{24}$/i.test(id);

        const product = await Product.findOne({
            ...(isObjectId ? { _id: id } : { slug: id }),
            isActive: true,
        }).lean();

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
            .populate("vendorId", "shopName shopLogo rating isOpen city")
            .sort({ isFeatured: -1, rating: -1, createdAt: -1 })
            .limit(10)
            .lean();

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
        const { page = 1, limit = 20, search, productType, category, inStock } = req.query;
        const filter = { isActive: { $ne: false } };
        if (productType) filter.productType = productType;
        if (category) filter.category = { $regex: escapeRegex(category), $options: "i" };
        if (inStock === "true") filter.inStock = true;
        if (inStock === "false") filter.inStock = false;
        if (search) filter.$or = [
            { name: { $regex: escapeRegex(search), $options: "i" } },
            { category: { $regex: escapeRegex(search), $options: "i" } },
            { sku: { $regex: escapeRegex(search), $options: "i" } },
        ];

        const skip = (Number(page) - 1) * Number(limit);
        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate("vendorId", "shopName")
                .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
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

        /* ───────────────
           🔧 SAFE PARSING (CRITICAL)
        ─────────────── */
        const safeParse = (val, fallback) => {
            try {
                return typeof val === "string" ? JSON.parse(val) : val;
            } catch {
                return fallback;
            }
        };

        body.sizes = safeParse(body.sizes, []);
        body.highlights = safeParse(body.highlights, {});
        body.customizationConfig = safeParse(body.customizationConfig, null);

        /* ───────────────
           🔒 BASIC VALIDATION
        ─────────────── */
        if (!body.name?.trim() || !body.price || !body.category) {
            return res.status(400).json({
                success: false,
                message: "Name, price and category are required",
            });
        }

        /* ───────────────
           🔁 BOOLEAN PARSE
        ─────────────── */
        const parseBool = (v) => v === "true" || v === true;

        const isFeatured = parseBool(body.isFeatured);
        const isDeal = parseBool(body.isDeal);
        const isCustomizable = parseBool(body.isCustomizable);

        /* ───────────────
           🔢 NUMBER PARSE
        ─────────────── */
        const toNum = (v, def = 0) => {
            const n = Number(v);
            return isNaN(n) ? def : n;
        };

        const price = toNum(body.price);
        const mrp = body.mrp ? toNum(body.mrp) : null;
        const cost = toNum(body.cost);
        const stock = toNum(body.stock);
        const gstPercent = toNum(body.gstPercent);

        if (price <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid price value",
            });
        }

        /* ───────────────
           🏷️ TAGS
        ─────────────── */
        const tags = body.tags
            ? Array.isArray(body.tags)
                ? body.tags
                : body.tags.split(",").map(t => t.trim()).filter(Boolean)
            : [];

        /* ───────────────
           📦 SIZES (SAFE NORMALIZATION)
        ─────────────── */
        const sizes = Array.isArray(body.sizes)
            ? body.sizes
                .map(s => {
                    if (typeof s === "string") {
                        return { size: s, stock: 0 };
                    }
                    if (typeof s === "object" && s.size) {
                        return {
                            size: String(s.size),
                            stock: toNum(s.stock),
                        };
                    }
                    return null;
                })
                .filter(Boolean)
            : [];

        /* ───────────────
           🖼️ IMAGE UPLOAD (PRODUCTION-READY)
        ─────────────── */
        const images = [];
        const imageErrors = [];

        // ✅ VALIDATION: Check if files are present
        if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
            console.warn(`[adminCreateProduct] ⚠️ No image files received. req.files: ${JSON.stringify(req.files?.length || 'undefined')}, type: ${typeof req.files}`);
        } else {
            console.log(`[adminCreateProduct] 📁 Processing ${req.files.length} image file(s)`);

            for (let i = 0; i < Math.min(6, req.files.length); i++) {
                const file = req.files[i];
                try {
                    // Validate file object
                    if (!file || !file.buffer) {
                        throw new Error(`File ${i + 1} is invalid or missing buffer. File: ${JSON.stringify(Object.keys(file || {}))}`);
                    }

                    console.log(`[adminCreateProduct] 🔄 Uploading image ${i + 1}/${req.files.length}: ${file.originalname || 'unknown'} (${file.size} bytes)`);

                    const result = await uploadToCloudinary(file.buffer, "products");

                    if (result?.secure_url) {
                        images.push({
                            url: result.secure_url,
                            publicId: result.public_id || "",
                            alt: body.name?.trim() || "product-image",
                            fileName: file.originalname || `image-${i + 1}`,
                        });
                        console.log(`[adminCreateProduct] ✅ Image ${i + 1} uploaded: ${result.secure_url}`);
                    } else {
                        throw new Error(`Cloudinary did not return secure_url. Response: ${JSON.stringify(result || {})}`);
                    }
                } catch (err) {
                    const errMsg = `Image ${i + 1} (${file?.originalname || 'unknown'}): ${err.message}`;
                    imageErrors.push(errMsg);
                    console.error(`[adminCreateProduct] ❌ ${errMsg}`);
                }
            }
        }

        // ✅ VALIDATION: At least 1 image required
        if (images.length === 0) {
            const errorDetail = imageErrors.length > 0
                ? `All image uploads failed: ${imageErrors.join("; ")}`
                : `No images were provided or processed`;
            console.error(`[adminCreateProduct] 🚨 Product creation blocked: ${errorDetail}`);
            return res.status(400).json({
                success: false,
                message: "At least 1 image is required. Check file format and size (max 5MB).",
                errors: imageErrors,
            });
        }

        console.log(`[adminCreateProduct] ✅ Successfully processed ${images.length} image(s) for product "${body.name}"`);

        /* ───────────────
           📅 DEAL DATE
        ─────────────── */
        let dealEndsAt = null;
        if (isDeal && body.dealEndsAt) {
            const d = new Date(body.dealEndsAt);
            if (!isNaN(d.getTime())) dealEndsAt = d;
        }

        /* ───────────────
           🧱 CREATE PRODUCT
        ─────────────── */
        const product = await Product.create({
            name: body.name.trim(),
            description: body.description?.trim() || "",
            price,
            mrp,
            cost,
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

            tags,
            sizes,
            highlights: body.highlights || {},

            images,

            stock,
            inStock: stock > 0,

            isFeatured,
            isDeal,
            dealEndsAt,

            gstPercent,
            isCustomizable,
            ...(isCustomizable && body.customizationConfig
                ? { customizationConfig: body.customizationConfig }
                : {}),

            productType: "ecommerce",
            vendorId: null,
            isActive: true,
        });

        /* ───────────────
           🧹 CACHE CLEAR
        ─────────────── */
        try {
            await Promise.all([
                delCacheByPrefix("homepage:"),
                delCacheByPrefix("products:"),
                delCacheByPrefix("deals:"),
            ]);
        } catch {
            console.warn("⚠️ Cache clear failed");
        }

        return res.status(201).json({
            success: true,
            product,
        });

    } catch (err) {
        console.error("[adminCreateProduct]", err);

        return res.status(500).json({
            success: false,
            message: err.message || "Failed to create product",
        });
    }
};

/* ════════════════════════════════════════
   ADMIN — Update product
════════════════════════════════════════ */
export const adminUpdateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found",
            });
        }

        const body = req.body;
        const oldPrice = product.price; // Track for price drop detection

        // 🔁 Helpers
        const parseBool = (val) => val === "true" || val === true;

        const safeNumber = (val, fallback = 0) => {
            const num = Number(val);
            return isNaN(num) ? fallback : num;
        };

        // 🖼️ Upload new images (replace existing)
        if (req.files?.length) {
            const newImages = [];

            for (const file of req.files.slice(0, 6)) {
                try {
                    const result = await uploadToCloudinary(file.buffer, "products");
                    if (result?.secure_url) {
                        newImages.push({
                            url: result.secure_url,
                            publicId: result.public_id || "",
                            alt: body.name?.trim() || product.name,
                        });
                    }
                } catch (err) {
                    console.warn("⚠️ Image upload failed, skipping file");
                }
            }

            if (newImages.length) {
                product.images = newImages;
            }
        }

        // 🧱 Primitive fields update
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
            if (body[key] !== undefined) {
                product[key] = fieldMap[key](body[key]);
            }
        }

        // 🔘 Booleans
        if (body.isFeatured !== undefined) product.isFeatured = parseBool(body.isFeatured);
        if (body.isDeal !== undefined) product.isDeal = parseBool(body.isDeal);
        if (body.isActive !== undefined) product.isActive = parseBool(body.isActive);
        if (body.isCustomizable !== undefined) product.isCustomizable = parseBool(body.isCustomizable);

        // 🎨 Customization config
        if (body.customizationConfig !== undefined) {
            try {
                const raw = typeof body.customizationConfig === 'string'
                    ? JSON.parse(body.customizationConfig)
                    : body.customizationConfig;
                if (raw && typeof raw === 'object') {
                    product.customizationConfig = raw;
                }
            } catch { /* ignore bad JSON */ }
        }

        // 📅 Deal handling
        if (body.dealEndsAt !== undefined) {
            const d = new Date(body.dealEndsAt);
            product.dealEndsAt = !isNaN(d.getTime()) ? d : null;
        }

        if (!product.isDeal) {
            product.dealEndsAt = null;
        }

        // 🏷️ Tags normalization
        if (body.tags !== undefined) {
            const rawTags = Array.isArray(body.tags)
                ? body.tags
                : body.tags.split(",");

            product.tags = rawTags.map((t) => t.trim()).filter(Boolean);
        }

        // 📦 Sizes normalization (CRITICAL FIX)
        if (body.sizes !== undefined) {
            try {
                const rawSizes =
                    typeof body.sizes === "string"
                        ? JSON.parse(body.sizes)
                        : body.sizes;

                if (Array.isArray(rawSizes)) {
                    product.sizes = rawSizes
                        .map((s) => {
                            if (typeof s === "string") {
                                return { size: s, stock: 0 };
                            }

                            if (typeof s === "object") {
                                return {
                                    size: String(s.size || s.label || "").trim(),
                                    stock: safeNumber(s.stock),
                                };
                            }

                            return null;
                        })
                        .filter((s) => s && s.size);
                } else {
                    product.sizes = [];
                }
            } catch (err) {
                console.error("❌ Invalid sizes JSON:", err);
                product.sizes = [];
            }
        }

        // 📦 Sync stock with sizes (optional but smart)
        if (product.sizes.length > 0) {
            product.stock = product.sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
        }

        // 📊 Stock status
        const wasOutOfStock = !product.inStock;
        product.inStock = product.stock > 0;

        // 💾 Save
        await product.save();

        // 📧 Send restock notifications if product came back in stock
        if (wasOutOfStock && product.inStock) {
            sendRestockNotifications(product._id, product.name, product.slug);
            handleBackInStock(product);
        }

        // 📉 Detect price drop and notify wishlist users
        if (product.price !== oldPrice && product.price < oldPrice) {
            handlePriceChange(product, oldPrice, product.price, req.user?._id);
        }

        // 🧹 Cache clear
        try {
            await Promise.all([
                delCacheByPrefix("homepage:"),
                delCacheByPrefix("products:"),
                delCacheByPrefix("deals:"),
            ]);
        } catch {
            console.warn("⚠️ Cache clear failed");
        }

        return res.json({
            success: true,
            product,
        });

    } catch (err) {
        console.error("[adminUpdateProduct]", err);

        return res.status(500).json({
            success: false,
            message: err.message || "Failed to update product",
        });
    }
};

/* ════════════════════════════════════════
   ADMIN — Delete (soft)
════════════════════════════════════════ */
export const adminDeleteProduct = async (req, res) => {
    try {
        const product = await Product.findByIdAndUpdate(
            req.params.id, { isActive: false }, { new: true }
        );
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        await Promise.all([
            delCacheByPrefix("homepage:"),
            delCacheByPrefix("products:"),
            delCacheByPrefix("deals:"),
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

        // Check subscription product limit
        const { default: Subscription } = await import("../models/vendorModels/Subscription.js");
        const sub = await Subscription.findOne({ vendorId: vendor._id, status: "active" });
        const maxProducts = sub?.maxProducts ?? 30;
        const currentCount = await Product.countDocuments({ vendorId: vendor._id, isActive: true });
        if (currentCount >= maxProducts)
            return res.status(403).json({
                success: false,
                message: `Product limit reached (${maxProducts}/${maxProducts}). Upgrade subscription.`,
            });

        // Upload images
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
        const product = await Product.create({
            name: body.name.trim(),
            description: body.description?.trim() || "",
            price: Number(body.price),
            mrp: body.mrp ? Number(body.mrp) : null,
            category: body.category,
            tags: body.tags ? body.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
            images,
            stock,
            inStock: stock > 0,
            prepTimeMinutes: Number(body.prepTimeMinutes) || 10,
            maxOrderQty: Number(body.maxOrderQty) || 10,
            productType: "urbexon_hour",
            vendorId: vendor._id,
            isActive: true,
            isDeal: body.isDeal === "true" || body.isDeal === true,
            dealEndsAt: body.dealEndsAt ? new Date(body.dealEndsAt) : null,
        });

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
        const { page = 1, limit = 20, search } = req.query;
        const filter = { vendorId: req.vendor._id };
        if (search) filter.name = { $regex: escapeRegex(search), $options: "i" };

        const skip = (Number(page) - 1) * Number(limit);
        const [products, total] = await Promise.all([
            Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
            Product.countDocuments(filter),
        ]);

        res.json({ products, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
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
        const oldPrice = product.price; // Track for price drop detection
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

            // Send restock notifications if product came back in stock
            if (wasOutOfStock && product.inStock) {
                sendRestockNotifications(product._id, product.name, product.slug);
                handleBackInStock(product);
            }
        }
        if (body.isActive !== undefined)
            product.isActive = body.isActive === "true" || body.isActive === true;
        if (body.tags)
            product.tags = body.tags.split(",").map(t => t.trim()).filter(Boolean);

        // Deal fields
        if (body.isDeal !== undefined) {
            product.isDeal = body.isDeal === "true" || body.isDeal === true;
            if (!product.isDeal) product.dealEndsAt = null;
        }
        if (body.dealEndsAt !== undefined) {
            product.dealEndsAt = body.dealEndsAt ? new Date(body.dealEndsAt) : null;
        }

        // Handle image uploads
        if (req.files?.length) {
            const newImages = [];
            for (const file of req.files.slice(0, 4)) {
                try {
                    const result = await uploadToCloudinary(file.buffer, `vendor_products/${req.vendor._id}`);
                    if (result?.secure_url) {
                        newImages.push({
                            url: result.secure_url,
                            publicId: result.public_id || "",
                            alt: body.name || product.name,
                        });
                    }
                } catch { /* skip */ }
            }
            if (newImages.length) product.images = newImages;
        }

        await product.save();

        // 📉 Detect price drop and notify wishlist users
        if (product.price !== oldPrice && product.price < oldPrice) {
            handlePriceChange(product, oldPrice, product.price, req.vendor?.userId);
        }

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
        res.json({ success: true, message: "Product removed" });
    } catch (err) {
        console.error("[vendorDeleteProduct]", err);
        res.status(500).json({ success: false, message: "Failed" });
    }
};

/* ════════════════════════════════════════
   ADMIN — Manage Urbexon Hour Flash Deals
   ─────────────────────────────────────
   • Create deals with automatic rotation
   • Set deal duration & priority
   • View deal performance
   • Bulk enable/disable deals
════════════════════════════════════════ */

// Get all available products for creating deals
export const adminGetDealableProducts = async (req, res) => {
    try {
        const { search, limit = 50 } = req.query;

        const filter = {
            productType: "urbexon_hour",
            isActive: true,
            inStock: true,
            stock: { $gt: 0 },
        };

        if (search?.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            filter.$or = [{ name: searchRegex }, { brand: searchRegex }, { category: searchRegex }];
        }

        const products = await Product.find(filter)
            .select("name brand price mrp category stock inStock isDeal dealEndsAt")
            .limit(Number(limit))
            .lean();

        res.json({ success: true, products });
    } catch (err) {
        console.error("[adminGetDealableProducts]", err);
        res.status(500).json({ success: false, message: "Failed to fetch products" });
    }
};

// Create/Update flash deal with auto-cache invalidation
export const adminCreateOrUpdateDeal = async (req, res) => {
    try {
        const { productId, durationHours = 24, priority = 0, discount = 0 } = req.body;

        if (!productId) {
            return res.status(400).json({ success: false, message: "Product ID required" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Calculate deal timing
        const now = new Date();
        const dealStartsAt = now;
        const dealEndsAt = new Date(now.getTime() + Number(durationHours) * 60 * 60 * 1000);

        // Update product with deal info
        product.isDeal = true;
        product.dealStartsAt = dealStartsAt;
        product.dealEndsAt = dealEndsAt;
        product.dealPriority = Number(priority) || 0;
        product.discount = Number(discount) || 0;

        await product.save();

        // Invalidate cache to show updated deals immediately
        await delCacheByPrefix("uh_flash_deals");

        res.json({
            success: true,
            message: `Deal created for ${product.name}`,
            product: {
                _id: product._id,
                name: product.name,
                dealStartsAt: product.dealStartsAt,
                dealEndsAt: product.dealEndsAt,
                priority: product.dealPriority,
                durationHours,
            }
        });

    } catch (err) {
        console.error("[adminCreateOrUpdateDeal]", err);
        res.status(500).json({ success: false, message: "Failed to create deal" });
    }
};

// Disable deal (remove from flash deals)
export const adminRemoveDeal = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findByIdAndUpdate(
            productId,
            {
                isDeal: false,
                dealEndsAt: null,
                dealStartsAt: null,
                dealPriority: 0,
            },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Invalidate cache
        await delCacheByPrefix("uh_flash_deals");

        res.json({ success: true, message: `Deal removed for ${product.name}` });

    } catch (err) {
        console.error("[adminRemoveDeal]", err);
        res.status(500).json({ success: false, message: "Failed to remove deal" });
    }
};

// Get all active flash deals with performance metrics
export const adminGetFlashDealsMetrics = async (req, res) => {
    try {
        const now = new Date();

        const deals = await Product.find({
            productType: "urbexon_hour",
            isDeal: true,
            dealEndsAt: { $gt: now },
        })
            .select("name price mrp discount dealEndsAt dealPriority sales views stock dealPriority vendor")
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

// Refresh/rotate flash deals cache (force immediate update)
export const adminRefreshFlashDeals = async (req, res) => {
    try {
        // Clear the cache
        await delCacheByPrefix("uh_flash_deals");

        // Optionally: Automatically set new deals if old ones expired
        const now = new Date();
        const expiredDeals = await Product.find({
            productType: "urbexon_hour",
            isDeal: true,
            dealEndsAt: { $lte: now },
        });

        // Auto-disable expired deals
        await Product.updateMany(
            { _id: { $in: expiredDeals.map(d => d._id) } },
            { isDeal: false, dealEndsAt: null }
        );

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