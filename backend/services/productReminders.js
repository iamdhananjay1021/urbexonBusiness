/**
 * productReminders.js — Core reminder engine
 * Detects price drops, creates user notifications, sends via WebSocket
 */
import UserNotification from "../models/UserNotification.js";
import PriceHistory from "../models/PriceHistory.js";
import Wishlist from "../models/Wishlist.js";
import Product from "../models/Product.js";
import { sendToUser } from "../utils/wsHub.js";
import { sendEmailBackground } from "../utils/emailService.js";
import logger from "../utils/logger.js";

/**
 * Called when a product's price changes.
 * Logs history, notifies wishlist users + recent viewers.
 */
export const handlePriceChange = async (product, oldPrice, newPrice, changedBy = null) => {
    if (!product || oldPrice === newPrice) return;

    const changePercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    // Log price history
    try {
        await PriceHistory.create({
            productId: product._id,
            oldPrice,
            newPrice,
            changePercent,
            changedBy,
        });
    } catch (err) {
        console.error("[PriceHistory] Failed to log:", err.message);
    }

    // Only notify on price DROP (not increase)
    if (newPrice >= oldPrice) return;

    const productName = product.name?.length > 50
        ? product.name.substring(0, 50) + "…"
        : product.name;
    const slug = product.slug || product._id;
    const image = product.images?.[0]?.url || "";
    const link = `/products/${slug}`;

    // Find all users who have this product in wishlist
    try {
        const wishlists = await Wishlist.find(
            { products: product._id },
            { userId: 1 }
        ).lean();

        const userIds = wishlists.map(w => w.userId);
        if (userIds.length === 0) return;

        // Prevent duplicate notifications — check if we already sent for this product today
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existing = await UserNotification.find({
            userId: { $in: userIds },
            productId: product._id,
            type: "price_drop",
            createdAt: { $gte: today },
        }, { userId: 1 }).lean();

        const alreadyNotified = new Set(existing.map(e => e.userId.toString()));
        const toNotify = userIds.filter(id => !alreadyNotified.has(id.toString()));

        if (toNotify.length === 0) return;

        // Create notifications in bulk
        const notifications = toNotify.map(userId => ({
            userId,
            type: "price_drop",
            title: `Price dropped ${changePercent}%!`,
            message: `${productName} is now ₹${newPrice} (was ₹${oldPrice})`,
            image,
            productId: product._id,
            link,
            meta: { oldPrice, newPrice, changePercent },
        }));

        await UserNotification.insertMany(notifications, { ordered: false });

        // Push via WebSocket to online users
        for (const userId of toNotify) {
            sendToUser(userId.toString(), "notification", {
                type: "price_drop",
                title: `Price dropped ${changePercent}%!`,
                message: `${productName} is now ₹${newPrice}`,
                image,
                link,
                productId: product._id.toString(),
            });
        }

        await logger.info(`[PriceDrop] Notified ${toNotify.length} users for ${productName} (${changePercent}% off)`);
    } catch (err) {
        console.error("[handlePriceChange] Notification failed:", err.message);
    }
};

/**
 * Called when a product comes back in stock.
 * Notifies wishlist users (in addition to email-based StockNotification).
 */
export const handleBackInStock = async (product) => {
    if (!product) return;

    const productName = product.name?.length > 50
        ? product.name.substring(0, 50) + "…"
        : product.name;
    const slug = product.slug || product._id;
    const image = product.images?.[0]?.url || "";
    const link = `/products/${slug}`;

    try {
        const wishlists = await Wishlist.find(
            { products: product._id },
            { userId: 1 }
        ).lean();

        const userIds = wishlists.map(w => w.userId);
        if (userIds.length === 0) return;

        // Prevent duplicate — check last 24h
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const existing = await UserNotification.find({
            userId: { $in: userIds },
            productId: product._id,
            type: "back_in_stock",
            createdAt: { $gte: yesterday },
        }, { userId: 1 }).lean();

        const alreadyNotified = new Set(existing.map(e => e.userId.toString()));
        const toNotify = userIds.filter(id => !alreadyNotified.has(id.toString()));

        if (toNotify.length === 0) return;

        const notifications = toNotify.map(userId => ({
            userId,
            type: "back_in_stock",
            title: "Back in Stock! 🎉",
            message: `${productName} is available again — grab it before it sells out!`,
            image,
            productId: product._id,
            link,
            meta: { price: product.price },
        }));

        await UserNotification.insertMany(notifications, { ordered: false });

        for (const userId of toNotify) {
            sendToUser(userId.toString(), "notification", {
                type: "back_in_stock",
                title: "Back in Stock! 🎉",
                message: `${productName} is available again`,
                image,
                link,
                productId: product._id.toString(),
            });
        }

        await logger.info(`[BackInStock] Notified ${toNotify.length} wishlist users for ${productName}`);
    } catch (err) {
        console.error("[handleBackInStock] Failed:", err.message);
    }
};

