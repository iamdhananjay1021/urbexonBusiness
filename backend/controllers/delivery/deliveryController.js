/**
 * deliveryController.js — Production v3.1
 * ✅ FIXED: Removed delivery.provider: LOCAL_RIDER filter from getDeliveryOrders
 * ✅ FIXED: handleRiderAccept now checks orderMode instead of provider
 * ✅ OTP delivery confirmation (generate + verify)
 * ✅ Atomic order accept via Assignment Engine
 * ✅ GPS tracking (Redis-first, MongoDB fallback)
 * ✅ Earnings update
 * ✅ Delivery boy profile update
 * ✅ FCM token management
 * ✅ Reject / Cancel order
 * ✅ Smart assignment integration
 */
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import Order from "../../models/Order.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { sendEmailBackground } from "../../utils/emailService.js";
import { deliveryAssignedEmail } from "../../utils/emailTemplates.js";
import { DELIVERY_CONFIG } from "../../config/deliveryConfig.js";
import { getRedis, isRedisUp } from "../../config/redis.js";
import { handleRiderAccept, handleRiderReject, handleRiderCancel } from "../../services/assignmentEngine.js";
import { sendOrderStatusPush } from "../../services/fcmService.js";

const genOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const DELIVERY_EARNING_BASE = 25;
const DELIVERY_EARNING_PER_KM = 5;
const DELIVERY_EARNING_MIN = 25;
const DELIVERY_EARNING_MAX = 120;

const calcDeliveryEarning = (distanceKm = 0) => {
    const earning = DELIVERY_EARNING_BASE + (distanceKm * DELIVERY_EARNING_PER_KM);
    return Math.min(Math.max(Math.round(earning), DELIVERY_EARNING_MIN), DELIVERY_EARNING_MAX);
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
    const toRad = d => (d * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── POST /api/delivery/register ──────────────────────────
export const registerDeliveryBoy = async (req, res) => {
    try {
        const userId = req.user._id;
        const existing = await DeliveryBoy.findOne({ userId });
        if (existing) {
            return res.status(409).json({ success: false, message: "You have already registered", status: existing.status });
        }
        const { name, phone, vehicleType, vehicleNumber, vehicleModel, city } = req.body;
        if (!name || !phone || !vehicleType) {
            return res.status(400).json({ success: false, message: "name, phone, and vehicleType are required" });
        }
        const docs = {};
        for (const field of ["aadhaarPhoto", "licensePhoto", "vehicleRc", "selfie"]) {
            if (req.files?.[field]?.[0]) {
                try {
                    const r = await uploadToCloudinary(req.files[field][0].buffer, `delivery/${userId}/${field}`);
                    docs[field] = r.secure_url;
                } catch (e) { console.warn(`[Delivery] Upload ${field} failed:`, e.message); }
            }
        }
        const rider = await DeliveryBoy.create({
            userId, name: name.trim(), phone: phone.trim(),
            vehicleType, vehicleNumber: vehicleNumber?.trim() || "",
            vehicleModel: vehicleModel?.trim() || "",
            city: city?.trim() || "", documents: docs, status: "pending",
        });
        res.status(201).json({ success: true, message: "Registration submitted. Pending approval.", rider });
    } catch (err) {
        console.error("[registerDeliveryBoy]", err);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
};

// ── GET /api/delivery/status ─────────────────────────────
export const getDeliveryStatus = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id }).lean();
        if (!db) return res.json({ registered: false });
        res.json({ registered: true, status: db.status, isOnline: db.isOnline, rider: db });
    } catch (err) { res.status(500).json({ success: false, message: "Failed to fetch status" }); }
};

// ── PATCH /api/delivery/toggle-status ───────────────────
export const toggleOnlineStatus = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });
        if (db.status !== "approved") return res.status(403).json({ success: false, message: "Account not approved yet." });
        const updated = await DeliveryBoy.findByIdAndUpdate(
            db._id,
            { isOnline: !db.isOnline },
            { new: true, runValidators: false }
        );
        res.json({ success: true, isOnline: updated.isOnline });
    } catch (err) {
        console.error("[toggleOnlineStatus]", err.message, err.errors);
        res.status(500).json({ success: false, message: "Failed to toggle status" });
    }
};

