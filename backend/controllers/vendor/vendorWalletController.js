/**
 * vendorWalletController.js — vendor-facing wallet reads. Every mutation
 * lives in services/vendorWalletService.js and is only ever triggered by
 * settlementManager.js/payoutController.js/walletAdjustmentController.js
 * — nothing here writes to the wallet. Ownership is enforced by scoping
 * every query to req.vendor._id (set by protectVendor), never by
 * accepting a vendorId from the client.
 */
import VendorWalletTransaction from "../../models/vendorModels/VendorWalletTransaction.js";
import * as walletService from "../../services/vendorWalletService.js";
import { sendCsv } from "../../utils/csvExport.js";

// GET /api/vendor/wallet — balance (direct field read, never aggregated) + lifetime summary
export const getMyWallet = async (req, res) => {
    try {
        const [walletBalance, summary] = await Promise.all([
            walletService.getBalance(req.vendor._id),
            walletService.getSummary(req.vendor._id),
        ]);
        res.json({ success: true, walletBalance, ...summary });
    } catch (err) {
        console.error("[getMyWallet]", err);
        res.status(500).json({ success: false, message: "Failed to fetch wallet" });
    }
};

// GET /api/vendor/wallet/transactions — paginated, filterable
export const getMyWalletTransactions = async (req, res) => {
    try {
        const { type, dateFrom, dateTo, page, limit } = req.query;
        const result = await walletService.getHistory(req.vendor._id, { type, dateFrom, dateTo, page, limit });
        res.json({ success: true, ...result });
    } catch (err) {
        console.error("[getMyWalletTransactions]", err);
        res.status(500).json({ success: false, message: "Failed to fetch transactions" });
    }
};

// GET /api/vendor/wallet/transactions/:id — ownership-checked via the
// query filter itself (vendorId must match), not a fetch-then-if check.
export const getMyWalletTransactionDetail = async (req, res) => {
    try {
        const entry = await VendorWalletTransaction.findOne({ _id: req.params.id, vendorId: req.vendor._id }).lean();
        if (!entry) return res.status(404).json({ success: false, message: "Transaction not found" });
        res.json({ success: true, transaction: entry });
    } catch (err) {
        console.error("[getMyWalletTransactionDetail]", err);
        res.status(500).json({ success: false, message: "Failed to fetch transaction" });
    }
};

// GET /api/vendor/wallet/export — CSV, date-range-bounded (max 12 months)
// to avoid an unbounded query against a high-volume vendor's full history.
export const exportMyWalletTransactions = async (req, res) => {
    try {
        let { dateFrom, dateTo, type } = req.query;
        const to = dateTo ? new Date(dateTo) : new Date();
        const from = dateFrom ? new Date(dateFrom) : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
        const maxRangeMs = 366 * 24 * 60 * 60 * 1000;
        if (to.getTime() - from.getTime() > maxRangeMs) {
            return res.status(400).json({ success: false, message: "Export date range cannot exceed 12 months" });
        }

        const filter = { vendorId: req.vendor._id, createdAt: { $gte: from, $lte: to } };
        if (type) filter.type = type;

        const entries = await VendorWalletTransaction.find(filter).sort({ createdAt: -1 }).limit(5000).lean();

        const rows = entries.map((e) => [
            new Date(e.createdAt).toISOString(),
            e.type,
            e.amount,
            e.balanceAfter,
            e.description || "",
            e.referenceType ? `${e.referenceType}:${e.referenceId}` : "",
        ]);

        sendCsv(res, `wallet-transactions-${Date.now()}.csv`, ["Date", "Type", "Amount", "Balance After", "Description", "Reference"], rows);
    } catch (err) {
        console.error("[exportMyWalletTransactions]", err);
        res.status(500).json({ success: false, message: "Failed to export transactions" });
    }
};
