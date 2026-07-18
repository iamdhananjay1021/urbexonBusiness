/**
 * CollectionsIndex.jsx — /collections
 * Entry point for the Collection Engine: every active collection the
 * admin creates shows up here automatically (GET /api/collections).
 * Without this page collections were orphans — reachable only by URL.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";
import { fetchCollections } from "../api/collectionApi";
import { FiLayers, FiArrowRight } from "react-icons/fi";

const SkeletonCard = () => (
    <div className="bg-white border border-[var(--color-graphite-100)] rounded-xl overflow-hidden">
        <div className="aspect-[16/7] bg-[var(--color-graphite-100)] animate-pulse" />
        <div className="p-5 flex flex-col gap-2.5">
            <div className="h-4 w-1/2 bg-[var(--color-graphite-100)] rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-[var(--color-graphite-100)] rounded animate-pulse" />
        </div>
    </div>
);

const CollectionsIndex = () => {
    const [result, setResult] = useState({ loaded: false, collections: [] });

    useEffect(() => {
        const ctrl = new AbortController();
        fetchCollections({ signal: ctrl.signal })
            .then(({ data }) => setResult({ loaded: true, collections: data?.collections || [] }))
            .catch((err) => {
                if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                setResult({ loaded: true, collections: [] });
            });
        return () => ctrl.abort();
    }, []);

    const { loaded, collections } = result;

    return (
        <div className="bg-canvas min-h-screen">
            <SEO
                title="Collections"
                description="Shop curated collections on Urbexon — new arrivals, best sellers, festival picks and more, updated automatically."
                path="/collections"
            />

            {/* ── Hero — light Signal palette ── */}
            <div className="bg-white border-b border-[var(--color-graphite-100)] px-[clamp(16px,5vw,80px)] pt-9 pb-7">
                <div className="max-w-[1280px] mx-auto">
                    <p className="inline-block pl-2.5 border-l-2 border-[var(--accent-primary)] text-[10px] font-bold tracking-[.16em] uppercase text-accent mb-3 leading-none">
                        Urbexon · Curated
                    </p>
                    <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-extrabold text-primary tracking-tight mb-2">
                        Collections
                    </h1>
                    <p className="text-[13px] text-muted">
                        Hand-picked themes that update themselves — new products flow in automatically
                    </p>
                </div>
            </div>

            <div className="max-w-[1280px] mx-auto px-[clamp(16px,5vw,80px)] py-8 sm:py-10">
                {!loaded ? (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
                    </div>
                ) : collections.length === 0 ? (
                    <div className="text-center py-20">
                        <FiLayers size={40} className="mx-auto text-[var(--color-graphite-200)] mb-4" />
                        <p className="text-base font-bold text-primary">No collections yet</p>
                        <p className="text-[13px] text-muted mt-1.5 mb-6">Check back soon — curated picks are on the way.</p>
                        <Link to="/products"
                            className="inline-flex items-center gap-2 h-11 px-7 rounded-xl bg-accent text-white
                                       text-sm font-bold no-underline hover:bg-accent-hover transition-colors duration-200">
                            Browse All Products <FiArrowRight size={13} />
                        </Link>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {collections.map((c) => (
                            <Link key={c.slug} to={`/collections/${c.slug}`}
                                className="group no-underline bg-white border border-[var(--color-graphite-100)] rounded-xl overflow-hidden
                                           shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5
                                           transition-all duration-200
                                           focus-visible:outline-none focus-ring-accent">
                                {/* Banner — image or graphite gradient fallback */}
                                <div className="relative aspect-[16/7] overflow-hidden bg-[var(--color-graphite-900)]">
                                    {c.image ? (
                                        <img src={c.image} alt={c.name} loading="lazy"
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <FiLayers size={28} className="text-white/20" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,21,26,0.55)] to-transparent" />
                                    <p className="absolute bottom-3 left-4 right-4 text-white font-display font-bold text-lg leading-tight">
                                        {c.name}
                                    </p>
                                </div>
                                <div className="p-4 flex items-center justify-between gap-3">
                                    <p className="text-[12.5px] text-secondary leading-snug line-clamp-2 flex-1">
                                        {c.description || `Explore the ${c.name} collection`}
                                    </p>
                                    <span className="w-8 h-8 rounded-full bg-accent-tint flex items-center justify-center shrink-0
                                                     transition-transform duration-200 group-hover:translate-x-0.5">
                                        <FiArrowRight size={13} className="text-accent" />
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CollectionsIndex;
