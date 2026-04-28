import { useState } from "react";
import api from "../api/axios";
import SEO from "../components/SEO";

export default function ContactUs() {
    const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
    const [status, setStatus] = useState(null); // null | "loading" | "success" | "error"

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async () => {
        if (!form.name || !form.email || !form.message) {
            alert("Please fill in Name, Email, and Message.");
            return;
        }
        setStatus("loading");

        try {
            const res = await api.post("/contact", form);
            if (res.data) {
                setStatus("success");
                setForm({ name: "", email: "", phone: "", subject: "", message: "" });
            } else {
                setStatus("error");
            }
        } catch {
            setStatus("error");
        }
    };

    return (
        <div className="min-h-screen bg-[#fdf8f3]">
            <SEO title="Contact Us" description="Contact Urbexon in Noida. Call +91 88084 85840 or email support@urbexon.in. We're here to help!" path="/contact" />
            {/* Header */}
            <div className="bg-white border-b border-amber-100 py-12">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <p className="text-amber-600 text-sm font-medium tracking-widest uppercase mb-3">Get in Touch</p>
                    <h1 className="text-4xl font-bold text-gray-900" style={{ fontFamily: "'Playfair Display', serif" }}>
                        Contact Us
                    </h1>
                    <p className="mt-3 text-gray-500 max-w-md mx-auto">
                        Have a question or need help? We're here for you. Reach out and we'll respond within 24 hours.
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Contact Info */}
                    <div className="space-y-5">
                        <InfoCard
                            icon="📧"
                            title="Email Us"
                            line1="support@urbexon.in"
                            line2="For orders & general queries"
                        />
                        <InfoCard
                            icon="📞"
                            title="Call Us"
                            line1="+91 88084 85840"
                            line2="Mon–Sun, 10am – 6pm"
                        />
                        <InfoCard
                            icon="📍"
                            title="Our Address"
                            line1="Ground Floor, Sector 63, Noida"
                            line2="Noida, UP – 201301, India"
                        />
                        <InfoCard
                            icon="⏱️"
                            title="Response Time"
                            line1="Within 24 hours"
                            line2="Usually much faster!"
                        />
                    </div>

                    {/* Contact Form */}
                    <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-amber-50 p-8">
                        <h2 className="text-2xl font-semibold text-gray-900 mb-6" style={{ fontFamily: "'Playfair Display', serif" }}>
                            Send a Message
                        </h2>

                        {status === "success" ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-2">Message Sent!</h3>
                                <p className="text-gray-500">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                                <button
                                    onClick={() => setStatus(null)}
                                    className="mt-6 text-amber-600 hover:text-amber-700 font-medium text-sm underline"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Your Name *" name="name" value={form.name} onChange={handleChange} placeholder="Rahul Sharma" />
                                    <Field label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="rahul@example.com" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Phone Number" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                                    <Field label="Subject" name="subject" value={form.subject} onChange={handleChange} placeholder="Order query, feedback..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                                    <textarea
                                        name="message"
                                        value={form.message}
                                        onChange={handleChange}
                                        rows={5}
                                        placeholder="Tell us how we can help you..."
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent resize-none transition"
                                    />
                                </div>

                                {status === "error" && (
                                    <p className="text-red-500 text-sm">Something went wrong. Please try again or email us directly.</p>
                                )}

                                <button
                                    onClick={handleSubmit}
                                    disabled={status === "loading"}
                                    className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-semibold py-3 rounded-xl transition-colors text-sm tracking-wide"
                                >
                                    {status === "loading" ? "Sending..." : "Send Message"}
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
}

function InfoCard({ icon, title, line1, line2 }) {
    return (
        <div className="bg-white rounded-xl border border-amber-50 shadow-sm p-5 flex gap-4 items-start">
            <span className="text-2xl mt-0.5">{icon}</span>
            <div>
                <p className="font-semibold text-gray-800 text-sm">{title}</p>
                <p className="text-gray-700 text-sm mt-0.5">{line1}</p>
                <p className="text-gray-400 text-xs mt-0.5">{line2}</p>
            </div>
        </div>
    );
}

function Field({ label, name, type = "text", value, onChange, placeholder }) {
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
            <input
                type={type}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent transition"
            />
        </div>
    );
}