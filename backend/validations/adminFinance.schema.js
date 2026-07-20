/**
 * adminFinance.schema.js — request-shape validation for the admin routes
 * that move money or change a vendor's approval/commission state
 * (adminRoutes.js). Previously none of these had any schema validation at
 * all — every field was read straight off req.body and trusted by the
 * controller. These schemas are deliberately permissive (loose bounds,
 * most fields optional) — they exist to reject the wrong *shape* (a
 * string where a number was required, a missing required field), not to
 * duplicate the business-rule checks the controllers already do
 * themselves (e.g. commissionRate's 0-50 range is still enforced in
 * vendorApproval.js — this schema just guarantees it's actually a number
 * before that check runs).
 */
import { z } from "zod";

export const approveVendorSchema = z.object({
    commissionRate: z.coerce.number().min(0).max(50).optional(),
    plan: z.string().max(50).optional(),
});

export const rejectVendorSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});

export const suspendVendorSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});

export const updateCommissionSchema = z.object({
    commissionRate: z.coerce.number().min(0).max(50),
});

// paymentRef is deliberately optional here, matching the existing admin UI
// (AdminSettlements.jsx's confirm button has no client-side "required" gate
// on this field today) — tightening it to mandatory would reject a
// previously-successful admin action, not just a malformed one.
export const markSettlementPaidSchema = z.object({
    paymentRef: z.string().trim().max(200).optional(),
    paymentMethod: z.enum(["bank_transfer", "upi", "cheque"]).optional(),
});

export const markBatchPaidSchema = markSettlementPaidSchema;

export const rejectPayoutSchema = z.object({
    reason: z.string().trim().min(1).max(500),
});

export const completePayoutSchema = z.object({
    paymentRef: z.string().trim().max(200).optional(),
    paymentMethod: z.enum(["bank_transfer", "upi"]).optional(),
    note: z.string().trim().max(500).optional(),
});

export const createWalletAdjustmentSchema = z.object({
    vendorId: z.string().min(1),
    amount: z.coerce.number().positive(),
    direction: z.enum(["credit", "debit"]),
    reason: z.string().trim().min(1).max(500),
});

export const rejectWalletAdjustmentSchema = z.object({
    reviewNotes: z.string().trim().max(500).optional(),
});
