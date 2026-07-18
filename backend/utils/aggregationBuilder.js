/**
 * aggregationBuilder.js — builds the $facet aggregation pipeline that
 * generates every filter group dynamically from whatever product data
 * actually exists in the matched context.
 *
 * Nothing is hardcoded: brands/colors/sizes/subcategories come from
 * $group over live documents, and the `attributes` Map is exploded via
 * $objectToArray so ANY attribute key added from the Admin Panel
 * (fabric, fit, ram, storage, occasion, …) becomes a facet automatically.
 */

const NON_EMPTY = { $nin: [null, ""] };

/** value/count list, most common first, capped so payloads stay small */
const valueCounts = (field, limit = 60) => [
    { $match: { [field]: NON_EMPTY } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
    { $limit: limit },
    { $project: { _id: 0, value: "$_id", count: 1 } },
];

export const buildFacetPipeline = (contextMatch) => [
    { $match: contextMatch },
    {
        $facet: {
            /* ── Brand ── */
            brands: valueCounts("brand"),

            /* ── Subcategory ── */
            subcategories: valueCounts("subcategory", 40),

            /* ── Color — base color + every colorVariant name.
                 Swatch hexes come from buildColorHexPipeline (merged in
                 the service layer) so this stage stays simple. ── */
            colors: [
                {
                    $project: {
                        names: {
                            $setUnion: [
                                {
                                    $cond: [
                                        { $gt: [{ $strLenCP: { $ifNull: ["$color", ""] } }, 0] },
                                        ["$color"],
                                        [],
                                    ],
                                },
                                {
                                    $map: {
                                        input: { $ifNull: ["$colorVariants", []] },
                                        as: "v",
                                        in: "$$v.name",
                                    },
                                },
                            ],
                        },
                    },
                },
                { $unwind: "$names" },
                { $match: { names: NON_EMPTY } },
                { $group: { _id: "$names", count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } },
                { $limit: 40 },
                { $project: { _id: 0, value: "$_id", count: 1 } },
            ],

            /* ── Size ── */
            sizes: [
                { $unwind: "$sizes" },
                { $match: { "sizes.size": NON_EMPTY } },
                { $group: { _id: "$sizes.size", count: { $sum: 1 } } },
                { $sort: { count: -1, _id: 1 } },
                { $limit: 40 },
                { $project: { _id: 0, value: "$_id", count: 1 } },
            ],

            /* ── Price range ── */
            price: [
                {
                    $group: {
                        _id: null,
                        min: { $min: "$price" },
                        max: { $max: "$price" },
                    },
                },
                { $project: { _id: 0, min: 1, max: 1 } },
            ],

            /* ── Rating buckets (4+ / 3+ / 2+ / 1+) ── */
            ratings: [
                {
                    $group: {
                        _id: null,
                        r4: { $sum: { $cond: [{ $gte: ["$rating", 4] }, 1, 0] } },
                        r3: { $sum: { $cond: [{ $gte: ["$rating", 3] }, 1, 0] } },
                        r2: { $sum: { $cond: [{ $gte: ["$rating", 2] }, 1, 0] } },
                        r1: { $sum: { $cond: [{ $gte: ["$rating", 1] }, 1, 0] } },
                    },
                },
                { $project: { _id: 0 } },
            ],

            /* ── Discount buckets — derived from mrp/price ── */
            discounts: [
                {
                    $project: {
                        pct: {
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
                    },
                },
                {
                    $group: {
                        _id: null,
                        d10: { $sum: { $cond: [{ $gte: ["$pct", 10] }, 1, 0] } },
                        d25: { $sum: { $cond: [{ $gte: ["$pct", 25] }, 1, 0] } },
                        d40: { $sum: { $cond: [{ $gte: ["$pct", 40] }, 1, 0] } },
                        d60: { $sum: { $cond: [{ $gte: ["$pct", 60] }, 1, 0] } },
                    },
                },
                { $project: { _id: 0 } },
            ],

            /* ── Dynamic attributes — every key in the attributes Map ── */
            attributes: [
                {
                    $project: {
                        attrs: { $objectToArray: { $ifNull: ["$attributes", {}] } },
                    },
                },
                { $unwind: "$attrs" },
                { $match: { "attrs.v": NON_EMPTY } },
                {
                    $group: {
                        _id: { key: "$attrs.k", value: "$attrs.v" },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1, "_id.value": 1 } },
                {
                    $group: {
                        _id: "$_id.key",
                        values: { $push: { value: "$_id.value", count: "$count" } },
                        total: { $sum: "$count" },
                    },
                },
                { $sort: { total: -1, _id: 1 } },
                { $limit: 25 },
                {
                    $project: {
                        _id: 0,
                        key: "$_id",
                        values: { $slice: ["$values", 40] },
                    },
                },
            ],
        },
    },
];

/** color swatch hexes need a second cheap pass (name → most common hex) */
export const buildColorHexPipeline = (contextMatch) => [
    { $match: contextMatch },
    { $unwind: { path: "$colorVariants", preserveNullAndEmptyArrays: false } },
    { $match: { "colorVariants.name": NON_EMPTY, "colorVariants.hex": NON_EMPTY } },
    {
        $group: {
            _id: "$colorVariants.name",
            hex: { $first: "$colorVariants.hex" },
        },
    },
    { $limit: 80 },
    { $project: { _id: 0, name: "$_id", hex: 1 } },
];
