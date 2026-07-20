/**
 * vendorReturnController.js — vendor-facing reads over the existing
 * Order.return embedded subdocument. There is no separate ReturnRequest
 * collection and none is created here — returns/refunds already live on
 * Order (see orderController.js::requestReturn/processReturn), this file
 * only adds a vendor-scoped read layer on top, mirroring vendorOrders.js's
 * established scoping technique (Product.find({vendorId}).distinct("_id")
 * → Order.find({"items.productId": {$in: productIds}})) exactly.
 *
 * Security: unlike vendorOrders.js's buildVendorScopedOrder (which spreads
 * the full order, including payment/paymentLogs), every response here is
 * an explicit field whitelist — no payment gateway fields, no admin
 * approval metadata, ever reach the vendor.
 */
import Order from "../../models/Order.js";
import Product from "../../models/Product.js";
import { Settlement } from "../../models/vendorModels/Settlement.js";
import VendorWalletTransaction from "../../models/vendorModels/VendorWalletTransaction.js";
import { sendCsv } from "../../utils/csvExport.js";

const RETURN_STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "PICKED_UP", "REFUNDED"];

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildDateRangeFilter = (dateFrom, dateTo) => {
    if (!dateFrom && !dateTo) return null;
    const range = {};
    if (dateFrom) range.$gte = new Date(dateFrom);
    if (dateTo) range.$lte = new Date(dateTo);
    return range;
};

/**
 * Vendor-safe projection of one order's return/refund state. Deliberately
 * whitelists fields rather than spreading the order — order.payment,
 * order.paymentLogs, order.refund.razorpayRefundId and order.refund.
 * processedBy never appear here.
 */
const sanitizeReturnForVendor = (order, vendorProductIdSet) => {
    const items = (order.items || [])
        .filter((item) => vendorProductIdSet.has(String(item.productId)))
        .map((item) => ({
            productId: item.productId,
            name: item.name,
            image: item.image,
            price: item.price,
            qty: item.qty,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
        }));

    return {
        _id: order._id,
        invoiceNumber: order.invoiceNumber,
        customerName: order.customerName,
        orderStatus: order.orderStatus,
        orderMode: order.orderMode,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        items,
        return: {
            status: order.return?.status || "NONE",
            reason: order.return?.reason || "",
            images: order.return?.images || [],
            requestedAt: order.return?.requestedAt || null,
            deadlineAt: order.return?.deadlineAt || null,
            processedAt: order.return?.processedAt || null,
            refundAmount: order.return?.refundAmount || 0,
            // Already sent to the customer verbatim by email on every
            // processReturn action (orderController.js:1739) — safe to
            // surface to the vendor too, it isn't internal-only text.
            adminNote: order.return?.adminNote || "",
            trackingUrl: order.return?.trackingUrl || "",
        },
        refund: {
            status: order.refund?.status || "NONE",
            amount: order.refund?.amount || 0,
            requestedAt: order.refund?.requestedAt || null,
            processedAt: order.refund?.processedAt || null,
            rejectionReason: order.refund?.rejectionReason || "",
        },
        statusTimeline: order.statusTimeline || {},
    };
};

const buildReturnFilter = async ({ vendorId, status, dateFrom, dateTo, search }) => {
    const productIds = await Product.find({ vendorId }).distinct("_id");
    if (!productIds.length) return { filter: null, productIds: [] };

    const filter = { "items.productId": { $in: productIds }, "return.status": { $in: RETURN_STATUSES } };
    if (status && RETURN_STATUSES.includes(status)) filter["return.status"] = status;

    const dateRange = buildDateRangeFilter(dateFrom, dateTo);
    if (dateRange) filter["return.requestedAt"] = dateRange;

    if (search) {
        const escaped = escapeRegex(search.trim());
        filter.$or = [
            { invoiceNumber: { $regex: escaped, $options: "i" } },
            { customerName: { $regex: escaped, $options: "i" } },
        ];
    }

    return { filter, productIds };
};

