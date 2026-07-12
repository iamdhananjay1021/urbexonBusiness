/**
 * deliveryController.js — Production v3.2
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
 * ✅ NEW (v3.2): getDeliveryStatus now returns a stable `applicationStatus`
 *    field so the frontend AuthContext can route riders (apply form /
 *    pending screen / dashboard) without guessing from `registered` + `status`.
 */
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";
import Order from "../../models/Order.js";
import Vendor from "../../models/vendorModels/Vendor.js";
import { uploadToCloudinary } from "../../config/cloudinary.js";
import { sendNotification as sendToUser } from "../../utils/notificationQueue.js";
import { sendEmailBackground } from "../../utils/emailService.js";
import { deliveryAssignedEmail } from "../../utils/emailTemplates.js";
import { DELIVERY_CONFIG } from "../../config/deliveryConfig.js";
import { getRedis, isRedisUp } from "../../config/redis.js";
import { handleRiderAccept, handleRiderReject, handleRiderCancel, MAX_ACTIVE_ORDERS } from "../../services/assignmentEngine.js";
import { sendOrderStatusPush } from "../../services/fcmService.js";
import { haversineKm, isPlausibleIndiaLatLng, isPlausibleMovement } from "../../services/geoEngine.js";
import { applyOrderTransition, buildTimelineEntry, notifyOrderStakeholders } from "../../services/orderEngine.js";
import { settleAllVendorsForOrder } from "../../services/settlementEngine.js";
import { sendWhatsAppMessage, isWhatsAppConfigured } from "../../services/whatsappService.js";

const genOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const DELIVERY_EARNING_BASE = 25;
const DELIVERY_EARNING_PER_KM = 5;
const DELIVERY_EARNING_MIN = 25;
const DELIVERY_EARNING_MAX = 120;

const calcDeliveryEarning = (distanceKm = 0) => {
    const earning = DELIVERY_EARNING_BASE + (distanceKm * DELIVERY_EARNING_PER_KM);
    return Math.min(Math.max(Math.round(earning), DELIVERY_EARNING_MIN), DELIVERY_EARNING_MAX);
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
        res.status(201).json({
            success: true,
            message: "Registration submitted. Pending approval.",
            rider,
            applicationStatus: rider.status, // ✅ NEW — lets frontend update state immediately without a refetch
        });
    } catch (err) {
        console.error("[registerDeliveryBoy]", err);
        res.status(500).json({ success: false, message: "Registration failed" });
    }
};

