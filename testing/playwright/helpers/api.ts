/**
 * Thin wrapper over Playwright's APIRequestContext bound to the real
 * backend routes. No mocks — every call hits the production endpoints.
 */
import { APIRequestContext, request, expect } from "@playwright/test";
import { ENV } from "../config/env";
import { USERS, QA_PASSWORD } from "../fixtures/testData";

export const EP = {
    // auth (client + admin share /api/auth)
    login: "/api/auth/login",
    adminLogin: "/api/auth/admin/login",
    vendorLogin: "/api/vendor/login",
    deliveryLogin: "/api/delivery/login",
    refresh: "/api/auth/refresh",
    logout: "/api/auth/logout",
    profile: "/api/auth/profile",
    register: "/api/auth/register",
    // catalog
    products: "/api/products",
    categories: "/api/categories",
    banners: "/api/banners",
    // orders
    orders: "/api/orders",
    myOrders: "/api/orders/my",
    pricing: "/api/orders/pricing",
    // panels
    vendorOrders: "/api/vendor/orders",
    vendorStatus: "/api/vendor/status",
    deliveryStatus: "/api/delivery/status",
    deliveryToggle: "/api/delivery/toggle-status",
    deliveryLocation: "/api/delivery/location",
    deliveryEarnings: "/api/delivery/earnings",
    adminDashboard: "/api/auth/admin/dashboard",
    adminUsers: "/api/auth/users",
    wishlist: "/api/wishlist",
    addresses: "/api/addresses",
    coupons: "/api/coupons",
} as const;

export type Role = "customer" | "vendor" | "admin" | "delivery";

const LOGIN_ROUTE: Record<Role, string> = {
    customer: EP.login,
    vendor: EP.vendorLogin,
    admin: EP.adminLogin,
    delivery: EP.deliveryLogin,
};

export const loginPayload = (role: Role) => ({
    email: USERS[role].email,
    password: QA_PASSWORD,
});

/** Login via the real endpoint; returns { token, user, raw } */
export const apiLogin = async (ctx: APIRequestContext, role: Role) => {
    const res = await ctx.post(`${ENV.apiUrl}${LOGIN_ROUTE[role]}`, {
        data: loginPayload(role),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status(), token: body.token as string | undefined, user: body.user, body, res };
};

/** New request context with a Bearer token pre-attached */
export const authedContext = async (token: string) =>
    request.newContext({
        baseURL: ENV.apiUrl,
        extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

/** Assert helper: response is JSON and success shape */
export const expectOk = async (res: { status(): number; json(): Promise<any> }, allowed = [200, 201]) => {
    expect(allowed).toContain(res.status());
    const body = await res.json();
    expect(body.success ?? true).toBeTruthy();
    return body;
};
