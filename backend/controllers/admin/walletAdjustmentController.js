/**
 * walletAdjustmentController.js — admin read access to vendor wallets, and
 * the maker-checker workflow for manual wallet adjustments.
 *
 * Thin orchestration only — every actual balance mutation happens inside
 * services/vendorWalletService.js::manualAdjustment(). This controller
 * never writes to VendorWalletTransaction or Vendor.walletBalance
 * directly, and never approves its own requests (enforced inside the
 * service, not just here, so the rule can't be bypassed by a second
 * caller of the service).
 */
import Vendor from "../../models/vendorModels/Vendor.js";
import ApprovalRequest from "../../models/ApprovalRequest.js";
import * as walletService from "../../services/vendorWalletService.js";

// GET /api/admin/vendors/:id/wallet — read-only, any vendor
export const getVendorWalletAdmin = async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.id).select("shopName ownerName walletBalance").lean();
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const { type, dateFrom, dateTo, page, limit } = req.query;
        const [summary, history] = await Promise.all([
            walletService.getSummary(vendor._id),
            walletService.getHistory(vendor._id, { type, dateFrom, dateTo, page, limit }),
        ]);

        res.json({ success: true, vendor: { _id: vendor._id, shopName: vendor.shopName, ownerName: vendor.ownerName }, walletBalance: vendor.walletBalance, summary, ...history });
    } catch (err) {
        console.error("[getVendorWalletAdmin]", err);
        res.status(500).json({ success: false, message: "Failed to fetch vendor wallet" });
    }
};

// GET /api/admin/wallet-adjustments?status=PENDING
// Not explicitly listed in the spec, but a required minimum for the
// approve/reject endpoints below to be reachable at all — without a way
// to list pending requests there is no way to discover an :id to act on.
export const listWalletAdjustments = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const filter = { type: "WALLET_ADJUSTMENT" };
        if (status) filter.status = status;

        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(50, parseInt(limit) || 20);

        const [requests, total] = await Promise.all([
            ApprovalRequest.find(filter)
                .populate("requestedBy", "name email")
                .populate("reviewedBy", "name email")
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .lean(),
            ApprovalRequest.countDocuments(filter),
        ]);

        // targetId is Mixed (vendorId) — populate manually since it's not
        // a real ref path (ApprovalRequest.targetId is deliberately
        // loosely-typed to also carry Order/Settlement ids for its other
        // reserved types, so it can't be a schema-level ref).
        const vendorIds = [...new Set(requests.map((r) => String(r.targetId)))];
        const vendors = await Vendor.find({ _id: { $in: vendorIds } }).select("shopName ownerName").lean();
        const vendorMap = Object.fromEntries(vendors.map((v) => [String(v._id), v]));
        const enriched = requests.map((r) => ({ ...r, vendor: vendorMap[String(r.targetId)] || null }));

        res.json({ success: true, requests: enriched, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error("[listWalletAdjustments]", err);
        res.status(500).json({ success: false, message: "Failed to fetch wallet adjustments" });
    }
};

// POST /api/admin/wallet-adjustments — creates the request only, never
// touches the wallet. Money moves only on approval (see below).
export const createWalletAdjustmentRequest = async (req, res) => {
    try {
        const { vendorId, amount, direction, reason } = req.body;

        if (!["credit", "debit"].includes(direction)) {
            return res.status(400).json({ success: false, message: "direction must be 'credit' or 'debit'" });
        }
        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
            return res.status(400).json({ success: false, message: "amount must be a positive number" });
        }
        if (!reason?.trim()) {
            return res.status(400).json({ success: false, message: "reason is required" });
        }

        const vendor = await Vendor.findById(vendorId).select("_id").lean();
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        const request = await ApprovalRequest.create({
            type: "WALLET_ADJUSTMENT",
            status: "PENDING",
            requestedBy: req.user._id,
            targetId: vendor._id,
            amount: numAmount,
            reason: reason.trim().slice(0, 500),
            payload: { direction },
        });

        res.status(201).json({ success: true, request });
    } catch (err) {
        console.error("[createWalletAdjustmentRequest]", err);
        res.status(500).json({ success: false, message: "Failed to create adjustment request" });
    }
};

// PATCH /api/admin/wallet-adjustments/:id/approve
// MAKER-CHECKER: the actual "requester != approver" enforcement lives
// inside walletService.manualAdjustment() so it can never be bypassed by
// some future second caller of the service — this route just surfaces
// the service's decision as the right HTTP status.
export const approveWalletAdjustment = async (req, res) => {
    try {
        const { entry, walletBalance, approvalRequest } = await walletService.manualAdjustment({
            approvalRequestId: req.params.id,
            approvedBy: req.user._id,
        });
        res.json({ success: true, message: "Adjustment approved and applied", entry, walletBalance, approvalRequest });
    } catch (err) {
        console.error("[approveWalletAdjustment]", err);
        const statusByCode = {
            NOT_FOUND: 404,
            WRONG_TYPE: 400,
            ALREADY_DECIDED: 409,
            SELF_APPROVAL_BLOCKED: 403,
            INSUFFICIENT_BALANCE: 400,
            VENDOR_NOT_FOUND: 404,
        };
        res.status(statusByCode[err.code] || 500).json({ success: false, message: err.message || "Failed to approve adjustment" });
    }
};

// PATCH /api/admin/wallet-adjustments/:id/reject — no ledger write, single
// document, no session needed.
export const rejectWalletAdjustment = async (req, res) => {
    try {
        const { reviewNotes } = req.body;

        const claimed = await ApprovalRequest.findOneAndUpdate(
            { _id: req.params.id, type: "WALLET_ADJUSTMENT", status: "PENDING" },
            { $set: { status: "REJECTED", reviewedBy: req.user._id, reviewedAt: new Date(), reviewNotes: (reviewNotes || "").trim().slice(0, 500) } },
            { new: true }
        );

        if (!claimed) {
            const existing = await ApprovalRequest.findById(req.params.id).lean();
            if (!existing) return res.status(404).json({ success: false, message: "Adjustment request not found" });
            return res.status(409).json({ success: false, message: `Request already ${existing.status.toLowerCase()}` });
        }

        res.json({ success: true, message: "Adjustment rejected", request: claimed });
    } catch (err) {
        console.error("[rejectWalletAdjustment]", err);
        res.status(500).json({ success: false, message: "Failed to reject adjustment" });
    }
};
