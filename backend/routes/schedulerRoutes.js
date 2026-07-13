/**
 * 📊 SCHEDULER MONITORING ENDPOINT
 * Admin dashboard for automation status
 */

import express from 'express';
import { protect, adminOnly } from '../middlewares/authMiddleware.js';
import scheduler from '../jobs/scheduler.js';

const router = express.Router();

// ══════════════════════════════════════════════════════
// GET /api/admin/scheduler/status
// Get current scheduler statistics
// ══════════════════════════════════════════════════════
router.get('/scheduler/status', protect, adminOnly, (req, res) => {
    try {
        const stats = scheduler.getStats();
        res.json({
            success: true,
            data: stats,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch scheduler stats',
        });
    }
});

// ══════════════════════════════════════════════════════
// POST /api/admin/scheduler/restart
// Stop + re-register every cron job (Ops Dashboard "Restart Scheduler")
// ══════════════════════════════════════════════════════
router.post('/scheduler/restart', protect, adminOnly, async (req, res) => {
    try {
        const stats = await scheduler.restart();
        res.json({ success: true, message: 'Scheduler restarted', data: stats });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to restart scheduler' });
    }
});

// ══════════════════════════════════════════════════════
// GET /api/admin/scheduler/jobs
// List all scheduled jobs with details
// ══════════════════════════════════════════════════════
router.get('/scheduler/jobs', protect, adminOnly, (req, res) => {
    try {
        const jobs = [];
        for (const [name, job] of scheduler.jobs.entries()) {
            jobs.push({
                name,
                schedule: job.config.schedule,
                enabled: job.config.enabled,
                lastRun: job.lastRun,
                nextRun: job.nextRun,
                description: getJobDescription(name),
            });
        }

        res.json({
            success: true,
            total: jobs.length,
            jobs,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch jobs',
        });
    }
});

// Helper function to get job descriptions
const getJobDescription = (jobName) => {
    const descriptions = {
        'Auto-Complete Delivered Orders': 'Automatically completes orders after 24hrs in OUT_FOR_DELIVERY',
        'Auto-Refund Expired Payments': 'Refunds payment holds that expire after 30 minutes',
        'Auto-Generate Invoices': 'Generates invoices for delivered orders automatically',
        'Check Low Stock Items': 'Alerts when product stock falls below threshold',
        'Send Pending Order Emails': 'Sends order confirmation emails',
        'Send Delivery Updates': 'Sends delivery status emails to customers',
        'Send Abandoned Cart Reminders': 'Reminds users to complete abandoned cart purchases',
        'Calculate Seller Commissions': 'Calculates monthly commissions for vendors',
        'Auto-Generate Payouts': 'Approves and generates payouts for vendors',
        'Update Vendor Ratings': 'Updates vendor ratings based on reviews',
        'Cleanup Expired Sessions': 'Deletes old sessions (30+ days)',
        'Archive Old Orders': 'Archives delivered orders older than 90 days',
        'Cleanup Temporary Files': 'Removes temporary files older than 24 hours',
        'Refresh Cache Data': 'Refreshes Redis cache for banners, categories, products',
        'Auto-Assign Delivery Boys': 'Automatically assigns delivery boys to pending orders',
        'Update Delivery Status': 'Updates delivery status based on time thresholds',
        'Reconcile Active Orders Counter': 'Repairs DeliveryBoy.activeOrders drift against real assigned-order counts and logs the result',
    };

    return descriptions[jobName] || 'Unknown job';
};

export default router;
