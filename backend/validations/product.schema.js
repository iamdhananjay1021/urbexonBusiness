import { z } from "zod";

/* ─── Smart JSON Parser ─────────────────────────────────── */
const safeJsonParse = (val) => {
    if (typeof val !== "string") return val;
    const trimmed = val.trim();

    // Only parse if it looks like JSON
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
        try {
            return JSON.parse(trimmed);
        } catch {
            return val; // return original if parse fails
        }
    }
    return val;
};

/* ─── Create Product Schema ─────────────────────────────── */
export const createProductSchema = z.object({
    // Required fields
    name: z.string().min(2, "Name must be at least 2 characters").max(200),
    price: z.coerce.number().min(0.01, "Price must be greater than 0"),
    category: z.string().min(1, "Category is required"),
    stock: z.coerce.number().min(0, "Stock cannot be negative").default(0),

    // Optional primitives
    description: z.string().max(2000).optional(),
    mrp: z.coerce.number().min(0).optional().nullable(),
    brand: z.string().max(100).optional(),
    sku: z.string().max(50).optional(),
    weight: z.string().max(20).optional(),
    origin: z.string().max(100).optional(),
    returnPolicy: z.string().max(100).optional(),
    shippingInfo: z.string().max(200).optional(),
    color: z.string().max(50).optional(),
    material: z.string().max(100).optional(),
    occasion: z.string().max(100).optional(),
    subcategory: z.string().max(100).optional(),
    gstPercent: z.coerce.number().min(0).max(100).default(0),
    hsn: z.string().max(20).optional(),
    barcode: z.string().max(50).optional(),
    lowStockThreshold: z.coerce.number().min(0).max(10000).optional(),

    // SEO (flat FormData keys — controller nests them under seo{})
    metaTitle: z.string().max(120).optional(),
    metaDesc: z.string().max(200).optional(),

    // Shipping package dimensions (JSON object {lengthCm,widthCm,heightCm})
    shipping: z.preprocess(
        safeJsonParse,
        z.object({
            lengthCm: z.coerce.number().min(0).default(0),
            widthCm: z.coerce.number().min(0).default(0),
            heightCm: z.coerce.number().min(0).default(0),
        }).optional()
    ),

    // Per-image alt texts (JSON array of strings, index-mapped to main images)
    imageAlts: z.preprocess(
        safeJsonParse,
        z.array(z.string().max(150)).optional()
    ),

    // Booleans (FormData sends "true"/"false" strings)
    // NOTE: z.coerce.boolean() treats "false" as true (non-empty string).
    // Must use preprocess to handle string booleans from FormData.
    isFeatured: z.preprocess((v) => v === "true" || v === true, z.boolean().default(false)),
    isDeal: z.preprocess((v) => v === "true" || v === true, z.boolean().default(false)),
    isCustomizable: z.preprocess((v) => v === "true" || v === true, z.boolean().default(false)),

    // Date (only if isDeal is true)
    dealEndsAt: z.preprocess(
        (val) => {
            if (!val || val === "" || val === "undefined") return undefined;
            const d = new Date(val);
            return isNaN(d.getTime()) ? undefined : d;
        },
        z.date().optional()
    ),

    // Tags (JSON string from FormData)
    tags: z.preprocess(
        safeJsonParse,
        z.array(z.string()).default([])
    ),

    // Sizes (JSON string: [{size, stock}])
    sizes: z.preprocess(
        safeJsonParse,
        z.array(z.object({
            size: z.string().min(1),
            stock: z.coerce.number().min(0).default(0),
        })).default([])
    ),

    // Highlights (JSON object: {key: value})
    highlights: z.preprocess(
        safeJsonParse,
        z.record(z.string(), z.string()).default({})
    ),

    // Dynamic discovery attributes (JSON object: {key: value}) — keys come
    // from the category's attributeSchema metadata; values are free strings.
    // Powers the global filter engine (attr_<key> params + facets).
    attributes: z.preprocess(
        safeJsonParse,
        z.record(z.string(), z.string()).default({})
    ),

    // Customization config (JSON object)
    customizationConfig: z.preprocess(
        safeJsonParse,
        z.object({
            allowText: z.coerce.boolean().default(true),
            allowImage: z.coerce.boolean().default(true),
            allowNote: z.coerce.boolean().default(true),
            textLabel: z.string().max(100).default("Name / Message"),
            textPlaceholder: z.string().max(200).default(""),
            textMaxLength: z.coerce.number().min(1).max(500).default(100),
            imageLabel: z.string().max(100).default("Upload Design"),
            noteLabel: z.string().max(100).default("Special Instructions"),
            notePlaceholder: z.string().max(200).default(""),
            extraPrice: z.coerce.number().min(0).default(0),
        }).optional()
    ),

    // Images meta (required for dynamic variant uploads)
    mainImageCount: z.coerce.number().min(0).optional(),
    colorVariants: z.preprocess(
        safeJsonParse,
        z.array(z.any()).default([])
    ),
});

/* ─── Update Schema (all fields optional) ─────────────── */
export const updateProductSchema = createProductSchema.partial();