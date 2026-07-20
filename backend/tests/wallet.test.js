/**
 * tests/wallet.test.js — Vendor Wallet Ledger regression coverage.
 *
 * Exercises services/vendorWalletService.js directly (unit-style, not via
 * HTTP) — this is the ONLY place allowed to write to VendorWalletTransaction
 * or mutate Vendor.walletBalance, and previously had zero automated coverage
 * despite being the app's actual money-movement logic (see audit finding
 * C-5). Covers: credit/debit balance math, the negative-balance guard, the
 * idempotency unique index, and the maker-checker rule on manual
 * adjustments (an approver can never be the same admin who requested the
 * adjustment).
 *
 * Uses a mongoose session WITHOUT calling startTransaction() — credit()/
 * debit() only require a session to be passed through to each write, and
 * this keeps the suite runnable against a standalone MongoDB (no replica
 * set required), matching the existing test suite's own MONGO_URI setup in
 * tests/helpers.js. It exercises the same production code paths; only the
 * cross-document atomicity guarantee (irrelevant to the assertions below,
 * which each check one write's outcome) is not exercised here.
 */
import { jest } from "@jest/globals";
import mongoose from "mongoose";
import { connectTestDB, disconnectTestDB } from "./helpers.js";

jest.mock("../config/redis.js", () => ({
    connectRedis: jest.fn(),
    getRedis: jest.fn().mockReturnValue(null),
    isRedisUp: jest.fn().mockReturnValue(false),
}));

let Vendor, User, VendorWalletTransaction, ApprovalRequest, walletService;

const makeVendor = async (overrides = {}) => {
    const user = await User.create({
        name: "Wallet Test Owner",
        email: `wallet_owner_${Date.now()}_${Math.random().toString(36).slice(2)}@urbexon.com`,
        phone: "9876543210",
        password: "hashed-not-used-in-these-tests",
        role: "vendor",
        isEmailVerified: true,
    });
    return Vendor.create({
        userId: user._id,
        shopName: `Wallet Test Shop ${Date.now()}`,
        ownerName: "Wallet Test Owner",
        email: user.email,
        phone: "9876543210",
        commissionRate: 18,
        status: "approved",
        walletBalance: 0,
        ...overrides,
    });
};

beforeAll(async () => {
    await connectTestDB();
    Vendor = (await import("../models/vendorModels/Vendor.js")).default;
    User = (await import("../models/User.js")).default;
    VendorWalletTransaction = (await import("../models/vendorModels/VendorWalletTransaction.js")).default;
    ApprovalRequest = (await import("../models/ApprovalRequest.js")).default;
    walletService = await import("../services/vendorWalletService.js");
});

afterAll(async () => {
    await disconnectTestDB();
});

describe("vendorWalletService.credit()", () => {
    it("increases walletBalance and writes a ledger entry with the correct balanceAfter", async () => {
        const vendor = await makeVendor();
        const session = await mongoose.startSession();

        const { entry, walletBalance } = await walletService.credit(session, {
            vendorId: vendor._id,
            amount: 500,
            type: "manual_credit",
            description: "test credit",
        });
        await session.endSession();

        expect(walletBalance).toBe(500);
        expect(entry.balanceAfter).toBe(500);
        expect(entry.amount).toBe(500);

        const fresh = await Vendor.findById(vendor._id).select("walletBalance").lean();
        expect(fresh.walletBalance).toBe(500);
    });

    it("throws VENDOR_NOT_FOUND for a non-existent vendor", async () => {
        const session = await mongoose.startSession();
        await expect(
            walletService.credit(session, { vendorId: new mongoose.Types.ObjectId(), amount: 100, type: "manual_credit" })
        ).rejects.toMatchObject({ code: "VENDOR_NOT_FOUND" });
        await session.endSession();
    });
});

describe("vendorWalletService.debit()", () => {
    it("decreases walletBalance when sufficient funds exist", async () => {
        const vendor = await makeVendor({ walletBalance: 1000 });
        const session = await mongoose.startSession();

        const { walletBalance } = await walletService.debit(session, {
            vendorId: vendor._id,
            amount: 300,
            type: "withdrawal_debit",
        });
        await session.endSession();

        expect(walletBalance).toBe(700);
    });

    it("throws INSUFFICIENT_BALANCE rather than letting the balance go negative", async () => {
        const vendor = await makeVendor({ walletBalance: 100 });
        const session = await mongoose.startSession();

        await expect(
            walletService.debit(session, { vendorId: vendor._id, amount: 500, type: "withdrawal_debit" })
        ).rejects.toMatchObject({ code: "INSUFFICIENT_BALANCE" });
        await session.endSession();

        const fresh = await Vendor.findById(vendor._id).select("walletBalance").lean();
        expect(fresh.walletBalance).toBe(100); // unchanged — the failed debit must not partially apply
    });
});

