/**
 * Shared fixtures.
 *
 * UI auth strategy: login once per role in global-setup via the REAL
 * endpoints, then inject the token into each app's own localStorage key
 * (exact shape each AuthContext rehydrates from) before first paint.
 * This exercises the apps' real rehydration + token-validation paths
 * without burning the auth rate limiter on a UI login per test.
 */
import { test as base, expect, Page, APIRequestContext, request } from "@playwright/test";
import { ENV, readAvailability, readTokens, Availability } from "../config/env";
import { STORAGE_KEYS } from "./testData";
import { Role } from "../helpers/api";

type AppName = "client" | "vendor" | "admin" | "delivery";

const APP_URL: Record<AppName, string> = {
    client: ENV.clientUrl,
    vendor: ENV.vendorUrl,
    admin: ENV.adminUrl,
    delivery: ENV.deliveryUrl,
};

/** Each app persists a differently-shaped auth blob (must match each app's
 *  own AuthContext rehydration: client/admin read specific shapes, vendor
 *  nests under `vendor`, delivery under `rider`). */
const authBlob = (app: AppName, token: string, user: any): unknown => {
    switch (app) {
        case "client": return { token, user };
        case "vendor": return { token, vendor: { ...user, token } };
        // Admin rehydration reads a FLAT object and checks `parsed.role`
        // (not parsed.user.role), matching AdminAuthContext.login's stored
        // shape — a nested { token, user } is rejected and bounced to login.
        case "admin": return { _id: user?._id, name: user?.name, email: user?.email, role: user?.role, token };
        case "delivery": return {
            token,
            rider: { ...user, applicationStatus: user?.applicationStatus ?? "approved" },
        };
    }
};

type Fixtures = {
    availability: Availability;
    /** Skip unless the named apps are reachable */
    requireApps: (...apps: (AppName | "api")[]) => void;

    api: APIRequestContext;          // unauthenticated, baseURL = backend
    customerApi: APIRequestContext;  // Bearer contexts per role
    vendorApi: APIRequestContext;
    adminApi: APIRequestContext;
    deliveryApi: APIRequestContext;

    customerPage: Page;  // pre-authenticated pages per app
    vendorPage: Page;
    adminPage: Page;
    deliveryPage: Page;
};

const tokenFor = (role: Role) => {
    const t = readTokens()[role];
    return t ?? null;
};

const makeAuthedApi = async (role: Role): Promise<APIRequestContext> => {
    const t = tokenFor(role);
    return request.newContext({
        baseURL: ENV.apiUrl,
        extraHTTPHeaders: t ? { Authorization: `Bearer ${t.token}` } : {},
    });
};

const makeAuthedPage = async (
    browser: import("@playwright/test").Browser,
    app: AppName,
    role: Role
): Promise<Page> => {
    const t = tokenFor(role);
    const context = await browser.newContext();
    if (t) {
        const key = STORAGE_KEYS[app];
        const value = JSON.stringify(authBlob(app, t.token, t.user));
        await context.addInitScript(
            ([k, v]) => { try { window.localStorage.setItem(k, v); } catch { /* cross-origin frame */ } },
            [key, value] as const
        );
    }
    const page = await context.newPage();
    return page;
};

export const test = base.extend<Fixtures>({
    availability: async ({}, use) => { await use(readAvailability()); },

    requireApps: async ({ availability }, use) => {
        await use((...apps) => {
            for (const app of apps) {
                test.skip(!availability[app], `${app} is not running (${app === "api" ? ENV.apiUrl : APP_URL[app as AppName]})`);
            }
        });
    },

    api: async ({}, use) => {
        const ctx = await request.newContext({ baseURL: ENV.apiUrl });
        await use(ctx);
        await ctx.dispose();
    },
    customerApi: async ({}, use) => { const c = await makeAuthedApi("customer"); await use(c); await c.dispose(); },
    vendorApi: async ({}, use) => { const c = await makeAuthedApi("vendor"); await use(c); await c.dispose(); },
    adminApi: async ({}, use) => { const c = await makeAuthedApi("admin"); await use(c); await c.dispose(); },
    deliveryApi: async ({}, use) => { const c = await makeAuthedApi("delivery"); await use(c); await c.dispose(); },

    customerPage: async ({ browser }, use) => {
        const p = await makeAuthedPage(browser, "client", "customer");
        await use(p); await p.context().close();
    },
    vendorPage: async ({ browser }, use) => {
        const p = await makeAuthedPage(browser, "vendor", "vendor");
        await use(p); await p.context().close();
    },
    adminPage: async ({ browser }, use) => {
        const p = await makeAuthedPage(browser, "admin", "admin");
        await use(p); await p.context().close();
    },
    deliveryPage: async ({ browser }, use) => {
        const p = await makeAuthedPage(browser, "delivery", "delivery");
        await use(p); await p.context().close();
    },
});

export { expect, APP_URL };
export type { AppName };
