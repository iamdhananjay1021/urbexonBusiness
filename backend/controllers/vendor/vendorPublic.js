/**
 * vendorPublic.js — Production v2.0
 * FIXES:
 * - getNearbyVendors: subscription check added to ALL 3 query paths
 * - getFeaturedVendors: subscription check added
 * - checkPincode vendors: filtered to only active subscription
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import Product from "../../models/Product.js";
import Subscription from "../../models/vendorModels/Subscription.js";

// Base filter for publicly visible vendors (approved + subscription active)
const ACTIVE_VENDOR_BASE = {
    status: "approved",
    isDeleted: false,
    isOpen: true,
    acceptingOrders: true,
    "subscription.isActive": true,
    "subscription.expiryDate": { $gt: new Date() },
};

export const getVendorStore = async (req, res) => {
    try {
        const { slug } = req.params;

        const vendor = await Vendor.findOne({
            $or: [{ shopSlug: slug }, { _id: slug.match(/^[0-9a-fA-F]{24}$/) ? slug : undefined }],
            status: "approved",
            isDeleted: false,
        })
            .select("shopName shopLogo shopBanner shopSlug shopCategory shopDescription rating ratingCount totalOrders isOpen address.city address.state createdAt subscription.isActive subscription.expiryDate")
            .lean();

        if (!vendor) {
            return res.status(404).json({ success: false, message: "Vendor not found" });
        }

        // Check subscription active
        const now = new Date();
        const subActive = vendor.subscription?.isActive && vendor.subscription?.expiryDate && new Date(vendor.subscription.expiryDate) > now;
        if (!subActive) {
            return res.status(404).json({ success: false, message: "This store is currently unavailable" });
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
        const now = new Date();

        const vendors = await Vendor.find({
            status: "approved",
            isDeleted: false,
            isOpen: true,
            "subscription.isActive": true,
            "subscription.expiryDate": { $gt: now },
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
 * Returns nearby vendors with ACTIVE subscription sorted by distance
 */
export const getNearbyVendors = async (req, res) => {
    try {
        const lat = parseFloat(req.query.lat);
        const lng = parseFloat(req.query.lng);
        const radiusKm = Math.min(Math.max(parseFloat(req.query.radius) || 10, 1), 50);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);
        const category = req.query.category?.trim() || null;
        const pincode = req.query.pincode?.trim() || null;
        const now = new Date();

        let vendors = [];

        // Subscription filter applied to all paths
        const subFilter = {
            "subscription.isActive": true,
            "subscription.expiryDate": { $gt: now },
        };

        // 1️⃣ Geo search if valid coordinates
        if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            try {
                const geoFilter = {
                    location: {
                        $nearSphere: {
                            $geometry: { type: "Point", coordinates: [lng, lat] },
                            $maxDistance: radiusKm * 1000,
                        },
                    },
                    status: "approved",
                    isOpen: true,
                    acceptingOrders: true,
                    isDeleted: false,
                    "location.coordinates": { $ne: [0, 0] },
                    ...subFilter,
                };
                if (category) geoFilter.shopCategory = category;
                vendors = await Vendor.find(geoFilter)
                    .limit(limit)
                    .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove isOpen acceptingOrders");
            } catch { vendors = []; }
        }

        // 2️⃣ Pincode fallback
        if (vendors.length === 0 && pincode && /^\d{4,6}$/.test(pincode)) {
            const filter = {
                servicePincodes: pincode,
                status: "approved",
                isDeleted: false,
                ...subFilter,
            };
            if (category) filter.shopCategory = category;
            vendors = await Vendor.find(filter)
                .sort({ rating: -1, totalOrders: -1 })
                .limit(limit)
                .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove isOpen acceptingOrders");
        }

        // 3️⃣ All approved + subscribed vendors fallback
        if (vendors.length === 0) {
            const filter = {
                status: "approved",
                isDeleted: false,
                ...subFilter,
            };
            if (category) filter.shopCategory = category;
            vendors = await Vendor.find(filter)
                .sort({ rating: -1, totalOrders: -1 })
                .limit(limit)
                .select("shopName shopLogo shopCategory shopSlug rating ratingCount totalOrders preparationTime deliveryMode location address minOrderAmount freeDeliveryAbove isOpen acceptingOrders");
        }

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

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return +(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1);
}
