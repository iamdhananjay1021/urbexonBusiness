/**
 * CollectionPage.jsx — /collections/:slug
 *
 * Renders any rule-based collection the admin creates (New Arrivals,
 * Festival Collection, Editor's Choice, …) with paged products, sort,
 * SEO from collection metadata, and a recommendation rail below.
 * Zero collection-specific code — everything comes from the API.
 */
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import SEO, { JsonLd } from "../components/SEO";
import ProductCard from "../components/ProductCard";
import ProductRail from "../components/ProductRail";
import { fetchCollectionProducts } from "../api/collectionApi";
import { FiPackage, FiAlertTriangle } from "react-icons/fi";
import Button from "../design-system/Button";
import Pagination from "../design-system/Pagination";
import { SkeletonCard } from "../design-system/Skeleton";
import { EmptyState, ErrorState } from "../design-system/EmptyState";

const SORT_OPTIONS = [
    { val: "", label: "Default" },
    { val: "newest", label: "Newest First" },
    { val: "popularity", label: "Popularity" },
    { val: "price_asc", label: "Price: Low to High" },
    { val: "price_desc", label: "Price: High to Low" },
    { val: "rating", label: "Top Rated" },
    { val: "discount", label: "Best Discount" },
];

const CollectionPage = () => {
    const { slug } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const sort = searchParams.get("sort") || "";

    const requestKey = useMemo(() => JSON.stringify({ slug, page, sort }), [slug, page, sort]);
    const [result, setResult] = useState({ key: null, data: null, error: null });

    useEffect(() => {
        const ctrl = new AbortController();
        const { slug: s, page: p, sort: srt } = JSON.parse(requestKey);
        fetchCollectionProducts(s, { page: p, ...(srt ? { sort: srt } : {}) }, { signal: ctrl.signal })
            .then(({ data }) => setResult({ key: requestKey, data, error: null }))
            .catch((err) => {
                if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                setResult({
                    key: requestKey, data: null,
                    error: err.response?.status === 404 ? "Collection not found" : "Failed to load collection",
                });
            });
        return () => ctrl.abort();
    }, [requestKey]);

    const loading = result.key !== requestKey;
    const { data, error } = result;
    const collection = data?.collection;
    const products = data?.products || [];

    const setParam = (key, value) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (value) next.set(key, value); else next.delete(key);
            if (key !== "page") next.delete("page");
            return next;
        });
        if (key === "page") window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (!loading && error) return (
        <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
            <ErrorState
                icon={FiAlertTriangle}
                title={error}
                description="The collection may have been removed."
                action={<Button variant="primary" onClick={() => window.location.assign("/products")}>Browse Products</Button>}
            />
        </div>
    );

    return (
        <div className="min-h-screen bg-canvas">
            {collection && (
                <>
                    <SEO
                        title={collection.seo?.title || collection.name}
                        description={collection.seo?.description}
                        path={`/collections/${slug}`}
                        image={collection.image || undefined}
                    />
                    <JsonLd data={{
                        "@context": "https://schema.org",
                        "@type": "CollectionPage",
                        name: collection.name,
                        description: collection.description,
                        url: `https://www.urbexon.in/collections/${slug}`,
                    }} />
                </>
            )}

            {/* ── Hero — light Signal palette ── */}
            <div className="bg-white border-b border-[var(--color-graphite-100)] px-[clamp(16px,5vw,80px)] pt-9 pb-7">
                <div className="max-w-[1400px] mx-auto">
                    <p className="inline-block pl-2.5 border-l-2 border-[var(--accent-primary)] text-[10px] font-bold tracking-[.16em] uppercase text-accent mb-3 leading-none">
                        Urbexon · Collection
                    </p>
                    <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-extrabold text-primary tracking-tight mb-2">
                        {collection?.name || (loading ? "…" : slug?.replace(/-/g, " "))}
                    </h1>
                    {collection?.description && (
                        <p className="text-[13px] text-secondary max-w-[560px]">{collection.description}</p>
                    )}
                    <p className="text-[13px] text-muted mt-2" aria-live="polite">
                        {loading ? "Loading products…" : `${(data?.total || 0).toLocaleString()} products`}
                    </p>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto px-[clamp(16px,5vw,80px)] pt-8 pb-16">
                {/* ── Sort pills ── */}
                <div className="flex gap-2 flex-wrap mb-6">
                    {SORT_OPTIONS.map((o) => (
                        <button key={o.val} onClick={() => setParam("sort", o.val)}
                            className={`h-8 px-4 rounded-full text-xs font-semibold border transition-colors duration-200 whitespace-nowrap
                                ${sort === o.val
                                    ? "bg-[var(--color-graphite-900)] border-[var(--color-graphite-900)] text-white"
                                    : "bg-white border-default text-secondary hover:border-strong hover:text-primary"}`}>
                            {o.label}
                        </button>
                    ))}
                </div>

                {!loading && products.length === 0 ? (
                    <div className="py-16 flex justify-center">
                        <EmptyState
                            icon={FiPackage}
                            title="No products in this collection yet"
                            description="Products matching the collection rules will appear here automatically."
                        />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                            {loading
                                ? Array(10).fill(0).map((_, i) => <SkeletonCard key={i} />)
                                : products.map((p) => <ProductCard key={p._id} product={p} hideActions />)}
                        </div>
                        {!loading && (data?.totalPages || 1) > 1 && (
                            <div className="py-10">
                                <Pagination page={page} totalPages={data.totalPages} onChange={(p) => setParam("page", String(p))} />
                            </div>
                        )}
                    </>
                )}

                {/* ── Recommendation rail — proves the engines compose ── */}
                <div className="mt-14 pt-10 border-t border-[var(--color-graphite-100)]">
                    <ProductRail type="trending" title="Trending Now" sub="What everyone's looking at this month" to="/products?sort=popularity" />
                </div>
            </div>
        </div>
    );
};

export default CollectionPage;
