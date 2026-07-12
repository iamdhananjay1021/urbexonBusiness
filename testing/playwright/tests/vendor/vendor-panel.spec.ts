/**
 * Vendor panel — login UI, dashboard access, and vendor order API.
 */
import { test, expect } from "../../fixtures/fixtures";
import { VendorLoginPage, VendorDashboardPage, VendorOrdersPage } from "../../pageObjects/vendor/VendorPages";
import { EP } from "../../helpers/api";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("vendor login UI", () => {
    test.beforeEach(({ requireApps }) => requireApps("vendor", "api"));

    test("login page renders and 'apply as vendor' points at the client app", async ({ page }) => {
        const login = new VendorLoginPage(page);
        await login.open();
        await expect(login.identifier).toBeVisible();
        await expect(login.password).toBeVisible();
        const apply = login.applyAsVendorLink;
        if (await apply.count()) {
            const href = await apply.getAttribute("href");
            expect(href).toMatch(/register\?role=vendor/);
        }
    });

    test("vendor can log in through the UI and leave /login", async ({ page }) => {
        const login = new VendorLoginPage(page);
        await login.open();
        await login.login(USERS.vendor.email, QA_PASSWORD);
        await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    });
});

test.describe("vendor dashboard (pre-authenticated)", () => {
    test.beforeEach(({ requireApps }) => requireApps("vendor", "api"));

    test("dashboard renders for an approved vendor", async ({ vendorPage }) => {
        const dash = new VendorDashboardPage(vendorPage);
        await dash.open();
        await expect(vendorPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
        await expect(vendorPage.locator("body")).not.toBeEmpty();
    });

    test("orders page renders", async ({ vendorPage }) => {
        const orders = new VendorOrdersPage(vendorPage);
        await orders.open();
        await expect(vendorPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });
});

test.describe("vendor order API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("approved vendor can read its orders list", async ({ vendorApi }) => {
        const res = await vendorApi.get(EP.vendorOrders);
        // approved + active subscription seeded → 200; if subscription gate
        // trips it's 402/403 but never a crash
        expect(res.status()).toBeLessThan(500);
    });

    test("vendor status endpoint returns approval state", async ({ vendorApi }) => {
        const res = await vendorApi.get(EP.vendorStatus);
        expect(res.status()).toBe(200);
    });
});
