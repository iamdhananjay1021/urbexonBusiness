/**
 * Client app (customer) page objects — selectors mirror the real
 * components in client/src (design-system Input/Button, AppRoutes paths).
 */
import { Page, expect } from "@playwright/test";
import { BasePage } from "../BasePage";
import { ENV } from "../../config/env";

export class ClientLoginPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }

    readonly path = "/login";
    get identifier() { return this.page.getByPlaceholder(/your@email\.com/i); }
    get password() { return this.page.getByPlaceholder("••••••••"); }
    get submit() { return this.page.getByRole("button", { name: /sign in/i }); }
    get errorAlert() { return this.page.locator('[class*="alert"], [role="alert"]').first(); }
    get createAccountLink() { return this.page.getByRole("link", { name: /create account/i }); }
    get forgotPasswordLink() { return this.page.getByRole("link", { name: /forgot password/i }); }

    async open() { await this.goto(this.path); }

    async login(email: string, password: string) {
        await this.identifier.fill(email);
        await this.password.fill(password);
        await this.submit.click();
    }
}

export class ClientRegisterPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/register";

    roleCard(label: "Customer" | "Seller" | "Delivery") {
        return this.page.getByText(label, { exact: true }).first();
    }
    async open(role?: string) {
        await this.goto(role ? `${this.path}?role=${role}` : this.path);
    }
}

export class HomePage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }

    get footer() { return this.page.locator("footer"); }
    get becomeVendorLink() { return this.page.getByRole("link", { name: /become a vendor/i }); }
    get urbexonHourLink() { return this.page.getByRole("link", { name: /urbexon hour/i }).first(); }

    async open() { await this.goto("/"); }
}

export class ProductsPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/products";

    get productLinks() { return this.page.locator('a[href*="/products/"]'); }

    async open() { await this.goto(this.path); }
    async openFirstProduct() {
        await this.productLinks.first().click();
        await this.expectPath(/\/products\/.+/);
    }
}

export class CartPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/cart";
    async open() { await this.goto(this.path); }
}

export class WishlistPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/wishlist";
    async open() { await this.goto(this.path); }
}

export class ProfilePage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/profile";
    async open() { await this.goto(this.path); }
}

export class OrdersPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/orders";
    async open() { await this.goto(this.path); }
}

export class CheckoutPage extends BasePage {
    constructor(page: Page) { super(page, ENV.clientUrl); }
    readonly path = "/checkout";
    async open() { await this.goto(this.path); }
}

export const expectRedirectedToLogin = async (page: Page) => {
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
};
