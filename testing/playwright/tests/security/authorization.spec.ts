/**
 * Authorization boundaries — unauthenticated access, role protection,
 * route protection. All against real protected routes.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";

test.describe("unauthenticated access is rejected", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    const protectedGets = [
        EP.profile,
        EP.myOrders,
        EP.vendorOrders,
        EP.deliveryStatus,
        EP.adminDashboard,
        EP.adminUsers,
        EP.wishlist,
        EP.addresses,
    ];

    for (const route of protectedGets) {
        test(`GET ${route} without token → 401`, async ({ api }) => {
            const res = await api.get(route);
            expect(res.status()).toBe(401);
        });
    }

    test("POST /orders without token → 401", async ({ api }) => {
        const res = await api.post(EP.orders, { data: {} });
        expect(res.status()).toBe(401);
    });
});

test.describe("role protection between panels", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("customer token CANNOT read admin dashboard → 403", async ({ customerApi }) => {
        const res = await customerApi.get(EP.adminDashboard);
        expect(res.status()).toBe(403);
    });

    test("customer token CANNOT list all users (admin only) → 403", async ({ customerApi }) => {
        const res = await customerApi.get(EP.adminUsers);
        expect(res.status()).toBe(403);
    });

    test("customer token CANNOT access delivery status (delivery only) → 403", async ({ customerApi }) => {
        const res = await customerApi.get(EP.deliveryStatus);
        expect(res.status()).toBe(403);
    });

    test("vendor token CANNOT reach admin routes → 403", async ({ vendorApi }) => {
        const res = await vendorApi.get(EP.adminUsers);
        expect(res.status()).toBe(403);
    });

    test("delivery token CANNOT reach admin routes → 403", async ({ deliveryApi }) => {
        const res = await deliveryApi.get(EP.adminUsers);
        expect(res.status()).toBe(403);
    });

    test("admin token CAN read admin dashboard → 200", async ({ adminApi }) => {
        const res = await adminApi.get(EP.adminDashboard);
        expect([200, 304]).toContain(res.status());
    });
});
