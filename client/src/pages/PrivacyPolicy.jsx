import { useEffect } from "react";
import SEO from "../components/SEO";

export default function PrivacyPolicy() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#fdf8f3]">
            <SEO title="Privacy Policy" description="Read Urbexon's privacy policy. Learn how we collect, use, and protect your personal information." path="/privacy-policy" />
            {/* Header */}
            <div className="bg-white border-b border-stone-100 py-12">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-3">Legal</p>
                    <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Privacy Policy
                    </h1>
                    <p className="mt-3 text-gray-500 text-sm">Last updated: March 2026</p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 md:p-12 space-y-10">

                    <Section title="1. Information We Collect">
                        <p>We collect information you provide directly to us when you create an account, place an order, or contact us. This includes:</p>
                        <ul>
                            <li>Name, email address, phone number</li>
                            <li>Shipping and billing address</li>
                            <li>Payment information (processed securely via Razorpay — we do not store card details)</li>
                            <li>Order history and preferences</li>
                        </ul>
                        <p>We also automatically collect certain information when you visit our website, such as your IP address, browser type, and pages visited.</p>
                    </Section>

                    <Section title="2. How We Use Your Information">
                        <p>We use the information we collect to:</p>
                        <ul>
                            <li>Process and fulfill your orders</li>
                            <li>Send order confirmations and delivery updates</li>
                            <li>Respond to your queries and customer support requests</li>
                            <li>Improve our website and services</li>
                            <li>Send promotional emails (only with your consent)</li>
                            <li>Comply with legal obligations</li>
                        </ul>
                    </Section>

                    <Section title="3. Sharing of Information">
                        <p>We do not sell, trade, or rent your personal information to third parties. We may share your information with:</p>
                        <ul>
                            <li><strong>Payment Processors:</strong> Razorpay, for secure payment processing</li>
                            <li><strong>Delivery Partners:</strong> Logistics and courier services engaged to deliver your order</li>
                            <li><strong>Legal Authorities:</strong> When required by law or to protect our rights</li>
                        </ul>
                    </Section>

                    <Section title="4. Data Security">
                        <p>We implement industry-standard security measures to protect your personal information. All payment transactions are encrypted using SSL technology and processed through Razorpay's secure payment gateway. However, no method of transmission over the Internet is 100% secure.</p>
                    </Section>

                    <Section title="5. Cookies">
                        <p>We use cookies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can choose to disable cookies through your browser settings, though this may affect some features of our website.</p>
                    </Section>

                    <Section title="6. Your Rights">
                        <p>You have the right to:</p>
                        <ul>
                            <li>Access and update your personal information</li>
                            <li>Request deletion of your data (subject to legal obligations)</li>
                            <li>Opt out of marketing communications at any time</li>
                            <li>Lodge a complaint with the relevant data protection authority</li>
                        </ul>
                    </Section>

                    <Section title="7. Children's Privacy">
                        <p>Our website is not intended for children under the age of 13. We do not knowingly collect personal information from children.</p>
                    </Section>

                    <Section title="8. Changes to This Policy">
                        <p>We may update this Privacy Policy from time to time. We will notify you of any significant changes by posting the new policy on this page with an updated date.</p>
                    </Section>

                    <Section title="9. Contact Us">
                        <p>If you have any questions about this Privacy Policy, please contact us:</p>
                        <ContactBox />
                    </Section>

                </div>
            </div>
        </div>
    );
}

function Section({ title, children }) {
    return (
        <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                {title}
            </h2>
            <div className="text-gray-600 leading-relaxed space-y-3 [&_ul]:mt-2 [&_ul]:space-y-1 [&_ul]:list-disc [&_ul]:pl-5">
                {children}
            </div>
        </div>
    );
}

function ContactBox() {
    return (
        <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-sm text-gray-700 space-y-1">
            <p><strong>Urbexon</strong></p>
            <p>Email: support@urbexon.in</p>
            <p>Phone: +91 88084 85840</p>
            <p>Sector 62, Noida</p>
            <p>Noida – 201309, Uttar Pradesh, India</p>
            {/* <p>GSTIN: 09AABCU1234F1Z5</p> */}
        </div>
    );
}