// ── GET /api/delivery/orders ─────────────────────────────
// ✅ FIXED: Removed "delivery.provider": "LOCAL_RIDER" filter
// Orders are now fetched by orderMode + status only
export const getDeliveryOrders = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        // ✅ FIXED: No provider filter — any URBEXON_HOUR unassigned READY_FOR_PICKUP order
        const availableRaw = await Order.find({
            orderMode: "URBEXON_HOUR",
            orderStatus: "READY_FOR_PICKUP",
            "delivery.assignedTo": null,
            // ✅ REMOVED: "delivery.provider": "LOCAL_RIDER" — was blocking orders
        })
            .limit(30)
            .lean();

        const riderLat = db.location?.lat;
        const riderLng = db.location?.lng;

        const available = availableRaw.map(o => {
            let distanceFromRider = null;
            if (riderLat && riderLng) {
                const orderLat = o.latitude || DELIVERY_CONFIG.SHOP_LAT;
                const orderLng = o.longitude || DELIVERY_CONFIG.SHOP_LNG;
                distanceFromRider = Math.round(haversineKm(riderLat, riderLng, orderLat, orderLng) * 10) / 10;
            }
            return { ...o, distanceFromRider };
        });

        if (riderLat && riderLng) {
            available.sort((a, b) => (a.distanceFromRider || 999) - (b.distanceFromRider || 999));
        }

        // ✅ FIXED: My active orders — removed LOCAL_RIDER filter
        const myOrders = await Order.find({
            orderMode: "URBEXON_HOUR",
            "delivery.assignedTo": db._id,
            orderStatus: { $in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"] },
        }).sort({ createdAt: -1 }).limit(30).lean();

        const stats = {
            todayDeliveries: db.todayDeliveries || 0,
            weekDeliveries: db.weekDeliveries || 0,
            totalDeliveries: db.totalDeliveries || 0,
            todayEarnings: db.todayEarnings || 0,
            totalEarnings: db.totalEarnings || 0,
            weekEarnings: db.weekEarnings || 0,
            rating: db.rating || 5,
        };

        res.json({
            success: true,
            orders: [...available, ...myOrders],
            stats,
            isOnline: db.isOnline,
            status: db.status,
        });
    } catch (err) {
        console.error("[getDeliveryOrders]", err);
        res.status(500).json({ success: false, message: "Failed to fetch orders" });
    }
};

// ── PATCH /api/delivery/orders/:id/accept ───────────────
export const acceptOrder = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db || db.status !== "approved") return res.status(403).json({ success: false, message: "Account not approved" });

        const result = await handleRiderAccept(req.params.id, db._id, req.user._id);
        if (!result.success) {
            return res.status(409).json({ success: false, message: result.message || "Order is not available for pickup" });
        }

        const order = result.order;

        const otp = genOtp();
        await Order.findByIdAndUpdate(order._id, {
            $set: {
                "deliveryOtp.code": otp,
                "deliveryOtp.expiresAt": new Date(Date.now() + 2 * 60 * 60 * 1000),
                "deliveryOtp.verified": false,
            },
            $push: {
                timeline: { status: "RIDER_ASSIGNED", timestamp: new Date(), note: `Accepted by ${db.name}` },
            },
        });

        if (order.user) {
            sendToUser(String(order.user), "order_status", {
                orderId: order._id, status: "RIDER_ASSIGNED",
                riderName: db.name, riderPhone: db.phone,
                message: `Rider ${db.name} accepted your order. Will pick up soon!`,
            });
        }

        res.json({ success: true, order, message: "Order accepted" });

        if (db.email) {
            const mailData = deliveryAssignedEmail(db.name, order);
            sendEmailBackground({ to: db.email, subject: mailData.subject, html: mailData.html, label: "Delivery/Assigned" });
        }
    } catch (err) {
        console.error("[acceptOrder]", err);
        res.status(500).json({ success: false, message: "Failed to accept order" });
    }
};

// ── PATCH /api/delivery/orders/:id/pickup ───────────────
export const pickupOrder = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (String(order.delivery?.assignedTo) !== String(db._id)) {
            return res.status(403).json({ success: false, message: "This order is not assigned to you" });
        }
        if (order.orderStatus !== "READY_FOR_PICKUP") {
            return res.status(400).json({ success: false, message: `Order must be in READY_FOR_PICKUP status, currently ${order.orderStatus}` });
        }

        order.orderStatus = "OUT_FOR_DELIVERY";
        order.delivery.pickedUpAt = new Date();
        order.delivery.status = "PICKED_UP";
        const existing = order.statusTimeline?.toObject ? order.statusTimeline.toObject() : { ...order.statusTimeline };
        order.statusTimeline = { ...existing, outForDeliveryAt: new Date() };
        order.markModified("statusTimeline");
        order.timeline = order.timeline || [];
        order.timeline.push({ status: "PICKED_UP", timestamp: new Date(), note: `Picked up by ${db.name}` });
        await order.save();

        if (order.user) {
            sendToUser(String(order.user), "order_status", {
                orderId: order._id, status: "OUT_FOR_DELIVERY",
                riderName: db.name, riderPhone: db.phone,
                message: `Your order is now out for delivery with ${db.name}!`,
            });
        }

        res.json({ success: true, message: "Order picked up and out for delivery", order: order.toObject() });
    } catch (err) {
        console.error("[pickupOrder]", err);
        res.status(500).json({ success: false, message: "Failed to mark pickup" });
    }
};

