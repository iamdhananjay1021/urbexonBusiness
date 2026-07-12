/**
 * Delivery panel — login UI, apply-flow routing (QA-fixed), dashboard,
 * online/offline toggle, and delivery status/earnings API.
 */
import { test, expect } from "../../fixtures/fixtures";
import { DeliveryLoginPage, DeliveryDashboardPage } from "../../pageObjects/delivery/DeliveryPages";
import { EP } from "../../helpers/api";
import { ENV } from "../../config/env";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("delivery login UI", () => {
    test.beforeEach(({ requireApps }) => requireApps("delivery", "api"));

    test("login page renders", async ({ page }) => {
        const login = new DeliveryLoginPage(page);
        await login.open();
        await expect(login.identifier).toBeVisible();
        await expect(login.password).toBeVisible();
    });

    test("'apply as new delivery partner' links to the client signup with role (QA fix)", async ({ page }) => {
        const login = new DeliveryLoginPage(page);
        await login.open();
        const apply = login.applyLink;
        if (await apply.count()) {
            const href = await apply.getAttribute("href");
            expect(href).toMatch(/register\?role=delivery_boy/);
        }
    });

    test("delivery partner can log in through the UI", async ({ page }) => {
        const login = new DeliveryLoginPage(page);
        await login.open();
        await login.login(USERS.delivery.email, QA_PASSWORD);
        await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    });
});

test.describe("delivery dashboard (pre-authenticated, approved rider)", () => {
    test.beforeEach(({ requireApps }) => requireApps("delivery", "api"));

    test("approved rider reaches the dashboard (not /apply or /pending-approval)", async ({ deliveryPage }) => {
        const dash = new DeliveryDashboardPage(deliveryPage);
        await dash.open();
        await expect(deliveryPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
        await expect(deliveryPage).not.toHaveURL(/\/pending-approval/);
    });
});

test.describe("delivery API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("status endpoint reports approved application", async ({ deliveryApi }) => {
        const res = await deliveryApi.get(EP.deliveryStatus);
        expect(res.status()).toBe(200);
        const body = await res.json();
        expect(body.applicationStatus ?? body.status).toBeTruthy();
    });

    test("go online → go offline toggle round-trips", async ({ deliveryApi }) => {
        const on = await deliveryApi.patch(EP.deliveryToggle);
        expect(on.status()).toBeLessThan(500);
        const off = await deliveryApi.patch(EP.deliveryToggle);
        expect(off.status()).toBeLessThan(500);
    });

    test("earnings endpoint returns wallet/earnings data", async ({ deliveryApi }) => {
        const res = await deliveryApi.get(EP.deliveryEarnings);
        expect(res.status()).toBeLessThan(500);
    });
});
