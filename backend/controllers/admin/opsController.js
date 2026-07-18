/**
 * opsController.js — Operations Dashboard aggregation + actions.
 *
 * Only covers metrics that have NO existing endpoint (order-stage
 * breakdown, failed payments, offline vendor/rider counts, WS connection
 * count) — everything else the Ops Dashboard needs (revenue/orders today,
 * scheduler status, assignment queue, refund queue, active-delivery list,
 * active vendor/rider counts snapshot) is read directly from the existing
 * /admin/dashboard, /admin/scheduler/*, /admin/assignments/active, and
 * /orders/admin/refunds endpoints by the frontend — not duplicated here.
 *
 * "active"/"offline" vendor and rider definitions here mirror
 * dashboardController.js's getMapData currentVendors/currentRiders query
 * exactly, computed fresh alongside the offline count so the two numbers
 * are always mutually consistent from one snapshot (avoids drift between
 * two separately-timed endpoint calls).
 */
import Order from "../../models/Order.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import BroadcastLog from "../../models/BroadcastLog.js";
import { getWsStats, broadcastAll, broadcastToAdmins } from "../../utils/wsHub.js";
import { fanoutBroadcast } from "../../services/broadcastService.js";

// Mirrors jobs/deliveryJobs.js's alertStaleAssignedOrders threshold — a
// UH order assigned but not picked up within this window is "late". Kept
// as the same constant/definition rather than inventing a second SLA.
const STALE_ASSIGNED_MS = 25 * 60 * 1000;

export const getOpsSummary = async (req, res) => {
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const [orderFacets, activeVendors, totalApprovedVendors, activeRiders, totalApprovedRiders, failedPayments] = await Promise.all([
            Order.aggregate([
                {
                    $facet: {
                        liveOrders: [{ $match: { orderStatus: { $nin: ["DELIVERED", "CANCELLED"] } } }, { $count: "n" }],
                        waitingVendorAcceptance: [{ $match: { orderStatus: "PLACED" } }, { $count: "n" }],
                        searchingRider: [{ $match: { orderMode: "URBEXON_HOUR", "delivery.status": "SEARCHING_RIDER" } }, { $count: "n" }],
                        lateOrders: [
                            {
                                $match: {
                                    orderMode: "URBEXON_HOUR",
                                    orderStatus: "READY_FOR_PICKUP",
                                    "delivery.status": "ASSIGNED",
                                    "delivery.assignedAt": { $lt: new Date(now.getTime() - STALE_ASSIGNED_MS) },
                                },
                            },
                            { $count: "n" },
                        ],
                        cancelledToday: [
                            { $match: { orderStatus: "CANCELLED", "statusTimeline.cancelledAt": { $gte: startOfToday } } },
                            { $count: "n" },
                        ],
                    },
                },
            ]),
            Vendor.countDocuments({
                status: "approved", isOpen: true, acceptingOrders: true, isDeleted: false,
                "subscription.isActive": true, "subscription.expiryDate": { $gt: now },
            }),
            Vendor.countDocuments({ status: "approved", isDeleted: false }),
            DeliveryBoy.countDocuments({ status: "approved", isOnline: true }),
            DeliveryBoy.countDocuments({ status: "approved" }),
            Order.find({ "payment.status": "FAILED", createdAt: { $gte: startOfToday } })
                .select("_id invoiceNumber customerName totalAmount createdAt payment.method")
                .sort({ createdAt: -1 })
                .limit(20)
                .lean(),
        ]);

        const pick = (arr) => arr?.[0]?.n || 0;
        const f = orderFacets[0] || {};

        res.json({
            success: true,
            generatedAt: now.toISOString(),
            orders: {
                live: pick(f.liveOrders),
                waitingVendorAcceptance: pick(f.waitingVendorAcceptance),
                searchingRider: pick(f.searchingRider),
                lateOrders: pick(f.lateOrders),
                cancelledToday: pick(f.cancelledToday),
            },
            vendors: { active: activeVendors, offline: Math.max(0, totalApprovedVendors - activeVendors), total: totalApprovedVendors },
            riders: { active: activeRiders, offline: Math.max(0, totalApprovedRiders - activeRiders), total: totalApprovedRiders },
            failedPayments: { count: failedPayments.length, orders: failedPayments },
            websocket: getWsStats(),
        });
    } catch (err) {
        console.error("[getOpsSummary]", err);
        res.status(500).json({ success: false, message: "Failed to load ops summary" });
    }
};

// POST /api/admin/broadcast — Ops Dashboard "Broadcast Notification".
// WS delivery is a thin wrapper over the existing wsHub primitives and
// stays synchronous (it's instant). Email/WhatsApp are opt-in via
// `channels` and run in the background via fanoutBroadcast — NOT
// awaited — so this endpoint still responds immediately even when the
// audience is thousands of rows; see broadcastService.js for why.
export const broadcastNotification = async (req, res) => {
    try {
        const message = String(req.body?.message || "").trim().slice(0, 500);
        const audience = req.body?.audience === "admins" ? "admins" : "all";
        const channels = {
            email: Boolean(req.body?.channels?.email),
            whatsapp: Boolean(req.body?.channels?.whatsapp),
        };
        if (!message) return res.status(400).json({ success: false, message: "message is required" });

        const payload = {
            message,
            from: req.user?.name || "Admin",
            at: new Date().toISOString(),
        };

        if (audience === "admins") {
            await broadcastToAdmins("admin:broadcast", payload);
        } else {
            broadcastAll("admin:broadcast", payload);
        }

        const log = await BroadcastLog.create({
            message,
            audience,
            channels: { ws: true, ...channels },
            wsConnections: getWsStats().connections,
            sentBy: { id: req.user?._id, name: req.user?.name || "Admin" },
            status: channels.email || channels.whatsapp ? "sending" : "completed",
        });

        if (channels.email || channels.whatsapp) {
            fanoutBroadcast({ logId: log._id, message, audience, channels, fromName: payload.from })
                .catch((err) => console.error("[broadcastNotification] fanout failed:", err.message));
        }

        res.json({ success: true, message: "Broadcast sent", audience, channels, logId: log._id });
    } catch (err) {
        console.error("[broadcastNotification]", err);
        res.status(500).json({ success: false, message: "Failed to broadcast" });
    }
};

// GET /api/admin/broadcast/history — audit trail so admin can see past
// broadcasts and whether email/WhatsApp fan-out actually completed,
// instead of the "sent" response being the only trace it ever happened.
export const getBroadcastHistory = async (req, res) => {
    try {
        const logs = await BroadcastLog.find({}).sort({ createdAt: -1 }).limit(20).lean();
        res.json({ success: true, logs });
    } catch (err) {
        console.error("[getBroadcastHistory]", err);
        res.status(500).json({ success: false, message: "Failed to load broadcast history" });
    }
};
