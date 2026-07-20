/**
 * 🗄️ DATABASE CLEANUP & CACHE REFRESH JOBS
 * Sessions, archives, temporary files, cache management
 */

import Order from '../models/Order.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import { getCache, setCache, delCacheByPrefix } from '../utils/Cache.js';
import { purgeOldNotifications } from '../controllers/admin/notificationController.js';

// ══════════════════════════════════════════════════════
// 1️⃣ CLEANUP EXPIRED SESSIONS (DISABLED - NO SESSION MODEL)
// ══════════════════════════════════════════════════════
export const cleanupExpiredSessions = async () => {
    try {
        // Session model not available in current schema
        // This can be implemented if a Session collection is added
        logger.warn('⏭️  Session cleanup skipped - Session model not available');
        return { sessionsDeleted: 0 };
    } catch (err) {
        logger.error('Cleanup Sessions Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 2️⃣ ARCHIVE OLD ORDERS
// ══════════════════════════════════════════════════════
export const archiveOldOrders = async () => {
    try {
        const archiveDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days

        const archived = await Order.updateMany(
            {
                // [FIX] Was `status`, a field that doesn't exist at the top
                // level of the Order schema (only nested subdocuments have
                // a `status` path) — this query matched zero documents ever.
                // The real order-lifecycle field is `orderStatus`.
                orderStatus: 'DELIVERED',
                createdAt: { $lt: archiveDate },
                isArchived: { $ne: true },
            },
            {
                $set: {
                    isArchived: true,
                    archivedAt: new Date(),
                },
            }
        );

        logger.info(`📦 Archived ${archived.modifiedCount} old orders (>90 days old)`);
        return { ordersArchived: archived.modifiedCount };
    } catch (err) {
        logger.error('Archive Orders Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 3️⃣ CLEANUP TEMPORARY FILES
// ══════════════════════════════════════════════════════
export const cleanupTemporaryFiles = async () => {
    try {
        const tempDir = path.join(process.cwd(), 'temp');
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        let deleted = 0;

        try {
            const files = await fs.readdir(tempDir);

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stats = await fs.stat(filePath);
                const age = Date.now() - stats.mtimeMs;

                if (age > maxAge) {
                    await fs.unlink(filePath);
                    deleted++;
                    logger.debug(`🗑️  Deleted temp file: ${file}`);
                }
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
        }

        logger.info(`🗑️  Cleaned up ${deleted} temporary files (>24hrs old)`);
        return { filesDeleted: deleted };
    } catch (err) {
        logger.error('Cleanup Temp Files Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 4️⃣ REFRESH CACHE DATA
// ══════════════════════════════════════════════════════
export const refreshCacheData = async () => {
    try {
        let refreshed = 0;

        // Refresh banners cache
        try {
            const banners = await (await import('../controllers/bannerController.js'))
                .getActiveBanners({ query: {} }, {
                    json: (data) => {
                        setCache('banners:active', data, 600);
                        refreshed++;
                    },
                });
            logger.debug('🔄 Refreshed: banners cache');
        } catch (err) {
            logger.warn('Failed to refresh banners cache');
        }

        // Refresh categories cache
        try {
            const categories = await (await import('../controllers/categoryController.js'))
                .getActiveCategories({ query: {} }, {
                    json: (data) => {
                        setCache('categories:active', data, 600);
                        refreshed++;
                    },
                });
            logger.debug('🔄 Refreshed: categories cache');
        } catch (err) {
            logger.warn('Failed to refresh categories cache');
        }

        // Refresh homepage products cache
        try {
            const homepage = await (await import('../controllers/productController.js'))
                .getHomepageProducts({ query: {} }, {
                    json: (data) => {
                        setCache('homepage:products', data, 300);
                        refreshed++;
                    },
                });
            logger.debug('🔄 Refreshed: homepage products cache');
        } catch (err) {
            logger.warn('Failed to refresh homepage cache');
        }

        // Clear old user stats cache
        try {
            await delCacheByPrefix('user:stats:');
            logger.debug('🔄 Cleared: user stats cache');
            refreshed++;
        } catch (err) {
            logger.warn('Failed to clear user stats cache');
        }

        logger.info(`🔄 Refreshed ${refreshed} cache operations`);
        return { cacheRefreshed: refreshed };
    } catch (err) {
        logger.error('Refresh Cache Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// 5️⃣ CLEANUP OLD NOTIFICATIONS (>30 days, read only)
// ══════════════════════════════════════════════════════
export const cleanOldNotificationsJob = async () => {
    try {
        const deleted = await purgeOldNotifications();
        logger.info(`🔔 Cleaned up ${deleted} old read notifications (>30 days old)`);
        return { notificationsDeleted: deleted };
    } catch (err) {
        logger.error('Cleanup Notifications Error:', err);
        throw { message: err.message };
    }
};

// ══════════════════════════════════════════════════════
// BONUS: Cleanup abandoned carts (> 7 days) (DISABLED - NO CART MODEL)
// ══════════════════════════════════════════════════════
export const cleanupAbandonedCarts = async () => {
    try {
        // Cart model not available in current schema
        // This can be implemented if a Cart collection is added
        logger.warn('⏭️  Cart cleanup skipped - Cart model not available');
        return { cartsDeleted: 0 };
    } catch (err) {
        logger.error('Cleanup Carts Error:', err);
        throw { message: err.message };
    }
};
