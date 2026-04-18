import { Helmet } from "react-helmet-async";

const SITE = "Urbexon";
const BASE = "https://www.urbexon.in";
const DEFAULT_DESC = "Shop at Urbexon for the best deals on fashion, electronics, home essentials, and more. Fast delivery across India.";
const DEFAULT_IMG = `${BASE}/logo.png`;

/**
 * Reusable SEO head component.
 *
 * @param {string}  title       – Page title (appended with " | Urbexon")
 * @param {string}  description – Meta description (max ~160 chars)
 * @param {string}  path        – Canonical path e.g. "/products" (auto-prefixed with BASE)
 * @param {string}  image       – OG/Twitter image URL
 * @param {boolean} noindex     – Set true for auth-gated / private pages
 * @param {string}  type        – OG type (default "website")
 * @param {object}  schema      – JSON-LD structured data object
 */
export default function SEO({
    title,
    description = DEFAULT_DESC,
    path = "",
    image = DEFAULT_IMG,
    noindex = false,
    type = "website",
    schema,
}) {
    const fullTitle = title ? `${title} | ${SITE}` : `${SITE} | Premium Online Shopping`;
    const canonical = `${BASE}${path}`;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={description} />
            <link rel="canonical" href={canonical} />
            <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />

            {/* Open Graph */}
            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={description} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={image} />
            <meta property="og:type" content={type} />
            <meta property="og:site_name" content={SITE} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={description} />
            <meta name="twitter:image" content={image} />
        </Helmet>
    );
}

/**
 * Render a JSON-LD script for structured data.
 * Use alongside <SEO /> for product / breadcrumb schemas.
 */
export function JsonLd({ data }) {
    if (!data) return null;
    return (
        <Helmet>
            <script type="application/ld+json">{JSON.stringify(data)}</script>
        </Helmet>
    );
}
