/**
 * dashboardController.js — Admin Analytics v2.0
 * ✅ Single optimized endpoint for all dashboard stats
 * ✅ Revenue growth calculation
 * ✅ Order status breakdown
 * ✅ Recent 30-day revenue chart
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import Vendor from "../../models/vendorModels/Vendor.js";

export const getDashboardStats = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalOrders, todayOrders, monthOrders, prevMonthOrders,
            revenueAgg, todayRevAgg, monthRevAgg, prevMonthRevAgg,
            totalUsers, newUsersToday, newUsersMonth,
            totalProducts, activeProducts, outOfStock,
            pendingVendors, activeVendors,
            pendingRefunds, openReturns,
            recentOrders,
            ordersByStatus,
            revenueByDay,
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: startOfToday } }),
            Order.countDocuments({ createdAt: { $gte: startOfMonth } }),
            Order.countDocuments({ createdAt: { $gte: startOfPrev, $lte: endOfPrev } }),

            Order.aggregate([{ $match: { "payment.status": "PAID" } }, { $group: { _id: null, t: { $sum: "$totalAmount" } } }]),
            Order.aggregate([{ $match: { "payment.status": "PAID", createdAt: { $gte: startOfToday } } }, { $group: { _id: null, t: { $sum: "$totalAmount" } } }]),
            Order.aggregate([{ $match: { "payment.status": "PAID", createdAt: { $gte: startOfMonth } } }, { $group: { _id: null, t: { $sum: "$totalAmount" } } }]),
            Order.aggregate([{ $match: { "payment.status": "PAID", createdAt: { $gte: startOfPrev, $lte: endOfPrev } } }, { $group: { _id: null, t: { $sum: "$totalAmount" } } }]),

            User.countDocuments(),
            User.countDocuments({ createdAt: { $gte: startOfToday } }),
            User.countDocuments({ createdAt: { $gte: startOfMonth } }),

            Product.countDocuments(),
            Product.countDocuments({ isActive: true }),
            Product.countDocuments({ inStock: false, isActive: true }),

            Vendor.countDocuments({ status: "pending", isDeleted: false }),
            Vendor.countDocuments({ status: "approved", isDeleted: false }),

            Order.countDocuments({ "refund.status": "REQUESTED" }),
            Order.countDocuments({ "return.status": "REQUESTED" }),

            Order.find().sort({ createdAt: -1 }).limit(10)
                .select("customerName totalAmount orderStatus orderMode payment.method createdAt invoiceNumber")
                .lean(),

            Order.aggregate([
                { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            Order.aggregate([
                { $match: { "payment.status": "PAID", createdAt: { $gte: last30 } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        revenue: { $sum: "$totalAmount" },
                        orders: { $sum: 1 },
                    }
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        const totalRevenue = revenueAgg[0]?.t || 0;
        const todayRevenue = todayRevAgg[0]?.t || 0;
        const monthRevenue = monthRevAgg[0]?.t || 0;
        const prevMonthRevenue = prevMonthRevAgg[0]?.t || 0;

        const pct = (curr, prev) =>
            prev === 0 ? (curr > 0 ? 100 : 0) : Math.round(((curr - prev) / prev) * 100);

        res.json({
            stats: {
                totalOrders, todayOrders, monthOrders, prevMonthOrders,
                ordersGrowth: pct(monthOrders, prevMonthOrders),
                totalRevenue, todayRevenue, monthRevenue, prevMonthRevenue,
                revenueGrowth: pct(monthRevenue, prevMonthRevenue),
                totalUsers, newUsersToday, newUsersMonth,
                totalProducts, activeProducts, outOfStock,
                pendingVendors, activeVendors,
                pendingRefunds, openReturns,
            },
            recentOrders,
            ordersByStatus,
            revenueByDay,
        });
    } catch (err) {
        console.error("[getDashboardStats]", err);
        res.status(500).json({ success: false, message: "Failed to load dashboard" });
    }
};

/* ══════════════════════════════════════════════
   MAP DATA — User Locations + Order Origins
   GET /api/vendor/admin/map-data
══════════════════════════════════════════════ */
export const getMapData = async (req, res) => {
    try {
        const days = Math.min(parseInt(req.query.days) || 30, 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [userLocations, orderLocations, activeDeliveries] = await Promise.all([
            // Users with GPS location
            User.find({
                "location.latitude": { $exists: true, $ne: null },
                "location.longitude": { $exists: true, $ne: null },
            })
                .select("name email location.latitude location.longitude location.city location.state location.updatedAt createdAt")
                .sort({ "location.updatedAt": -1 })
                .limit(500)
                .lean(),

            // Orders with GPS coordinates (order origins)
            Order.find({
                latitude: { $exists: true, $ne: null },
                longitude: { $exists: true, $ne: null },
                createdAt: { $gte: since },
            })
                .select("latitude longitude customerName address orderStatus orderMode totalAmount createdAt invoiceNumber")
                .sort({ createdAt: -1 })
                .limit(500)
                .lean(),

            // Active deliveries (OUT_FOR_DELIVERY with rider assigned)
            Order.find({
                orderStatus: "OUT_FOR_DELIVERY",
                "delivery.assignedTo": { $ne: null },
            })
                .select("latitude longitude customerName address delivery deliveryLocation invoiceNumber totalAmount")
                .limit(50)
                .lean(),
        ]);

        // Aggregate order locations for heatmap (fine ~1km grid)
        const ordersByCity = {};
        orderLocations.forEach((o) => {
            const key = `${Math.round(o.latitude * 100) / 100},${Math.round(o.longitude * 100) / 100}`;
            if (!ordersByCity[key]) {
                ordersByCity[key] = { lat: o.latitude, lng: o.longitude, count: 0, revenue: 0 };
            }
            ordersByCity[key].count++;
            ordersByCity[key].revenue += o.totalAmount || 0;
        });

        // Regional clusters (coarse ~50km grid for big map bubbles)
        const regionClusters = {};
        orderLocations.forEach((o) => {
            const rLat = Math.round(o.latitude * 2) / 2;   // 0.5 deg ≈ 55km
            const rLng = Math.round(o.longitude * 2) / 2;
            const key = `${rLat},${rLng}`;
            if (!regionClusters[key]) {
                regionClusters[key] = { lat: 0, lng: 0, count: 0, revenue: 0, ecom: 0, uh: 0, sumLat: 0, sumLng: 0 };
            }
            const c = regionClusters[key];
            c.sumLat += o.latitude;
            c.sumLng += o.longitude;
            c.count++;
            c.revenue += o.totalAmount || 0;
            if (o.orderMode === "URBEXON_HOUR") c.uh++; else c.ecom++;
        });
        Object.values(regionClusters).forEach(c => { c.lat = c.sumLat / c.count; c.lng = c.sumLng / c.count; delete c.sumLat; delete c.sumLng; });

        // Mode breakdown totals
        const modeBreakdown = { ecom: 0, uh: 0, ecomRevenue: 0, uhRevenue: 0 };
        orderLocations.forEach(o => {
            if (o.orderMode === "URBEXON_HOUR") { modeBreakdown.uh++; modeBreakdown.uhRevenue += o.totalAmount || 0; }
            else { modeBreakdown.ecom++; modeBreakdown.ecomRevenue += o.totalAmount || 0; }
        });

        // State-wise aggregation (users)
        const usersByState = {};
        userLocations.forEach((u) => {
            const st = u.location?.state?.trim() || "Unknown";
            if (!usersByState[st]) usersByState[st] = { state: st, users: 0, orders: 0, revenue: 0 };
            usersByState[st].users++;
        });

        // State-wise aggregation (orders) - extract state from address
        orderLocations.forEach((o) => {
            // Try to extract state from address (last part before pincode or last comma-separated part)
            const addr = o.address || "";
            const parts = addr.split(",").map(p => p.trim());
            let state = "Unknown";
            // Find matching user state by proximity, or parse from address
            for (const u of userLocations) {
                if (u.location?.state && u.location.latitude && u.location.longitude) {
                    const dlat = Math.abs((u.location.latitude) - o.latitude);
                    const dlng = Math.abs((u.location.longitude) - o.longitude);
                    if (dlat < 0.5 && dlng < 0.5) { state = u.location.state; break; }
                }
            }
            if (state === "Unknown" && parts.length >= 2) {
                // Try second-to-last part (often state in Indian addresses)
                const candidate = parts[parts.length - 2]?.replace(/\d+/g, "").trim();
                if (candidate && candidate.length > 1 && candidate.length < 30) state = candidate;
            }
            if (!usersByState[state]) usersByState[state] = { state, users: 0, orders: 0, revenue: 0 };
            usersByState[state].orders++;
            usersByState[state].revenue += o.totalAmount || 0;
        });

        // Top cities from users
        const cityCount = {};
        userLocations.forEach((u) => {
            const city = u.location?.city?.split(",")[0]?.trim() || "Unknown";
            cityCount[city] = (cityCount[city] || 0) + 1;
        });
        const topCities = Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([city, count]) => ({ city, count }));

        res.json({
            success: true,
            userLocations: userLocations.map((u) => ({
                id: u._id,
                name: u.name,
                email: u.email,
                lat: u.location.latitude,
                lng: u.location.longitude,
                city: u.location.city,
                state: u.location.state,
                lastSeen: u.location.updatedAt,
                joinedAt: u.createdAt,
            })),
            orderLocations: orderLocations.map((o) => ({
                id: o._id,
                lat: o.latitude,
                lng: o.longitude,
                customer: o.customerName,
                address: o.address,
                status: o.orderStatus,
                mode: o.orderMode,
                amount: o.totalAmount,
                invoice: o.invoiceNumber,
                date: o.createdAt,
            })),
            activeDeliveries: activeDeliveries.map((d) => ({
                id: d._id,
                customerLat: d.latitude,
                customerLng: d.longitude,
                customer: d.customerName,
                address: d.address,
                riderName: d.delivery?.riderName,
                riderPhone: d.delivery?.riderPhone,
                riderLat: d.deliveryLocation?.coordinates?.[1] || null,
                riderLng: d.deliveryLocation?.coordinates?.[0] || null,
                invoice: d.invoiceNumber,
                amount: d.totalAmount,
            })),
            heatmapData: Object.values(ordersByCity),
            regionClusters: Object.values(regionClusters).sort((a, b) => b.count - a.count),
            modeBreakdown,
            stateWise: Object.values(usersByState).sort((a, b) => (b.orders + b.users) - (a.orders + a.users)),
            topCities,
            totalUsers: userLocations.length,
            totalOrders: orderLocations.length,
            totalActiveDeliveries: activeDeliveries.length,
        });
    } catch (err) {
        console.error("[getMapData]", err);
        res.status(500).json({ success: false, message: "Failed to load map data" });
    }
};
