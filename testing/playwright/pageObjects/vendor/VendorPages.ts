/**
 * Vendor panel page objects (vendor-panel/src/pages).
 */
import { Page } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ENV } from "../../config/env";

export class VendorLoginPage extends BasePage {
    constructor(page: Page) { super(page, ENV.vendorUrl); }
    readonly path = "/login";

    get identifier() { return this.page.locator('form input:not([type="password"])').first(); }
    get password() { return this.page.locator('input[type="password"]').first(); }
    // Scope to [type="submit"] only: the password show/hide toggle is a
    // <button type="button"> that sits before the real submit button, so a
    // `form button` union selector + .first() clicked the eye icon and the
    // form never submitted (same bug that hit the delivery login POM).
    get submit() { return this.page.locator('form button[type="submit"]').first(); }
    get applyAsVendorLink() { return this.page.getByRole("link", { name: /apply as vendor/i }); }

    async open() { await this.goto(this.path); }
    async login(email: string, password: string) {
        await this.identifier.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }
}

export class VendorDashboardPage extends BasePage {
    constructor(page: Page) { super(page, ENV.vendorUrl); }
    readonly path = "/dashboard";
    async open() { await this.goto(this.path); }
}

export class VendorOrdersPage extends BasePage {
    constructor(page: Page) { super(page, ENV.vendorUrl); }
    readonly path = "/orders";
    async open() { await this.goto(this.path); }
}

export class VendorProductsPage extends BasePage {
    constructor(page: Page) { super(page, ENV.vendorUrl); }
    readonly path = "/products";
    async open() { await this.goto(this.path); }
}
