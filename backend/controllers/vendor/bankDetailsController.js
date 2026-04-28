/**
 * bankDetailsController.js — Vendor & Delivery Bank Management
 * Save bank details for payouts
 */

import Vendor from "../../models/vendorModels/Vendor.js";
import DeliveryBoy from "../../models/deliveryModels/DeliveryBoy.js";

// ══════════════════════════════════════════════════════════════
// VENDOR — Update bank details
// PATCH /api/vendor/bank-details
// ══════════════════════════════════════════════════════════════
export const updateVendorBankDetails = async (req, res) => {
    try {
        const { accountHolder, accountNumber, ifsc, bankName, upiId } = req.body;

        // At least bank OR UPI required
        if (!accountNumber && !upiId) {
            return res.status(400).json({ success: false, message: "Provide bank account OR UPI ID" });
        }

        // IFSC validation — only validate if account number AND ifsc are provided
        if (accountNumber && ifsc) {
            const ifscCode = ifsc?.trim()?.toUpperCase();

            // Check if user used letter O instead of zero
            if (ifscCode.includes("O") && ifscCode.length === 11) {
                const corrected = ifscCode.replace(/O/g, "0");
                if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(corrected)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid IFSC: contains letter "O" instead of digit "0". Did you mean: ${corrected}?`
                    });
                }
            }

            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid IFSC format. Must be: 4 letters + 0 (zero) + 6 characters. Example: SBIN0001234"
                });
            }
        }

        const vendor = await Vendor.findById(req.vendor._id);
        if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

        if (accountHolder !== undefined) vendor.set("bankDetails.accountHolder", accountHolder?.trim()?.slice(0, 100) || "");
        if (accountNumber !== undefined) vendor.set("bankDetails.accountNumber", accountNumber?.trim()?.slice(0, 20) || "");
        if (ifsc !== undefined) vendor.set("bankDetails.ifsc", ifsc?.trim()?.toUpperCase()?.slice(0, 11) || "");
        if (bankName !== undefined) vendor.set("bankDetails.bankName", bankName?.trim()?.slice(0, 100) || "");
        if (upiId !== undefined) vendor.set("bankDetails.upiId", upiId?.trim()?.slice(0, 80) || "");

        await vendor.save();

        res.json({
            success: true,
            message: "Bank details updated for payouts",
            bankDetails: vendor.bankDetails
        });
    } catch (err) {
        console.error("[updateVendorBankDetails]", err);
        res.status(500).json({ success: false, message: "Failed to update bank details" });
    }
};

// ══════════════════════════════════════════════════════════════
// DELIVERY — Update bank details  
// PATCH /api/delivery/bank-details
// ══════════════════════════════════════════════════════════════
export const updateDeliveryBankDetails = async (req, res) => {
    try {
        const { accountHolder, accountNumber, ifsc, bankName, upiId } = req.body;

        if (!accountNumber && !upiId) {
            return res.status(400).json({ success: false, message: "Provide bank account OR UPI ID" });
        }

        // IFSC validation — only validate if account number AND ifsc are provided
        if (accountNumber && ifsc) {
            const ifscCode = ifsc?.trim()?.toUpperCase();

            // Check if user used letter O instead of zero
            if (ifscCode.includes("O") && ifscCode.length === 11) {
                const corrected = ifscCode.replace(/O/g, "0");
                if (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(corrected)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid IFSC: contains letter "O" instead of digit "0". Did you mean: ${corrected}?`
                    });
                }
            }

            if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid IFSC format. Must be: 4 letters + 0 (zero) + 6 characters. Example: SBIN0001234"
                });
            }
        }

        const rider = await DeliveryBoy.findOne({ userId: req.user._id });
        if (!rider) return res.status(404).json({ success: false, message: "Not found" });

        if (accountHolder !== undefined) rider.set("bankDetails.accountHolder", accountHolder?.trim()?.slice(0, 100) || "");
        if (accountNumber !== undefined) rider.set("bankDetails.accountNumber", accountNumber?.trim()?.slice(0, 20) || "");
        if (ifsc !== undefined) rider.set("bankDetails.ifsc", ifsc?.trim()?.toUpperCase()?.slice(0, 11) || "");
        if (bankName !== undefined) rider.set("bankDetails.bankName", bankName?.trim()?.slice(0, 100) || "");
        if (upiId !== undefined) rider.set("bankDetails.upiId", upiId?.trim()?.slice(0, 80) || "");

        await rider.save();

        res.json({
            success: true,
            message: "Bank details updated for payouts",
            bankDetails: rider.bankDetails
        });
    } catch (err) {
        console.error("[updateDeliveryBankDetails]", err);
        res.status(500).json({ success: false, message: "Failed to update bank details" });
    }
};

