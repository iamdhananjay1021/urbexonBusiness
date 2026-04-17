/**
 * 🤖 PRODUCTION AUTOMATION SCHEDULER
 * Central hub for all cron jobs — order, inventory, email, payments, cache, cleanup
 * Uses: FreeCron (node-cron) - NO EXTERNAL DEPENDENCY NEEDED
 */

import cron from 'node-cron';
import logger from '../utils/logger.js';

// Import all job handlers
import {
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
} from './deliveryJobs.js';

import {
    checkNewDeals,
    sendWishlistReminders,
} from '../services/productReminders.js';

// ══════════════════════════════════════════════════════
// 🎯 JOB REGISTRY
// ══════════════════════════════════════════════════════

const JOBS = [
    {
        name: 'Auto-Complete Delivered Orders',
        schedule: '0 */6 * * *', // Every 6 hours
        handler: autoCompleteDeliveredOrders,
        enabled: true,
    },
    {
        name: 'Auto-Refund Expired Payments',
        schedule: '0 */2 * * *', // Every 2 hours
        handler: autoRefundExpiredPayments,
        enabled: true,
    },
    {
        name: 'Auto-Generate Invoices',
        schedule: '0 */12 * * *', // Every 12 hours
        handler: autoGenerateInvoices,
        enabled: true,
    },
    {
        name: 'Check Low Stock Items',
        schedule: '0 9 * * *', // Daily at 9 AM
        handler: checkLowStockItems,
        enabled: true,
    },
    {
        name: 'Send Pending Order Emails',
        schedule: '*/15 * * * *', // Every 15 minutes
        handler: sendPendingOrderEmails,
        enabled: true,
    },
    {
        name: 'Send Delivery Updates',
        schedule: '*/30 * * * *', // Every 30 minutes
        handler: sendDeliveryUpdates,
        enabled: true,
    },
    {
        name: 'Send Abandoned Cart Reminders',
        schedule: '0 */4 * * *', // Every 4 hours
        handler: sendAbandonedCartReminders,
        enabled: false, // DISABLED: Cart model not available
    },
    {
        name: 'Calculate Seller Commissions',
        schedule: '0 0 1 * *', // 1st of every month at midnight
        handler: calculateSellerCommissions,
        enabled: true,
    },
    {
        name: 'Auto-Generate Payouts',
        schedule: '0 0 5 * *', // 5th of every month
        handler: autoGeneratePayouts,
        enabled: true,
    },
    {
        name: 'Update Vendor Ratings',
        schedule: '0 2 * * *', // Daily at 2 AM
        handler: updateVendorRatings,
        enabled: true,
    },
    {
        name: 'Cleanup Expired Sessions',
        schedule: '0 3 * * *', // Daily at 3 AM
        handler: cleanupExpiredSessions,
        enabled: false, // DISABLED: Session model not available
    },
    {
        name: 'Archive Old Orders',
        schedule: '0 4 * * 0', // Weekly on Sunday at 4 AM
        handler: archiveOldOrders,
        enabled: true,
    },
    {
        name: 'Cleanup Temporary Files',
        schedule: '0 5 * * *', // Daily at 5 AM
        handler: cleanupTemporaryFiles,
        enabled: true,
    },
    {
        name: 'Refresh Cache Data',
        schedule: '*/30 * * * *', // Every 30 minutes
        handler: refreshCacheData,
        enabled: true,
    },
    {
        name: 'Auto-Assign Delivery Boys',
        schedule: '*/5 * * * *', // Every 5 minutes
        handler: autoAssignDeliveryBoys,
        enabled: true,
    },
    {
        name: 'Update Delivery Status',
        schedule: '*/2 * * * *', // Every 2 minutes
        handler: updateDeliveryStatus,
        enabled: true,
    },
    {
        name: 'Check New Deal Alerts',
        schedule: '0 */1 * * *', // Every hour
        handler: checkNewDeals,
        enabled: true,
    },
    {
        name: 'Send Wishlist Reminders',
        schedule: '0 10 * * *', // Daily at 10 AM
        handler: sendWishlistReminders,
        enabled: true,
    },
    {
        name: 'Send Admin Daily Summary',
        schedule: '0 21 * * *', // Daily at 9 PM IST
        handler: sendAdminDailySummary,
        enabled: true,
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
}

export default new Scheduler();
