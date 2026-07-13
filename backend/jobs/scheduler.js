/**
 * 🤖 PRODUCTION AUTOMATION SCHEDULER
 * Central hub for all cron jobs — order, inventory, email, payments, cache, cleanup
 * Uses: FreeCron (node-cron) - NO EXTERNAL DEPENDENCY NEEDED
 *
 * [FIX] Each job now carries its own `description` field directly in the
 * JOBS array below, instead of a second, separately-maintained dictionary
 * living in routes/schedulerRoutes.js. That separate dictionary silently
 * fell out of sync every time a job was added here without a matching
 * update there — 3 jobs (Auto-Cancel Stale COD Orders, Auto-Expire
 * Subscriptions, Auto-Offline Inactive Delivery Boys) ended up showing
 * "Unknown job" in the admin Scheduler dashboard as a result. Description
 * is now defined exactly once, right next to the job it describes, so
 * adding a new job can never again silently produce an "Unknown job" card.
 */

import cron from 'node-cron';
import logger from '../utils/logger.js';

// Import all job handlers
import {
    autoCancelStaleCODOrders,
    autoCompleteDeliveredOrders,
    autoRefundExpiredPayments,
    autoGenerateInvoices,
    checkLowStockItems,
} from './orderInventoryJobs.js';

import {
    sendPendingOrderEmails,
    sendDeliveryUpdates,
    sendAbandonedCartReminders,
    sendAdminDailySummary,
} from './emailJobs.js';

import {
    calculateSellerCommissions,
    autoGeneratePayouts,
    updateVendorRatings,
    autoExpireSubscriptions,
} from './sellerJobs.js';

import {
    cleanupExpiredSessions,
    archiveOldOrders,
    cleanupTemporaryFiles,
    refreshCacheData,
} from './databaseJobs.js';

import {
    autoAssignDeliveryBoys,
    updateDeliveryStatus,
    updateDeliveryBoyAvailability,
    alertStaleAssignedOrders,
    reconcileActiveOrders,
} from './deliveryJobs.js';

import {
    checkNewDeals,
    sendWishlistReminders,
} from '../services/productReminders.js';

// ══════════════════════════════════════════════════════
// 🎯 JOB REGISTRY
// [FIX] `description` added to every entry — this is now the ONLY place
// a job's description is defined. routes/schedulerRoutes.js reads it
// straight off job.config.description instead of a separate dictionary.
// ══════════════════════════════════════════════════════

