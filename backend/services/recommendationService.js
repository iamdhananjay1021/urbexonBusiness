/**
 * recommendationService.js — one strategy map behind
 * GET /api/products/recommendations?type=…
 *
 * Every strategy is just a (params) → { filter, sort } resolver over the
 * same Product collection, so new strategies are one entry here — no new
 * endpoints, no client changes.
 */
import mongoose from "mongoose";
import Product from "../models/Product.js";

const escapeRegex = (str = "") => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugToRegex = (slug) => {
    if (!slug) return null;
    const pattern = String(slug).trim().split("-").filter(Boolean).map(escapeRegex).join("[\\s-]*");
    return pattern ? new RegExp(`^\\s*${pattern}\\s*$`, "i") : null;
};

const BASE = { isActive: true, inStock: true, productType: "ecommerce" };
const DAYS = (n) => new Date(Date.now() - n * 86400000);

/** type → { filter, sort } */
export const STRATEGIES = {
    "trending": () => ({
        filter: { ...BASE, updatedAt: { $gte: DAYS(30) } },
        sort: { views: -1, sales: -1, createdAt: -1 },
    }),
    "best-sellers": () => ({
        filter: { ...BASE, sales: { $gt: 0 } },
        sort: { sales: -1, rating: -1 },
    }),
    "new-arrivals": () => ({
        filter: { ...BASE, createdAt: { $gte: DAYS(60) } },
        sort: { createdAt: -1 },
    }),
    "top-rated": () => ({
        filter: { ...BASE, rating: { $gte: 4 }, numReviews: { $gte: 1 } },
        sort: { rating: -1, numReviews: -1 },
    }),
    "popular-in-category": ({ category }) => {
        const rx = slugToRegex(category);
        return {
            filter: { ...BASE, ...(rx ? { category: rx } : {}) },
            sort: { sales: -1, views: -1, rating: -1 },
        };
    },
    "recommended": () => ({
        filter: { ...BASE },
        sort: { isFeatured: -1, sales: -1, rating: -1 },
    }),
};

const PRODUCT_FIELDS =
    "name slug category brand price mrp images rating numReviews inStock stock isDeal dealEndsAt isFeatured tags productType vendorId colorVariants sizes";

/**
 * "similar" gets special handling: same category as the anchor product,
 * excluding the product itself, ranked by rating/sales.
 */
export const getRecommendedProducts = async ({ type, category, productId, limit }) => {
    const cappedLimit = Math.min(24, Math.max(1, Number(limit) || 12));

    if (type === "similar") {
        if (!productId || !mongoose.isValidObjectId(productId)) return [];
        const anchor = await Product.findById(productId).select("category tags").lean();
        if (!anchor) return [];
        const rx = anchor.category
            ? new RegExp(`^\\s*${escapeRegex(anchor.category)}\\s*$`, "i")
            : null;
        return Product.find({
            ...BASE,
            _id: { $ne: anchor._id },
            ...(rx ? { category: rx } : {}),
        })
            .select(PRODUCT_FIELDS)
            .sort({ rating: -1, sales: -1, createdAt: -1 })
            .limit(cappedLimit)
            .lean();
    }

    const strategy = STRATEGIES[type] || STRATEGIES.recommended;
    const { filter, sort } = strategy({ category });
    return Product.find(filter).select(PRODUCT_FIELDS).sort(sort).limit(cappedLimit).lean();
};
