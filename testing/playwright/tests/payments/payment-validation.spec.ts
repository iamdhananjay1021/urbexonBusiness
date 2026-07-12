/**
 * Payment method validation on order creation — the real createOrder
 * enforces paymentMethod ∈ {COD, RAZORPAY} plus phone/name/address rules.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";
import { resolveQaProductId, buildOrder } from "../../helpers/orderHelper";
import { ORDER_ADDRESS } from "../../fixtures/testData";

test.describe("payment & order-input validation", () => {
    let productId: string | null = null;

    test.beforeAll(async ({ requireApps }) => requireApps("api"));
    test.beforeEach(async ({ api }) => {
        if (!productId) productId = await resolveQaProductId(api);
    });

    test("invalid paymentMethod → 400", async ({ customerApi }) => {
        test.skip(!productId, "no product id");
        const res = await customerApi.post(EP.orders, {
            data: { ...buildOrder(productId!), paymentMethod: "BITCOIN" as any },
        });
        expect(res.status()).toBe(400);
    });

    test("invalid phone pattern → 400", async ({ customerApi }) => {
        test.skip(!productId, "no product id");
        const res = await customerApi.post(EP.orders, {
            data: { ...buildOrder(productId!), phone: "12345" },
        });
        expect(res.status()).toBe(400);
    });

    test("missing address → 400", async ({ customerApi }) => {
        test.skip(!productId, "no product id");
        const { address, ...noAddr } = buildOrder(productId!);
        const res = await customerApi.post(EP.orders, { data: noAddr });
        expect(res.status()).toBe(400);
    });

    test("empty cart → 400", async ({ customerApi }) => {
        const res = await customerApi.post(EP.orders, {
            data: {
                items: [],
                customerName: ORDER_ADDRESS.customerName,
                phone: ORDER_ADDRESS.phone,
                address: ORDER_ADDRESS.address,
                paymentMethod: "COD",
            },
        });
        expect(res.status()).toBe(400);
    });

    test("COD is an accepted payment method (happy path reaches pricing, not validation)", async ({ customerApi }) => {
        test.skip(!productId, "no product id");
        const res = await customerApi.post(EP.orders, { data: buildOrder(productId!, "COD") });
        // Not a 400 validation rejection — either created or a business gate (stock, etc.)
        expect(res.status()).not.toBe(400);
        expect(res.status()).toBeLessThan(500);
    });

    test("RAZORPAY order is accepted at validation layer", async ({ customerApi }) => {
        test.skip(!productId, "no product id");
        const res = await customerApi.post(EP.orders, { data: buildOrder(productId!, "RAZORPAY") });
        expect(res.status()).not.toBe(400);
        expect(res.status()).toBeLessThan(500);
    });
});