// ── PATCH /api/delivery/orders/:id/deliver ──────────────
export const markDelivered = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not found" });

        const order = await Order.findById(req.params.id).select("+deliveryOtp.code");
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (String(order.delivery?.assignedTo) !== String(db._id)) {
            return res.status(403).json({ success: false, message: "This order is not assigned to you" });
        }
        if (order.orderStatus !== "OUT_FOR_DELIVERY") {
            return res.status(400).json({ success: false, message: "Order is not out for delivery" });
        }

        const { otp } = req.body;
        if (!otp) return res.status(400).json({ success: false, message: "OTP required for delivery confirmation" });
        if (!order.deliveryOtp?.code) return res.status(400).json({ success: false, message: "No OTP generated for this order" });
        if (new Date() > new Date(order.deliveryOtp.expiresAt)) return res.status(400).json({ success: false, message: "OTP expired. Contact admin." });

        order.deliveryOtp.attempts = (order.deliveryOtp.attempts || 0) + 1;
        if (order.deliveryOtp.attempts > 5) {
            await order.save();
            return res.status(429).json({ success: false, message: "Too many wrong attempts. Contact support." });
        }

        if (String(order.deliveryOtp.code) !== String(otp.trim())) {
            await order.save();
            return res.status(400).json({ success: false, message: "Incorrect OTP. Please get OTP from the customer." });
        }

        const updated = await Order.findOneAndUpdate(
            {
                _id: req.params.id,
                "delivery.assignedTo": db._id,
                orderStatus: "OUT_FOR_DELIVERY",
            },
            {
                $set: {
                    orderStatus: "DELIVERED",
                    "delivery.status": "DELIVERED",
                    "deliveryOtp.verified": true,
                    "deliveryOtp.attempts": order.deliveryOtp.attempts,
                    "statusTimeline.deliveredAt": new Date(),
                    ...(order.payment?.method === "COD" && {
                        "payment.status": "PAID",
                        "payment.paidAt": new Date(),
                    }),
                },
                $push: {
                    timeline: {
                        status: "DELIVERED",
                        timestamp: new Date(),
                        note: `OTP verified, delivered by ${db.name}`,
                    },
                },
            },
            { new: true }
        );

        if (!updated) {
            return res.status(400).json({ success: false, message: "Order already delivered or invalid state" });
        }

        const distanceKm = order.delivery?.distanceKm || 0;
        const earning = calcDeliveryEarning(distanceKm);

        await DeliveryBoy.findByIdAndUpdate(db._id, {
            $inc: {
                todayDeliveries: 1,
                totalDeliveries: 1,
                todayEarnings: earning,
                totalEarnings: earning,
                weekDeliveries: 1,
                weekEarnings: earning,
                activeOrders: -1,
            },
            $max: { activeOrders: 0 },
        });

        if (order.user) {
            sendToUser(String(order.user), "order_status", {
                orderId: order._id, status: "DELIVERED",
                message: "Your order has been delivered! Enjoy!",
            });
        }

        res.json({ success: true, message: "Order delivered successfully", earning });
    } catch (err) {
        console.error("[markDelivered]", err);
        res.status(500).json({ success: false, message: "Failed to mark delivered" });
    }
};