/**
 * Cron job: Check for new deals starting and notify wishlist users
 */
export const checkNewDeals = async () => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now - 60 * 60 * 1000);

        // Find products that recently became active deals
        const newDeals = await Product.find({
            isDeal: true,
            isActive: true,
            inStock: true,
            dealStartsAt: { $gte: oneHourAgo, $lte: now },
        }).lean();

        if (newDeals.length === 0) return;

        for (const product of newDeals) {
            const wishlists = await Wishlist.find(
                { products: product._id },
                { userId: 1 }
            ).lean();

            const userIds = wishlists.map(w => w.userId);
            if (userIds.length === 0) continue;

            const productName = product.name?.length > 50
                ? product.name.substring(0, 50) + "…"
                : product.name;
            const discountPercent = product.mrp && product.mrp > product.price
                ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                : 0;

            const notifications = userIds.map(userId => ({
                userId,
                type: "deal_alert",
                title: `Deal Alert! ${discountPercent}% off 🔥`,
                message: `${productName} is on sale — limited time offer!`,
                image: product.images?.[0]?.url || "",
                productId: product._id,
                link: `/products/${product.slug || product._id}`,
                meta: { price: product.price, mrp: product.mrp, discountPercent },
            }));

            await UserNotification.insertMany(notifications, { ordered: false }).catch(() => { });

            for (const userId of userIds) {
                sendToUser(userId.toString(), "notification", {
                    type: "deal_alert",
                    title: `Deal Alert! ${discountPercent}% off 🔥`,
                    message: `${productName} is now on sale!`,
                    image: product.images?.[0]?.url || "",
                    link: `/products/${product.slug || product._id}`,
                });
            }
        }

        await logger.info(`[DealAlerts] Processed ${newDeals.length} new deals`);
    } catch (err) {
        console.error("[checkNewDeals]", err.message);
    }
};

/**
 * Cron job: Wishlist reminder — remind users about items sitting in wishlist > 3 days
 */
export const sendWishlistReminders = async () => {
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

        // Get wishlists that haven't been reminded in 7 days
        const wishlists = await Wishlist.find({
            updatedAt: { $lte: threeDaysAgo },
        }).populate({
            path: "products",
            match: { isActive: true, inStock: true },
            select: "name slug price mrp images",
            options: { limit: 3 },
        }).lean();

        let count = 0;
        for (const wl of wishlists) {
            if (!wl.products?.length) continue;

            // Check if we sent a wishlist reminder in the last 7 days
            const lastReminder = await UserNotification.findOne({
                userId: wl.userId,
                type: "wishlist_reminder",
                createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            }).lean();

            if (lastReminder) continue;

            const topProduct = wl.products[0];
            const productName = topProduct.name?.length > 40
                ? topProduct.name.substring(0, 40) + "…"
                : topProduct.name;

            await UserNotification.create({
                userId: wl.userId,
                type: "wishlist_reminder",
                title: "Still interested? 💫",
                message: `${productName} and ${wl.products.length > 1 ? `${wl.products.length - 1} more items` : "more"} in your wishlist`,
                image: topProduct.images?.[0]?.url || "",
                productId: topProduct._id,
                link: "/wishlist",
                meta: { totalItems: wl.products.length },
            });

            sendToUser(wl.userId.toString(), "notification", {
                type: "wishlist_reminder",
                title: "Still interested? 💫",
                message: `${productName} is waiting in your wishlist`,
                image: topProduct.images?.[0]?.url || "",
                link: "/wishlist",
            });

            count++;
        }

        if (count > 0) {
            await logger.info(`[WishlistReminder] Sent ${count} reminders`);
        }
    } catch (err) {
        console.error("[sendWishlistReminders]", err.message);
    }
};
