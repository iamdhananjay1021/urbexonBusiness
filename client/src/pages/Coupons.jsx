/**
 * Coupons.jsx — My Coupons page
 * Route: /coupons
 * Real data only — GET /coupons/active already filters out expired,
 * usage-limit-exhausted, and already-used-by-this-user codes server-side.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as couponApi from "../api/couponApi";
import { FiTag, FiCopy, FiCheck, FiArrowLeft } from "react-icons/fi";
import SEO from "../components/SEO";
import Loader from "../design-system/Loader";
import Card from "../design-system/Card";
import { EmptyState } from "../design-system/EmptyState";

const formatDiscount = (c) =>
    c.discountType === "PERCENT"
        ? `${c.discountValue}% OFF${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ""}`
        : `₹${c.discountValue} OFF`;

const Coupons = () => {
    const navigate = useNavigate();
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [copiedCode, setCopiedCode] = useState("");

    useEffect(() => {
        couponApi.getActiveCoupons()
            .then(({ data }) => setCoupons(data.coupons || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const copyCode = (code) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(""), 2000);
        });
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-canvas">
            <Loader size="lg" />
        </div>
    );

    return (
        <div className="min-h-screen bg-canvas px-[clamp(12px,4vw,40px)] py-8">
            <SEO title="My Coupons" noindex />
            <div className="max-w-[720px] mx-auto">
                <div className="flex items-center gap-3 mb-7">
                    <button
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="w-9 h-9 rounded-full bg-surface border border-default flex items-center justify-center text-secondary hover:text-accent transition-colors flex-shrink-0"
                    >
                        <FiArrowLeft size={15} aria-hidden="true" />
                    </button>
                    <h1 className="text-[clamp(20px,3vw,26px)] font-bold text-primary font-display flex items-center gap-2.5">
                        <FiTag className="text-accent" size={20} aria-hidden="true" />
                        My Coupons <span className="text-[15px] text-muted font-medium">({coupons.length})</span>
                    </h1>
                </div>

                {coupons.length === 0 ? (
                    <EmptyState icon={FiTag} title="No coupons available right now" description="Check back later for new offers." />
                ) : (
                    <div className="flex flex-col gap-3">
                        {coupons.map((c) => (
                            <Card key={c._id} padding="md" className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-full bg-accent-tint flex items-center justify-center flex-shrink-0">
                                    <FiTag className="text-accent" size={18} aria-hidden="true" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[15px] font-extrabold text-primary">{formatDiscount(c)}</p>
                                    {c.description && <p className="text-xs text-secondary mt-0.5">{c.description}</p>}
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        {c.minOrderValue > 0 && (
                                            <span className="text-[10.5px] font-semibold text-muted">Min order ₹{c.minOrderValue}</span>
                                        )}
                                        {c.expiresAt && (
                                            <span className="text-[10.5px] font-semibold text-muted">
                                                Valid till {new Date(c.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                            </span>
                                        )}
                                        {c.applicableTo !== "ALL" && (
                                            <span className="text-[9.5px] font-extrabold uppercase tracking-wide text-accent bg-accent-tint px-2 py-0.5 rounded-full">
                                                {c.applicableTo === "URBEXON_HOUR" ? "Urbexon Hour" : "Ecommerce"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => copyCode(c.code)}
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--accent-primary)] text-accent text-[13px] font-extrabold tracking-wide flex-shrink-0 hover:bg-accent-tint transition-colors"
                                >
                                    {copiedCode === c.code ? <FiCheck size={13} aria-hidden="true" /> : <FiCopy size={13} aria-hidden="true" />}
                                    {c.code}
                                </button>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Coupons;