describe("vendorWalletService idempotency (unique referenceType+referenceId+type index)", () => {
    it("rejects a second credit for the same {referenceType, referenceId, type}", async () => {
        const vendor = await makeVendor();
        const referenceId = new mongoose.Types.ObjectId();

        const s1 = await mongoose.startSession();
        await walletService.credit(s1, {
            vendorId: vendor._id, amount: 200, type: "settlement_credit",
            referenceType: "Settlement", referenceId,
        });
        await s1.endSession();

        const s2 = await mongoose.startSession();
        await expect(
            walletService.credit(s2, {
                vendorId: vendor._id, amount: 200, type: "settlement_credit",
                referenceType: "Settlement", referenceId,
            })
        ).rejects.toThrow(); // E11000 duplicate key — the DB constraint is the actual idempotency guard
        await s2.endSession();

        const count = await VendorWalletTransaction.countDocuments({ vendorId: vendor._id, referenceId, type: "settlement_credit" });
        expect(count).toBe(1); // exactly one credit was ever recorded for this settlement
    });
});

describe("vendorWalletService.manualAdjustment() — maker-checker", () => {
    it("blocks an admin from approving their own adjustment request", async () => {
        const vendor = await makeVendor();
        const admin = await User.create({
            name: "Admin One", email: `admin1_${Date.now()}@urbexon.com`, phone: "9000000001",
            password: "hashed", role: "admin", isEmailVerified: true,
        });

        const request = await ApprovalRequest.create({
            type: "WALLET_ADJUSTMENT", status: "PENDING",
            requestedBy: admin._id, targetId: vendor._id,
            amount: 250, reason: "Test self-approval block", payload: { direction: "credit" },
        });

        await expect(
            walletService.manualAdjustment({ approvalRequestId: request._id, approvedBy: admin._id })
        ).rejects.toMatchObject({ code: "SELF_APPROVAL_BLOCKED" });

        const stillPending = await ApprovalRequest.findById(request._id).lean();
        expect(stillPending.status).toBe("PENDING"); // the block must happen before any state change
    });

    it("applies the credit and marks the request APPROVED when a different admin approves", async () => {
        const vendor = await makeVendor({ walletBalance: 0 });
        const requester = await User.create({
            name: "Admin Requester", email: `admin_req_${Date.now()}@urbexon.com`, phone: "9000000002",
            password: "hashed", role: "admin", isEmailVerified: true,
        });
        const approver = await User.create({
            name: "Admin Approver", email: `admin_appr_${Date.now()}@urbexon.com`, phone: "9000000003",
            password: "hashed", role: "admin", isEmailVerified: true,
        });

        const request = await ApprovalRequest.create({
            type: "WALLET_ADJUSTMENT", status: "PENDING",
            requestedBy: requester._id, targetId: vendor._id,
            amount: 400, reason: "Test two-party approval", payload: { direction: "credit" },
        });

        const { walletBalance, approvalRequest } = await walletService.manualAdjustment({
            approvalRequestId: request._id, approvedBy: approver._id,
        });

        expect(walletBalance).toBe(400);
        expect(approvalRequest.status).toBe("APPROVED");

        const fresh = await Vendor.findById(vendor._id).select("walletBalance").lean();
        expect(fresh.walletBalance).toBe(400);
    });

    it("rejects approving the same request twice", async () => {
        const vendor = await makeVendor();
        const requester = await User.create({
            name: "Admin R2", email: `admin_r2_${Date.now()}@urbexon.com`, phone: "9000000004",
            password: "hashed", role: "admin", isEmailVerified: true,
        });
        const approver = await User.create({
            name: "Admin A2", email: `admin_a2_${Date.now()}@urbexon.com`, phone: "9000000005",
            password: "hashed", role: "admin", isEmailVerified: true,
        });
        const request = await ApprovalRequest.create({
            type: "WALLET_ADJUSTMENT", status: "PENDING",
            requestedBy: requester._id, targetId: vendor._id,
            amount: 150, reason: "Test double-approve guard", payload: { direction: "credit" },
        });

        await walletService.manualAdjustment({ approvalRequestId: request._id, approvedBy: approver._id });

        await expect(
            walletService.manualAdjustment({ approvalRequestId: request._id, approvedBy: approver._id })
        ).rejects.toMatchObject({ code: "ALREADY_DECIDED" });
    });
});

describe("vendorWalletService.getBalance() / getSummary()", () => {
    it("getBalance reads the field directly and matches credits minus debits", async () => {
        const vendor = await makeVendor();
        const s1 = await mongoose.startSession();
        await walletService.credit(s1, { vendorId: vendor._id, amount: 1000, type: "manual_credit" });
        await s1.endSession();
        const s2 = await mongoose.startSession();
        await walletService.debit(s2, { vendorId: vendor._id, amount: 300, type: "manual_debit" });
        await s2.endSession();

        const balance = await walletService.getBalance(vendor._id);
        expect(balance).toBe(700);
    });

    it("getSummary aggregates lifetime totals, independent of the current balance", async () => {
        const vendor = await makeVendor();
        const s1 = await mongoose.startSession();
        await walletService.credit(s1, { vendorId: vendor._id, amount: 600, type: "manual_credit" });
        await s1.endSession();
        const s2 = await mongoose.startSession();
        await walletService.debit(s2, { vendorId: vendor._id, amount: 200, type: "manual_debit" });
        await s2.endSession();

        const summary = await walletService.getSummary(vendor._id);
        expect(summary.totalCredited).toBe(600);
        expect(summary.totalDebited).toBe(200);
        expect(summary.transactionCount).toBe(2);
    });
});
