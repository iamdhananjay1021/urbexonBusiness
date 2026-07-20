import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Vendor from "../models/vendorModels/Vendor.js";
import express from "express";
import { getCache, setCache } from "../utils/Cache.js";

const router = express.Router();
const BASE = "https://urbexon.in";
const SITEMAP_CACHE_KEY = "sitemap:xml";
const SITEMAP_TTL = 3600; // matches the Cache-Control max-age below

router.get("/sitemap.xml", async (_req, res) => {
    try {
        // [FIX] Previously ran 3 unbounded collection scans on EVERY hit —
        // the Cache-Control header only cached in the requester's browser,
        // giving no protection against repeat crawler/scraper traffic.
        const cached = await getCache(SITEMAP_CACHE_KEY);
        if (cached) {
            res.set("Content-Type", "application/xml");
            res.set("Cache-Control", "public, max-age=3600");
            return res.send(cached);
        }

        const [products, categories, vendors] = await Promise.all([
            Product.find({ isActive: true }).select("_id updatedAt").lean(),
            Category.find({ isActive: true }).select("slug updatedAt").lean(),
            // [FIX] Was `isApproved` — Vendor has no such field (see
            // models/vendorModels/Vendor.js's `status` enum), so this
            // matched zero vendors ever and no vendor store page has been
            // in the sitemap since this route was written.
            Vendor.find({ status: "approved", isDeleted: false }).select("shopSlug updatedAt").lean(),
        ]);

        const urls = [
            { loc: "/", priority: "1.0", freq: "daily" },
            { loc: "/products", priority: "0.8", freq: "daily" },
            { loc: "/deals", priority: "0.8", freq: "daily" },
            { loc: "/urbexon-hour", priority: "0.7", freq: "daily" },
            { loc: "/contact", priority: "0.4", freq: "monthly" },
            { loc: "/privacy-policy", priority: "0.3", freq: "yearly" },
            { loc: "/terms-conditions", priority: "0.3", freq: "yearly" },
            { loc: "/refund-policy", priority: "0.3", freq: "yearly" },
            { loc: "/become-vendor", priority: "0.5", freq: "monthly" },
            { loc: "/become-delivery", priority: "0.5", freq: "monthly" },
        ];

        // Category pages
        for (const cat of categories) {
            urls.push({
                loc: `/category/${cat.slug}`,
                lastmod: cat.updatedAt?.toISOString?.(),
                priority: "0.7",
                freq: "weekly",
            });
        }

        // Product pages
        for (const p of products) {
            urls.push({
                loc: `/products/${p._id}`,
                lastmod: p.updatedAt?.toISOString?.(),
                priority: "0.6",
                freq: "weekly",
            });
        }

        // Vendor store pages
        for (const v of vendors) {
            if (!v.shopSlug) continue;
            urls.push({
                loc: `/vendor/${v.shopSlug}`,
                lastmod: v.updatedAt?.toISOString?.(),
                priority: "0.5",
                freq: "weekly",
            });
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
                .map(
                    (u) => `  <url>
    <loc>${BASE}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ""}
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
                )
                .join("\n")}
</urlset>`;

        await setCache(SITEMAP_CACHE_KEY, xml, SITEMAP_TTL);
        res.set("Content-Type", "application/xml");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(xml);
    } catch (err) {
        console.error("Sitemap error:", err);
        res.status(500).send("Sitemap generation failed");
    }
});

export default router;
