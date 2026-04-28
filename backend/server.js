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
import invoiceRoutes from "./routes/Invoiceroutes.js";
import bannerRoutes from "./routes/bannerRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
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
import schedulerRoutes from "./routes/schedulerRoutes.js";
import sitemapRoutes from "./routes/sitemapRoutes.js";
import deliveryConfigRoutes from "./routes/deliveryConfigRoutes.js";

import { notFound, errorHandler } from "./middlewares/errorMiddleware.js";
import scheduler from "./jobs/scheduler.js";
import logger from "./utils/logger.js";
import { refreshDeliveryConfig } from "./config/deliveryConfig.js";

dotenv.config();

/* ───────── ENV VALIDATION ───────── */
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("❌ JWT_SECRET missing or weak");
    process.exit(1);
}
if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing");
    process.exit(1);
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
app.use(xss());
app.use(mongoSanitize());

/* ───────── CORS FIX (FINAL) ───────── */
const allowedOrigins = [
    "https://urbexon.in",
    "https://admin.urbexon.in",
    "https://vendor.urbexon.in",
    "https://delivery.partner.urbexon.in",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    process.env.FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
    process.env.VENDOR_FRONTEND_URL,
    process.env.DELIVERY_FRONTEND_URL,
    process.env.CLIENT_URL,
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.error("❌ CORS BLOCKED:", origin);
        return callback(new Error("CORS not allowed"));
    },
    credentials: true,
}));

app.options("*", cors());

/* ───────── LIMITERS ───────── */
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });
const publicLimiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
const generalLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 150 });

/* ───────── MIDDLEWARE ───────── */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use("/api/invoice", generalLimiter, invoiceRoutes);
app.use("/api/categories", publicLimiter, categoryRoutes);
app.use("/api/banners", publicLimiter, bannerRoutes);
app.use("/api/shiprocket", generalLimiter, shiprocketRoutes);
app.use("/api/wishlist", generalLimiter, wishlistRoutes);
app.use("/api/coupons", generalLimiter, couponRoutes);
app.use("/api/notifications", generalLimiter, notificationRoutes);
app.use("/api/user-notifications", generalLimiter, userNotificationRoutes);
app.use("/api/delivery", generalLimiter, deliveryRoutes);
app.use("/api/vendor", generalLimiter, vendorRoutes);
app.use("/api/addresses", generalLimiter, addressRoutes);
app.use("/api/pincode", publicLimiter, pincodeRoutes);
app.use("/api/admin", adminLimiter, adminRoutes);
app.use("/api", sitemapRoutes);
app.use("/api", deliveryConfigRoutes);

/* ───────── ERROR HANDLING ───────── */
app.use(notFound);
app.use(errorHandler);

/* ───────── START SERVER ───────── */
const PORT = process.env.PORT || 9000;

server.listen(PORT, async () => {
    console.log(`🚀 Server running on ${PORT}`);

    console.log("📡 Allowed Origins:");
    allowedOrigins.forEach(o => console.log("   ✅", o));

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
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));