/**
 * maskBankDetails.js — shared bank-account masking.
 *
 * [FIX] Extracted from controllers/admin/payoutController.js (previously a
 * local, unexported helper) so controllers/vendor/bankDetailsController.js
 * can reuse it instead of echoing a freshly-saved, fully unmasked
 * accountNumber straight back in the API response.
 */

// Mask bank account number — show only last 4 digits
export const maskAccountNumber = (num) => {
    if (!num || num.length <= 4) return num || "";
    return "X".repeat(num.length - 4) + num.slice(-4);
};

export const maskBankDetails = (bd) => {
    if (!bd) return {};
    return {
        ...bd,
        accountNumber: maskAccountNumber(bd.accountNumber),
    };
};
