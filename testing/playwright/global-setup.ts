/**
 * Global setup:
 *  1. Probe which apps are reachable → .state/availability.json
 *     (UI specs for an app that isn't running skip with a clear reason
 *     instead of drowning the report in connection-refused noise)
 *  2. Seed deterministic QA data into Mongo (SEED=0 to skip)
 *  3. Login every role ONCE via the real endpoints and cache tokens →
 *     .auth/tokens.json (respects the 30-req/15-min auth rate limiter)
 */
import { request, FullConfig } from "@playwright/test";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { ENV, PATHS } from "./config/env";
import { apiLogin, Role } from "./helpers/api";

const probe = async (url: string): Promise<boolean> => {
    if (!url) return false;
    const ctx = await request.newContext({ timeout: 5000 });
    try {
        const res = await ctx.get(url, { timeout: 5000 });
        return res.status() < 500;
    } catch {
        return false;
    } finally {
        await ctx.dispose();
    }
};

export default async function globalSetup(_config: FullConfig) {
    fs.mkdirSync(PATHS.STATE_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(PATHS.TOKENS_FILE), { recursive: true });

    /* 1 ── availability probe */
    const availability = {
        api: await probe(`${ENV.apiUrl}/api/products?limit=1`),
        client: await probe(ENV.clientUrl),
        admin: await probe(ENV.adminUrl),
        vendor: await probe(ENV.vendorUrl),
        delivery: await probe(ENV.deliveryUrl),
    };
    fs.writeFileSync(PATHS.AVAIL_FILE, JSON.stringify(availability, null, 2));
    console.log("[setup] availability:", JSON.stringify(availability));

    if (!availability.api) {
        console.warn("[setup] ⚠ backend API unreachable — API tests will fail fast; start backend on", ENV.apiUrl);
        return;
    }

    /* 2 ── seed */
    if (process.env.SEED !== "0" && ENV.name !== "production") {
        try {
            execFileSync(process.execPath, [path.join(__dirname, "seed/seed.mjs")], {
                stdio: "inherit",
                timeout: 60_000,
            });
        } catch (e) {
            console.warn("[setup] ⚠ seeding failed — tests relying on QA data may fail:", (e as Error).message);
        }
    }

    /* 3 ── one login per role, cached for every fixture */
    const ctx = await request.newContext();
    const tokens: Record<string, { token: string; user: any }> = {};
    for (const role of ["customer", "vendor", "admin", "delivery"] as Role[]) {
        try {
            const r = await apiLogin(ctx, role);
            if (r.status === 200 && r.token) {
                tokens[role] = { token: r.token, user: r.user };
            } else {
                console.warn(`[setup] ⚠ ${role} login failed (${r.status}):`, JSON.stringify(r.body?.message));
            }
        } catch (e) {
            console.warn(`[setup] ⚠ ${role} login threw:`, (e as Error).message);
        }
    }
    await ctx.dispose();
    fs.writeFileSync(PATHS.TOKENS_FILE, JSON.stringify(tokens, null, 2));
    console.log("[setup] cached tokens for:", Object.keys(tokens).join(", ") || "none");
}
