import { useEffect } from "react";
import SEO from "../components/SEO";

export default function TermsConditions() {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="min-h-screen bg-[#fdf8f3]">
            <SEO title="Terms & Conditions" description="Urbexon terms and conditions. Understand your rights, responsibilities, and our policies." path="/terms-conditions" />
            {/* Header */}
            <div className="bg-white border-b border-stone-100 py-12">
                <div className="max-w-3xl mx-auto px-6 text-center">
                    <p className="text-zinc-500 text-sm font-medium tracking-widest uppercase mb-3">Legal</p>
                    <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Terms &amp; Conditions
                    </h1>
                    <p className="mt-3 text-gray-500 text-sm">Last updated: March 2026</p>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-8 md:p-12 space-y-10">

                    <div className="bg-zinc-50 border-l-4 border-zinc-800 rounded-r-xl p-4 text-sm text-gray-700">
                        Please read these Terms &amp; Conditions carefully before using our website or placing an order. By accessing our website, you agree to be bound by these terms.
                    </div>

                    <Section title="1. Acceptance of Terms">
                        <p>By accessing and using the Urbexon website, you accept and agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, please do not use our website.</p>
                    </Section>

                    <Section title="2. Use of the Website">
                        <p>You agree to use this website only for lawful purposes and in a manner that does not infringe the rights of others. You must not:</p>
                        <ul>
                            <li>Use the site for any fraudulent or unlawful purpose</li>
                            <li>Attempt to gain unauthorized access to any part of the website</li>
                            <li>Transmit any unsolicited or unauthorized advertising material</li>
                            <li>Reproduce, duplicate, or copy any content without our permission</li>
                        </ul>
                    </Section>

                    <Section title="3. Products & Orders">
                        <p>All products listed on our website are subject to availability. We reserve the right to discontinue any product at any time.</p>
                        <p>When you place an order, you are making an offer to purchase the product. We reserve the right to accept or decline your order at our discretion. An order confirmation does not constitute acceptance until the order is dispatched.</p>
                        <p>Product images are for illustrative purposes only. Actual products may vary slightly in appearance.</p>
                    </Section>

                    <Section title="4. Pricing & Payment">
                        <p>All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless stated otherwise. We reserve the right to change prices at any time without prior notice.</p>
                        <p>Payments are processed securely through Razorpay. We accept UPI, credit/debit cards, net banking, and other payment methods offered by Razorpay. By providing payment information, you confirm that you are authorized to use that payment method.</p>
                    </Section>

                    <Section title="5. Shipping & Delivery">
                        <p>We deliver across India. Delivery times are estimates and may vary based on location and transport availability. We are not responsible for delays caused by our transport or delivery partners or circumstances beyond our control.</p>
                        <p>Risk of loss and title pass to you upon delivery. Please inspect your order upon receipt and contact us immediately if the item is defective or damaged.</p>
                    </Section>

                    <Section title="6. Intellectual Property">
                        <p>All content on this website, including text, images, logos, and graphics, is the property of Urbexon and is protected by applicable intellectual property laws. You may not use any content without our prior written permission.</p>
                    </Section>

                    <Section title="7. Limitation of Liability">
                        <p>To the fullest extent permitted by law, Urbexon shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our website or products. Our total liability shall not exceed the amount paid for the specific order in question.</p>
                    </Section>

                    <Section title="8. Governing Law">
                        <p>These Terms and Conditions are governed by the laws of India. Any disputes arising shall be subject to the exclusive jurisdiction of the courts in Gautam Buddha Nagar (Noida), Uttar Pradesh, India.</p>
                    </Section>

                    <Section title="9. Changes to Terms">
                        <p>We reserve the right to modify these Terms and Conditions at any time. Changes will be posted on this page with an updated date. Continued use of the website after changes constitutes acceptance of the revised terms.</p>
                    </Section>

                    <Section title="10. Contact Us">
                        <p>For any questions regarding these Terms and Conditions:</p>
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