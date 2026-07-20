/**
 * tests/vendorApproval.test.js — Vendor KYC/approval flow regression
 * coverage (audit finding C-5: this flow had zero automated tests despite
 * gating a vendor's ability to sell at all).
 *
 * Calls the exported controller functions directly with minimal req/res
 * doubles rather than going through supertest+admin-JWT auth — the thing
 * actually worth protecting here is the status-transition logic itself
 * (atomic double-approval guard, role sync, idempotency), which lives
 * entirely inside these functions regardless of how the request reached
 * them.
 */
import { jest } from "@jest/globals";
import { connectTestDB, disconnectTestDB } from "./helpers.js";

jest.mock("../services/notificationService.js", () => ({
    notifyVendorApplicationApproved: jest.fn().mockResolvedValue(),
    notifyVendorApplicationRejected: jest.fn().mockResolvedValue(),
    notifyVendorApplicationReceived: jest.fn().mockResolvedValue(),
    notifyUserWelcome: jest.fn().mockResolvedValue(),
}));
jest.mock("../utils/wsHub.js", () => ({
    broadcastToAdmins: jest.fn(),
    VENDOR_WS_EVENTS: { CREATED: "vendor_created", UPDATED: "vendor_updated" },
}));
jest.mock("../services/notificationEngine.js", () => ({
    notify: jest.fn().mockResolvedValue(),
    notifyMany: jest.fn().mockResolvedValue(),
}));

let Vendor, User, approveVendor, rejectVendor;

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const makePendingVendor = async () => {
    const user = await User.create({
        name: "KYC Test Owner",
        email: `kyc_owner_${Date.now()}_${Math.random().toString(36).slice(2)}@urbexon.com`,
        phone: "9876500000",
        password: "hashed-not-used-in-these-tests",
        role: "user",
        isEmailVerified: true,
    });
    const vendor = await Vendor.create({
        userId: user._id,
        shopName: `KYC Test Shop ${Date.now()}`,
        ownerName: "KYC Test Owner",
        email: user.email,
        phone: "9876500000",
        status: "pending",
    });
    return { user, vendor };
};

beforeAll(async () => {
    await connectTestDB();
    Vendor = (await import("../models/vendorModels/Vendor.js")).default;
    User = (await import("../models/User.js")).default;
    ({ approveVendor, rejectVendor } = await import("../controllers/admin/vendorApproval.js"));
});

afterAll(async () => {
    await disconnectTestDB();
});

describe("approveVendor()", () => {
    it("moves a pending vendor to approved and syncs User.role to vendor", async () => {
        const { user, vendor } = await makePendingVendor();
        const admin = await User.create({
            name: "KYC Admin", email: `kyc_admin_${Date.now()}@urbexon.com`, phone: "9000009999",
            password: "hashed", role: "admin", isEmailVerified: true,
        });

        const req = { params: { id: vendor._id.toString() }, user: { _id: admin._id }, body: {} };
        const res = mockRes();
        await approveVendor(req, res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const fresh = await Vendor.findById(vendor._id).lean();
        expect(fresh.status).toBe("approved");
        expect(fresh.approvedBy?.toString()).toBe(admin._id.toString());

        const freshUser = await User.findById(user._id).lean();
        expect(freshUser.role).toBe("vendor");
    });

    it("does not re-approve (or error) an already-approved vendor — idempotent", async () => {
        const { vendor } = await makePendingVendor();
        const admin = await User.create({
            name: "KYC Admin 2", email: `kyc_admin2_${Date.now()}@urbexon.com`, phone: "9000009998",
            password: "hashed", role: "admin", isEmailVerified: true,
        });

        const req = { params: { id: vendor._id.toString() }, user: { _id: admin._id }, body: {} };
        await approveVendor(req, mockRes());
        const afterFirst = await Vendor.findById(vendor._id).select("approvedAt").lean();

        // Second approve call on an already-approved vendor must not throw,
        // and must not silently re-run side effects — this is the exact
        // race the atomic {status: {$ne:"approved"}} guard exists for.
        await approveVendor(req, mockRes());
        const afterSecond = await Vendor.findById(vendor._id).select("status approvedAt").lean();

        expect(afterSecond.status).toBe("approved");
        expect(afterSecond.approvedAt.getTime()).toBe(afterFirst.approvedAt.getTime());
    });

    it("returns 404 for a vendor that doesn't exist", async () => {
        const admin = await User.create({
            name: "KYC Admin 3", email: `kyc_admin3_${Date.now()}@urbexon.com`, phone: "9000009997",
            password: "hashed", role: "admin", isEmailVerified: true,
        });
        const fakeId = new (await import("mongoose")).default.Types.ObjectId();
        const req = { params: { id: fakeId.toString() }, user: { _id: admin._id }, body: {} };
        const res = mockRes();
        await approveVendor(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe("rejectVendor()", () => {
    it("moves a pending vendor to rejected, records the reason, and demotes User.role back to user", async () => {
        const { user, vendor } = await makePendingVendor();
        const req = { params: { id: vendor._id.toString() }, body: { reason: "Incomplete documents" } };
        const res = mockRes();
        await rejectVendor(req, res);

        expect(res.status).not.toHaveBeenCalledWith(404);
        const fresh = await Vendor.findById(vendor._id).lean();
        expect(fresh.status).toBe("rejected");
        expect(fresh.rejectionReason).toBe("Incomplete documents");

        const freshUser = await User.findById(user._id).lean();
        expect(freshUser.role).toBe("user");
    });
});
