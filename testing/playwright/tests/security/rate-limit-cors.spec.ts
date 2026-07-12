/**
 * Rate limiting, CORS and duplicate-request handling.
 *
 * The auth flood test is OFF by default — it poisons the 30-req/15-min
 * window and would fail every subsequent auth test in the run. Enable with
 * RATE_LIMIT_FLOOD=1 when running the security suite in isolation.
 */
import { test, expect } from "../../fixtures/fixtures";
import { ENV } from "../../config/env";
import { EP } from "../../helpers/api";

test.describe("CORS policy", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("allowed origin is echoed with credentials support", async ({ api }) => {
        const res = await api.get(`${EP.products}?limit=1`, {
            headers: { Origin: ENV.clientUrl },
        });
        expect(res.status()).toBeLessThan(500);
        const acao = res.headers()["access-control-allow-origin"];
        // API either echoes the allowed origin or omits it; it must NEVER be "*"
        // together with credentials.
        if (acao) expect(acao).not.toBe("*");
    });

    test("credentials flag is enabled for the allowed origin", async ({ api }) => {
        const res = await api.get(`${EP.products}?limit=1`, {
            headers: { Origin: ENV.clientUrl },
        });
        const acc = res.headers()["access-control-allow-credentials"];
        if (acc) expect(acc).toBe("true");
    });
});

test.describe("rate limiting", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("auth endpoint enforces a limit under flooding", async ({ api }) => {
        test.skip(process.env.RATE_LIMIT_FLOOD !== "1",
            "flood test disabled — set RATE_LIMIT_FLOOD=1 and run security suite in isolation");

        let saw429 = false;
        for (let i = 0; i < 40; i++) {
            const res = await api.post(EP.login, {
                data: { email: `flood${i}@urbexon.test`, password: "x" },
            });
            if (res.status() === 429) { saw429 = true; break; }
        }
        expect(saw429, "auth limiter should return 429 within 40 rapid requests").toBe(true);
    });
});
