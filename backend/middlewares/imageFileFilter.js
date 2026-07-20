/**
 * imageFileFilter.js — shared multer fileFilter for image-only uploads.
 *
 * [FIX] categoryRoutes.js, collectionRoutes.js, bannerRoutes.js, and
 * productRoutes.js each had their own inline `file.mimetype.startsWith
 * ("image/")` check, which also matches "image/svg+xml". An uploaded SVG
 * can embed <script>/event-handler payloads that execute when the file is
 * later opened or rendered inline — a stored-XSS vector via what looks
 * like a harmless image upload. Excluded explicitly here rather than
 * switching to an allowlist, to avoid silently rejecting any currently-
 * working format (jpg/png/webp/avif/gif/etc.) these routes accept today.
 */
export const imageFileFilter = (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/") || file.mimetype === "image/svg+xml") {
        return cb(new Error("Only image files allowed (SVG not permitted)"), false);
    }
    cb(null, true);
};
