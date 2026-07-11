import { flushQueueForUser } from "./notificationQueue.js";
/**
 * wsHub.js — WebSocket real-time hub
 * Used for: order updates, vendor notifications, delivery tracking, rider assignment
 * ✅ Production domains configured
 * ✅ Origin validation for WebSocket
 * ✅ [FIX v3] Admin room + VENDOR_WS_EVENTS + broadcastToAdmins
 */

import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import url from "url";
import { getRedis, isRedisUp } from "../config/redis.js";

const clients = new Map();  // userId -> Set<ws>
const rooms = new Map();    // roomName -> Set<userId>

// ── Allowed WebSocket Origins (Production + Dev) ──────────────────
const buildAllowedWsOrigins = () => {
    const allowedOrigins = [
        'https://urbexon.in',
        'https://admin.urbexon.in',
        'https://vendor.urbexon.in',
        'https://delivery.partner.urbexon.in',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
    ];
    const fromEnv = [
        process.env.VITE_API_URL,
        process.env.ADMIN_VITE_API_URL,
        process.env.VENDOR_VITE_API_URL,
        process.env.DELIVERY_VITE_API_URL,
        process.env.CLIENT_URL,
    ].filter(Boolean);
    return [...new Set([...allowedOrigins, ...fromEnv])];
};

/**
 * [FIX v3] Standard vendor-related WebSocket event names.
 * Keeping these centralized here (instead of hardcoded strings scattered
 * across controllers) avoids typo-mismatches between emitter and listener.
 */
export const VENDOR_WS_EVENTS = {
    STATUS_CHANGED: "vendor:status_changed", // approved / rejected / suspended
    UPDATED: "vendor:updated",               // commission, subscription, general update
    DELETED: "vendor:deleted",
};

