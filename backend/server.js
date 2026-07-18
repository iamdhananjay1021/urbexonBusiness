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
import hpp from "hpp";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import { connectRedis, isRedisUp, getCacheStatus } from "./config/redis.js";
import { initFirebase, isFcmAvailable } from "./config/firebase.js";
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
import ticketRoutes from "./routes/ticketRoutes.js";
import invoiceRoutes from "./routes/Invoiceroutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import collectionRoutes from "./routes/collectionRoutes.js";
import shiprocketRoutes from "./routes/shiprocketRoutes.js";
import vendorRoutes from "./routes/VendorRoutes/vendorRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes/deliveryRoutes.js";
import wishlistRoutes from "./routes/wishlistRoutes.js";
import pincodeRoutes from "./routes/pincodeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import stockNotificationRoutes from "./routes/stockNotificationRoutes.js";
import userNotificationRoutes from "./routes/userNotificationRoutes.js";
import sitemapRoutes from "./routes/sitemapRoutes.js";
import deliveryConfigRoutes from "./routes/deliveryConfigRoutes.js";
import vendorAuthRoutes from "./routes//VendorRoutes/vendorRoutes.js";
// [FIX] schedulerRoutes was imported here but never mounted directly —
// it's already correctly mounted inside adminRoutes.js via router.use(schedulerRoutes).
// Removed the dead top-level import to avoid confusion about where it lives.

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import scheduler from "./jobs/scheduler.js";
import logger from "./utils/logger.js";
import { refreshDeliveryConfig } from "./config/deliveryConfig.js";
import { getEmailStatus } from "./utils/emailService.js";

dotenv.config();

/* ───────── ENV VALIDATION ───────── */
// [FIX] Expanded beyond JWT_SECRET/MONGO_URI. Previously, a missing
// Razorpay/Cloudinary key would let the server boot fine and only fail
// silently on the first real payment/upload in production — the worst
// possible time to discover a config mistake. Now it fails fast at
// startup with a clear message instead.
const REQUIRED_ENV_VARS = [
    "JWT_SECRET",
    "MONGO_URI",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
];

const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]?.trim());
if (missingEnvVars.length > 0) {
    console.error("❌ Missing required environment variables:", missingEnvVars.join(", "));
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    console.error("❌ JWT_SECRET is too weak (must be at least 32 characters)");
    process.exit(1);
}

// [FIX] Non-fatal warnings for envs that degrade a feature but shouldn't
// block the whole server from starting (email, Redis have fallbacks).
const RECOMMENDED_ENV_VARS = ["RESEND_API_KEY", "REDIS_URL"];
const missingRecommended = RECOMMENDED_ENV_VARS.filter((key) => !process.env[key]?.trim());
if (missingRecommended.length > 0) {
    console.warn("⚠️  Missing recommended environment variables (features will degrade):", missingRecommended.join(", "));
}

/* ───────── APP INIT ───────── */
const app = express();
const server = createServer(app);

/* ───────── SERVICES ───────── */
connectDB();
connectRedis();
initFirebase();

/* ───────── SECURITY ───────── */
app.set("trust proxy", 1);
app.use(helmet());
app.use(cookieParser());

app.use(xss());
app.use(mongoSanitize());
// [FIX] HTTP Parameter Pollution guard — without this, a request like
// "?price=100&price=200" or repeated array-style query keys can silently
// override filter/sort logic in list endpoints (products, orders, vendors).
app.use(hpp());

/* ───────── CORS FIX (FINAL) ───────── */
const allowedOrigins = [
    // Main Website
    "https://urbexon.in",
    "https://www.urbexon.in",

    // Panels
    "https://admin.urbexon.in",
    "https://vendor.urbexon.in",
    "https://delivery.partner.urbexon.in",

    // Local Development
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",

    // Environment Variables
    process.env.VITE_API_URL,
    process.env.CLIENT_URL,
    process.env.ADMIN_VITE_API_URL,
    process.env.VENDOR_VITE_API_URL,
    process.env.DELIVERY_VITE_API_URL,
].filter(Boolean);

