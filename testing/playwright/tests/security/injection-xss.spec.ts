/**
 * Injection & XSS hardening — NoSQL operator injection, XSS payload
 * persistence, mass-assignment of role. Uses real endpoints.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP } from "../../helpers/api";
import { QA_PASSWORD, USERS } from "../../fixtures/testData";

test.describe("NoSQL / Mongo operator injection", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("operator object in email field must NOT authenticate", async ({ api }) => {
        // Classic { "$gt": "" } auth bypass attempt
        const res = await api.post(EP.login, {
            data: { email: { $gt: "" }, password: { $gt: "" } },
        });
        expect(res.status()).not.toBe(200);
        expect((await res.json().catch(() => ({}))).token).toBeUndefined();
    });

    test("operator injection in password must NOT authenticate a known user", async ({ api }) => {
        const res = await api.post(EP.login, {
            data: { email: USERS.customer.email, password: { $ne: "x" } },
        });
        expect(res.status()).not.toBe(200);
    });
});

test.describe("XSS payload handling", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    const XSS = '<script>window.__xss=1</script>';

    test("XSS in a product search query is not reflected as executable HTML", async ({ api }) => {
        const res = await api.get(`${EP.products}?search=${encodeURIComponent(XSS)}`);
        expect(res.status()).toBeLessThan(500);
        const text = await res.text();
        // response is JSON — the raw <script> must not appear unescaped in an HTML context.
        // (JSON body may contain the string; assert the API never returns text/html here.)
        expect(res.headers()["content-type"] || "").toMatch(/application\/json/);
        expect(text).not.toContain("<script>window.__xss");
    });
});

test.describe("mass-assignment / privilege escalation", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("registering with role=admin must NOT create an admin", async ({ api }) => {
        const email = `qa.escalate.${Date.now()}@urbexon.test`;
        const res = await api.post(EP.register, {
            data: {
                name: "Escalation Probe",
                email,
                phone: "9700000010",
                password: QA_PASSWORD,
                role: "admin", // attacker-supplied
            },
        });
        // Registration may require OTP; regardless, it must never mint an admin.
        // If a token comes back, decode role; otherwise the account (if created)
        // is only reachable after OTP — either way this must not be admin.
        const body = await res.json().catch(() => ({}));
        if (body.token) {
            const payload = JSON.parse(
                Buffer.from(body.token.split(".")[1], "base64").toString("utf-8")
            );
            expect(payload.role).not.toBe("admin");
            expect(payload.role).not.toBe("owner");
        }
        expect(res.status()).toBeLessThan(500);
    });
});