// ── PATCH /api/delivery/location ────────────────────────
export const updateRiderLocation = async (req, res) => {
    try {
        const { lat, lng, orderId } = req.body;
        if (!lat || !lng) return res.status(400).json({ success: false, message: "lat and lng required" });

        const numLat = Number(lat);
        const numLng = Number(lng);

        const db = await DeliveryBoy.findOneAndUpdate(
            { userId: req.user._id },
            {
                location: { lat: numLat, lng: numLng, updatedAt: new Date() },
                geoLocation: { type: "Point", coordinates: [numLng, numLat] },
            },
            { new: true }
        );
        if (!db) return res.status(404).json({ success: false, message: "Not found" });

        if (isRedisUp()) {
            const redis = getRedis();
            try {
                const locationData = JSON.stringify({ lat: numLat, lng: numLng, riderName: db.name, updatedAt: new Date().toISOString() });
                await redis.setex(`rider:location:${req.user._id}`, 120, locationData);
                if (orderId) {
                    await redis.setex(`order:rider_location:${orderId}`, 120, locationData);
                }
            } catch { /* non-fatal */ }
        }

        if (orderId) {
            await Order.findByIdAndUpdate(orderId, {
                deliveryLocation: { type: "Point", coordinates: [numLng, numLat] },
            }).catch(() => { });

            const order = await Order.findById(orderId).select("user").lean();
            if (order?.user) {
                sendToUser(String(order.user), "rider_location", {
                    orderId, lat: numLat, lng: numLng, riderName: db.name,
                    riderPhone: db.phone, at: new Date().toISOString(),
                });
            }
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, message: "Failed" }); }
};

// ── GET /api/delivery/earnings ───────────────────────────
export const getDeliveryEarnings = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id }).lean();
        if (!db) return res.status(404).json({ success: false, message: "Not found" });

        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        startOfWeek.setHours(0, 0, 0, 0);

        const deliveries = await Order.find({
            "delivery.assignedTo": db._id,
            orderStatus: "DELIVERED",
        }).sort({ createdAt: -1 }).lean();

        const thisWeek = deliveries.filter(o => new Date(o.createdAt) >= startOfWeek);
        const weekEarnings = thisWeek.reduce((sum, o) => sum + calcDeliveryEarning(o.delivery?.distanceKm || 0), 0);

        const breakdown = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
            const next = new Date(d); next.setDate(next.getDate() + 1);
            const dayOrders = deliveries.filter(o => {
                const t = new Date(o.createdAt);
                return t >= d && t < next;
            });
            breakdown.push({
                day: d.toLocaleDateString("en-IN", { weekday: "short" }),
                date: d.toISOString().split("T")[0],
                deliveries: dayOrders.length,
                earnings: dayOrders.reduce((sum, o) => sum + calcDeliveryEarning(o.delivery?.distanceKm || 0), 0),
            });
        }

        res.json({
            success: true,
            todayDeliveries: db.todayDeliveries || 0,
            todayEarnings: db.todayEarnings || 0,
            weekDeliveries: thisWeek.length,
            weekEarnings,
            totalDeliveries: db.totalDeliveries || 0,
            totalEarnings: db.totalEarnings || 0,
            rating: db.rating || 5,
            weeklyBreakdown: breakdown,
        });
    } catch (err) { res.status(500).json({ success: false, message: "Failed" }); }
};

// ── PATCH /api/delivery/profile ──────────────────────────
export const updateDeliveryProfile = async (req, res) => {
    try {
        const { city, vehicleNumber, vehicleModel } = req.body;
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not found" });
        if (city) db.city = city.trim();
        if (vehicleNumber) db.vehicleNumber = vehicleNumber.trim();
        if (vehicleModel) db.vehicleModel = vehicleModel.trim();
        await db.save();
        res.json({ success: true, rider: db });
    } catch (err) { res.status(500).json({ success: false, message: "Failed" }); }
};

// ── PATCH /api/delivery/documents ───────────────────────
export const updateDeliveryDocuments = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not found" });

        const docFields = ["aadhaarPhoto", "licensePhoto", "vehicleRc", "selfie"];
        let updated = false;

        for (const field of docFields) {
            if (req.files?.[field]?.[0]) {
                try {
                    const r = await uploadToCloudinary(req.files[field][0].buffer, `delivery/${req.user._id}/${field}`);
                    db.documents[field] = r.secure_url;
                    db.documentStatus[field] = "pending";
                    db.documentNotes[field] = "";
                    updated = true;
                } catch (e) { console.warn(`[Delivery] Upload ${field} failed:`, e.message); }
            }
        }

        if (!updated) return res.status(400).json({ success: false, message: "No documents provided" });

        const updatedRider = await DeliveryBoy.findOneAndUpdate(
            { userId: req.user._id },
            { $set: { documents: db.documents.toObject(), documentStatus: db.documentStatus.toObject(), documentNotes: db.documentNotes.toObject() } },
            { new: true, runValidators: false }
        );
        res.json({ success: true, rider: updatedRider, message: "Documents updated" });
    } catch (err) {
        console.error("[updateDeliveryDocuments]", err);
        res.status(500).json({ success: false, message: "Failed to update documents" });
    }
};

