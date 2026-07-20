/**
 * invoiceController.js
 * ─────────────────────────────────────────────────────────
 * Download invoice PDF + public invoice verification
 */

import Order from "../models/Order.js";
import { generateInvoiceBuffer } from "../utils/invoiceEmailHelper.js";

/* ══════════════════════════════════════════════════════
   DOWNLOAD INVOICE PDF
   GET /api/invoice/:orderId/download
   Owner or Admin only
══════════════════════════════════════════════════════ */
export const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId || req.params.id;
        const order = await Order.findById(orderId).lean();

        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });

        const isOwner = order.user?.toString() === req.user._id.toString();
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin)
            return res.status(403).json({ success: false, message: "Access denied" });

        const pdfBuffer = await generateInvoiceBuffer(order);
        const invoiceId = order.invoiceNumber || order._id.toString().slice(-8).toUpperCase();
        const filename = `Urbexon_Invoice_${invoiceId}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("[Invoice] Download error:", err);
        res.status(500).json({ success: false, message: "Failed to generate invoice" });
    }
};

/* ══════════════════════════════════════════════════════
   DOWNLOAD BY INVOICE NUMBER
   GET /api/invoice/number/:invoiceNumber/download
   Owner or Admin only
══════════════════════════════════════════════════════ */
export const downloadInvoiceByNumber = async (req, res) => {
    try {
        const order = await Order.findOne({
            invoiceNumber: req.params.invoiceNumber,
        }).lean();

        if (!order)
            return res.status(404).json({ success: false, message: "Invoice not found" });

        const isOwner = order.user?.toString() === req.user._id.toString();
        const isAdmin = ["admin", "owner"].includes(req.user.role);
        if (!isOwner && !isAdmin)
            return res.status(403).json({ success: false, message: "Access denied" });

        const pdfBuffer = await generateInvoiceBuffer(order);
        const filename = `Urbexon_${order.invoiceNumber}.pdf`;

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.send(pdfBuffer);

    } catch (err) {
        console.error("[Invoice] Download by number error:", err);
        res.status(500).json({ success: false, message: "Invoice generation failed" });
    }
};

/* ══════════════════════════════════════════════════════
   PUBLIC VERIFY (QR scan → anyone can verify)
   GET /api/invoice/:invoiceNumber/verify
   No auth required — QR on printed invoice links here
══════════════════════════════════════════════════════ */
// [FIX] Invoice numbers are sequential (INV-{year}-{month}-{5-digit seq}),
// so this endpoint's own reachability makes it a realistic PII-enumeration
// target — a script iterating the sequence range could harvest customer
// names and order values for a whole month of orders. Doesn't change the
// public "verify this invoice is real" purpose the QR code exists for;
// just stops it from also being a bulk customer-data lookup. Masking here
// rather than removing the fields entirely, since a customer scanning
// their own invoice still needs to recognize it as theirs.
const maskName = (name) => {
    if (!name) return "";
    const parts = name.trim().split(/\s+/);
    const first = parts[0];
    const maskedFirst = first.length > 2 ? `${first.slice(0, 2)}${"*".repeat(first.length - 2)}` : first;
    const rest = parts.slice(1).map((p) => `${p[0]}${"*".repeat(Math.max(0, p.length - 1))}`);
    return [maskedFirst, ...rest].join(" ");
};

export const verifyInvoice = async (req, res) => {
    try {
        const order = await Order.findOne({
            invoiceNumber: req.params.invoiceNumber,
        })
            .select("invoiceNumber customerName orderStatus payment createdAt totalAmount _id")
            .lean();

        if (!order) {
            return res.json({
                valid: false,
                message: "Invoice not found. This may be fake or tampered.",
            });
        }

        res.json({
            valid: true,
            invoiceNumber: order.invoiceNumber,
            orderId: `#${order._id.toString().slice(-8).toUpperCase()}`,
            customerName: maskName(order.customerName),
            orderStatus: order.orderStatus,
            paymentStatus: order.payment?.status,
            totalAmount: order.totalAmount,
            date: order.createdAt,
            message: "This is an authentic Urbexon invoice.",
        });

    } catch (err) {
        console.error("[Invoice] Verify error:", err);
        res.status(500).json({ success: false, message: "Verification failed" });
    }
};