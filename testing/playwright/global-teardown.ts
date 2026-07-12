/**
 * Global teardown — QA data is deliberately left in place (idempotent
 * seed keyed on fixed emails/slugs) so failures can be inspected against
 * the exact data that produced them. Cached auth tokens are removed so a
 * stale token never leaks into the next run.
 */
import * as fs from "fs";
import { PATHS } from "./config/env";

export default async function globalTeardown() {
    try {
        fs.rmSync(PATHS.TOKENS_FILE, { force: true });
    } catch {
        /* nothing to clean */
    }
}
