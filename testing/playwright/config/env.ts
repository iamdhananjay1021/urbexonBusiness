/**
 * Environment resolution for the QA suite.
 * TEST_ENV=development|staging|production picks the URL set;
 * every URL is overridable via env vars (see .env.example).
 */
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.join(ROOT, ".env") });

type EnvName = "development" | "staging" | "production";

const name = (process.env.TEST_ENV as EnvName) || "development";

const pick = (prefix: string, key: string, fallback: string) =>
    process.env[`${prefix}_${key}`] || fallback;

const SETS: Record<EnvName, Record<string, string>> = {
    development: {
        api: pick("DEV", "API_URL", "http://localhost:9000"),
        client: pick("DEV", "CLIENT_URL", "http://localhost:5173"),
        admin: pick("DEV", "ADMIN_URL", "http://localhost:5174"),
        vendor: pick("DEV", "VENDOR_URL", "http://localhost:5175"),
        delivery: pick("DEV", "DELIVERY_URL", "http://localhost:5176"),
    },
    staging: {
        api: pick("STAGING", "API_URL", ""),
        client: pick("STAGING", "CLIENT_URL", ""),
        admin: pick("STAGING", "ADMIN_URL", ""),
        vendor: pick("STAGING", "VENDOR_URL", ""),
        delivery: pick("STAGING", "DELIVERY_URL", ""),
    },
    production: {
        api: pick("PROD", "API_URL", "https://api.urbexon.in"),
        client: pick("PROD", "CLIENT_URL", "https://urbexon.in"),
        admin: pick("PROD", "ADMIN_URL", "https://admin.urbexon.in"),
        vendor: pick("PROD", "VENDOR_URL", "https://vendor.urbexon.in"),
        delivery: pick("PROD", "DELIVERY_URL", "https://delivery.partner.urbexon.in"),
    },
};

export const ENV = {
    name,
    apiUrl: SETS[name].api,
    apiBase: `${SETS[name].api}/api`,
    clientUrl: SETS[name].client,
    adminUrl: SETS[name].admin,
    vendorUrl: SETS[name].vendor,
    deliveryUrl: SETS[name].delivery,
    wsUrl: SETS[name].api.replace(/^http/, "ws") + "/ws",
};

/* ── Availability map written by global-setup (which apps are actually up) ── */
const STATE_DIR = path.join(ROOT, "playwright/.state");
const AVAIL_FILE = path.join(STATE_DIR, "availability.json");
const TOKENS_FILE = path.join(ROOT, "playwright/.auth/tokens.json");

export type Availability = { api: boolean; client: boolean; admin: boolean; vendor: boolean; delivery: boolean };

export const readAvailability = (): Availability => {
    try {
        return JSON.parse(fs.readFileSync(AVAIL_FILE, "utf-8"));
    } catch {
        return { api: false, client: false, admin: false, vendor: false, delivery: false };
    }
};

export type RoleTokens = Partial<Record<"customer" | "vendor" | "admin" | "delivery", { token: string; user: any }>>;

export const readTokens = (): RoleTokens => {
    try {
        return JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
    } catch {
        return {};
    }
};

export const PATHS = { ROOT, STATE_DIR, AVAIL_FILE, TOKENS_FILE };
