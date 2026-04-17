import { getCache, setCache, delCacheByPrefix } from "../utils/Cache.js";
import Banner from "../models/Banner.js";
import cloudinary, { uploadToCloudinary } from "../config/cloudinary.js";

const optimizeUrl = (url, width = 1200) => {
    if (!url || !url.includes("cloudinary.com")) return url ?? "";
    return url.replace("/upload/", `/upload/q_auto,f_auto,w_${width}/`);
};

const safeDestroy = async (publicId) => {
    if (!publicId) return;
    try { await cloudinary.uploader.destroy(publicId); }
    catch (e) { console.warn("[Cloudinary] Banner delete failed:", e.message); }
};

/* ── GET ALL ACTIVE BANNERS (public) ── */
export const getActiveBanners = async (req, res) => {
    try {
        const cached = await getCache("banners:active");
        if (cached) return res.json(cached);

        const banners = await Banner.find({ isActive: true })
            .sort({ order: 1, createdAt: -1 })
            .lean();
        await setCache("banners:active", banners, 600); // 10 min
        res.json(banners);
    } catch (err) {
        console.error("GET BANNERS ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch banners" });
    }
};

/* ── GET ALL BANNERS (admin) ── */
export const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1, createdAt: -1 }).lean();
        res.json(banners);
    } catch (err) {
        console.error("GET ALL BANNERS ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to fetch banners" });
    }
};

/* ── CREATE BANNER (admin) ── */
export const createBanner = async (req, res) => {
    try {
        const { title, subtitle, link, isActive, order } = req.body;

        if (!req.file) return res.status(400).json({ success: false, message: "Banner image is required" });

        const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");

        const banner = await Banner.create({
            title: title?.trim() || "",
            subtitle: subtitle?.trim() || "",
            link: link?.trim() || "",
            isActive: isActive === "true" || isActive === true,
            order: Number(order) || 0,
            image: {
                url: optimizeUrl(result.secure_url),
                public_id: result.public_id,
            },
        });

        await delCacheByPrefix("banners:");
        res.status(201).json(banner);
    } catch (err) {
        console.error("CREATE BANNER ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to create banner" });
    }
};

/* ── UPDATE BANNER (admin) ── */
export const updateBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

        const { title, subtitle, link, isActive, order } = req.body;

        if (title !== undefined) banner.title = title.trim();
        if (subtitle !== undefined) banner.subtitle = subtitle.trim();
        if (link !== undefined) banner.link = link.trim();
        if (isActive !== undefined) banner.isActive = isActive === "true" || isActive === true;
        if (order !== undefined) banner.order = Number(order) || 0;

        // Replace image if new one uploaded
        if (req.file) {
            await safeDestroy(banner.image?.public_id);
            const result = await uploadToCloudinary(req.file.buffer, "rv-gift-products");
            banner.image = {
                url: optimizeUrl(result.secure_url),
                public_id: result.public_id,
            };
        }

        await banner.save();
        await delCacheByPrefix("banners:");
        res.json(banner);
    } catch (err) {
        console.error("UPDATE BANNER ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to update banner" });
    }
};

/* ── DELETE BANNER (admin) ── */
export const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) return res.status(404).json({ success: false, message: "Banner not found" });

        await safeDestroy(banner.image?.public_id);
        await banner.deleteOne();
        await delCacheByPrefix("banners:");

        res.json({ message: "Banner deleted successfully" });
    } catch (err) {
        console.error("DELETE BANNER ERROR:", err);
        res.status(500).json({ success: false, message: "Failed to delete banner" });
    }
};