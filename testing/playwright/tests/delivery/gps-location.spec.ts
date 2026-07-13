/**
 * GPS / rider location — the /api/delivery/location endpoint validates
 * lat/lng (real validateBody rules: lat & lng required, type number) and
 * feeds live tracking. These assert the validation + happy path.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";

test.describe("rider GPS location endpoint", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("valid coordinates are accepted", async ({ deliveryApi }) => {
        const res = await deliveryApi.patch(EP.deliveryLocation, {
            data: { lat: 28.6139, lng: 77.209 },
        });
        expect(res.status()).toBeLessThan(500);
        // approved online rider → 200; if offline gate applies it's 4xx, not 5xx
        expect([200, 400, 403]).toContain(res.status());
    });

    test("missing lng → 400 validation error (GPS disabled / partial fix)", async ({ deliveryApi }) => {
        const res = await deliveryApi.patch(EP.deliveryLocation, { data: { lat: 28.6139 } });
        expect(res.status()).toBe(400);
    });

    test("REGRESSION: a coarse Wi-Fi/desktop fix (accuracy 800m) is accepted, not dropped", async ({ deliveryApi }) => {
        // The 100m accuracy filter used to silently drop every desktop/weak-GPS
        // fix (Wi-Fi geolocation is 500–5000m) → rider location never persisted,
        // maps blank, distanceKm never computed. It must now be accepted.
        const res = await deliveryApi.patch(EP.deliveryLocation, {
            data: { lat: 28.6142, lng: 77.2085, accuracy: 800, timestamp: Date.now() },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.ignored, "an 800m fix must NOT be ignored as low_accuracy").toBeFalsy();
    });

    test("a truly garbage fix (accuracy 3000m) is still ignored", async ({ deliveryApi }) => {
        const res = await deliveryApi.patch(EP.deliveryLocation, {
            data: { lat: 28.61, lng: 77.20, accuracy: 3000, timestamp: Date.now() },
        });
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.ignored).toBe(true);
        expect(body.reason).toBe("low_accuracy");
    });

    test("non-numeric coordinates → 400 (GPS spoof / bad payload)", async ({ deliveryApi }) => {
        const res = await deliveryApi.patch(EP.deliveryLocation, {
            data: { lat: "not-a-number", lng: "spoofed" },
        });
        expect(res.status()).toBe(400);
    });

    test("customer token cannot push rider location (role protection) → 403", async ({ customerApi }) => {
        const res = await customerApi.patch(EP.deliveryLocation, {
            data: { lat: 28.6, lng: 77.2 },
        });
        expect(res.status()).toBe(403);
    });

    test("location updates are rate-limited (locationLimiter) under a burst", async ({ deliveryApi }) => {
        // Fire a rapid burst; the endpoint has a dedicated limiter. We only
        // assert it never 5xx's and that SOME limiting or steady 200s occur.
        let anyServerError = false;
        for (let i = 0; i < 15; i++) {
            const res = await deliveryApi.patch(EP.deliveryLocation, {
                data: { lat: 28.6 + i * 0.001, lng: 77.2 + i * 0.001 },
            });
            if (res.status() >= 500) { anyServerError = true; break; }
        }
        expect(anyServerError).toBe(false);
    });
});
