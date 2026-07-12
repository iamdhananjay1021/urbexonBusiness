/**
 * Customer authentication — real /api/auth endpoints.
 */
import { test, expect } from "../../fixtures/fixtures";
import { EP, apiLogin } from "../../helpers/api";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("customer auth API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("valid credentials → 200 with token + safe user payload", async ({ api }) => {
        const r = await apiLogin(api, "customer");
        expect(r.status).toBe(200);
        expect(r.token).toBeTruthy();
        expect(r.user.email).toBe(USERS.customer.email);
        expect(r.user.role).toBe("user");
        // password must never leak
        expect(r.user.password).toBeUndefined();
    });

    test("wrong password → 401, no token", async ({ api }) => {
        const res = await api.post(EP.login, {
            data: { email: USERS.customer.email, password: "WrongPass@123" },
        });
        expect(res.status()).toBe(401);
        const body = await res.json();
        expect(body.token).toBeUndefined();
        expect(body.success).toBe(false);
    });

    test("unknown account → 401 (no user enumeration difference)", async ({ api }) => {
        const res = await api.post(EP.login, {
            data: { email: "nobody-here@urbexon.test", password: "Whatever@123" },
        });
        expect(res.status()).toBe(401);
        expect((await res.json()).message).toMatch(/invalid credentials/i);
    });

    test("missing fields → 400", async ({ api }) => {
        const res = await api.post(EP.login, { data: { email: USERS.customer.email } });
        expect(res.status()).toBe(400);
    });

    test("admin account is rejected on the customer endpoint", async ({ api }) => {
        const res = await api.post(EP.login, {
            data: { email: USERS.admin.email, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(403);
        expect((await res.json()).message).toMatch(/admin/i);
    });

    test("phone-number login works (identifier flexibility)", async ({ api }) => {
        const res = await api.post(EP.login, {
            data: { phone: USERS.customer.phone, password: QA_PASSWORD },
        });
        expect(res.status()).toBe(200);
        expect((await res.json()).user.email).toBe(USERS.customer.email);
    });

    test("GET /auth/profile with bearer token → own profile", async ({ customerApi }) => {
        const res = await customerApi.get(EP.profile);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.user?.email ?? body.email).toBe(USERS.customer.email);
    });
});
