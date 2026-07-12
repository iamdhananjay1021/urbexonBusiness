/**
 * Customer UI — login page render, validation, route protection, logout.
 * Uses the real client app (client/src).
 */
import { test, expect } from "../../fixtures/fixtures";
import { ClientLoginPage, ProfilePage, expectRedirectedToLogin } from "../../pageObjects/client/ClientPages";
import { USERS, QA_PASSWORD } from "../../fixtures/testData";

test.describe("customer login UI", () => {
    test.beforeEach(({ requireApps }) => requireApps("client", "api"));

    test("login page renders the form", async ({ page }) => {
        const login = new ClientLoginPage(page);
        await login.open();
        await expect(login.identifier).toBeVisible();
        await expect(login.password).toBeVisible();
        await expect(login.submit).toBeVisible();
    });

    test("valid login lands the customer on the home app (not /login)", async ({ page }) => {
        const login = new ClientLoginPage(page);
        await login.open();
        await login.login(USERS.customer.email, QA_PASSWORD);
        await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    });

    test("invalid login shows an error and stays on /login", async ({ page }) => {
        const login = new ClientLoginPage(page);
        await login.open();
        await login.login(USERS.customer.email, "WrongPass@999");
        await expect(page).toHaveURL(/\/login/);
        await expect(login.errorAlert).toBeVisible({ timeout: 10_000 });
    });
});

test.describe("customer route protection", () => {
    test.beforeEach(({ requireApps }) => requireApps("client"));

    test("unauthenticated /profile redirects to /login", async ({ page }) => {
        const profile = new ProfilePage(page);
        await profile.open();
        await expectRedirectedToLogin(page);
    });

    test("unauthenticated /orders redirects to /login", async ({ page }) => {
        await page.goto(`${new ProfilePage(page)["baseUrl"]}/orders`);
        await expectRedirectedToLogin(page);
    });
});

test.describe("authenticated customer session", () => {
    test.beforeEach(({ requireApps }) => requireApps("client", "api"));

    test("pre-authenticated page can open /profile without redirect", async ({ customerPage }) => {
        const profile = new ProfilePage(customerPage);
        await profile.open();
        await expect(customerPage).not.toHaveURL(/\/login/, { timeout: 15_000 });
    });
});
