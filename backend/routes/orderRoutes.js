/**
 * orderRoutes.js — v2.0 with full validation
 */
import express from "express";
import { validateBody } from "../middlewares/validate.js";
import {
    createOrder, getMyOrders, getAllOrders, getOrderById,
    updateOrderStatus, cancelOrder, processRefund, retryRefund,
    getRefundQueue, getReturnQueue, processReturn, requestReturn, getFlaggedOrders,
    getCheckoutPricing, streamMyOrderEvents,
    getLocalDeliveryQueue, assignLocalDelivery,
} from "../controllers/orderController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";
import { downloadInvoice } from "../controllers/invoiceController.js";

const router = express.Router();

// SSE stream (requires auth)
router.get("/stream", protect, streamMyOrderEvents);

// Pricing
router.post("/pricing", protect, validateBody({ items: { required: true } }), getCheckoutPricing);

// User
router.post("/", protect, validateBody({
    items: { required: true },
    customerName: { required: true, minLength: 2, maxLength: 100 },
    phone: { required: true, pattern: /^[6-9]\d{9}$/ },
    address: { required: true, minLength: 5 },
    paymentMethod: { required: true, enum: ['COD', 'RAZORPAY'] },
}), createOrder);
router.get("/my", protect, getMyOrders);

// Admin queues (before /:id)
router.get("/admin/refunds", protect, adminOnly, getRefundQueue);
router.get("/admin/returns", protect, adminOnly, getReturnQueue);
router.get("/admin/flagged", protect, adminOnly, getFlaggedOrders);
router.get("/admin/local-delivery", protect, adminOnly, getLocalDeliveryQueue);
router.put("/admin/local-delivery/:id/assign", protect, adminOnly, assignLocalDelivery);

// Admin management
router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id", protect, adminOnly, validateBody({ orderStatus: { required: true } }), updateOrderStatus);

// User actions
router.patch("/:id/cancel", protect, cancelOrder);

// Refund
router.put("/:id/refund/process", protect, adminOnly, validateBody({ action: { required: true, enum: ['approve', 'reject'] } }), processRefund);
router.put("/:id/refund/retry", protect, adminOnly, retryRefund);

// Return
router.put("/:id/return/request", protect, validateBody({ reason: { required: true, minLength: 5, maxLength: 500 } }), requestReturn);
router.put("/:id/return/process", protect, adminOnly, validateBody({ action: { required: true, enum: ['approve', 'reject', 'pickup', 'refund'] } }), processReturn);

// Invoice
router.get("/:id/invoice", protect, downloadInvoice);

// Single order
router.get("/:id", protect, getOrderById);

export default router;