const corsOptions = {
    origin(origin, callback) {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.error(`❌ CORS BLOCKED: ${origin}`);
        callback(new Error("CORS not allowed"));
    },
    credentials: true,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ───────── LIMITERS ─────────
 * Limits are env-tunable. The `skip` predicate lets an authenticated
 * automated-QA client bypass limiting when the backend is explicitly run
 * with DISABLE_RATE_LIMIT=1 (never set in production) — otherwise a full
 * E2E run trips the 30-login auth window and every subsequent /api/auth
 * request (including profile + admin dashboard, which sit under the same
 * mount) starts returning 429. Real traffic is unaffected.
 */
const RL_DISABLED = process.env.DISABLE_RATE_LIMIT === "1" && process.env.NODE_ENV !== "production";
const skipWhenDisabled = () => RL_DISABLED;
const num = (v, d) => (Number.isFinite(+v) && +v > 0 ? +v : d);

if (RL_DISABLED) console.warn("⚠️  Rate limiting DISABLED (DISABLE_RATE_LIMIT=1, non-production)");

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: num(process.env.RL_AUTH_MAX, 30), skip: skipWhenDisabled });
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: num(process.env.RL_PUBLIC_MAX, 200), skip: skipWhenDisabled });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: num(process.env.RL_GENERAL_MAX, 120), skip: skipWhenDisabled });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: num(process.env.RL_ADMIN_MAX, 150), skip: skipWhenDisabled });

/* ───────── MIDDLEWARE ───────── */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(compression());
app.use(morgan("dev"));

/* ───────── HEALTH ───────── */
app.get("/", (_req, res) => res.json({ status: "ok" }));

app.get("/health", (_req, res) => res.json({
    status: "ok",
    cache: getCacheStats(),
    realtime: { sse: getStreamStats(), ws: getWsStats() }
}));

/* ───────── ROUTES ───────── */
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/products", publicLimiter, productRoutes);
app.use("/api/orders", generalLimiter, orderRoutes);
app.use("/api/reviews", publicLimiter, reviewRoutes);
app.use("/api/uploads", generalLimiter, uploadRoutes);
app.use("/api/payment", generalLimiter, paymentRoutes);
app.use("/api/contact", generalLimiter, contactRoute);
app.use("/api/tickets", generalLimiter, ticketRoutes);
app.use("/api/invoice", generalLimiter, invoiceRoutes);
app.use("/api/categories", publicLimiter, categoryRoutes);
app.use("/api/collections", publicLimiter, collectionRoutes);
app.use("/api/banners", publicLimiter, bannerRoutes);
app.use("/api/shiprocket", generalLimiter, shiprocketRoutes);
app.use("/api/wishlist", generalLimiter, wishlistRoutes);
app.use("/api/coupons", generalLimiter, couponRoutes);
app.use("/api/notifications", generalLimiter, notificationRoutes);
// [FIX] stockNotificationRoutes was imported but never mounted — the
// entire "notify me when back in stock" feature has been silently dead
// with no error anywhere. Mounted here under generalLimiter, matching
// the pattern of the other customer-facing notification routes.
app.use("/api/stock-notifications", generalLimiter, stockNotificationRoutes);
app.use("/api/user-notifications", generalLimiter, userNotificationRoutes);
app.use("/api/delivery", generalLimiter, deliveryRoutes);
app.use("/api/vendor", generalLimiter, vendorRoutes);
app.use("/api/addresses", generalLimiter, addressRoutes);
app.use("/api/pincode", publicLimiter, pincodeRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api", sitemapRoutes);
app.use("/api", deliveryConfigRoutes);
app.use("/api/auth/vendor", authLimiter, vendorAuthRoutes);


/* ───────── ERROR HANDLING ───────── */
app.use(notFound);
app.use(errorHandler);

/* ───────── START SERVER ───────── */
const PORT = process.env.PORT || 9000;

server.listen(PORT, async () => {
    console.log(`🚀 Server running on ${PORT}`);

    console.log("📡 Allowed Origins:");
    allowedOrigins.forEach(o => console.log("   ✅", o));

    // Email configuration status
    try {
        const emailStatus = getEmailStatus();
        console.log("📧 Email status:", emailStatus.provider);
        console.log("   → Resend configured:", emailStatus.useResend);
        console.log("   → SMTP configured:", emailStatus.smtpConfigured);
        console.log("   → From address:", emailStatus.fromEmail);
        if (emailStatus.provider === "none") {
            console.warn("⚠️ No email provider configured. Set RESEND_API_KEY or SMTP_* env vars before going to production.");
        }
    } catch (e) {
        console.warn("⚠️ Failed to determine email status:", e.message || e);
    }

    initWebSocket(server);
    await refreshDeliveryConfig();

    try {
        await scheduler.initialize();
        console.log("✅ Scheduler ready");
    } catch (e) {
        console.error("❌ Scheduler failed:", e.message);
    }
});

/* ───────── SHUTDOWN ───────── */
// [NOTE] Kept as-is for now — Day 3 (crash safety) will replace this with
// a graceful shutdown that drains in-flight requests, closes the Mongo
// connection, and adds uncaughtException/unhandledRejection handlers.
// Not touching it today to keep Day 1 scoped to security only.
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));