// ── GET /api/delivery/orders/:id/rider-location ─────────
export const getRiderLocationForOrder = async (req, res) => {
    try {
        const Order = (await import("../../models/Order.js")).default;
        const order = await Order.findById(req.params.id).select("delivery user").lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const isOwner = String(order.user) === String(req.user._id);
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin) return res.status(403).json({ success: false, message: "Not authorized" });

        if (!order.delivery?.assignedTo)
            return res.json({ success: true, available: false, message: "No rider assigned yet" });

        if (isRedisUp()) {
            const redis = getRedis();
            try {
                const cached = await redis.get(`order:rider_location:${req.params.id}`);
                if (cached) {
                    const loc = JSON.parse(cached);
                    const rider = await DeliveryBoy.findById(order.delivery.assignedTo).select("name phone isOnline").lean();
                    return res.json({
                        success: true, available: true, source: "redis",
                        rider: {
                            name: rider?.name || loc.riderName || "",
                            phone: rider?.phone || "",
                            isOnline: rider?.isOnline ?? true,
                            lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt,
                        },
                    });
                }
            } catch { /* fall through */ }
        }

        const rider = await DeliveryBoy.findById(order.delivery.assignedTo)
            .select("name phone location isOnline").lean();
        if (!rider) return res.json({ success: true, available: false });

        res.json({
            success: true,
            available: !!(rider.location?.lat && rider.location?.lng),
            source: "mongodb",
            rider: {
                name: rider.name, phone: rider.phone, isOnline: rider.isOnline,
                lat: rider.location?.lat || null, lng: rider.location?.lng || null,
                updatedAt: rider.location?.updatedAt || null,
            },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch rider location" });
    }
};

// ── PATCH /api/delivery/orders/:id/reject ──────────────
export const rejectOrder = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });
        await handleRiderReject(req.params.id, db._id);
        res.json({ success: true, message: "Order rejected" });
    } catch (err) {
        console.error("[rejectOrder]", err);
        res.status(500).json({ success: false, message: "Failed to reject order" });
    }
};

// ── PATCH /api/delivery/orders/:id/cancel ──────────────
export const cancelOrder = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (String(order.delivery?.assignedTo) !== String(db._id)) {
            return res.status(403).json({ success: false, message: "This order is not assigned to you" });
        }
        if (order.orderStatus === "DELIVERED") {
            return res.status(400).json({ success: false, message: "Cannot cancel a delivered order" });
        }

        const reason = req.body.reason || "";
        await handleRiderCancel(req.params.id, db._id, reason);
        res.json({ success: true, message: "Order cancelled. Reassignment in progress." });
    } catch (err) {
        console.error("[cancelOrder]", err);
        res.status(500).json({ success: false, message: "Failed to cancel delivery" });
    }
};

// ── PATCH /api/delivery/fcm-token ──────────────────────
export const saveFcmToken = async (req, res) => {
    try {
        const { token } = req.body;
        if (!token || typeof token !== "string") {
            return res.status(400).json({ success: false, message: "FCM token required" });
        }
        const db = await DeliveryBoy.findOneAndUpdate(
            { userId: req.user._id },
            { fcmToken: token.trim() },
            { new: true }
        );
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });
        res.json({ success: true, message: "FCM token saved" });
    } catch (err) {
        console.error("[saveFcmToken]", err);
        res.status(500).json({ success: false, message: "Failed to save FCM token" });
    }
};

// ── PATCH /api/delivery/orders/:id/status ──────────────
export const updateDeliveryStatus = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        const order = await Order.findById(req.params.id);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (String(order.delivery?.assignedTo) !== String(db._id)) {
            return res.status(403).json({ success: false, message: "This order is not assigned to you" });
        }

        const { status } = req.body;
        const allowed = ["ARRIVING_VENDOR"];
        if (!allowed.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Use: ${allowed.join(", ")}. For PICKED_UP/OUT_FOR_DELIVERY, call PATCH /api/delivery/orders/:id/pickup`,
            });
        }

        order.delivery.status = status;
        order.timeline = order.timeline || [];
        order.timeline.push({ status, timestamp: new Date(), note: `${status} by ${db.name}` });
        await order.save();

        if (order.user) {
            const messages = {
                ARRIVING_VENDOR: "Rider is heading to the store to pick up your order.",
            };
            sendToUser(String(order.user), "order_status", {
                orderId: order._id, status,
                riderName: db.name, riderPhone: db.phone,
                message: messages[status] || `Delivery status: ${status}`,
                deliveryStatus: status,
            });
        }

        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        console.error("[updateDeliveryStatus]", err);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};