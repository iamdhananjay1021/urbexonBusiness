/**
 * AboutUs.jsx — /about
 * The footer linked here since day one but the route never existed (404).
 * Signal design system; static content, no business logic.
 */
import { Link } from "react-router-dom";
import SEO, { JsonLd } from "../components/SEO";
import {
    FaStore, FaBolt, FaShippingFast, FaLock, FaMedal, FaHeadset, FaArrowRight,
} from "react-icons/fa";

const STATS = [
    { value: "500+", label: "Products" },
    { value: "20+", label: "Categories" },
    { value: "45 min", label: "Urbexon Hour delivery" },
    { value: "100%", label: "Verified sellers" },
];

const PILLARS = [
    {
        Icon: FaStore,
        title: "Multi-vendor Marketplace",
        text: "Fashion, electronics, home essentials and more from verified sellers across India — one cart, one checkout, one promise.",
    },
    {
        Icon: FaBolt,
        title: "Urbexon Hour",
        text: "Our quick-commerce network delivers groceries and daily essentials from hyperlocal stores to your door in about 45 minutes.",
        hour: true,
    },
    {
        Icon: FaLock,
        title: "Trust by Default",
        text: "Encrypted payments, transparent pricing, easy returns and a support team that actually answers — trust isn't a feature, it's the baseline.",
    },
];

const VALUES = [
    { Icon: FaShippingFast, title: "Fast", text: "Free delivery over ₹499, express in 45 minutes with Urbexon Hour." },
    { Icon: FaMedal, title: "Genuine", text: "Every seller is verified; every product is authentic." },
    { Icon: FaLock, title: "Secure", text: "100% encrypted checkout and payment protection." },
    { Icon: FaHeadset, title: "Human", text: "Real support, 24/7 — before and after your order." },
];

const AboutUs = () => (
    <div className="bg-canvas min-h-screen">
        <SEO
            title="About Us"
            description="Urbexon is India's premium multi-vendor marketplace — fashion, electronics and essentials from verified sellers, plus 45-minute hyperlocal delivery with Urbexon Hour."
            path="/about"
        />
        <JsonLd data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Urbexon",
            url: "https://www.urbexon.in",
            logo: "https://www.urbexon.in/logo.png",
            description: "India's premium multi-vendor marketplace with hyperlocal express delivery.",
            contactPoint: { "@type": "ContactPoint", telephone: "+91-88084-85840", contactType: "customer support", email: "support@urbexon.in" },
        }} />

        {/* ── Hero — light Signal palette ── */}
        <div className="bg-white border-b border-[var(--color-graphite-100)] px-[clamp(16px,5vw,80px)] pt-12 pb-10">
            <div className="max-w-[1280px] mx-auto">
                <p className="inline-block pl-2.5 border-l-2 border-[var(--accent-primary)] text-[10px] font-bold tracking-[.16em] uppercase text-accent mb-3 leading-none">
                    About Urbexon
                </p>
                <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold text-primary leading-[1.12] tracking-tight max-w-[640px] mb-4">
                    Everything you love, from <span className="text-accent">people you can trust.</span>
                </h1>
                <p className="text-[14px] sm:text-[15px] text-secondary leading-relaxed max-w-[560px]">
                    Urbexon is India's premium multi-vendor marketplace — bringing verified local
                    sellers, national brands and 45-minute hyperlocal delivery together on one platform.
                </p>
            </div>
        </div>

        {/* ── Stats strip ── */}
        <div className="bg-white border-b border-[var(--color-graphite-100)]">
            <div className="max-w-[1280px] mx-auto px-[clamp(16px,5vw,80px)] py-8
                            grid grid-cols-2 md:grid-cols-4 gap-6">
                {STATS.map(({ value, label }) => (
                    <div key={label} className="text-center">
                        <p className="text-[26px] sm:text-[30px] font-extrabold text-primary leading-none">{value}</p>
                        <p className="text-[11px] text-muted font-semibold uppercase tracking-[0.08em] mt-2">{label}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* ── Pillars ── */}
        <div className="max-w-[1280px] mx-auto px-[clamp(16px,5vw,80px)] py-10 sm:py-14">
            <div className="text-center mb-8">
                <span className="inline-block text-[10px] font-bold tracking-[0.16em] uppercase text-accent">What we do</span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight mt-2.5">
                    One platform, three promises
                </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
                {PILLARS.map(({ Icon, title, text, hour }) => ( // eslint-disable-line no-unused-vars -- Icon rendered as <Icon/>
                    <div key={title}
                        className="bg-white border border-[var(--color-graphite-100)] rounded-xl p-6
                                   shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5
                                   transition-all duration-200">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4
                                        ${hour ? "bg-hour-tint" : "bg-accent-tint"}`}>
                            <Icon size={18} className={hour ? "text-[var(--accent-hour-hover)]" : "text-accent"} />
                        </div>
                        <h3 className="text-[15px] font-bold text-primary mb-2 tracking-tight">{title}</h3>
                        <p className="text-[13px] text-secondary leading-relaxed">{text}</p>
                    </div>
                ))}
            </div>
        </div>

        {/* ── Values ── */}
        <div className="bg-white border-y border-[var(--color-graphite-100)]">
            <div className="max-w-[1280px] mx-auto px-[clamp(16px,5vw,80px)] py-10 sm:py-14">
                <div className="text-center mb-8">
                    <span className="inline-block text-[10px] font-bold tracking-[0.16em] uppercase text-accent">Our values</span>
                    <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight mt-2.5">
                        Why shoppers stay with Urbexon
                    </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {VALUES.map(({ Icon, title, text }) => ( // eslint-disable-line no-unused-vars -- Icon rendered as <Icon/>
                        <div key={title} className="text-center px-2">
                            <div className="w-10 h-10 rounded-full bg-accent-tint flex items-center justify-center mx-auto mb-3">
                                <Icon size={15} className="text-accent" />
                            </div>
                            <p className="text-sm font-bold text-primary mb-1">{title}</p>
                            <p className="text-xs text-muted leading-relaxed">{text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* ── CTA ── */}
        <div className="max-w-[1280px] mx-auto px-[clamp(16px,5vw,80px)] py-12 text-center">
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary tracking-tight mb-3">
                Ready to explore?
            </h2>
            <p className="text-[13px] text-muted mb-6 max-w-[400px] mx-auto">
                Thousands of products from verified sellers — or sell with us and reach customers across India.
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
                <Link to="/products"
                    className="inline-flex items-center gap-2 h-11 px-7 rounded-xl bg-accent text-white
                               text-sm font-bold no-underline hover:bg-accent-hover transition-colors duration-200">
                    Start Shopping <FaArrowRight size={11} />
                </Link>
                <Link to="/become-vendor"
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-xl bg-white border border-strong
                               text-primary text-sm font-semibold no-underline
                               hover:border-[var(--color-graphite-400)] transition-colors duration-200">
                    Become a Vendor
                </Link>
            </div>
        </div>
    </div>
);

export default AboutUs;
