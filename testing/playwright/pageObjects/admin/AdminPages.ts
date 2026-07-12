/**
 * Admin panel page objects (admin/src/pages, AdminLogin uses email+password).
 */
import { Page } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ENV } from "../../config/env";

export class AdminLoginPage extends BasePage {
    constructor(page: Page) { super(page, ENV.adminUrl); }
    readonly path = "/admin/login";

    get email() { return this.page.locator('input[type="email"], form input:not([type="password"])').first(); }
    get password() { return this.page.locator('input[type="password"]').first(); }
    get submit() { return this.page.locator('form button[type="submit"], form button').first(); }

    async open() {
        await this.goto(this.path);
        // some builds route admin login at /login
        if (this.currentPath.includes("404") || (await this.page.locator("form").count()) === 0) {
            await this.goto("/login");
        }
    }
    async login(email: string, password: string) {
        await this.email.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }
}

export class AdminDashboardPage extends BasePage {
    constructor(page: Page) { super(page, ENV.adminUrl); }
    readonly path = "/admin/dashboard";
    async open() { await this.goto(this.path); }
}

export class AdminOrdersPage extends BasePage {
    constructor(page: Page) { super(page, ENV.adminUrl); }
    readonly path = "/admin/orders";
    async open() { await this.goto(this.path); }
}

export class AdminApplicationQueuePage extends BasePage {
    constructor(page: Page) { super(page, ENV.adminUrl); }
    readonly path = "/admin/delivery/applications";
    async open() { await this.goto(this.path); }
}
