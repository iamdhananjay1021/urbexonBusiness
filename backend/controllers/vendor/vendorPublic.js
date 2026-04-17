/**
 * vendorPublic.js — Public vendor endpoints
 * GET /vendor/featured?limit=N → top-rated approved vendors
 * GET /vendor/store/:slug       → vendor store page (profile + products)
 * GET /vendor/nearby?lat=&lng=&radius=&category= → nearby shops
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Product from "../../models/Product.js";

export const getVendorStore = async (req, res) => {
    try {
        const { slug } = req.params;

        const vendor = await Vendor.findOne({
            $or: [{ shopSlug: slug }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : undefined }],
            status: "approved",
            isDeleted: false,
        })
            .select("shopName shopLogo shopBanner shopSlug shopCategory shopDescription rating ratingCount totalOrders isOpen address.city address.state createdAt")
            .lean();

        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        const products = await Product.find({
            vendorId: vendor._id,
            isActive: true,
        })
            .sort({ createdAt: -1 })
            .select("name slug images price mrp rating numReviews stock inStock category")
            .lean();

        res.json({ success: true, vendor, products });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch vendor store" });
    }
};

export const getFeaturedVendors = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 20);

        const vendors = await Vendor.find({
            status: "approved",
            isDeleted: false,
            isOpen: true,
        })
            .sort({ rating: -1, totalOrders: -1, createdAt: -1 })
            .limit(limit)
            .select("shopName shopLogo shopSlug shopCategory rating ratingCount totalOrders totalRevenue")
            .lean();

        res.json({ success: true, vendors });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch featured vendors" });
    }
};

/**
 * GET /vendor/nearby?lat=28.6&lng=77.2&radius=10&category=Grocery&limit=20&pincode=226001
 * Returns nearby vendors sorted by distance (geo) — falls back to pincode / all approved.
 */
export const getNearbyVendors = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radiusKm = Math.min(Math.max(parseFloat(req.query.radius) || 10, 1), 50);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
        const category = req.query.category?.trim() || null;
        const pincode = req.query.pincode?.trim() || null;

        let vendors = [];

        // 1️⃣ Try geo search if valid coordinates
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            try {
                vendors = await Vendor.findNearby(lng, lat, radiusKm * 1000, { category, limit });
            } catch { vendors = []; }
        }

        // 2️⃣ Fallback: pincode-based search
        if (vendors.length === 0 && pincode && /^\d{4,6}$/.test(pincode)) {
            const filter = {
                servicePincodes: pincode,
                status: "approved",
                isDeleted: false,
            };
            if (category) filter.shopCategory = category;
            vendors = await Vendor.find(filter)
                .sort({ rating: -1, totalOrders: -1 })
                .limit(limit)
                .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove isOpen acceptingOrders");
        }

        // 3️⃣ Fallback: all approved vendors (capped)
        if (vendors.length === 0) {
            const filter = {
                status: "approved",
                isDeleted: false,
            };
            if (category) filter.shopCategory = category;
            vendors = await Vendor.find(filter)
                .sort({ rating: -1, totalOrders: -1 })
                .limit(limit)
                .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove isOpen acceptingOrders");
        }

        // Compute distance if geo available
        const hasGeo = Number.isFinite(lat) && Number.isFinite(lng);
        const results = vendors.map((v) => {
            const vObj = v.toObject ? v.toObject() : v;
            if (hasGeo) {
                const [vLng, vLat] = v.location?.coordinates || [0, 0];
                if (vLat && vLng) vObj.distanceKm = haversine(lat, lng, vLat, vLng);
            }
            return vObj;
        });

        res.json({ success: true, vendors: results, total: results.length });
    } catch (err) {
        console.error("[getNearbyVendors]", err);
        res.status(500).json({ success: false, message: "Failed to fetch nearby vendors" });
    }
};

/** Haversine formula — returns distance in km */
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}
