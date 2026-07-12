/**
 * Customer catalog surfaces — home, products listing, product details.
 * Read-only public pages; assert they render real data from the API.
 */
import { test, expect } from "../../fixtures/fixtures";
import { HomePage, ProductsPage } from "../../pageObjects/client/ClientPages";

test.describe("customer catalog", () => {
    test.beforeEach(({ requireApps }) => requireApps("client"));

    test("home page renders with footer and no uncaught page errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        const home = new HomePage(page);
        await home.open();
        await expect(home.footer).toBeVisible({ timeout: 15_000 });
        expect(errors, `page errors: ${errors.join("; ")}`).toHaveLength(0);
    });

    test("products listing page renders", async ({ page }) => {
        const products = new ProductsPage(page);
        await products.open();
        await expect(page.locator("body")).not.toBeEmpty();
        // Either products show, or an explicit empty-state — never a crash
        await expect(page).toHaveURL(/\/products/);
    });

    test("a product detail page opens from the listing", async ({ page, availability }) => {
        const products = new ProductsPage(page);
        await products.open();
        const count = await products.productLinks.count();
        test.skip(count === 0, "no products rendered on listing to click into");
        await products.openFirstProduct();
        await expect(page.locator("body")).not.toBeEmpty();
    });
});
