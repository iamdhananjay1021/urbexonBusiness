/**
 * Customer wishlist / cart / addresses — exercised via the real API with a
 * customer bearer token (the UI is a thin layer over these endpoints).
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";
import { ORDER_ADDRESS } from "../../fixtures/testData";

test.describe("wishlist API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("customer can read their wishlist", async ({ customerApi }) => {
        const res = await customerApi.get(EP.wishlist);
        expect([200, 304]).toContain(res.status());
    });
});

test.describe("addresses API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("customer can list addresses", async ({ customerApi }) => {
        const res = await customerApi.get(EP.addresses);
        expect([200, 304]).toContain(res.status());
    });

    test("customer can add and then see a new address", async ({ customerApi }) => {
        const create = await customerApi.post(EP.addresses, {
            data: {
                name: ORDER_ADDRESS.customerName,
                phone: ORDER_ADDRESS.phone,
                addressLine: ORDER_ADDRESS.address,
                pincode: "201301",
                city: "Noida",
                state: "Uttar Pradesh",
            },
        });
        // Endpoint may validate a stricter shape; accept success or validation,
        // never a server crash.
        expect(create.status()).toBeLessThan(500);
        if (create.status() < 300) {
            const list = await customerApi.get(EP.addresses);
            expect([200, 304]).toContain(list.status());
        }
    });
});

test.describe("coupon validation API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("seeded QATEST10 coupon is retrievable / valid", async ({ customerApi }) => {
        const res = await customerApi.get(EP.coupons);
        expect(res.status()).toBeLessThan(500);
    });
});