const JOBS = [
    {
        name: 'Auto-Cancel Stale COD Orders',
        schedule: '0 */3 * * *', // Every 3 hours
        handler: autoCancelStaleCODOrders,
        enabled: true,
        description: 'Cancels COD orders stuck unconfirmed for too long',
    },
    {
        name: 'Auto-Complete Delivered Orders',
        schedule: '0 */6 * * *', // Every 6 hours
        handler: autoCompleteDeliveredOrders,
        enabled: true,
        description: 'Automatically completes orders after 24hrs in OUT_FOR_DELIVERY',
    },
    {
        name: 'Auto-Refund Expired Payments',
        schedule: '0 */2 * * *', // Every 2 hours
        handler: autoRefundExpiredPayments,
        enabled: true,
        description: 'Refunds payment holds that expire after 30 minutes',
    },
    {
        name: 'Auto-Generate Invoices',
        schedule: '0 */12 * * *', // Every 12 hours
        handler: autoGenerateInvoices,
        enabled: false, // DISABLED: Only sets a flag, no actual invoice PDF generated
        description: 'Generates invoices for delivered orders automatically',
    },
    {
        name: 'Check Low Stock Items',
        schedule: '0 9 * * *', // Daily at 9 AM
        handler: checkLowStockItems,
        enabled: false, // DISABLED: Only logs warnings, no vendor email alerts wired
        description: 'Alerts when product stock falls below threshold',
    },
    {
        name: 'Send Pending Order Emails',
        schedule: '*/15 * * * *', // Every 15 minutes
        handler: sendPendingOrderEmails,
        enabled: true,
        description: 'Sends order confirmation emails',
    },
    {
        name: 'Send Delivery Updates',
        schedule: '0 */2 * * *', // Every 2 hours (reduced from 30min)
        handler: sendDeliveryUpdates,
        enabled: true,
        description: 'Sends delivery status emails to customers',
    },
    {
        name: 'Send Abandoned Cart Reminders',
        schedule: '0 */4 * * *', // Every 4 hours
        handler: sendAbandonedCartReminders,
        enabled: false, // DISABLED: Cart model not available
        description: 'Reminds users to complete abandoned cart purchases',
    },
    {
        name: 'Calculate Seller Commissions',
        schedule: '0 0 1 * *', // 1st of every month at midnight
        handler: calculateSellerCommissions,
        enabled: true,
        description: 'Calculates monthly commissions for vendors',
    },
    {
        name: 'Auto-Generate Payouts',
        schedule: '0 0 5 * *', // 5th of every month
        handler: autoGeneratePayouts,
        enabled: false, // DISABLED: No payment gateway for vendor payouts yet
        description: 'Approves and generates payouts for vendors',
    },
    {
        name: 'Update Vendor Ratings',
        schedule: '0 2 * * *', // Daily at 2 AM
        handler: updateVendorRatings,
        enabled: true,
        description: 'Updates vendor ratings based on reviews',
    },
    {
        name: 'Auto-Expire Subscriptions',
        schedule: '0 0 * * *', // Daily at midnight
        handler: autoExpireSubscriptions,
        enabled: true,
        description: 'Expires vendor subscriptions past their expiry date',
    },
    {
        name: 'Cleanup Expired Sessions',
        schedule: '0 3 * * *', // Daily at 3 AM
        handler: cleanupExpiredSessions,
        enabled: false, // DISABLED: Session model not available
        description: 'Deletes old sessions (30+ days)',
    },
    {
        name: 'Archive Old Orders',
        schedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
        handler: archiveOldOrders,
        enabled: false, // DISABLED: Cosmetic flag, not needed early-stage
        description: 'Archives delivered orders older than 90 days',
    },
    {
        name: 'Cleanup Temporary Files',
        schedule: '0 5 * * *', // Daily at 5 AM
        handler: cleanupTemporaryFiles,
        enabled: false, // DISABLED: Low-risk, no heavy temp file usage
        description: 'Removes temporary files older than 24 hours',
    },
    {
        name: 'Refresh Cache Data',
        schedule: '*/30 * * * *', // Every 30 minutes
        handler: refreshCacheData,
        enabled: true,
        description: 'Refreshes Redis cache for banners, categories, products',
    },
    {
        name: 'Auto-Assign Delivery Boys',
        schedule: '*/5 * * * *', // Every 5 minutes
        handler: autoAssignDeliveryBoys,
        enabled: true,
        description: 'Automatically assigns delivery boys to pending orders',
    },
    {
        name: 'Update Delivery Status',
        schedule: '*/10 * * * *', // Every 10 minutes (reduced from 2min)
        handler: updateDeliveryStatus,
        enabled: true,
        description: 'Updates delivery status based on time thresholds',
    },
    {
        name: 'Auto-Offline Inactive Delivery Boys',
        schedule: '*/10 * * * *', // Every 10 minutes
        handler: updateDeliveryBoyAvailability,
        enabled: true, // was defined but never scheduled — dead code until now
        description: 'Sets delivery boys offline after a period of inactivity',
    },
    {
        name: 'Alert Stale Assigned Orders',
        schedule: '*/10 * * * *', // Every 10 minutes
        handler: alertStaleAssignedOrders,
        enabled: true, // safe, read-only replacement for the disabled "Update Delivery Status" job
        description: 'Flags orders stuck in ASSIGNED status for too long without pickup',
    },
    {
        name: 'Reconcile Active Orders Counter',
        schedule: '*/30 * * * *', // Every 30 minutes — maintenance-only, not assignment-path
        handler: reconcileActiveOrders,
        enabled: true,
        description: 'Repairs DeliveryBoy.activeOrders drift against real assigned-order counts and logs the result',
    },
    {
        name: 'Check New Deal Alerts',
        schedule: '0 */1 * * *', // Every hour
        handler: checkNewDeals,
        enabled: false, // DISABLED: Marketing feature, enable when deal flow is established
        description: 'Notifies users about new deals matching their interests',
    },
    {
        name: 'Send Wishlist Reminders',
        schedule: '0 10 * * *', // Daily at 10 AM
        handler: sendWishlistReminders,
        enabled: false, // DISABLED: Marketing feature, enable later
        description: 'Reminds users about items sitting in their wishlist',
    },
    {
        name: 'Send Admin Daily Summary',
        schedule: '0 21 * * *', // Daily at 9 PM IST
        handler: sendAdminDailySummary,
        enabled: false, // DISABLED: Informational, enable when needed
        description: 'Sends a daily business summary email to admins',
    },
];

