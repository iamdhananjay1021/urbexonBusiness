// Runs before every client build (see package.json "prebuild").
// Pulls the live sitemap (home/static pages + products/categories/vendor
// stores from the DB) from the backend and writes it into public/ so Vite
// ships it as a real static file at https://urbexon.in/sitemap.xml — the
// exact URL robots.txt advertises.
//
// Network failure here (backend down, no VITE_API_URL locally, offline
// dev machine, etc.) must NEVER fail the build. We log a warning and
// leave whatever sitemap.xml already exists in public/ untouched.

import { writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "../public/sitemap.xml");

const API_BASE = process.env.VITE_API_URL || "http://localhost:9000/api";
const SITEMAP_URL = `${API_BASE.replace(/\/$/, "")}/sitemap.xml`;

const FALLBACK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://urbexon.in/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;

async function generate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(SITEMAP_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`Backend responded ${res.status} ${res.statusText}`);
    }

    const xml = await res.text();
    if (!xml.trim().startsWith("<?xml")) {
      throw new Error("Response was not valid XML");
    }

    await writeFile(OUT_PATH, xml, "utf8");
    console.log(`[sitemap] Generated ${OUT_PATH} from ${SITEMAP_URL}`);
  } catch (err) {
    clearTimeout(timeout);
    console.warn(`[sitemap] Skipped live generation (${err.message}).`);

    try {
      await access(OUT_PATH);
      console.warn("[sitemap] Keeping existing public/sitemap.xml as-is.");
    } catch {
      console.warn("[sitemap] No existing sitemap.xml — writing minimal fallback.");
      await writeFile(OUT_PATH, FALLBACK_XML, "utf8");
    }
  }
}

await generate();
