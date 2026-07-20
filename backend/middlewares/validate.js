// middlewares/validate.js
//
// [DECISION] Two parallel request-validation systems exist in this codebase:
// this legacy rule-object middleware (validateBody) and the newer
// zod-schema-based one in middlewares/zodValidate.js. Zod is the
// standardized target for all NEW routes going forward — it gives real
// type coercion/inference instead of string-matched rules, and is already
// the pattern used across every admin-finance and product route added
// since. This file is intentionally left as-is (not migrated) because its
// 5 existing call sites (authRoutes.js, orderRoutes.js, addressRoutes.js,
// VendorRoutes/vendorRoutes.js, deliveryRoutes/deliveryRoutes.js) are
// working in production and migrating them carries real regression risk
// for zero functional gain — do not add new call sites here; use
// zodValidate.js's validate(schema) instead.

export const validateBody = (rules) => (req, res, next) => {
    const errors = [];

    for (const [field, rule] of Object.entries(rules)) {
        let val = req.body[field];

        // sanitize string
        if (typeof val === "string") {
            val = val.trim();
            req.body[field] = val;
        }

        const isEmpty = val === undefined || val === null || val === "";

        if (rule.required && isEmpty) {
            errors.push(`${field} is required`);
            continue;
        }

        if (isEmpty) continue;

        // Normalize case before any pattern check below runs — e.g. GSTIN/PAN,
        // which are stored uppercase on the model (Vendor.gstNumber/panNumber
        // already have `uppercase: true`), so validation should judge the
        // same normalized form that ends up persisted, not whatever case the
        // user happened to type.
        if (rule.uppercase && typeof val === "string") {
            val = val.toUpperCase();
            req.body[field] = val;
        }

        // TYPE VALIDATION
        if (rule.type === "string" && typeof val !== "string") {
            errors.push(`${field} must be a string`);
        }

        if (rule.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            errors.push(`${field} must be a valid email`);
        }

        if (rule.type === "number" && !/^\d+(\.\d+)?$/.test(String(val))) {
            errors.push(`${field} must be a valid number`);
        }

        if (rule.type === "boolean" && !["true", "false", true, false].includes(val)) {
            errors.push(`${field} must be boolean`);
        }

        if (rule.type === "array" && !Array.isArray(val)) {
            errors.push(`${field} must be an array`);
        }

        // STRING LIMITS
        if (rule.minLength && String(val).length < rule.minLength) {
            errors.push(`${field} must be at least ${rule.minLength} chars`);
        }

        if (rule.maxLength && String(val).length > rule.maxLength) {
            errors.push(`${field} max length is ${rule.maxLength}`);
        }

        // NUMBER LIMITS
        if (rule.min !== undefined && Number(val) < rule.min) {
            errors.push(`${field} must be >= ${rule.min}`);
        }

        if (rule.max !== undefined && Number(val) > rule.max) {
            errors.push(`${field} must be <= ${rule.max}`);
        }

        // ENUM
        if (rule.enum && !rule.enum.includes(val)) {
            errors.push(`${field} must be one of: ${rule.enum.join(", ")}`);
        }

        // PATTERN
        if (rule.pattern && !rule.pattern.test(String(val))) {
            errors.push(`${field} format is invalid`);
        }
    }

    if (errors.length) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors,
        });
    }

    next();
};