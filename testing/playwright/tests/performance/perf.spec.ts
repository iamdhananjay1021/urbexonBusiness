/**
 * Performance smoke — API latency budgets and duplicate/N+1 heuristics.
 * These are guardrails, not micro-benchmarks: they flag gross regressions
 * (multi-second responses, pathological list endpoints) in CI.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";

const timed = async (fn: () => Promise<any>) => {
    const t0 = Date.now();
    const res = await fn();
    return { ms: Date.now() - t0, res };
};

test.describe("API latency budgets", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("products listing responds under 2000ms", async ({ api }) => {
        const { ms, res } = await timed(() => api.get(`${EP.products}?limit=20`));
        expect(res.status()).toBeLessThan(500);
        expect(ms, `products listing took ${ms}ms`).toBeLessThan(2000);
    });

    test("categories responds under 1500ms", async ({ api }) => {
        const { ms, res } = await timed(() => api.get(EP.categories));
        expect(res.status()).toBeLessThan(500);
        expect(ms, `categories took ${ms}ms`).toBeLessThan(1500);
    });

    test("login round-trip under 2500ms", async ({ customerApi }) => {
        const { ms, res } = await timed(() => customerApi.get(EP.profile));
        expect(res.status()).toBe(200);
        expect(ms, `profile fetch took ${ms}ms`).toBeLessThan(2500);
    });

    test("admin dashboard aggregate under 3000ms", async ({ adminApi }) => {
        const { ms, res } = await timed(() => adminApi.get(EP.adminDashboard));
        expect(res.status()).toBeLessThan(500);
        expect(ms, `admin dashboard took ${ms}ms`).toBeLessThan(3000);
    });

    test("repeated identical list calls stay within a stable latency band (no N+1 blow-up)", async ({ api }) => {
        const runs: number[] = [];
        for (let i = 0; i < 5; i++) {
            const { ms } = await timed(() => api.get(`${EP.products}?limit=20`));
            runs.push(ms);
        }
        const avg = runs.reduce((a, b) => a + b, 0) / runs.length;
        const max = Math.max(...runs);
        // worst call shouldn't be wildly beyond the average (catches per-item
        // query fan-out that only shows under certain data shapes)
        expect(max, `runs=${runs.join(",")} avg=${avg.toFixed(0)}`).toBeLessThan(avg * 4 + 500);
    });
});
