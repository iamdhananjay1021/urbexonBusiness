/**
 * filterQueryBuilder.js — turns request query params into MongoDB match
 * conditions for the global dynamic filtering system.
 *
 * Nothing here is hardcoded to a category: every dimension is generic and
 * `attr_<key>=v1,v2` params map onto the Product model's free-form
 * `attributes` Map, so new attributes added from the Admin Panel are
 * filterable with zero code changes.
 *
 * Used by BOTH:
 *   - getProducts        (applies the user's selected filters)
 *   - getProductFilters  (facet aggregation context)
 */

const escapeRegex = (str = "") => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Nike, Puma ,adidas" → ["Nike","Puma","adidas"] (max 20 values, each ≤ 60 chars) */
export const parseMulti = (raw) => {
    if (!raw) return [];
    return String(raw)
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && v.length <= 60)
        .slice(0, 20);
};

/** Case-insensitive exact matcher for one value */
const ciExact = (v) => new RegExp(`^\\s*${escapeRegex(v)}\\s*$`, "i");

/** ["a","b"] → { $in: [/^a$/i, /^b$/i] } */
const ciIn = (values) => ({ $in: values.map(ciExact) });

/** Attribute params arrive as attr_<key>=v1,v2 — collect them dynamically. */
export const parseAttributeParams = (query) => {
    const attrs = {};
    for (const [key, raw] of Object.entries(query)) {
        if (!key.startsWith("attr_")) continue;
        const name = key.slice(5).trim();
        // Attribute keys are stored as-is in the attributes Map; only allow
        // sane key shapes so query params can't inject operators.
        if (!/^[a-zA-Z0-9 _-]{1,40}$/.test(name)) continue;
        const values = parseMulti(raw);
        if (values.length) attrs[name] = values;
    }
    return attrs;
};

/**
 * Build the list of extra $and conditions for the user's selected value
 * filters. Returned separately (not merged into the base filter object)
 * so they can never clobber the caller's own $or/$and (e.g. search).
 *
 * Also returns a deterministic cacheKey fragment for these params.
 */
export const buildDynamicConditions = (query) => {
    const conditions = [];
    const cacheParts = [];

    const brands = parseMulti(query.brand);
    if (brands.length) {
        conditions.push({ brand: ciIn(brands) });
        cacheParts.push(`b${brands.join("|")}`);
    }

    const colors = parseMulti(query.color);
    if (colors.length) {
        // A product "has" a color if its base color matches OR any of its
        // color variants is named that color.
        conditions.push({
            $or: [
                { color: ciIn(colors) },
                { "colorVariants.name": ciIn(colors) },
            ],
        });
        cacheParts.push(`c${colors.join("|")}`);
    }

    const sizes = parseMulti(query.size);
    if (sizes.length) {
        conditions.push({ "sizes.size": ciIn(sizes) });
        cacheParts.push(`s${sizes.join("|")}`);
    }

    const rating = Number(query.rating);
    if (rating >= 1 && rating <= 5) {
        conditions.push({ rating: { $gte: rating } });
        cacheParts.push(`r${rating}`);
    }

    const discount = Number(query.discount);
    if (discount >= 1 && discount <= 99) {
        // Effective discount % derived from mrp/price so it works even when
        // the stored `discount` field isn't maintained.
        conditions.push({
            $expr: {
                $gte: [
                    {
                        $cond: [
                            { $gt: [{ $ifNull: ["$mrp", 0] }, "$price"] },
                            {
                                $multiply: [
                                    { $divide: [{ $subtract: ["$mrp", "$price"] }, "$mrp"] },
                                    100,
                                ],
                            },
                            0,
                        ],
                    },
                    discount,
                ],
            },
        });
        cacheParts.push(`d${discount}`);
    }

    const attrs = parseAttributeParams(query);
    for (const [key, values] of Object.entries(attrs)) {
        conditions.push({ [`attributes.${key}`]: ciIn(values) });
        cacheParts.push(`a_${key}:${values.join("|")}`);
    }

    return { conditions, cacheFragment: cacheParts.join(";") };
};

/**
 * availability param:
 *   (absent) / "instock" → default behaviour (inStock: true, unchanged)
 *   "all"                → include out-of-stock products too
 * Mutates the base filter the same way getProducts builds it.
 */
export const applyAvailability = (filter, query) => {
    if (query.availability === "all") {
        delete filter.inStock;
        return "avAll";
    }
    return "";
};
