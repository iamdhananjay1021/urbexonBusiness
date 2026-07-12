/**
 * Vendor / Admin / Delivery panel login endpoints — role filters are the
 * core security boundary between the four apps.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("panel login role filters", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("vendor login accepts the vendor account", async ({ api }) => {
        const res = await api.post(EP.vendorLogin, {
            data: { email: USERS.vendor.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.user.role).toBe("vendor");
        // role-filtered login must report application status for panel routing
        expect(body).toHaveProperty("vendorApplicationStatus");
    });

    test("vendor login REJECTS a customer account (role filter)", async ({ api }) => {
        // Regression guard: /api/vendor/login was wired to the generic login
        // (no role filter) — any customer could obtain a vendor-panel session.
        const res = await api.post(EP.vendorLogin, {
            data: { email: USERS.customer.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(403);
        expect((await res.json()).message).toMatch(/not a vendor/i);
    });

    test("delivery login accepts the delivery account with application status", async ({ api }) => {
        const res = await api.post(EP.deliveryLogin, {
            data: { email: USERS.delivery.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.user.role).toBe("delivery_boy");
        expect(body).toHaveProperty("deliveryApplicationStatus");
        expect(body.deliveryApplicationStatus).toBe("approved");
    });

    test("delivery login REJECTS a customer account", async ({ api }) => {
        const res = await api.post(EP.deliveryLogin, {
            data: { email: USERS.customer.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(403);
    });

    test("admin login accepts the admin account", async ({ api }) => {
        const res = await api.post(EP.adminLogin, {
            data: { email: USERS.admin.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(200);
        expect((await res.json()).user.role).toBe("admin");
    });

    test("admin login REJECTS a customer account", async ({ api }) => {
        const res = await api.post(EP.adminLogin, {
            data: { email: USERS.customer.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(403);
    });
});
