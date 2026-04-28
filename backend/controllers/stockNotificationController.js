/**
 * stockNotificationController.js — Back-in-Stock Notification System
 * 
 * Endpoints:
 *   POST /subscribe      — Subscribe email to product restock alert
 *   GET  /check/:productId — Check if email is already subscribed
 *   GET  /count/:productId — Get subscriber count (admin)
 */
import StockNotification from "../models/StockNotification.js";
import Product from "../models/Product.js";
import { sendEmail } from "../utils/emailService.js";

/* ════════════════════════════════════════
   PUBLIC — Subscribe to restock notification
════════════════════════════════════════ */
export const subscribeStockNotification = async (req, res) => {
    try {
        const { productId, email } = req.body;

        if (!productId || !email) {
            return res.status(400).json({ success: false, message: "productId and email required" });
        }

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: "Invalid email address" });
        }

        // Check product exists
        const product = await Product.findById(productId).select("name inStock stock").lean();
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // If product is already in stock, no need to subscribe
        if (product.inStock && product.stock > 0) {
            return res.json({ success: true, message: "Product is already in stock!", alreadyInStock: true });
        }

        // Upsert: if already subscribed, just update timestamp
        await StockNotification.findOneAndUpdate(
            { productId, email: email.toLowerCase().trim() },
            {
                productId,
                email: email.toLowerCase().trim(),
                userId: req.user?._id || null,
                notified: false,
                notifiedAt: null,
            },
            { upsert: true, new: true }
        );

        res.json({ success: true, message: "You'll be notified when this product is back in stock!" });
    } catch (err) {
        // Duplicate key error (race condition safeguard)
        if (err.code === 11000) {
            return res.json({ success: true, message: "You're already subscribed!" });
        }
        console.error("[subscribeStockNotification]", err);
        res.status(500).json({ success: false, message: "Failed to subscribe" });
    }
};

/* ════════════════════════════════════════
   PUBLIC — Check subscription status
════════════════════════════════════════ */
export const checkStockSubscription = async (req, res) => {
    try {
        const { productId } = req.params;
        const { email } = req.query;

        if (!email) return res.json({ subscribed: false });

        const sub = await StockNotification.findOne({
            productId,
            email: email.toLowerCase().trim(),
            notified: false,
        }).lean();

        res.json({ subscribed: !!sub });
    } catch (err) {
        console.error("[checkStockSubscription]", err);
        res.json({ subscribed: false });
    }
};

/* ════════════════════════════════════════
   ADMIN — Get subscriber count for a product
════════════════════════════════════════ */
export const getStockSubscriberCount = async (req, res) => {
    try {
        const count = await StockNotification.countDocuments({
            productId: req.params.productId,
            notified: false,
        });
        res.json({ count });
    } catch (err) {
        console.error("[getStockSubscriberCount]", err);
        res.json({ count: 0 });
    }
};

/* ════════════════════════════════════════
   INTERNAL — Send restock notifications
   Called from product update controllers when
   a product comes back in stock.
════════════════════════════════════════ */
export const sendRestockNotifications = async (productId, productName, productSlug) => {
    try {
        const subscribers = await StockNotification.find({
            productId,
            notified: false,
        }).lean();

        if (!subscribers.length) return;

        console.log(`📧 Sending restock alerts to ${subscribers.length} subscribers for "${productName}"`);

        const productUrl = `${process.env.CLIENT_URL || "https://urbexon.com"}/products/${productSlug}`;

        // Send emails in background (non-blocking)
        for (const sub of subscribers) {
            sendEmail({
                to: sub.email,
                subject: `🎉 "${productName}" is back in stock!`,
                html: `
                    <div style="font-family: 'DM Sans', -apple-system, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px;">
                        <div style="text-align: center; margin-bottom: 24px;">
                            <h1 style="font-size: 22px; color: #1c1917; margin: 0 0 8px;">Great News! 🎉</h1>
                            <p style="font-size: 14px; color: #78716c; margin: 0;">An item on your wishlist is available again</p>
                        </div>
                        <div style="background: #f7f4f0; border: 1px solid #e7e5e1; padding: 20px; margin-bottom: 24px;">
                            <h2 style="font-size: 17px; color: #1c1917; margin: 0 0 8px;">${productName}</h2>
                            <p style="font-size: 14px; color: #16a34a; font-weight: 600; margin: 0;">✅ Now Back in Stock</p>
                        </div>
                        <div style="text-align: center;">
                            <a href="${productUrl}" style="display: inline-block; background: #1c1917; color: #fff; padding: 12px 32px; text-decoration: none; font-size: 13px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase;">
                                Shop Now →
                            </a>
                        </div>
                        <p style="text-align: center; font-size: 11px; color: #a8a29e; margin-top: 24px;">
                            You received this because you subscribed to restock alerts on Urbexon.
                        </p>
                    </div>
                `,
                label: "RestockAlert",
            }).catch(e => console.error("Mail Error:", e));
        }

        // Mark all as notified
        await StockNotification.updateMany(
            { productId, notified: false },
            { notified: true, notifiedAt: new Date() }
        );

        console.log(`✅ Marked ${subscribers.length} subscribers as notified for "${productName}"`);
    } catch (err) {
        console.error("[sendRestockNotifications]", err);
        // Non-critical — don't throw
    }
};
