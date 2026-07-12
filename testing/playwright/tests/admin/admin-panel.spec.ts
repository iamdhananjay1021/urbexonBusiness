/**
 * Admin panel — login UI, dashboard, application queue, and admin APIs.
 */
import { test, expect } from "../../fixtures/fixtures";
import { AdminLoginPage, AdminDashboardPage, AdminApplicationQueuePage } from "../../pageObjects/admin/AdminPages";
import { EP } from "../../helpers/api";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("admin login UI", () => {
    test.beforeEach(({ requireApps }) => requireApps("admin", "api"));

    test("admin login page renders", async ({ page }) => {
        const login = new AdminLoginPage(page);
        await login.open();
        await expect(login.email).toBeVisible();
        await expect(login.password).toBeVisible();
    });

    test("admin can log in through the UI", async ({ page }) => {
        const login = new AdminLoginPage(page);
        await login.open();
        await login.login(USERS.admin.email, QA_PASSWORD);
        await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    });
});

test.describe("admin panel pages (pre-authenticated)", () => {
    test.beforeEach(({ requireApps }) => requireApps("admin", "api"));

    test("dashboard renders", async ({ adminPage }) => {
        const dash = new AdminDashboardPage(adminPage);
        await dash.open();
        await expect(adminPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
        await expect(adminPage.locator("body")).not.toBeEmpty();
    });

    test("delivery application queue route renders (regression: route now wired)", async ({ adminPage }) => {
        const queue = new AdminApplicationQueuePage(adminPage);
        await queue.open();
        await expect(adminPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
        // must not be the 404/catch-all
        await expect(adminPage.locator("body")).not.toContainText(/404|not found/i);
    });
});

test.describe("admin API", () => {
    test.beforeEach(({ requireApps }) => requireApps("api"));

    test("admin dashboard endpoint returns metrics", async ({ adminApi }) => {
        const res = await adminApi.get(EP.adminDashboard);
        expect([200, 304]).toContain(res.status());
    });

    test("admin can list users with pagination", async ({ adminApi }) => {
        const res = await adminApi.get(`${EP.adminUsers}?page=1&limit=5`);
        expect(res.status()).toBe(200);
    });
});
