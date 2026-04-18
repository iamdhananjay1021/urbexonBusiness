import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Vendor from "../models/vendorModels/Vendor.js";
import express from "express";

const router = express.Router();
const BASE = "https://www.urbexon.in";

router.get("/sitemap.xml", async (_req, res) => {
    try {
        const [products, categories, vendors] = await Promise.all([
            Product.find({ isActive: true }).select("_id updatedAt").lean(),
            Category.find({ isActive: true }).select("slug updatedAt").lean(),
            Vendor.find({ isApproved: true }).select("shopSlug updatedAt").lean(),
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

        res.set("Content-Type", "application/xml");
        res.set("Cache-Control", "public, max-age=3600");
        res.send(xml);
    } catch (err) {
        console.error("Sitemap error:", err);
        res.status(500).send("Sitemap generation failed");
    }
});

export default router;
