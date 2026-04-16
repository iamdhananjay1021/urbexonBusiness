/**
 * server.js — Urbexon Production v2.0
 * ✅ express-mongo-sanitize added (NoSQL injection prevention)
 * ✅ JWT_SECRET validated at startup
 * ✅ Dynamic CORS from env
 * ✅ WebSocket + SSE real-time
 * ✅ Graceful shutdown
 */
import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import morgan from "morgan";
import xss from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";

import connectDB from "./config/db.js";
import { connectRedis } from "./config/redis.js";
import { initFirebase } from "./config/firebase.js";
import { getCacheStats } from "./utils/Cache.js";
import { getStreamStats } from "./utils/realtimeHub.js";
import { initWebSocket, getWsStats } from "./utils/wsHub.js";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import addressRoutes from "./routes/addressRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import contactRoute from "./routes/contact.js";
import invoiceRoutes from "./routes/Invoiceroutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import shiprocketRoutes from "./routes/shiprocketRoutes.js";
import vendorRoutes from "./routes/VendorRoutes/vendorRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes/deliveryRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import stockNotificationRoutes from "./routes/stockNotificationRoutes.js";
import schedulerRoutes from "./routes/schedulerRoutes.js";
import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import scheduler from "./jobs/scheduler.js";
import logger from "./utils/logger.js";

dotenv.config();

// ── Validate critical env vars at startup ─────────────────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("❌ FATAL: JWT_SECRET missing or too short (min 32 chars)");
    process.exit(1);
}
if (!process.env.MONGO_URI) {
    console.error("❌ FATAL: MONGO_URI is not defined in .env");
    process.exit(1);
}

const app = express();
const httpServer = createServer(app);

connectDB();
connectRedis();
initFirebase();
app.set("trust proxy", 1);

// ── Security ─────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(xss());
app.use(mongoSanitize()); // ✅ NoSQL injection protection

// ── CORS ──────────────────────────────────────────────────
const buildAllowedOrigins = () => {
    const allowedOrigins = [
        'https://urbexon.in',
        'https://admin.urbexon.in',
        'https://vendor.urbexon.in',
        'https://delivery.partner.urbexon.in',  // ← yeh add karo
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175',
        'http://localhost:5176',
    ];
    const fromEnv = [
        process.env.FRONTEND_URL,
        process.env.ADMIN_FRONTEND_URL,
        process.env.VENDOR_FRONTEND_URL,
        process.env.DELIVERY_FRONTEND_URL,
        process.env.CLIENT_URL,
    ].filter(Boolean);
    return [...new Set([...allowedOrigins, ...fromEnv])];
};

app.use(cors({
    origin: (origin, cb) => {
        const allowed = buildAllowedOrigins();
        if (!origin || allowed.includes(origin)) return cb(null, true);
        console.warn("[CORS] Blocked:", origin);
        cb(new Error("CORS not allowed"));
    },
    credentials: true,
}));

// ── Rate Limits ───────────────────────────────────────────
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { message: "Too many requests, try again later" } });
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

// ── Body Parsers ──────────────────────────────────────────
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(compression());
app.use(process.env.NODE_ENV === "production" ? morgan("combined") : morgan("dev"));

// ── Health ────────────────────────────────────────────────
app.get("/", (_req, res) => res.json({ status: "ok", service: "Urbexon API", version: "2.0" }));
app.get("/health", (_req, res) => res.json({
    status: "ok",
    uptime: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || "development",
    cache: getCacheStats(),
    rt: { sse: getStreamStats(), ws: getWsStats() },
}));

// ── Routes ────────────────────────────────────────────────
app.use("/api/auth", (req, _res, next) =>
    req.method === "GET" ? adminLimiter(req, _res, next) : authLimiter(req, _res, next)
);
app.use("/api/auth", authRoutes);
app.use("/api/products", publicLimiter, productRoutes);
app.use("/api/banners", publicLimiter, bannerRoutes);
app.use("/api/categories", publicLimiter, categoryRoutes);
app.use("/api/reviews", publicLimiter, reviewRoutes);
app.use("/api/orders", generalLimiter, orderRoutes);
app.use("/api/addresses", generalLimiter, addressRoutes);
app.use("/api/payment", generalLimiter, paymentRoutes);
app.use("/api/contact", generalLimiter, contactRoute);
app.use("/api/invoice", generalLimiter, invoiceRoutes);
app.use("/api/uploads", generalLimiter, uploadRoutes);
app.use("/api/shiprocket", generalLimiter, shiprocketRoutes);
app.use("/api/wishlist", generalLimiter, wishlistRoutes);
app.use("/api/coupons", generalLimiter, couponRoutes);
app.use("/api", generalLimiter, notificationRoutes);
app.use("/api/stock-notify", publicLimiter, stockNotificationRoutes);
app.use("/api", generalLimiter, vendorRoutes);
app.use("/api/delivery", generalLimiter, deliveryRoutes);
app.use("/api/admin", adminLimiter, schedulerRoutes);

// ── 404 + Error Handler ───────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || "9000", 10);
const server = httpServer.listen(PORT, "0.0.0.0", async () => {
    console.log(`🚀 Urbexon API v2.0 running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
    initWebSocket(server);
    console.log("🔌 WebSocket ready at /ws");

    // 🤖 Initialize Production Automation Scheduler
    try {
        await logger.info("🤖 Initializing Production Scheduler...");
        await scheduler.initialize();
        await logger.success("✅ Production Scheduler initialized successfully");
    } catch (err) {
        await logger.error("❌ Scheduler initialization failed", err);
    }

    // Daily midnight reset for delivery stats
    const scheduleMidnightReset = () => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        setTimeout(async () => {
            try {
                const { default: DeliveryBoy } = await import("./models/deliveryModels/DeliveryBoy.js");
                await DeliveryBoy.updateMany({}, { $set: { todayDeliveries: 0, todayEarnings: 0 } });
                console.log("✅ Daily delivery stats reset");
            } catch (e) {
                console.error("❌ Stats reset failed:", e.message);
            }
            scheduleMidnightReset();
        }, midnight - now);
    };
    scheduleMidnightReset();
});

process.on("SIGTERM", async () => {
    console.log("SIGTERM — shutting down gracefully");
    scheduler.stop(); // Stop all scheduler jobs
    server.close(() => process.exit(0));
});
process.on("uncaughtException", (e) => { console.error("Uncaught:", e); process.exit(1); });
process.on("unhandledRejection", (r) => { console.error("Unhandled:", r); process.exit(1); });
