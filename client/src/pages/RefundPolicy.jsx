import { useEffect } from "react";
import SEO from "../components/SEO";

export default function RefundPolicy() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#f5f7fa]">
            <SEO title="Cancellation & Refund Policy" description="Urbexon cancellation and refund policy. Easy returns and hassle-free refunds." path="/refund-policy" />

            {/* Header */}
            <div className="bg-white border-b border-stone-100 py-12">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-3">Customer Policy</p>
                    <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Cancellation &amp; Refund Policy
                    </h1>
                    <p className="mt-3 text-gray-500 text-sm">Last updated: March 2026 · Effective immediately</p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">

                {/* Quick Summary Cards — Flipkart style */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <QuickCard icon="🔄" title="Easy Returns" desc="Within 7 days of delivery" color="emerald" />
                    <QuickCard icon="💸" title="Fast Refunds" desc="Within 5–7 business days" color="blue" />
                    <QuickCard icon="❌" title="Free Cancellation" desc="Before order is packed" color="amber" />
                    <QuickCard icon="🛡️" title="Buyer Protection" desc="100% secure payments" color="violet" />
                </div>

                {/* Main Policy Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">

                    {/* Section: Cancellation */}
                    <SectionHeader icon="❌" title="1. Order Cancellation" />
                    <div className="p-6 space-y-4 border-b border-stone-100">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            You can cancel your order <strong>free of charge</strong> at any time before it is packed. Once the order is packed or handed over to our delivery partner, cancellation is no longer possible.
                        </p>

                        <div className="grid md:grid-cols-2 gap-4">
                            <StatusCard
                                color="emerald"
                                title="✅ Cancellation Allowed"
                                items={[
                                    "Order placed but not yet packed",
                                    "Payment pending or failed orders",
                                    "Duplicate orders placed by mistake",
                                ]}
                            />
                            <StatusCard
                                color="red"
                                title="❌ Cancellation NOT Allowed"
                                items={[
                                    "Order already packed",
                                    "Order picked up by courier",
                                    "Order already out for delivery",
                                    "Order already delivered",
                                ]}
                            />
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
                            <strong>How to cancel?</strong> Go to <em>My Orders → Select Order → Cancel Order</em>, or WhatsApp us at <strong>+91 88084 85840</strong> with your Order ID.
                        </div>
                    </div>

                    {/* Section: Return Policy */}
                    <SectionHeader icon="🔄" title="2. Return Policy" />
                    <div className="p-6 space-y-4 border-b border-stone-100">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            We offer a <strong>7-day return window</strong> from the date of delivery for eligible products. To initiate a return, the item must be unused, in its original packaging, and accompanied by a valid reason.
                        </p>

                        {/* Return Timeline — Flipkart style */}
                        <div className="relative mt-6">
                            <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-stone-200" />
                            <div className="space-y-5">
                                <TimelineStep step="1" title="Raise a Return Request" desc="Within 7 days of delivery via My Orders or WhatsApp" color="zinc" />
                                <TimelineStep step="2" title="Review & Approval" desc="Our team reviews your request within 24–48 hours" color="zinc" />
                                <TimelineStep step="3" title="Pickup Scheduled" desc="Courier picks up the item from your address" color="zinc" />
                                <TimelineStep step="4" title="Quality Check" desc="Item inspected at our warehouse (2–3 days)" color="zinc" />
                                <TimelineStep step="5" title="Refund Initiated" desc="Refund processed to your original payment method" color="emerald" />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <StatusCard
                                color="emerald"
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
                                color="red"
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
                    <div className="p-6 space-y-4 border-b border-stone-100">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            Once your return is approved and the item passes our quality check, your refund will be processed to the <strong>original payment method</strong> used at checkout.
                        </p>

                        {/* Refund Timeline Table */}
                        <div className="overflow-hidden rounded-xl border border-stone-200">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-zinc-900 text-white">
                                        <th className="text-left px-4 py-3 font-semibold">Payment Method</th>
                                        <th className="text-left px-4 py-3 font-semibold">Refund Timeline</th>
                                        <th className="text-left px-4 py-3 font-semibold">Refund To</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <RefundRow method="UPI (PhonePe, GPay, Paytm)" time="1–3 Business Days" to="UPI ID / Bank Account" alt />
                                    <RefundRow method="Credit / Debit Card" time="5–7 Business Days" to="Original Card" />
                                    <RefundRow method="Net Banking" time="3–5 Business Days" to="Bank Account" alt />
                                    <RefundRow method="Razorpay Wallet" time="1–2 Business Days" to="Razorpay Wallet" />
                                    <RefundRow method="Cash on Delivery (COD)" time="5–7 Business Days" to="Bank Account (NEFT)" alt />
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                            <strong>Note:</strong> Refund timelines are from the date of refund initiation. Bank processing times may add 2–5 additional business days. COD refunds require you to share bank account details with our support team.
                        </div>
                    </div>

                    {/* Section: Damaged / Wrong Item */}
                    <SectionHeader icon="📦" title="4. Damaged or Wrong Item Delivered" />
                    <div className="p-6 space-y-3 border-b border-stone-100">
                        <p className="text-gray-600 text-sm leading-relaxed">
                            If you receive a <strong>damaged, defective, or wrong item</strong>, please contact us within <strong>48 hours</strong> of delivery. We will arrange a free pickup and send a replacement or process a full refund.
                        </p>
                        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-sm text-zinc-700">
                            <p className="font-semibold mb-2">To report, share the following:</p>
                            <ul className="space-y-1 list-disc pl-4 text-zinc-600">
                                <li>Your Order ID</li>
                                <li>Clear photos/video of the damaged or wrong item</li>
                                <li>Photo of the outer packaging</li>
                            </ul>
                        </div>
                    </div>

                    {/* Section: Non-Returnable Categories */}
                    <SectionHeader icon="🚫" title="5. Non-Returnable &amp; Non-Refundable Items" />
                    <div className="p-6 space-y-3 border-b border-stone-100">
                        <p className="text-gray-600 text-sm">The following categories are strictly non-returnable and non-refundable:</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {[
                                "Customized / Personalized Items",
                                "Perishable Goods",
                                "Intimate / Hygiene Products",
                                "Digital Products / Software",
                                "Hazardous Materials",
                                "Items marked 'Non-Returnable' on product page",
                            ].map((item, i) => (
                                <div key={i} className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700 font-medium flex items-center gap-2">
                                    <span className="text-red-400">✕</span> {item}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Contact */}
                    <SectionHeader icon="📞" title="6. Need Help? Contact Us" />
                    <div className="p-6">
                        <p className="text-gray-600 text-sm mb-4">
                            Our support team is available <strong>Monday to Saturday, 10 AM – 7 PM IST</strong>. We typically respond within 2–4 hours.
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <a href="https://wa.me/918808485840" target="_blank" rel="noreferrer"
                                className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 hover:bg-emerald-100 transition-colors">
                                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white text-lg">💬</div>
                                <div>
                                    <p className="font-bold text-emerald-800 text-sm">WhatsApp Support</p>
                                    <p className="text-emerald-600 text-xs">+91 88084 85840</p>
                                </div>
                            </a>
                            <a href="mailto:officialurbexon@gmail.com"
                                className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white text-lg">✉️</div>
                                <div>
                                    <p className="font-bold text-blue-800 text-sm">Email Support</p>
                                    <p className="text-blue-600 text-xs">officialurbexon@gmail.com</p>
                                </div>
                            </a>
                        </div>

                        <div className="mt-5 bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-sm text-gray-700 space-y-1">
                            <p><strong>Urbexon</strong></p>
                            <p>Sector 62, Noida – 201309, Uttar Pradesh, India</p>
                            <p>GSTIN: 09AABCU1234F1Z5</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ── Sub-components ── */

function QuickCard({ icon, title, desc, color }) {
    const colors = {
        emerald: "bg-emerald-50 border-emerald-100 text-emerald-800",
        blue: "bg-blue-50 border-blue-100 text-blue-800",
        amber: "bg-amber-50 border-amber-100 text-amber-800",
        violet: "bg-violet-50 border-violet-100 text-violet-800",
    };
    return (
        <div className={`border rounded-xl p-4 text-center ${colors[color]}`}>
            <div className="text-2xl mb-2">{icon}</div>
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs mt-1 opacity-75">{desc}</p>
        </div>
    );
}

function SectionHeader({ icon, title }) {
    return (
        <div className="flex items-center gap-3 px-6 py-4 bg-stone-50 border-b border-stone-100">
            <span className="text-xl">{icon}</span>
            <h2 className="font-bold text-zinc-900 text-base">{title}</h2>
        </div>
    );
}

function StatusCard({ color, title, items }) {
    const colors = {
        emerald: { card: "bg-emerald-50 border-emerald-100", title: "text-emerald-800", dot: "text-emerald-500" },
        red: { card: "bg-red-50 border-red-100", title: "text-red-800", dot: "text-red-400" },
    };
    const s = colors[color];
    return (
        <div className={`border rounded-xl p-4 ${s.card}`}>
            <p className={`font-bold text-sm mb-3 ${s.title}`}>{title}</p>
            <ul className="space-y-1.5">
                {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className={`mt-0.5 shrink-0 ${s.dot}`}>●</span> {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TimelineStep({ step, title, desc, color }) {
    const colors = { zinc: "bg-zinc-800 text-white", emerald: "bg-emerald-500 text-white" };
    return (
        <div className="flex items-start gap-4 pl-0 relative">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 z-10 ${colors[color]}`}>
                {step}
            </div>
            <div className="pt-2">
                <p className="font-bold text-zinc-800 text-sm">{title}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
            </div>
        </div>
    );
}

function RefundRow({ method, time, to, alt }) {
    return (
        <tr className={alt ? "bg-stone-50" : "bg-white"}>
            <td className="px-4 py-3 text-zinc-700 font-medium">{method}</td>
            <td className="px-4 py-3 text-emerald-700 font-semibold">{time}</td>
            <td className="px-4 py-3 text-zinc-500">{to}</td>
        </tr>
    );
}