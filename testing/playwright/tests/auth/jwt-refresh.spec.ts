/**
 * JWT refresh-token lifecycle — per-panel scoped cookies + multi-session.
 * Playwright request contexts keep a cookie jar, so these tests exercise
 * the real httpOnly-cookie round trip exactly like a browser.
 */
import { test, expect } from "../../fixtures/fixtures";
import { request } from "@playwright/test";
import { ENV } from "../../config/env";
import { EP } from "../../helpers/api";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

const freshCtx = () => request.newContext({ baseURL: ENV.apiUrl });

test.describe("JWT refresh lifecycle", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("login sets a scoped httpOnly refresh cookie (rt_client)", async () => {
        const ctx = await freshCtx();
        const res = await ctx.post(EP.login, {
            data: { email: USERS.customer.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(200);
        const setCookie = res.headersArray().filter(h => h.name.toLowerCase() === "set-cookie");
        const rtClient = setCookie.find(h => h.value.startsWith("rt_client="));
        expect(rtClient, "login must set the rt_client cookie").toBeTruthy();
        expect(rtClient!.value).toMatch(/HttpOnly/i);
        expect(rtClient!.value).toMatch(/Path=\/api\/auth/i);
        await ctx.dispose();
    });

    test("refresh with scope returns a fresh valid access token", async () => {
        const ctx = await freshCtx();
        await ctx.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });

        const ref = await ctx.post(EP.refresh, { data: { scope: "client" } });
        expect(ref.status()).toBe(200);
        const body = await ref.json();
        expect(body.token).toBeTruthy();
        expect(body.user.email).toBe(USERS.customer.email);

        // The refreshed token must actually work on a protected route
        const prof = await ctx.get(EP.profile, {
            headers: { Authorization: `Bearer ${body.token}` },
        });
        expect(prof.status()).toBe(200);
        await ctx.dispose();
    });

    test("refresh without any session cookie → 401", async () => {
        const ctx = await freshCtx();
        const ref = await ctx.post(EP.refresh, { data: { scope: "client" } });
        expect(ref.status()).toBe(401);
        await ctx.dispose();
    });

    test("refresh with the WRONG scope cannot hijack another panel's cookie", async () => {
        const ctx = await freshCtx();
        await ctx.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });
        // only rt_client exists in this jar — asking for the vendor session must fail
        const ref = await ctx.post(EP.refresh, { data: { scope: "vendor" } });
        expect([401, 403]).toContain(ref.status());
        await ctx.dispose();
    });

    test("MULTI-PANEL ISOLATION: two accounts in one browser keep separate sessions", async () => {
        // The original production bug: vendor + delivery panels open in the
        // same browser shared ONE refresh cookie, so refreshing one panel
        // returned the OTHER account's token.
        const ctx = await freshCtx();
        await ctx.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });
        await ctx.post(EP.vendorLogin, { data: { email: USERS.vendor.email, password: QA_PASSWORD } });

        const refClient = await ctx.post(EP.refresh, { data: { scope: "client" } });
        expect(refClient.status()).toBe(200);
        expect((await refClient.json()).user.email).toBe(USERS.customer.email);

        const refVendor = await ctx.post(EP.refresh, { data: { scope: "vendor" } });
        expect(refVendor.status()).toBe(200);
        expect((await refVendor.json()).user.email).toBe(USERS.vendor.email);
        await ctx.dispose();
    });

    test("CONCURRENT refreshes do not invalidate each other (multi-tab race)", async () => {
        const ctx = await freshCtx();
        await ctx.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });

        const results = await Promise.all(
            Array.from({ length: 4 }, () => ctx.post(EP.refresh, { data: { scope: "client" } }))
        );
        for (const r of results) expect(r.status()).toBe(200);

        // and the session must still be alive afterwards
        const after = await ctx.post(EP.refresh, { data: { scope: "client" } });
        expect(after.status()).toBe(200);
        await ctx.dispose();
    });

    test("logout revokes the server-side session — refresh stops working", async () => {
        const ctx = await freshCtx();
        await ctx.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });
        expect((await ctx.post(EP.refresh, { data: { scope: "client" } })).status()).toBe(200);

        const out = await ctx.post(EP.logout, { data: { scope: "client" } });
        expect(out.status()).toBe(200);

        const after = await ctx.post(EP.refresh, { data: { scope: "client" } });
        expect([401, 403]).toContain(after.status());
        await ctx.dispose();
    });

    test("second-device login does NOT kill the first device's session", async () => {
        const deviceA = await freshCtx();
        const deviceB = await freshCtx();
        await deviceA.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });
        await deviceB.post(EP.login, { data: { email: USERS.customer.email, password: QA_PASSWORD } });

        // device A must still be able to refresh after B logged in
        const refA = await deviceA.post(EP.refresh, { data: { scope: "client" } });
        expect(refA.status()).toBe(200);
        await deviceA.dispose();
        await deviceB.dispose();
    });

    test("tampered access token → 401 on protected routes", async ({ api }) => {
        const res = await api.get(EP.profile, {
            headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZCI6ImZha2UifQ.invalidsig" },
        });
        expect(res.status()).toBe(401);
    });
});
