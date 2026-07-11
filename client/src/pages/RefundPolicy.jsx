import { useEffect } from "react";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Alert from "../design-system/Alert";
import Table from "../design-system/Table";
import { cn } from "../design-system/utils/cn";

export default function RefundPolicy() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const refundRows = [
        { _id: "upi", method: "UPI (PhonePe, GPay, Paytm)", time: "1–3 Business Days", to: "UPI ID / Bank Account" },
        { _id: "card", method: "Credit / Debit Card", time: "5–7 Business Days", to: "Original Card" },
        { _id: "netbanking", method: "Net Banking", time: "3–5 Business Days", to: "Bank Account" },
        { _id: "wallet", method: "Razorpay Wallet", time: "1–2 Business Days", to: "Razorpay Wallet" },
        { _id: "cod", method: "Cash on Delivery (COD)", time: "5–7 Business Days", to: "Bank Account (NEFT)" },
    ];

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="Cancellation & Refund Policy" description="Urbexon cancellation and refund policy. Easy returns and hassle-free refunds." path="/refund-policy" />

            {/* Header */}
            <div className="bg-surface border-b border-default py-12">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-muted text-sm font-medium tracking-widest uppercase mb-3">Customer Policy</p>
                    <h1 className="text-4xl font-bold text-primary font-display">
                        Cancellation &amp; Refund Policy
                    </h1>
                    <p className="mt-3 text-secondary text-sm">Last updated: March 2026 · Effective immediately</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickCard icon="🔄" title="Easy Returns" desc="Within 7 days of delivery" tint="bg-success-tint text-success" />
                    <QuickCard icon="💸" title="Fast Refunds" desc="Within 5–7 business days" tint="bg-info-tint text-info" />
                    <QuickCard icon="❌" title="Free Cancellation" desc="Before order is packed" tint="bg-warning-tint text-warning" />
                    <QuickCard icon="🛡️" title="Buyer Protection" desc="100% secure payments" tint="bg-accent-tint text-accent" />
                </div>

                {/* Main Policy Card */}
                <Card padding="none" className="overflow-hidden">

                    {/* Section: Cancellation */}
                    <SectionHeader icon="❌" title="1. Order Cancellation" />
                    <div className="p-6 space-y-4 border-b border-default">
                        <p className="text-secondary text-sm leading-relaxed">
                            You can cancel your order <strong>free of charge</strong> at any time before it is packed. Once the order is packed or handed over to our delivery partner, cancellation is no longer possible.
                        </p>

                        <div className="grid md:grid-cols-2 gap-4">
                            <StatusCard
                                variant="success"
                                title="✅ Cancellation Allowed"
                                items={[
                                    "Order placed but not yet packed",
                                    "Payment pending or failed orders",
                                    "Duplicate orders placed by mistake",
                                ]}
                            />
                            <StatusCard
                                variant="error"
                                title="❌ Cancellation NOT Allowed"
                                items={[
                                    "Order already packed",
                                    "Order picked up by courier",
                                    "Order already out for delivery",
                                    "Order already delivered",
                                ]}
                            />
                        </div>

                        <Alert variant="info">
                            <strong>How to cancel?</strong> Go to <em>My Orders → Select Order → Cancel Order</em>, or WhatsApp us at <strong>+91 88084 85840</strong> with your Order ID.
                        </Alert>
                    </div>

                    {/* Section: Return Policy */}
                    <SectionHeader icon="🔄" title="2. Return Policy" />
                    <div className="p-6 space-y-4 border-b border-default">
                        <p className="text-secondary text-sm leading-relaxed">
                            We offer a <strong>7-day return window</strong> from the date of delivery for eligible products. To initiate a return, the item must be unused, in its original packaging, and accompanied by a valid reason.
                        </p>

                        {/* Return Timeline */}
                        <div className="relative mt-6">
                            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-[var(--color-graphite-200)]" />
                            <div className="space-y-5">
                                <TimelineStep step="1" title="Raise a Return Request" desc="Within 7 days of delivery via My Orders or WhatsApp" />
                                <TimelineStep step="2" title="Review & Approval" desc="Our team reviews your request within 24–48 hours" />
                                <TimelineStep step="3" title="Pickup Scheduled" desc="Courier picks up the item from your address" />
                                <TimelineStep step="4" title="Quality Check" desc="Item inspected at our warehouse (2–3 days)" />
                                <TimelineStep step="5" title="Refund Initiated" desc="Refund processed to your original payment method" success />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <StatusCard
                                variant="success"
                                title="✅ Returnable If"
                                items={[
                                    "Wrong item delivered",
                                    "Physically damaged on delivery",
                                    "Item is defective or not working",
                                    "Item missing from package",
                                    "Significantly different from description",
                                ]}
                            />
                            <StatusCard
                                variant="error"
                                title="❌ NOT Returnable If"
                                items={[
                                    "Item has been used or worn",
                                    "Original tags or packaging removed",
                                    "Return request raised after 7 days",
                                    "Damage caused by misuse",
                                    "Customized or personalized items",
                                ]}
                            />
                        </div>
                    </div>

                    {/* Section: Refund */}
                    <SectionHeader icon="💸" title="3. Refund Policy" />
                    <div className="p-6 space-y-4 border-b border-default">
                        <p className="text-secondary text-sm leading-relaxed">
                            Once your return is approved and the item passes our quality check, your refund will be processed to the <strong>original payment method</strong> used at checkout.
                        </p>

                        <Table
                            columns={[
                                { key: "method", header: "Payment Method" },
                                { key: "time", header: "Refund Timeline", render: (r) => <span className="text-success font-semibold">{r.time}</span> },
                                { key: "to", header: "Refund To" },
                            ]}
                            rows={refundRows}
                        />

                        <Alert variant="warning">
                            <strong>Note:</strong> Refund timelines are from the date of refund initiation. Bank processing times may add 2–5 additional business days. COD refunds require you to share bank account details with our support team.
                        </Alert>
                    </div>

                    {/* Section: Damaged / Wrong Item */}
                    <SectionHeader icon="📦" title="4. Damaged or Wrong Item Delivered" />
                    <div className="p-6 space-y-3 border-b border-default">
                        <p className="text-secondary text-sm leading-relaxed">
                            If you receive a <strong>damaged, defective, or wrong item</strong>, please contact us within <strong>48 hours</strong> of delivery. We will arrange a free pickup and send a replacement or process a full refund.
                        </p>
                        <div className="bg-canvas border border-default rounded-[var(--radius-md)] p-4 text-sm text-primary">
                            <p className="font-semibold mb-2">To report, share the following:</p>
                            <ul className="space-y-1 list-disc pl-4 text-secondary">
                                <li>Your Order ID</li>
                                <li>Clear photos/video of the damaged or wrong item</li>
                                <li>Photo of the outer packaging</li>
                            </ul>
                        </div>
                    </div>

                    {/* Section: Non-Returnable Categories */}
                    <SectionHeader icon="🚫" title="5. Non-Returnable &amp; Non-Refundable Items" />
                    <div className="p-6 space-y-3 border-b border-default">
                        <p className="text-secondary text-sm">The following categories are strictly non-returnable and non-refundable:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                "Customized / Personalized Items",
                                "Perishable Goods",
                                "Intimate / Hygiene Products",
                                "Digital Products / Software",
                                "Hazardous Materials",
                                "Items marked 'Non-Returnable' on product page",
                            ].map((item, i) => (
                                <div key={i} className="bg-error-tint border border-[var(--color-error-100)] rounded-[var(--radius-sm)] px-3 py-2 text-xs text-error font-medium flex items-center gap-2">
                                    <span className="text-[var(--color-error-500)]">✕</span> {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Contact */}
                    <SectionHeader icon="📞" title="6. Need Help? Contact Us" />
                    <div className="p-6">
                        <p className="text-secondary text-sm mb-4">
                            Our support team is available <strong>Monday to Saturday, 10 AM – 7 PM IST</strong>. We typically respond within 2–4 hours.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <a href="https://wa.me/918808485840" target="_blank" rel="noreferrer"
                                className="flex items-center gap-3 bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-md)] p-4 hover:brightness-95 transition-all">
                                <div className="w-10 h-10 bg-[var(--color-success-500)] rounded-[var(--radius-md)] flex items-center justify-center text-white text-lg">💬</div>
                                <div>
                                    <p className="font-bold text-success text-sm">WhatsApp Support</p>
                                    <p className="text-success text-xs">+91 88084 85840</p>
                                </div>
                            </a>
                            <a href="mailto:support@urbexon.in"
                                className="flex items-center gap-3 bg-info-tint border border-[var(--color-info-100)] rounded-[var(--radius-md)] p-4 hover:brightness-95 transition-all">
                                <div className="w-10 h-10 bg-[var(--color-info-500)] rounded-[var(--radius-md)] flex items-center justify-center text-white text-lg">✉️</div>
                                <div>
                                    <p className="font-bold text-info text-sm">Email Support</p>
                                    <p className="text-info text-xs">support@urbexon.in</p>
                                </div>
                            </a>
                        </div>

                        <div className="mt-5 bg-canvas border border-default rounded-[var(--radius-md)] p-5 text-sm text-primary space-y-1">
                            <p><strong>Urbexon</strong></p>
                            <p>Sector 62, Noida – 201309, Uttar Pradesh, India</p>
                            <p>GSTIN: 09AABCU1234F1Z5</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function QuickCard({ icon, title, desc, tint }) {
    return (
        <div className={cn("border border-default rounded-[var(--radius-md)] p-4 text-center", tint)}>
            <div className="text-2xl mb-2">{icon}</div>
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs mt-1 opacity-75">{desc}</p>
        </div>
    );
}

function SectionHeader({ icon, title }) {
    return (
        <div className="flex items-center gap-3 px-6 py-4 bg-canvas border-b border-default">
            <span className="text-xl">{icon}</span>
            <h2 className="font-bold text-primary text-base font-display">{title}</h2>
        </div>
    );
}

function StatusCard({ variant, title, items }) {
    const styles = {
        success: { card: "bg-success-tint border-[var(--color-success-100)]", title: "text-success", dot: "text-[var(--color-success-500)]" },
        error: { card: "bg-error-tint border-[var(--color-error-100)]", title: "text-error", dot: "text-[var(--color-error-500)]" },
    };
    const s = styles[variant];
    return (
        <div className={cn("border rounded-[var(--radius-md)] p-4", s.card)}>
            <p className={cn("font-bold text-sm mb-3", s.title)}>{title}</p>
            <ul className="space-y-1.5">
                {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-secondary">
                        <span className={cn("mt-0.5 shrink-0", s.dot)}>●</span> {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TimelineStep({ step, title, desc, success }) {
    return (
        <div className="flex items-start gap-4 pl-0 relative">
            <div
                className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 z-10 text-white",
                    success ? "bg-[var(--color-success-500)]" : "bg-[var(--color-graphite-900)]"
                )}
            >
                {step}
            </div>
            <div className="pt-2">
                <p className="font-bold text-primary text-sm">{title}</p>
                <p className="text-muted text-xs mt-0.5">{desc}</p>
            </div>
        </div>
    );
}