export const initWebSocket = (server) => {
    const allowedOrigins = buildAllowedWsOrigins();

    const wss = new WebSocketServer({
        server,
        path: "/ws",
        verifyClient: (info, callback) => {
            const origin = info.req.headers.origin;
            const isAllowed = !origin || allowedOrigins.includes(origin);

            if (!isAllowed) {
                console.warn(`[WS] ⚠️  Blocked WebSocket from origin: ${origin}`);
                return callback(false, 403, "Origin not allowed");
            }

            callback(true);
        }
    });

    wss.on("connection", (ws, req) => {
        let userId = null;
        let userRole = null;
        const clientOrigin = req.headers.origin || "unknown";

        try {
            const { query } = url.parse(req.url, true);
            const token = query.token;
            if (!token) { ws.close(1008, "No token"); return; }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = String(decoded.id);
            userRole = decoded.role || null;
        } catch {
            ws.close(1008, "Invalid token");
            return;
        }

        // Register client
        if (!clients.has(userId)) clients.set(userId, new Set());
        clients.get(userId).add(ws);

        // BUG FIX: nothing was ever cleaning up a connection that goes dark
        // without a clean TCP close (phone backgrounded/killed, network
        // dropped) — `ws.close` never fires for those, so the socket stays
        // "OPEN" in `clients` indefinitely (a slow memory leak, and every
        // sendToUser/broadcastToRoom call against it silently no-ops instead
        // of ever being detected as dead). This is a real protocol-level
        // ping/pong (heartbeat sweep below), separate from the existing
        // app-level {type:"ping"} JSON echo, which only proves the app is
        // running — not that the transport itself is still alive.
        ws.isAlive = true;
        ws.on("pong", () => { ws.isAlive = true; });

        // [FIX v3] Auto-join the "admins" room for admin-role tokens so
        // broadcastToAdmins() works out of the box without relying on the
        // frontend remembering to send a join_room message.
        if (userRole === "admin") {
            joinRoom("admins", userId);
        }

        console.log(`✅ [WS] Connected: ${userId} (${userRole || "unknown role"}) from ${clientOrigin} (total: ${wss.clients.size})`);

        // Send welcome ping
        ws.send(JSON.stringify({ type: "connected", message: "Real-time connected", origin: clientOrigin }));

        // Flush any queued notifications for this user
        try { flushQueueForUser(userId); } catch { /* non-fatal */ }

        ws.on("message", (data) => {
            try {
                const msg = JSON.parse(data.toString());
                // Handle ping
                if (msg.type === "ping") ws.send(JSON.stringify({ type: "pong" }));

                // Handle room join (for live tracking, admin monitoring)
                if (msg.type === "join_room" && msg.room) {
                    // "order:<id>" rooms carry a rider's live GPS — only the
                    // order's own customer, its assigned rider, or an admin
                    // may subscribe. Any other room name keeps the previous
                    // open-join behavior (no PII involved there).
                    if (msg.room.startsWith("order:")) {
                        authorizeOrderRoomJoin(msg.room.slice(6), userId, userRole).then((allowed) => {
                            if (!allowed) {
                                ws.send(JSON.stringify({ type: "room_join_denied", room: msg.room }));
                                return;
                            }
                            joinRoom(msg.room, userId);
                            ws.send(JSON.stringify({ type: "room_joined", room: msg.room }));
                        });
                    } else {
                        joinRoom(msg.room, userId);
                        ws.send(JSON.stringify({ type: "room_joined", room: msg.room }));
                    }
                }

                // Handle room leave
                if (msg.type === "leave_room" && msg.room) {
                    leaveRoom(msg.room, userId);
                }

                // Handle rider location update via WebSocket (faster than HTTP)
                if (msg.type === "rider:location:update" && msg.payload) {
                    const { lat, lng, orderId } = msg.payload;
                    if (lat && lng) {
                        handleRiderLocationWs(userId, lat, lng, orderId);
                    }
                }
            } catch { /* ignore invalid messages */ }
        });

        ws.on("close", () => {
            const set = clients.get(userId);
            if (set) {
                set.delete(ws);
                if (set.size === 0) {
                    clients.delete(userId);
                    // Remove from all rooms
                    for (const [roomName, members] of rooms) {
                        members.delete(userId);
                        if (members.size === 0) rooms.delete(roomName);
                    }
                }
            }
            console.log(`[WS] Disconnected: ${userId}`);
        });

        ws.on("error", (err) => {
            console.error("[WS] Error:", err.message);
        });
    });

    // Heartbeat sweep — every 30s, ping every connection; any socket that
    // didn't respond with a pong since the previous sweep (i.e. `isAlive`
    // is still false from last time) is dead and gets forcibly terminated,
    // which fires the normal "close" handler above and cleans up
    // `clients`/`rooms` the same way a graceful disconnect would.
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) {
                ws.terminate();
                return;
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on("close", () => clearInterval(heartbeatInterval));

    return wss;
};

/**
 * Send event to a specific user
 */
export const sendToUser = (userId, type, payload = {}) => {
    const key = String(userId);
    const set = clients.get(key);
    if (!set || set.size === 0) return false;

    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    let sent = 0;
    for (const ws of set) {
        if (ws.readyState === 1) { // OPEN
            try { ws.send(message); sent++; } catch { /* ignore */ }
        }
    }
    return sent > 0;
};

/**
 * Broadcast to multiple users
 */
export const broadcastToUsers = (userIds, type, payload = {}) => {
    userIds.forEach(id => sendToUser(id, type, payload));
};

/**
 * Broadcast to ALL connected clients (admin announcements, etc.)
 */
export const broadcastAll = (type, payload = {}) => {
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    clients.forEach((set) => {
        set.forEach((ws) => {
            if (ws.readyState === 1) {
                try { ws.send(message); } catch { /* ignore */ }
            }
        });
    });
};

export const getWsStats = () => ({
    users: clients.size,
    connections: [...clients.values()].reduce((sum, set) => sum + set.size, 0),
    rooms: rooms.size,
});

/**
 * Room management — for live tracking rooms, admin monitoring etc.
 */
