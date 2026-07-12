/**
 * Edge cases — browser refresh persistence, expired/tampered JWT, duplicate
 * requests (idempotency of validation), and network-failure resilience.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";
import { ProfilePage } from "../../pageObjects/client/ClientPages";

test.describe("session persistence across refresh", () => {
    test.beforeEach(({ requireApps }) => requireApps("client", "api"));

    test("authenticated customer stays logged in after a full page reload", async ({ customerPage }) => {
        const profile = new ProfilePage(customerPage);
        await profile.open();
        await expect(customerPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
        await customerPage.reload({ waitUntil: "domcontentloaded" });
        // localStorage-backed session must survive reload (not bounce to login)
        await expect(customerPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });
});

test.describe("JWT edge cases", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("expired-shaped token is rejected", async ({ api }) => {
        // exp in the past
        const expired =
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
            Buffer.from(JSON.stringify({ id: "x", role: "user", exp: 1000 })).toString("base64url") +
            ".sig";
        const res = await api.get(EP.profile, { headers: { Authorization: `Bearer ${expired}` } });
        expect(res.status()).toBe(401);
    });

    test("garbage Authorization header is rejected", async ({ api }) => {
        const res = await api.get(EP.profile, { headers: { Authorization: "Bearer not.a.jwt" } });
        expect(res.status()).toBe(401);
    });

    test("missing Authorization header → 401 token missing", async ({ api }) => {
        const res = await api.get(EP.profile);
        expect(res.status()).toBe(401);
    });
});

test.describe("duplicate request handling", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("duplicate invalid orders both rejected identically (deterministic validation)", async ({ customerApi }) => {
        const bad = { items: [], customerName: "X", phone: "12345", address: "a", paymentMethod: "COD" };
        const [a, b] = await Promise.all([
            customerApi.post(EP.orders, { data: bad }),
            customerApi.post(EP.orders, { data: bad }),
        ]);
        expect(a.status()).toBe(b.status());
        expect(a.status()).toBe(400);
    });
});
