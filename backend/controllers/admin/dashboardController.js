/**
 * dashboardController.js — Production Hardened v2.0
 *
 * FIXES APPLIED:
 * [FIX-DB1] getDashboardStats → caching added (60s TTL) — prevents DB hammering on every page refresh
 * [FIX-DB2] getMapData → caching added (120s TTL)
 * [FIX-DB3] All cache calls wrapped in try/catch (safe helpers)
 * [FIX-DB4] Anti-stampede lock on getDashboardStats (concurrent admin refreshes)
 * [FIX-DB5] Input validation on getMapData (days param)
 * [FIX-DB6] All aggregation projections already present (from v1.0 FIX #5) — preserved
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import User from "../../models/User.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import { getCache, setCache, delCacheByPrefix } from "../../utils/Cache.js";

// [FIX-DB3] Safe cache helpers — never crash on cache failure
const safeGetCache = async (key) => {
    try { return await getCache(key); } catch (_) { return null; }
};
const safeSetCache = async (key, val, ttl) => {
    try { await setCache(key, val, ttl); } catch (_) { }
};

const DASHBOARD_CACHE_KEY = "dashboard:stats";
const DASHBOARD_LOCK_KEY = "dashboard:stats:lock";
const DASHBOARD_TTL = 60; // 1 minute — fresh enough, avoids DB storm

export const getDashboardStats = async (req, res) => {
    try {
        // [FIX-DB1] Serve from cache if available
        const cached = await safeGetCache(DASHBOARD_CACHE_KEY);
        if (cached) return res.json(cached);

        // [FIX-DB4] Anti-stampede lock — only 1 concurrent DB aggregation
        const isLocked = await safeGetCache(DASHBOARD_LOCK_KEY);
        if (isLocked) {
            // Return stale or loading signal if locked and no cache
            return res.status(202).json({ loading: true, message: "Dashboard is loading, retry in a moment" });
        }
        await safeSetCache(DASHBOARD_LOCK_KEY, "1", 10);

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfPrev = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        let result;
        try {
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

                // [FIX-DB6] Revenue aggregations with projections (preserved from v1.0)
                Order.aggregate([
                    { $match: { "payment.status": "PAID" } },
                    { $project: { totalAmount: 1 } },
                    { $group: { _id: null, t: { $sum: "$totalAmount" } } },
                ]),
                Order.aggregate([
                    { $match: { "payment.status": "PAID", createdAt: { $gte: startOfToday } } },
                    { $project: { totalAmount: 1 } },
                    { $group: { _id: null, t: { $sum: "$totalAmount" } } },
                ]),
                Order.aggregate([
                    { $match: { "payment.status": "PAID", createdAt: { $gte: startOfMonth } } },
                    { $project: { totalAmount: 1 } },
                    { $group: { _id: null, t: { $sum: "$totalAmount" } } },
                ]),
                Order.aggregate([
                    { $match: { "payment.status": "PAID", createdAt: { $gte: startOfPrev, $lte: endOfPrev } } },
                    { $project: { totalAmount: 1 } },
                    { $group: { _id: null, t: { $sum: "$totalAmount" } } },
                ]),

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

                Order.find()
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .select("customerName totalAmount orderStatus orderMode payment.method createdAt invoiceNumber")
                    .lean(),

                Order.aggregate([
                    { $project: { orderStatus: 1 } },
                    { $group: { _id: "$orderStatus", count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                ]),

                Order.aggregate([
                    { $match: { "payment.status": "PAID", createdAt: { $gte: last30 } } },
                    { $project: { totalAmount: 1, createdAt: 1 } },
                    {
                        $group: {
                            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                            revenue: { $sum: "$totalAmount" },
                            orders: { $sum: 1 },
                        },
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

            result = {
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
            };

            // [FIX-DB1] Cache result
            await safeSetCache(DASHBOARD_CACHE_KEY, result, DASHBOARD_TTL);
        } catch (dbErr) {
            // Release lock on failure
            await safeSetCache(DASHBOARD_LOCK_KEY, null, 1);
            throw dbErr;
        }

        // Release lock
        await safeSetCache(DASHBOARD_LOCK_KEY, null, 1);

        res.json(result);
    } catch (err) {
        console.error("[getDashboardStats]", err);
        res.status(500).json({ success: false, message: "Failed to load dashboard" });
    }
};

/* ══════════════════════════════════════════════
   MAP DATA — User Locations + Order Origins
══════════════════════════════════════════════ */
export const getMapData = async (req, res) => {
    try {
        // [FIX-DB5] Validate days param
        const daysRaw = parseInt(req.query.days);
        const days = isNaN(daysRaw) ? 30 : Math.min(Math.max(1, daysRaw), 90);

        // [FIX-DB2] Cache map data (120s — heavier query, slightly longer TTL)
        const cacheKey = `dashboard:map:d${days}`;
        const cached = await safeGetCache(cacheKey);
        if (cached) return res.json(cached);

        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [userLocations, orderLocations, activeDeliveries] = await Promise.all([
            User.find({
                "location.latitude": { $exists: true, $ne: null },
                "location.longitude": { $exists: true, $ne: null },
            })
                .select("name email location.latitude location.longitude location.city location.state location.updatedAt createdAt")
                .sort({ "location.updatedAt": -1 })
                .limit(500)
                .lean(),

            Order.find({
                latitude: { $exists: true, $ne: null },
                longitude: { $exists: true, $ne: null },
                createdAt: { $gte: since },
            })
                .select("latitude longitude customerName address orderStatus orderMode totalAmount createdAt invoiceNumber")
                .sort({ createdAt: -1 })
                .limit(500)
                .lean(),

            Order.find({
                orderStatus: "OUT_FOR_DELIVERY",
                "delivery.assignedTo": { $ne: null },
            })
                .select("latitude longitude customerName address delivery deliveryLocation invoiceNumber totalAmount")
                .limit(50)
                .lean(),
        ]);

        const ordersByCity = {};
        orderLocations.forEach((o) => {
            const key = `${Math.round(o.latitude * 100) / 100},${Math.round(o.longitude * 100) / 100}`;
            if (!ordersByCity[key]) {
                ordersByCity[key] = { lat: o.latitude, lng: o.longitude, count: 0, revenue: 0 };
            }
            ordersByCity[key].count++;
            ordersByCity[key].revenue += o.totalAmount || 0;
        });

        const regionClusters = {};
        orderLocations.forEach((o) => {
            const rLat = Math.round(o.latitude * 2) / 2;
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
        Object.values(regionClusters).forEach(c => {
            c.lat = c.sumLat / c.count;
            c.lng = c.sumLng / c.count;
            delete c.sumLat;
            delete c.sumLng;
        });

        const modeBreakdown = { ecom: 0, uh: 0, ecomRevenue: 0, uhRevenue: 0 };
        orderLocations.forEach(o => {
            if (o.orderMode === "URBEXON_HOUR") {
                modeBreakdown.uh++;
                modeBreakdown.uhRevenue += o.totalAmount || 0;
            } else {
                modeBreakdown.ecom++;
                modeBreakdown.ecomRevenue += o.totalAmount || 0;
            }
        });

        const usersByState = {};
        userLocations.forEach((u) => {
            const st = u.location?.state?.trim() || "Unknown";
            if (!usersByState[st]) usersByState[st] = { state: st, users: 0, orders: 0, revenue: 0 };
            usersByState[st].users++;
        });

        orderLocations.forEach((o) => {
            const addr = o.address || "";
            const parts = addr.split(",").map(p => p.trim());
            let state = "Unknown";
            for (const u of userLocations) {
                if (u.location?.state && u.location.latitude && u.location.longitude) {
                    const dlat = Math.abs(u.location.latitude - o.latitude);
                    const dlng = Math.abs(u.location.longitude - o.longitude);
                    if (dlat < 0.5 && dlng < 0.5) { state = u.location.state; break; }
                }
            }
            if (state === "Unknown" && parts.length >= 2) {
                const candidate = parts[parts.length - 2]?.replace(/\d+/g, "").trim();
                if (candidate && candidate.length > 1 && candidate.length < 30) state = candidate;
            }
            if (!usersByState[state]) usersByState[state] = { state, users: 0, orders: 0, revenue: 0 };
            usersByState[state].orders++;
            usersByState[state].revenue += o.totalAmount || 0;
        });

        const cityCount = {};
        userLocations.forEach((u) => {
            const city = u.location?.city?.split(",")[0]?.trim() || "Unknown";
            cityCount[city] = (cityCount[city] || 0) + 1;
        });
        const topCities = Object.entries(cityCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([city, count]) => ({ city, count }));

        const mapResult = {
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
        };

        // [FIX-DB2] Cache map data
        await safeSetCache(cacheKey, mapResult, 120);

        res.json(mapResult);
    } catch (err) {
        console.error("[getMapData]", err);
        res.status(500).json({ success: false, message: "Failed to load map data" });
    }
};