// ══════════════════════════════════════════════════════
// 🚀 SCHEDULER INITIALIZATION
// ══════════════════════════════════════════════════════

class Scheduler {
    constructor() {
        this.jobs = new Map();
        this.stats = {
            total: 0,
            running: 0,
            completed: 0,
            failed: 0,
            lastRun: null,
        };
    }

    async initialize() {
        logger.info('🤖 Initializing Production Scheduler...');

        for (const job of JOBS) {
            if (!job.enabled) {
                logger.warn(`⏭️  SKIPPED: ${job.name}`);
                continue;
            }

            try {
                const task = cron.schedule(job.schedule, async () => {
                    await this.executeJob(job);
                }, { runOnInit: false });

                this.jobs.set(job.name, {
                    task,
                    config: job,
                    lastRun: null,
                    nextRun: this.getNextRunTime(job.schedule),
                });

                logger.info(`✅ SCHEDULED: ${job.name} [${job.schedule}]`);
                this.stats.total++;
            } catch (err) {
                logger.error(`❌ Failed to schedule ${job.name}: ${err.message}`);
            }
        }

        logger.success(`🎯 Scheduler initialized: ${this.stats.total} jobs scheduled`);
        this.printJobSummary();
    }

    async executeJob(job) {
        const jobKey = job.name;
        const startTime = Date.now();

        logger.info(`▶️  EXECUTING: ${jobKey}`);
        this.stats.running++;

        try {
            const result = await job.handler();

            const duration = Date.now() - startTime;
            this.jobs.get(jobKey).lastRun = new Date();
            this.stats.running--;
            this.stats.completed++;
            this.stats.lastRun = new Date();

            logger.success(`✅ COMPLETED: ${jobKey} (${duration}ms)`, result);
        } catch (err) {
            const duration = Date.now() - startTime;
            this.stats.running--;
            this.stats.failed++;

            logger.error(
                `❌ FAILED: ${jobKey} (${duration}ms)`,
                {
                    error: err.message,
                    stack: err.stack,
                }
            );

            // Alert on critical failures
            if (err.critical) {
                await this.alertAdmin(jobKey, err);
            }
        }
    }

    getNextRunTime(schedule) {
        try {
            const interval = cron.parseExpression(schedule);
            return interval.next().toDate();
        } catch {
            return null;
        }
    }

    async alertAdmin(jobName, error) {
        logger.error(`🚨 CRITICAL JOB FAILURE: ${jobName}`, error);
        // Future: Send admin alert email/SMS
    }

    getStats() {
        return {
            ...this.stats,
            jobs: Array.from(this.jobs.entries()).map(([name, job]) => ({
                name,
                schedule: job.config.schedule,
                lastRun: job.lastRun,
                nextRun: job.nextRun,
                enabled: job.config.enabled,
                // [FIX] description now flows through from the single
                // source of truth in JOBS above.
                description: job.config.description || 'No description provided',
            })),
        };
    }

    printJobSummary() {
        console.log('\n╔════════════════════════════════════════════════════════╗');
        console.log('║         🤖 PRODUCTION AUTOMATION SUMMARY 🤖            ║');
        console.log('╠════════════════════════════════════════════════════════╣');

        let index = 1;
        for (const [name, job] of this.jobs.entries()) {
            console.log(`║ ${index}. ${name.padEnd(50)} ║`);
            console.log(`║    Schedule: ${job.config.schedule.padEnd(40)} ║`);
            index++;
        }

        console.log('╠════════════════════════════════════════════════════════╣');
        console.log(`║ Total Jobs: ${String(this.stats.total).padEnd(42)} ║`);
        console.log('╚════════════════════════════════════════════════════════╝\n');
    }

    stop() {
        logger.warn('⏹️  Stopping scheduler...');
        for (const [name, job] of this.jobs.entries()) {
            job.task.stop();
            logger.info(`⏹️  Stopped: ${name}`);
        }
    }

    // Ops-dashboard "Restart Scheduler" action — stops every cron task,
    // clears the in-memory registry/stats, and re-registers from the same
    // JOBS array via initialize(). Does not touch job handlers/business
    // logic, only the cron registration lifecycle.
    async restart() {
        logger.warn('🔄 Restarting scheduler...');
        this.stop();
        this.jobs.clear();
        this.stats = { total: 0, running: 0, completed: 0, failed: 0, lastRun: null };
        await this.initialize();
        return this.getStats();
    }
}

export default new Scheduler();