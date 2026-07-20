/**
 * Invoiceroutes.js
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middlewares/authMiddleware.js";
import {
    downloadInvoice,
    downloadInvoiceByNumber,
    verifyInvoice,
} from "../controllers/invoiceController.js";

const router = express.Router();

// [FIX] This route's own generalLimiter mount (120/min) is generous enough
// that a script iterating the sequential invoice-number range could still
// harvest a meaningful number of records. A tighter, dedicated limit here
// still comfortably covers real QR scans (a handful of people checking one
// invoice each) while making bulk enumeration impractically slow.
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ── Download by Order ID (user/admin)
// GET /api/invoice/:orderId/download
router.get("/:orderId/download", protect, downloadInvoice);

// ── Download by Invoice Number (user/admin)
// GET /api/invoice/number/:invoiceNumber/download
router.get("/number/:invoiceNumber/download", protect, downloadInvoiceByNumber);

// ── Public verify (QR code scan)
// GET /api/invoice/:invoiceNumber/verify
router.get("/:invoiceNumber/verify", verifyLimiter, verifyInvoice);

export default router;