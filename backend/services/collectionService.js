/**
 * collectionService.js — resolves a Collection's rules into a MongoDB
 * filter (same shape getProducts builds), so collections reuse the exact
 * discovery machinery: sorting, pagination, product card fields.
 */

const escapeRegex = (str = "") => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugToRegex = (slug) => {
    if (!slug) return null;
    const pattern = slug.trim().split("-").filter(Boolean).map(escapeRegex).join("[\\s-]*");
    return pattern ? new RegExp(`^\\s*${pattern}\\s*$`, "i") : null;
};

export const SORT_MAP = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { rating: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    discount: { mrp: -1, price: 1, createdAt: -1 },
    popularity: { sales: -1, views: -1, createdAt: -1 },
    recommended: { isFeatured: -1, sales: -1, rating: -1 },
};

/** rules → mongo filter (always scoped to active, in-stock ecommerce products) */
export const buildCollectionFilter = (rules = {}) => {
    const filter = { isActive: true, inStock: true, productType: "ecommerce" };
    const and = [];

    if (rules.category) {
        const rx = slugToRegex(rules.category);
        if (rx) filter.category = rx;
    }
    if (rules.brand) {
        filter.brand = new RegExp(`^\\s*${escapeRegex(rules.brand.trim())}\\s*$`, "i");
    }
    if (Array.isArray(rules.tags) && rules.tags.length) {
        and.push({ tags: { $in: rules.tags.map((t) => new RegExp(`^${escapeRegex(String(t).trim())}$`, "i")) } });
    }
    if (rules.isDeal) {
        filter.isDeal = true;
        and.push({ $or: [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }] });
    }
    if (rules.isFeatured) filter.isFeatured = true;
    if (rules.minRating > 0) filter.rating = { $gte: rules.minRating };
    if (rules.minDiscount > 0) {
        and.push({
            $expr: {
                $gte: [
                    {
                        $cond: [
                            { $gt: [{ $ifNull: ["$mrp", 0] }, "$price"] },
                            { $multiply: [{ $divide: [{ $subtract: ["$mrp", "$price"] }, "$mrp"] }, 100] },
                            0,
                        ],
                    },
                    rules.minDiscount,
                ],
            },
        });
    }
    if (rules.maxAgeDays > 0) {
        and.push({ createdAt: { $gte: new Date(Date.now() - rules.maxAgeDays * 86400000) } });
    }

    if (and.length) filter.$and = and;
    return filter;
};

export const resolveSort = (sortKey) => SORT_MAP[sortKey] || SORT_MAP.newest;