/**
 * Detail-view projection — everything the list view has, plus phone (still
 * not payment data) and the read-only Settlement snapshot. Settlement will
 * be null for every real return today: settleAllVendorsForOrder() only
 * ever creates a Settlement for URBEXON_HOUR orders (settlementEngine.js:
 * 73), and requestReturn() blocks returns on URBEXON_HOUR orders entirely
 * (orderController.js:1444-1445) — those two rules make "a return with a
 * paid settlement" unreachable in the current system. The lookup stays
 * wired (one indexed findOne) so this field is genuinely "if it exists"
 * rather than a hardcoded null, and self-corrects if that policy ever
 * changes.
 */
// order.timeline is the codebase's real append-only audit trail (pushed by
// orderEngine.js::applyOrderTransition on orderStatus changes) — but
// return/refund transitions never push to it (confirmed: no $push/timeline
// write anywhere in requestReturn/processReturn), so it only has actor
// data for the DELIVERED step, not for return approve/reject/pickup/
// refund. Reusing what's actually there rather than inventing the rest.
const findDeliveredActorRole = (timeline) => {
    const entry = [...(timeline || [])].reverse().find((t) => t.status === "DELIVERED");
    return entry?.role || "";
};

const sanitizeReturnDetailForVendor = (order, vendorProductIdSet, settlement, walletAdjustment) => ({
    ...sanitizeReturnForVendor(order, vendorProductIdSet),
    phone: order.phone || "",
    deliveredByRole: findDeliveredActorRole(order.timeline),
    // Refund Method — the payment *method type* (RAZORPAY/COD), not
    // payment credentials. Distinct from the banned razorpayPaymentId/
    // signature fields; this is the same class of info already shown
    // elsewhere in the vendor panel (Earnings.jsx's payout method column).
    refundMethod: order.payment?.method || "",
    settlement: settlement ? {
        status: settlement.status,
        vendorEarning: settlement.vendorEarning,
        commissionRate: settlement.commissionRate,
        settlementDate: settlement.settlementDate,
        paymentMethod: settlement.paymentMethod,
    } : null,
    // Wallet Adjustment Status — Module 5 (wallet integration for returns)
    // is paused pending a product-policy decision (see design discussion):
    // Settlement only ever exists for URBEXON_HOUR orders, which can never
    // have a return, so this resolves to "not_applicable" for every real
    // return today. The lookup itself is real, not hardcoded, so it
    // activates automatically once/if that policy changes.
    walletAdjustmentStatus: !settlement ? "not_applicable" : (walletAdjustment ? "applied" : "not_applied"),
});

// GET /api/vendor/returns/:orderId — single return detail, ownership
// enforced the same way as getVendorOrderById (query-filter-as-guard: the
// order must contain at least one of this vendor's products).
export const getMyReturnDetail = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const productIds = await Product.find({ vendorId }).distinct("_id");
        if (!productIds.length) return res.status(404).json({ success: false, message: "Return not found" });

        const order = await Order.findById(req.params.orderId)
            .select("invoiceNumber customerName phone orderStatus orderMode totalAmount createdAt items return refund statusTimeline payment.method timeline")
            .lean();
        if (!order) return res.status(404).json({ success: false, message: "Return not found" });
        if (!order.return?.status || order.return.status === "NONE") {
            return res.status(404).json({ success: false, message: "This order has no return request" });
        }

        const vendorProductIdSet = new Set(productIds.map(String));
        const hasVendorItem = (order.items || []).some((item) => vendorProductIdSet.has(String(item.productId)));
        if (!hasVendorItem) return res.status(403).json({ success: false, message: "Not authorized to view this return" });

        const settlement = await Settlement.findOne({ orderId: order._id })
            .select("status vendorEarning commissionRate settlementDate paymentMethod")
            .lean();
        const walletAdjustment = settlement
            ? await VendorWalletTransaction.findOne({ referenceType: "Settlement", referenceId: settlement._id, type: "refund_adjustment" }).select("_id").lean()
            : null;

        res.json({ success: true, return: sanitizeReturnDetailForVendor(order, vendorProductIdSet, settlement, walletAdjustment) });
    } catch (err) {
        console.error("[getMyReturnDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch return detail" });
    }
};