// ── GET /api/delivery/status ─────────────────────────────
// ✅ FIX: Added `applicationStatus` as an explicit, stable field
// ('not_applied' | 'pending' | 'approved' | 'rejected' | 'suspended').
// AuthContext on the frontend relies on this exact field name to decide
// routing (apply form / pending screen / dashboard) without having to
// guess from `registered` + `status`, and without merging the DeliveryBoy
// document (which has its own _id, distinct from the User _id) into the
// rider's identity object.
export const getDeliveryStatus = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id }).lean();
        if (!db) {
            return res.json({
                registered: false,
                applicationStatus: "not_applied",
            });
        }
        res.json({
            registered: true,
            status: db.status,
            applicationStatus: db.status, // alias, stable contract for the frontend
            isOnline: db.isOnline,
            rider: db,
        });
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
// ✅ FIXED: Filter by rider's servicePincodes if set (pincode-based delivery area)
export const getDeliveryOrders = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        // Build pincode filter — if rider has assigned pincodes, only show those orders
        const pincodeFilter = {};
        if (db.servicePincodes && db.servicePincodes.length > 0) {
            pincodeFilter["deliveryAddress.pincode"] = { $in: db.servicePincodes };
        }

        // BUG FIX: an offline rider, or one already at MAX_ACTIVE_ORDERS,
        // could still see (and, via the accept endpoint, claim) new orders —
        // neither condition was checked here, only cosmetically in sorting.
        const canTakeNewOrders = db.isOnline && (db.activeOrders || 0) < MAX_ACTIVE_ORDERS;

        const riderLat = db.location?.lat;
        const riderLng = db.location?.lng;
        const maxKm = DELIVERY_CONFIG.URBEXON_HOUR?.MAX_RADIUS_KM || 10;

        let available = [];
        if (canTakeNewOrders) {
            const availableRaw = await Order.find({
                orderMode: "URBEXON_HOUR",
                orderStatus: "READY_FOR_PICKUP",
                "delivery.assignedTo": null,
                ...pincodeFilter,
            })
                .limit(30)
                .lean();

            available = availableRaw.map(o => {
                let distanceFromRider = null;
                if (riderLat && riderLng) {
                    const orderLat = o.latitude || DELIVERY_CONFIG.SHOP_LAT;
                    const orderLng = o.longitude || DELIVERY_CONFIG.SHOP_LNG;
                    distanceFromRider = Math.round(haversineKm(riderLat, riderLng, orderLat, orderLng) * 10) / 10;
                }
                return { ...o, distanceFromRider };
            });

            // Once we actually know where the rider is, don't show (or let
            // them attempt to accept) orders outside the real delivery
            // radius — this used to be sort-only, not a filter, so a rider
            // could see and accept an order hundreds of km away.
            if (riderLat && riderLng) {
                available = available.filter(o => o.distanceFromRider == null || o.distanceFromRider <= maxKm);
                available.sort((a, b) => (a.distanceFromRider || 999) - (b.distanceFromRider || 999));
            }
        }

        // ✅ FIXED: My active orders — removed LOCAL_RIDER filter
        const myOrdersRaw = await Order.find({
            orderMode: "URBEXON_HOUR",
            "delivery.assignedTo": db._id,
            orderStatus: { $in: ["READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"] },
        }).sort({ createdAt: -1 }).limit(30).lean();

        // BUG FIX: the rider had no way to see the vendor's location at all
        // (order documents don't carry it) — the delivery-panel map could
        // only ever show the customer's address, never the pickup point, so
        // "Heading to Store" had nothing to navigate by. Attach each order's
        // vendor coordinates/name here so the frontend can render both.
        const vendorIds = [...new Set(myOrdersRaw.map((o) => o.vendorId?.toString()).filter(Boolean))];
        const vendorsById = {};
        if (vendorIds.length > 0) {
            const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("shopName location address").lean();
            vendors.forEach((v) => { vendorsById[v._id.toString()] = v; });
        }
        const myOrders = myOrdersRaw.map((o) => {
            const vendor = o.vendorId ? vendorsById[o.vendorId.toString()] : null;
            const coords = vendor?.location?.coordinates;
            return {
                ...o,
                vendorName: vendor?.shopName || "",
                vendorLat: coords?.length === 2 ? coords[1] : null,
                vendorLng: coords?.length === 2 ? coords[0] : null,
            };
        });

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

        // BUG FIX: this used to send its own ad-hoc customer notification
        // here — now redundant (and a duplicate-notification bug) since
        // handleRiderAccept() already notifies customer + vendor + rider
        // once, centrally, via notifyOrderStakeholders().

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
// Flow: Rider reaches vendor, picks up order → OUT_FOR_DELIVERY
// OTP is sent to customer so they can verify delivery at doorstep
export const pickupOrder = async (req, res) => {
    try {
        const db = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!db) return res.status(404).json({ success: false, message: "Not registered" });

        // Select OTP field so we can send it to customer
        const order = await Order.findById(req.params.id).select("+deliveryOtp.code");
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (String(order.delivery?.assignedTo) !== String(db._id)) {
            return res.status(403).json({ success: false, message: "This order is not assigned to you" });
        }
        if (order.orderStatus !== "READY_FOR_PICKUP") {
            return res.status(400).json({ success: false, message: `Order must be in READY_FOR_PICKUP status, currently ${order.orderStatus}` });
        }

        // ✅ BUG4 FIX: delivery.status must match orderStatus (OUT_FOR_DELIVERY, not PICKED_UP)
        // "PICKED_UP" is an internal event — admin dashboard checks delivery.status for display
        //
        // Atomic + auditable: conditions the write on orderStatus still
        // being READY_FOR_PICKUP at write time — a double-tap pickup
        // button (or a retried request after a slow response) previously
        // raced a plain findById→save(), letting duplicate timeline
        // entries and pickedUpAt overwrites through.
        const updated = await applyOrderTransition({
            orderId: order._id,
            fromStatuses: ["READY_FOR_PICKUP"],
            toStatus: "OUT_FOR_DELIVERY",
            setFields: {
                "delivery.pickedUpAt": new Date(),
                "delivery.status": "OUT_FOR_DELIVERY", // ✅ FIXED: was "PICKED_UP" — caused wrong status in admin
                "statusTimeline.outForDeliveryAt": new Date(),
            },
            timelineEntry: buildTimelineEntry({
                status: "PICKED_UP",
                actorId: req.user._id,
                role: "delivery",
                source: "delivery_panel",
                note: `Picked up by ${db.name}`,
            }),
        });
        if (!updated) {
            return res.status(409).json({ success: false, message: "Order status changed concurrently — please refresh and try again" });
        }
        order.orderStatus = updated.orderStatus;
        order.delivery = updated.delivery;
        order.statusTimeline = updated.statusTimeline;
        order.deliveryOtp = updated.deliveryOtp;

        // ✅ BUG1 FIX: Send OTP to customer in pickup notification
        // Customer needs OTP to verify delivery at doorstep
        const otpForCustomer = order.deliveryOtp?.code || null;

        if (order.user) {
            sendToUser(String(order.user), "order_status", {
                orderId: order._id,
                status: "OUT_FOR_DELIVERY",
                riderName: db.name,
                riderPhone: db.phone,
                message: `Your order is now out for delivery with ${db.name}!`,
                // ✅ FIXED: OTP now included so customer can see it without refreshing
                otp: otpForCustomer,
            });
        }

        // Vendor + admin need to see "picked up / out for delivery" too —
        // skipCustomer:true since the customer already got the richer
        // message above (with their delivery OTP, which must never reach
        // vendor/admin).
        notifyOrderStakeholders(order, "picked_up", {
            status: "OUT_FOR_DELIVERY",
            deliveryStatus: "OUT_FOR_DELIVERY",
            riderName: db.name,
        }, { skipCustomer: true }).catch((err) => console.warn("[pickupOrder] stakeholder notify failed:", err.message));

        if (isWhatsAppConfigured() && order.phone) {
            sendWhatsAppMessage({ to: order.phone, message: `Your order is out for delivery with ${db.name}!` })
                .catch((err) => console.warn("[pickupOrder] WhatsApp failed:", err.message));
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
                    timeline: buildTimelineEntry({
                        status: "DELIVERED",
                        actorId: req.user._id,
                        role: "delivery",
                        source: "delivery_panel",
                        note: `OTP verified, delivered by ${db.name}`,
                    }),
                },
            },
            { new: true }
        );

        if (!updated) {
            return res.status(400).json({ success: false, message: "Order already delivered or invalid state" });
        }

        // GAP FIX: this is the ONLY one of three delivery-completion paths
        // (admin force-update, vendor self-delivery, rider markDelivered)
        // that never created a vendor Settlement — a LOCAL_RIDER-delivered
        // Urbexon Hour order was silently never paid out to its vendor.
        settleAllVendorsForOrder(updated).catch((err) =>
            console.error("[Settlement] Auto-create failed:", updated._id, err.message)
        );

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
        });
        // ✅ BUG7 FIX: $inc and $max cannot be applied to same field atomically in one update.
        // Separate floor update prevents activeOrders from going negative.
        await DeliveryBoy.updateOne(
            { _id: db._id, activeOrders: { $lt: 0 } },
            { $set: { activeOrders: 0 } }
        );

        // Customer + vendor + admin all need to know the order is done —
        // no sensitive OTP in this payload, so one consolidated call
        // covers everyone (was customer-only sendToUser before).
        notifyOrderStakeholders(updated, "delivered", {
            status: "DELIVERED",
            deliveryStatus: "DELIVERED",
            message: "Your order has been delivered! Enjoy!",
        }).catch((err) => console.warn("[markDelivered] stakeholder notify failed:", err.message));

        if (isWhatsAppConfigured() && updated.phone) {
            sendWhatsAppMessage({ to: updated.phone, message: "Your order has been delivered. Enjoy!" })
                .catch((err) => console.warn("[markDelivered] WhatsApp failed:", err.message));
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
        const { lat, lng, orderId, timestamp } = req.body;
        if (!lat || !lng) return res.status(400).json({ success: false, message: "lat and lng required" });

        const numLat = Number(lat);
        const numLng = Number(lng);
        const gpsTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : null;

        // Security: never trust frontend coordinates blindly — reject
        // out-of-range/impossible values outright (spoofed or garbage fixes).
        if (!isPlausibleIndiaLatLng(numLat, numLng)) {
            return res.status(400).json({ success: false, message: "Invalid coordinates" });
        }

        // BUG FIX: the delivery-panel runs a real-time `watchPosition` AND a
        // 15s-interval `getCurrentPosition` fallback simultaneously, each
        // independently PATCHing this endpoint — since this used to write
        // unconditionally, whichever HTTP request happened to arrive LAST
        // won, even if its underlying GPS fix was actually OLDER (the
        // fallback's own `maximumAge` lets it reuse a reading up to 10s
        // stale). That's what made the rider marker visibly jump backward
        // on the customer's map every ~15s. Only accept this update if its
        // own GPS timestamp is at least as new as whatever's already
        // stored — a client not sending `timestamp` at all keeps the old
        // always-accept behavior (backward compatible).
        //
        // Fetched unconditionally (not just when gpsTimestamp is present)
        // because the live-tracking speed/heading calc below also needs
        // this previous fix, regardless of whether staleness/anti-spoof
        // checks apply to this particular request.
        const existing = await DeliveryBoy.findOne({ userId: req.user._id })
            .select("location.gpsTimestamp location.lat location.lng")
            .lean();

        if (gpsTimestamp !== null) {
            if (existing?.location?.gpsTimestamp && gpsTimestamp < existing.location.gpsTimestamp) {
                return res.json({ success: true, ignored: true, reason: "stale_fix" });
            }
            // Security: reject a fix that implies teleporting faster than any
            // real vehicle could travel — a spoofed/garbage GPS jump that
            // still happens to be inside India's bounding box.
            if (!isPlausibleMovement(existing?.location?.lat, existing?.location?.lng, existing?.location?.gpsTimestamp, numLat, numLng, gpsTimestamp)) {
                return res.json({ success: true, ignored: true, reason: "implausible_jump" });
            }
        }

        const db = await DeliveryBoy.findOneAndUpdate(
            { userId: req.user._id },
            {
                location: { lat: numLat, lng: numLng, updatedAt: new Date(), gpsTimestamp },
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
                // BUG FIX: this push used to carry ONLY raw lat/lng — no
                // leg/distanceKm/etaText/speed/heading — even though this
                // REST-PATCH path (not a WS message) is the ONLY way any
                // frontend actually reports rider GPS (confirmed: the
                // delivery-panel never sends a `rider:location:update` WS
                // message). That meant the map's distance/ETA/leg overlay
                // only ever updated via the 15s polling fallback, never via
                // the "live" WS push — exactly backwards from the
                // WS-primary/polling-fallback design intent. Computing the
                // same full tracking payload here as the poll endpoint
                // closes that gap; speedKmph/headingDeg are new fields
                // (derived from this fix vs. the previous one).
                const { computeLiveTrackingInfo } = await import("../../services/liveTrackingEngine.js");
                const tracking = await computeLiveTrackingInfo(
                    orderId, numLat, numLng,
                    existing?.location || null,
                    gpsTimestamp
                ).catch(() => null);

                sendToUser(String(order.user), "rider_location", {
                    orderId, lat: numLat, lng: numLng, riderName: db.name,
                    riderPhone: db.phone, at: new Date().toISOString(),
                    ...(tracking || {}),
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

        // ✅ IST timezone offset: UTC+5:30 = 330 minutes
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

        const getISTDayBounds = (daysAgo = 0) => {
            const nowUTC = Date.now();
            const nowIST = new Date(nowUTC + IST_OFFSET_MS);
            nowIST.setUTCHours(0, 0, 0, 0); // midnight IST
            const startIST = new Date(nowIST.getTime() - daysAgo * 86400000);
            const endIST = new Date(startIST.getTime() + 86400000);
            // Convert back to UTC for DB queries
            return {
                start: new Date(startIST.getTime() - IST_OFFSET_MS),
                end: new Date(endIST.getTime() - IST_OFFSET_MS),
            };
        };

        const startOfWeek = getISTDayBounds(new Date(Date.now() + IST_OFFSET_MS).getUTCDay()).start;

        const deliveries = await Order.find({
            "delivery.assignedTo": db._id,
            orderStatus: "DELIVERED",
        }).sort({ createdAt: -1 }).lean();

        const thisWeek = deliveries.filter(o => new Date(o.createdAt) >= startOfWeek);
        const weekEarnings = thisWeek.reduce((sum, o) => sum + calcDeliveryEarning(o.delivery?.distanceKm || 0), 0);

        // ✅ TIMEZONE FIX: Use IST day bounds for daily breakdown
        const breakdown = [];
        for (let i = 6; i >= 0; i--) {
            const { start, end } = getISTDayBounds(i);
            const dayOrders = deliveries.filter(o => {
                const t = new Date(o.createdAt);
                return t >= start && t < end;
            });
            breakdown.push({
                day: start.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
                date: new Date(start.getTime() + IST_OFFSET_MS).toISOString().split("T")[0],
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

// BUG FIX: neither response branch below ever checked how OLD the location
// fix actually was — once Redis's 2-min cache entry expires, the MongoDB
// fallback happily returns whatever GPS point was last written, even if
// that was hours ago (rider's phone died, app was killed, etc.), with
// `available: true` and no signal that tracking has actually stopped. Every
// consumer (LiveTrackingMap, AdminTrackingMap, the admin orders "LIVE"
// badge) trusted that blindly. `stale: true` lets them show "last seen
// Xm ago" instead of a misleading live marker.
const RIDER_LOCATION_STALE_MS = 3 * 60 * 1000; // a little past Redis's own 2-min TTL
const isLocationStale = (updatedAt) => {
    if (!updatedAt) return true;
    return Date.now() - new Date(updatedAt).getTime() > RIDER_LOCATION_STALE_MS;
};

// ── GET /api/delivery/orders/:id/rider-location ─────────
export const getRiderLocationForOrder = async (req, res) => {
    try {
        const Order = (await import("../../models/Order.js")).default;
        const order = await Order.findById(req.params.id).select("delivery user vendorId").lean();
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const isOwner = String(order.user) === String(req.user._id);
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        // SECURITY GAP FIX: the vendor fulfilling this order had no read
        // access to its own rider's location at all — only the customer
        // and admin were ever checked, even though vendor-panel's new live
        // map needs exactly this endpoint as its polling fallback.
        let isVendor = false;
        if (!isOwner && !isAdmin && order.vendorId && req.user.role === "vendor") {
            const Vendor = (await import("../../models/vendorModels/Vendor.js")).default;
            const vendor = await Vendor.findById(order.vendorId).select("userId").lean();
            isVendor = !!vendor && String(vendor.userId) === String(req.user._id);
        }
        if (!isOwner && !isAdmin && !isVendor) return res.status(403).json({ success: false, message: "Not authorized" });

        if (!order.delivery?.assignedTo)
            return res.json({ success: true, available: false, message: "No rider assigned yet" });

        const { computeLiveTrackingInfo } = await import("../../services/liveTrackingEngine.js");
        const withLiveInfo = async (lat, lng) => {
            try { return await computeLiveTrackingInfo(req.params.id, lat, lng); } catch { return null; }
        };

        if (isRedisUp()) {
            const redis = getRedis();
            try {
                const cached = await redis.get(`order:rider_location:${req.params.id}`);
                if (cached) {
                    const loc = JSON.parse(cached);
                    const rider = await DeliveryBoy.findById(order.delivery.assignedTo).select("name phone isOnline").lean();
                    const liveInfo = await withLiveInfo(loc.lat, loc.lng);
                    return res.json({
                        success: true, available: true, stale: isLocationStale(loc.updatedAt), source: "redis",
                        rider: {
                            name: rider?.name || loc.riderName || "",
                            phone: rider?.phone || "",
                            isOnline: rider?.isOnline ?? true,
                            lat: loc.lat, lng: loc.lng, updatedAt: loc.updatedAt,
                        },
                        ...(liveInfo || {}),
                    });
                }
            } catch { /* fall through */ }
        }

        const rider = await DeliveryBoy.findById(order.delivery.assignedTo)
            .select("name phone location isOnline").lean();
        if (!rider) return res.json({ success: true, available: false });

        const hasCoords = !!(rider.location?.lat && rider.location?.lng);
        const liveInfo = hasCoords ? await withLiveInfo(rider.location.lat, rider.location.lng) : null;
        res.json({
            success: true,
            available: hasCoords,
            stale: hasCoords ? isLocationStale(rider.location?.updatedAt) : true,
            source: "mongodb",
            rider: {
                name: rider.name, phone: rider.phone, isOnline: rider.isOnline,
                lat: rider.location?.lat || null, lng: rider.location?.lng || null,
                updatedAt: rider.location?.updatedAt || null,
            },
            ...(liveInfo || {}),
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
                message: `Invalid status. Use: ${allowed.join(", ")}. For pickup/delivery, call the respective endpoints.`,
            });
        }

        // ✅ Guard: Don't allow status update on terminal orders
        if (["DELIVERED", "CANCELLED"].includes(order.orderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Order is already ${order.orderStatus} — cannot update delivery status`,
            });
        }

        order.delivery.status = status;
        order.timeline = order.timeline || [];
        order.timeline.push({ status, timestamp: new Date(), note: `${status} by ${db.name}` });
        await order.save();

        // Vendor wants to know their rider is en route to pick up too
        // ("Vendor sees rider + pickup status" per the live-tracking spec) —
        // was customer-only before.
        const messages = {
            ARRIVING_VENDOR: "Rider is heading to the store to pick up your order.",
        };
        notifyOrderStakeholders(order, "delivery_status_update", {
            status: order.orderStatus,
            deliveryStatus: status,
            riderName: db.name,
            message: messages[status] || `Delivery status: ${status}`,
        }).catch((err) => console.warn("[updateDeliveryStatus] stakeholder notify failed:", err.message));

        res.json({ success: true, message: `Status updated to ${status}` });
    } catch (err) {
        console.error("[updateDeliveryStatus]", err);
        res.status(500).json({ success: false, message: "Failed to update status" });
    }
};