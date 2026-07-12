import { defineConfig, devices } from "@playwright/test";
import { ENV } from "./playwright/config/env";

/**
 * Urbexon Production QA — Playwright configuration
 *
 * Projects:
 *  - api      : pure API tests (no browser page needed) — auth, security,
 *               order flows, payments, performance
 *  - chromium : UI tests across the 4 apps (client/vendor/admin/delivery)
 *
 * Artifacts (screenshots / videos / traces) land in reports/artifacts and
 * are kept only on failure so a green run stays lightweight.
 */
export default defineConfig({
    testDir: "./playwright/tests",
    outputDir: "./reports/artifacts",

    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 1,
    // Backend /api/auth sits behind a 30-req/15-min rate limiter — keep
    // worker count low so parallel logins never poison the window.
    workers: process.env.CI ? 2 : 3,
    timeout: 45_000,
    expect: { timeout: 10_000 },

    globalSetup: "./playwright/global-setup.ts",
    globalTeardown: "./playwright/global-teardown.ts",

    reporter: [
        ["list"],
        ["html", { outputFolder: "reports/html", open: "never" }],
        ["json", { outputFile: "reports/results.json" }],
    ],

    use: {
        baseURL: ENV.clientUrl,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
        actionTimeout: 15_000,
        navigationTimeout: 30_000,
    },

    projects: [
        {
            name: "api",
            testMatch: [
                "**/auth/**/*.spec.ts",
                "**/security/**/*.spec.ts",
                "**/flows/**/*.spec.ts",
                "**/payments/**/*.spec.ts",
                "**/performance/**/*.spec.ts",
            ],
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "chromium",
            testMatch: [
                "**/customer/**/*.spec.ts",
                "**/vendor/**/*.spec.ts",
                "**/admin/**/*.spec.ts",
                "**/delivery/**/*.spec.ts",
                "**/realtime/**/*.spec.ts",
                "**/edge/**/*.spec.ts",
            ],
            use: {
                ...devices["Desktop Chrome"],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
});
