/**
 * filterService.js — computes the dynamic facet payload for
 * GET /api/products/filters.
 *
 * Facets are computed from the CONTEXT (productType/category/subcategory/
 * search) but deliberately NOT from the user's selected value filters —
 * that keeps every option visible with stable counts while the user
 * multi-selects (same behaviour as Myntra/Flipkart sidebars).
 *
 * Results are cached (same Cache util as getProducts) because the facet
 * aggregation is heavier than a paged find().
 */
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import { buildFacetPipeline, buildColorHexPipeline } from "../utils/aggregationBuilder.js";

const escapeRegex = (str = "") => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const slugToRegex = (slug) => {
    if (!slug) return null;
    const pattern = slug.trim().split("-").filter(Boolean).map(escapeRegex).join("[\\s-]*");
    if (!pattern) return null;
    return new RegExp(`^\\s*${pattern}\\s*$`, "i");
};

/**
 * The facet CONTEXT — mirrors getProducts' base match (active, in stock,
 * right productType, category/subcategory/search) without value filters.
 */
export const buildContextMatch = (query) => {
    const match = { isActive: true, inStock: true };

    match.productType = query.productType === "urbexon_hour" ? "urbexon_hour" : "ecommerce";

    if (query.vendorId && mongoose.isValidObjectId(query.vendorId)) {
        match.vendorId = new mongoose.Types.ObjectId(query.vendorId);
    }

    if (query.category) {
        const rx = slugToRegex(query.category);
        if (rx) match.category = rx;
    }
    if (query.subcategory) {
        const rx = slugToRegex(query.subcategory);
        if (rx) match.subcategory = rx;
    }
    if (query.deal === "true") {
        match.isDeal = true;
        match.$or = [{ dealEndsAt: null }, { dealEndsAt: { $gt: new Date() } }];
    }

    const search = (query.search || "").trim().slice(0, 50);
    if (search) {
        const rx = { $regex: escapeRegex(search), $options: "i" };
        // context $or must not clobber the deal $or — combine via $and
        const searchOr = {
            $or: [
                { name: rx }, { category: rx }, { subcategory: rx },
                { brand: rx }, { tags: { $elemMatch: rx } },
            ],
        };
        if (match.$or) {
            match.$and = [{ $or: match.$or }, searchOr];
            delete match.$or;
        } else {
            Object.assign(match, searchOr);
        }
    }

    return match;
};

const RATING_LABELS = [
    { value: "4", key: "r4", label: "4★ & above" },
    { value: "3", key: "r3", label: "3★ & above" },
    { value: "2", key: "r2", label: "2★ & above" },
    { value: "1", key: "r1", label: "1★ & above" },
];
const DISCOUNT_LABELS = [
    { value: "60", key: "d60", label: "60% or more" },
    { value: "40", key: "d40", label: "40% or more" },
    { value: "25", key: "d25", label: "25% or more" },
    { value: "10", key: "d10", label: "10% or more" },
];

/**
 * Category metadata shapes the raw facets: attributeSchema controls which
 * attribute groups are filterable, their labels, and their sidebar order.
 * Attributes present in product data but absent from the schema still
 * appear (data-driven first), sorted after the prioritized ones.
 */
const applyCategoryMetadata = (attributeFacets, attributeSchema = []) => {
    if (!attributeSchema.length) return attributeFacets;
    const bySchemaKey = new Map(
        attributeSchema.map((a, i) => [a.key.toLowerCase(), { ...a, idx: Number.isFinite(a.order) ? a.order : i }])
    );
    return attributeFacets
        .filter((g) => bySchemaKey.get(g.key.toLowerCase())?.filterable !== false)
        .map((g) => {
            const meta = bySchemaKey.get(g.key.toLowerCase());
            return {
                ...g,
                label: meta?.label || g.key,
                _order: meta ? meta.idx : 1000 + attributeFacets.indexOf(g),
            };
        })
        .sort((a, b) => a._order - b._order)
        .map(({ _order, ...g }) => g); // eslint-disable-line no-unused-vars
};

export const computeFacets = async (query) => {
    const context = buildContextMatch(query);

    // Category metadata (if this context is a category listing) — drives
    // attribute-group ordering, labels, and filterable flags.
    const categorySlugish = (query.category || "").trim().toLowerCase().replace(/\s+/g, "-");
    const [facetResult, hexRows, categoryMeta] = await Promise.all([
        Product.aggregate(buildFacetPipeline(context)).allowDiskUse(true),
        Product.aggregate(buildColorHexPipeline(context)),
        categorySlugish
            ? Category.findOne({ slug: categorySlugish, isActive: true })
                .select("attributeSchema defaultSort").lean()
            : Promise.resolve(null),
    ]);

    const raw = facetResult?.[0] || {};
    const hexByName = Object.fromEntries(
        (hexRows || []).map((r) => [String(r.name).toLowerCase(), r.hex])
    );

    const price = raw.price?.[0] || { min: 0, max: 0 };
    const ratings = raw.ratings?.[0] || {};
    const discounts = raw.discounts?.[0] || {};

    return {
        // Core facets — arrays of { value, count }
        brands: raw.brands || [],
        subcategories: raw.subcategories || [],
        sizes: raw.sizes || [],
        colors: (raw.colors || []).map((c) => ({
            ...c,
            hex: hexByName[String(c.value).toLowerCase()] || null,
        })),
        priceRange: { min: Math.floor(price.min || 0), max: Math.ceil(price.max || 0) },
        ratings: RATING_LABELS
            .map(({ value, key, label }) => ({ value, label, count: ratings[key] || 0 }))
            .filter((r) => r.count > 0),
        discounts: DISCOUNT_LABELS
            .map(({ value, key, label }) => ({ value, label, count: discounts[key] || 0 }))
            .filter((d) => d.count > 0),
        // Fully dynamic attribute groups — [{ key, label?, values: [{value,count}] }]
        // Ordered/labelled/gated by the category's attributeSchema when present.
        attributes: applyCategoryMetadata(raw.attributes || [], categoryMeta?.attributeSchema || []),
        // The category's preferred default sort (client may use as initial sort)
        defaultSort: categoryMeta?.defaultSort || "",
    };
};
