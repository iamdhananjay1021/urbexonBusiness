/**
 * Delivery panel page objects (delivery-panel/src/pages).
 */
import { Page } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ENV } from "../../config/env";

export class DeliveryLoginPage extends BasePage {
    constructor(page: Page) { super(page, ENV.deliveryUrl); }
    readonly path = "/login";

    get identifier() { return this.page.locator('form input:not([type="password"])').first(); }
    get password() { return this.page.locator('input[type="password"]').first(); }
    get submit() { return this.page.locator('form button[type="submit"], form button').first(); }
    /** External link → client app signup with ?role=delivery_boy (QA-fixed flow) */
    get applyLink() { return this.page.getByRole("link", { name: /apply as a new delivery partner/i }); }

    async open() { await this.goto(this.path); }
    async login(email: string, password: string) {
        await this.identifier.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }
}

export class DeliveryDashboardPage extends BasePage {
    constructor(page: Page) { super(page, ENV.deliveryUrl); }
    readonly path = "/dashboard";

    /** bottom-nav tabs from AppRoutes NAV */
    tab(label: "Home" | "Active" | "Earnings" | "History" | "Profile") {
        return this.page.getByRole("link", { name: label });
    }
    async open() { await this.goto(this.path); }
}

export class DeliveryRegisterPage extends BasePage {
    constructor(page: Page) { super(page, ENV.deliveryUrl); }
    readonly path = "/register";
    async open() { await this.goto(this.path); }
}
