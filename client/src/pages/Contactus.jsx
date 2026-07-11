import { useState } from "react";
import { submitContactForm } from "../api/contactApi";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Textarea from "../design-system/Textarea";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";

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
            const res = await submitContactForm(form);
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
        <div className="min-h-screen bg-canvas">
            <SEO title="Contact Us" description="Contact Urbexon in Noida. Call +91 88084 85840 or email support@urbexon.in. We're here to help!" path="/contact" />
            {/* Header */}
            <div className="bg-surface border-b border-default py-12">
                <div className="max-w-5xl mx-auto px-6 text-center">
                    <p className="text-accent text-sm font-medium tracking-widest uppercase mb-3">Get in Touch</p>
                    <h1 className="text-4xl font-bold text-primary font-display">
                        Contact Us
                    </h1>
                    <p className="mt-3 text-secondary max-w-md mx-auto">
                        Have a question or need help? We're here for you. Reach out and we'll respond within 24 hours.
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* Contact Info */}
                    <div className="space-y-5">
                        <InfoCard icon="📧" title="Email Us" line1="support@urbexon.in" line2="For orders & general queries" />
                        <InfoCard icon="📞" title="Call Us" line1="+91 88084 85840" line2="Mon–Sun, 10am – 6pm" />
                        <InfoCard icon="📍" title="Our Address" line1="Ground Floor, Sector 63, Noida" line2="Noida, UP – 201301, India" />
                        <InfoCard icon="⏱️" title="Response Time" line1="Within 24 hours" line2="Usually much faster!" />
                    </div>

                    {/* Contact Form */}
                    <Card className="md:col-span-2" padding="lg">
                        <h2 className="text-2xl font-semibold text-primary mb-6 font-display">
                            Send a Message
                        </h2>

                        {status === "success" ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="text-5xl mb-4">✅</div>
                                <h3 className="text-xl font-semibold text-primary mb-2">Message Sent!</h3>
                                <p className="text-secondary">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                                <button
                                    onClick={() => setStatus(null)}
                                    className="mt-6 text-accent hover:text-[var(--accent-primary-hover)] font-medium text-sm underline"
                                >
                                    Send another message
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input label="Your Name *" name="name" value={form.name} onChange={handleChange} placeholder="Rahul Sharma" />
                                    <Input label="Email Address *" name="email" type="email" value={form.email} onChange={handleChange} placeholder="rahul@example.com" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input label="Phone Number" name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                                    <Input label="Subject" name="subject" value={form.subject} onChange={handleChange} placeholder="Order query, feedback..." />
                                </div>
                                <Textarea
                                    label="Message *"
                                    name="message"
                                    value={form.message}
                                    onChange={handleChange}
                                    rows={5}
                                    placeholder="Tell us how we can help you..."
                                />

                                {status === "error" && (
                                    <Alert variant="error">Something went wrong. Please try again or email us directly.</Alert>
                                )}

                                <Button variant="primary" className="w-full" onClick={handleSubmit} loading={status === "loading"}>
                                    Send Message
                                </Button>
                            </div>
                        )}
                    </Card>

                </div>
            </div>
        </div>
    );
}

function InfoCard({ icon, title, line1, line2 }) {
    return (
        <Card className="flex gap-4 items-start">
            <span className="text-2xl mt-0.5">{icon}</span>
            <div>
                <p className="font-semibold text-primary text-sm">{title}</p>
                <p className="text-secondary text-sm mt-0.5">{line1}</p>
                <p className="text-muted text-xs mt-0.5">{line2}</p>
            </div>
        </Card>
    );
}