// GET /api/vendor/returns — paginated, filterable, with per-status counts
// for the dashboard's status tabs.
export const getMyReturns = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { status, dateFrom, dateTo, search, page = 1, limit = 20 } = req.query;

        const { filter, productIds } = await buildReturnFilter({ vendorId, status, dateFrom, dateTo, search });
        if (!filter) {
            return res.json({
                success: true, returns: [],
                stats: { requested: 0, approved: 0, rejected: 0, pickedUp: 0, refunded: 0, total: 0 },
                total: 0, page: Number(page), pages: 0,
            });
        }

        const vendorProductIdSet = new Set(productIds.map(String));
        const skip = (Number(page) - 1) * Number(limit);

        // Stats match every one of this vendor's returns regardless of the
        // current status/date/search filter (so tab counts don't shift
        // under the user while they filter) — only re-scoped to vendorId.
        const statsMatch = { "items.productId": { $in: productIds }, "return.status": { $in: RETURN_STATUSES } };

        const [orders, total, statsAgg] = await Promise.all([
            Order.find(filter)
                .select("invoiceNumber customerName orderStatus orderMode totalAmount createdAt items return refund statusTimeline")
                .sort({ "return.requestedAt": -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Order.countDocuments(filter),
            Order.aggregate([
                { $match: statsMatch },
                { $group: { _id: "$return.status", count: { $sum: 1 } } },
            ]),
        ]);

        const statsByStatus = Object.fromEntries(statsAgg.map((s) => [s._id, s.count]));
        const stats = {
            requested: statsByStatus.REQUESTED || 0,
            approved: statsByStatus.APPROVED || 0,
            rejected: statsByStatus.REJECTED || 0,
            pickedUp: statsByStatus.PICKED_UP || 0,
            refunded: statsByStatus.REFUNDED || 0,
        };
        stats.total = stats.requested + stats.approved + stats.rejected + stats.pickedUp + stats.refunded;

        res.json({
            success: true,
            returns: orders.map((o) => sanitizeReturnForVendor(o, vendorProductIdSet)),
            stats,
            total, page: Number(page), pages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error("[getMyReturns]", err);
        res.status(500).json({ success: false, message: "Failed to fetch returns" });
    }
};

// GET /api/vendor/returns/export — CSV, same filter set as the list view.
// Reuses buildReturnFilter so the exported rows always match what the
// vendor is currently looking at — no separate export-specific query logic.
export const exportMyReturns = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { status, dateFrom, dateTo, search } = req.query;

        const { filter, productIds } = await buildReturnFilter({ vendorId, status, dateFrom, dateTo, search });
        const vendorProductIdSet = new Set(productIds.map(String));

        const rows = [];
        if (filter) {
            const orders = await Order.find(filter)
                .select("invoiceNumber customerName items return refund")
                .sort({ "return.requestedAt": -1 })
                .limit(5000)
                .lean();
            for (const o of orders) {
                const safe = sanitizeReturnForVendor(o, vendorProductIdSet);
                rows.push([
                    safe.invoiceNumber || safe._id,
                    safe.customerName || "",
                    safe.return.requestedAt ? new Date(safe.return.requestedAt).toISOString() : "",
                    safe.return.status,
                    safe.refund.status,
                    safe.return.refundAmount,
                    safe.return.reason || "",
                ]);
            }
        }

        sendCsv(res, `vendor-returns-${Date.now()}.csv`, ["Order", "Customer", "Requested At", "Status", "Refund Status", "Refund Amount", "Reason"], rows);
    } catch (err) {
        console.error("[exportMyReturns]", err);
        res.status(500).json({ success: false, message: "Failed to export returns" });
    }
};