export const joinRoom = (roomName, userId) => {
    if (!rooms.has(roomName)) rooms.set(roomName, new Set());
    rooms.get(roomName).add(String(userId));
};

export const leaveRoom = (roomName, userId) => {
    const room = rooms.get(roomName);
    if (room) {
        room.delete(String(userId));
        if (room.size === 0) rooms.delete(roomName);
    }
};

/**
 * Broadcast to all users in a room
 */
export const broadcastToRoom = (roomName, type, payload = {}) => {
    const room = rooms.get(roomName);
    if (!room || room.size === 0) return;
    const message = JSON.stringify({ type, payload, timestamp: new Date().toISOString() });
    for (const userId of room) {
        const set = clients.get(userId);
        if (!set) continue;
        for (const ws of set) {
            if (ws.readyState === 1) {
                try { ws.send(message); } catch { /* ignore */ }
            }
        }
    }
};

/**
 * [FIX v3] Broadcast to every currently-connected admin.
 * Relies on admin clients being in the "admins" room — they're auto-joined
 * on connect if their JWT payload has role === "admin" (see connection
 * handler above). Fire-and-forget: never throws, safe to call without
 * awaiting from request handlers.
 */
export const broadcastToAdmins = async (type, payload = {}) => {
    try {
        broadcastToRoom("admins", type, payload);
    } catch (err) {
        console.error(`[broadcastToAdmins:${type}] Failed:`, err.message);
    }
};

/**
 * Authorize a "join_room" request for an "order:<id>" room, which streams a
 * rider's live GPS for that order. Mirrors the ownership check already
 * enforced on the equivalent REST endpoint (getRiderLocationForOrder) —
 * without this, any authenticated user who knew/guessed an order id could
 * subscribe to a stranger's live delivery location over WS.
 */
const authorizeOrderRoomJoin = async (orderId, userId, userRole) => {
    if (["admin", "owner"].includes(userRole)) return true;
    try {
        const Order = (await import("../models/Order.js")).default;
        const order = await Order.findById(orderId).select("user delivery.assignedTo").lean();
        if (!order) return false;
        if (String(order.user) === String(userId)) return true;

        if (order.delivery?.assignedTo) {
            const DeliveryBoy = (await import("../models/deliveryModels/DeliveryBoy.js")).default;
            const rider = await DeliveryBoy.findById(order.delivery.assignedTo).select("userId").lean();
            if (rider && String(rider.userId) === String(userId)) return true;
        }
        return false;
    } catch {
        return false;
    }
};

/**
 * Handle rider location update received via WebSocket
 * Faster than HTTP — saves to Redis (or in-memory) and broadcasts to tracking room
 */
const handleRiderLocationWs = async (userId, lat, lng, orderId) => {
    // Save to Redis for fast access
    if (isRedisUp()) {
        const redis = getRedis();
        try {
            const locationData = JSON.stringify({ lat, lng, userId, updatedAt: new Date().toISOString() });
            await redis.setex(`rider:location:${userId}`, 120, locationData); // TTL 2 minutes
            if (orderId) {
                await redis.setex(`order:rider_location:${orderId}`, 120, locationData);
            }
        } catch { /* non-fatal */ }
    }

    // Broadcast to order tracking room
    if (orderId) {
        broadcastToRoom(`order:${orderId}`, "rider_location", {
            orderId, lat, lng, updatedAt: new Date().toISOString(),
        });

        // Also send directly to order owner (in case they haven't joined the room)
        try {
            const Order = (await import("../models/Order.js")).default;
            const order = await Order.findById(orderId).select("user").lean();
            if (order?.user) {
                sendToUser(String(order.user), "rider_location", {
                    orderId, lat, lng, riderName: "", updatedAt: new Date().toISOString(),
                });
            }
        } catch { /* non-fatal */ }
    }
};

/**
 * Check if a user is currently connected
 */
export const isUserOnline = (userId) => {
    const set = clients.get(String(userId));
    return !!(set && set.size > 0);
};