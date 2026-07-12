import { Page, Locator, expect } from "@playwright/test";

export abstract class BasePage {
    constructor(protected readonly page: Page, protected readonly baseUrl: string) { }

    protected url(path = "/") {
        return `${this.baseUrl}${path}`;
    }

    async goto(path = "/") {
        await this.page.goto(this.url(path), { waitUntil: "domcontentloaded" });
    }

    get currentPath(): string {
        return new URL(this.page.url()).pathname;
    }

    async expectPath(path: string | RegExp, timeout = 15_000) {
        await expect(this.page).toHaveURL(
            typeof path === "string" ? new RegExp(`${path.replace(/\//g, "\\/")}`) : path,
            { timeout }
        );
    }

    /** True if the page body rendered something (never a blank crash) */
    async expectRendered() {
        await expect(this.page.locator("body")).not.toBeEmpty();
        const errors: string[] = [];
        this.page.on("pageerror", (e) => errors.push(e.message));
        return errors;
    }

    protected byRole(role: Parameters<Page["getByRole"]>[0], name?: string | RegExp): Locator {
        return name ? this.page.getByRole(role, { name }) : this.page.getByRole(role);
    }
}
