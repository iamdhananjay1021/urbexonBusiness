import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { FiCheck, FiX, FiAlertTriangle } from "react-icons/fi";
import { verifyInvoice } from "../api/orderApi";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Loader from "../design-system/Loader";
import StatusBadge from "../design-system/StatusBadge";

const VerifyInvoice = () => {
    const { invoiceNumber } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const verify = async () => {
            try {
                const res = await verifyInvoice(invoiceNumber);
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.message || "Verification server error. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        verify();
    }, [invoiceNumber]);

    return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-4 py-12">
            <SEO title="Verify Invoice" description="Verify your Urbexon order invoice authenticity online." path="/verify-invoice" noindex />

            {/* Logo */}
            <Link to="/" className="mb-8 flex items-center gap-3">
                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-graphite-900)] flex items-center justify-center">
                    <span className="font-bold text-white text-sm tracking-tight">UX</span>
                </div>
                <span className="font-bold text-primary text-xl font-display">Urbexon</span>
            </Link>

            <div className="w-full max-w-md">

                {/* Loading */}
                {loading && (
                    <Card padding="lg" className="text-center py-10">
                        <Loader size="lg" className="mb-4" />
                        <p className="text-secondary font-medium text-sm">Verifying invoice...</p>
                        <p className="text-muted text-xs mt-1">{invoiceNumber}</p>
                    </Card>
                )}

                {/* Error */}
                {!loading && error && (
                    <Card padding="lg" className="text-center">
                        <div className="w-14 h-14 bg-error-tint rounded-full flex items-center justify-center mx-auto mb-4">
                            <FiAlertTriangle className="w-7 h-7 text-[var(--color-error-500)]" aria-hidden="true" />
                        </div>
                        <h2 className="font-bold text-primary text-xl mb-2 font-display">Server Error</h2>
                        <p className="text-secondary text-sm">{error}</p>
                    </Card>
                )}

                {/* VALID Invoice */}
                {!loading && data?.valid && (
                    <Card padding="none" className="overflow-hidden">
                        {/* Header */}
                        <div className="bg-[var(--color-success-500)] px-6 py-5 text-center">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                <FiCheck className="w-8 h-8 text-[var(--color-success-500)]" strokeWidth={2.5} aria-hidden="true" />
                            </div>
                            <h2 className="font-bold text-white text-xl font-display">Invoice Verified</h2>
                            <p className="text-white/90 text-sm mt-1">This is an authentic Urbexon invoice</p>
                        </div>

                        {/* Details */}
                        <div className="p-6 space-y-3">
                            <Row label="Invoice No" value={data.invoiceNumber} mono />
                            <Row label="Order ID" value={data.orderId} mono />
                            <Row label="Customer" value={data.customerName} />
                            <Row
                                label="Amount"
                                value={`Rs. ${Number(data.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                bold
                            />
                            <Row
                                label="Date"
                                value={new Date(data.date).toLocaleDateString("en-IN", {
                                    day: "2-digit", month: "long", year: "numeric",
                                })}
                            />
                            <div className="flex justify-between items-center py-2 border-b border-default">
                                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Order Status</span>
                                <StatusBadge status={data.orderStatus} />
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs font-semibold text-muted uppercase tracking-wider">Payment</span>
                                <StatusBadge status={data.paymentStatus || "PENDING"} />
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-canvas border-t border-default px-6 py-4 text-center">
                            <p className="text-xs text-muted">
                                Verified by{" "}
                                <span className="font-bold text-secondary">urbexon.in</span>
                            </p>
                        </div>
                    </Card>
                )}

                {/* FAKE / Not Found */}
                {!loading && data && !data.valid && (
                    <Card padding="none" className="overflow-hidden">
                        {/* Header */}
                        <div className="bg-[var(--color-error-500)] px-6 py-5 text-center">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                <FiX className="w-8 h-8 text-[var(--color-error-500)]" strokeWidth={2.5} aria-hidden="true" />
                            </div>
                            <h2 className="font-bold text-white text-xl font-display">Invoice Not Found</h2>
                            <p className="text-white/90 text-sm mt-1">This invoice could not be verified</p>
                        </div>

                        <div className="p-6 text-center space-y-4">
                            <div className="bg-error-tint border border-[var(--color-error-100)] rounded-[var(--radius-md)] p-4">
                                <p className="text-error font-bold text-sm mb-1">Possible Fake Invoice</p>
                                <p className="text-error text-xs leading-relaxed">
                                    Invoice number{" "}
                                    <span className="font-mono font-bold">{invoiceNumber}</span>{" "}
                                    does not exist in our system. If you received this from Urbexon, please contact us immediately.
                                </p>
                            </div>
                            <p className="text-muted text-xs">
                                Contact:{" "}
                                <span className="font-bold text-secondary">+91 88084 85840</span>
                            </p>
                        </div>
                    </Card>
                )}

                {/* Back link */}
                {!loading && (
                    <div className="text-center mt-6">
                        <Link
                            to="/"
                            className="text-secondary font-semibold text-sm hover:text-primary transition-colors"
                        >
                            ← Back to Urbexon
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
};

const Row = ({ label, value, mono, bold }) => (
    <div className="flex justify-between items-center py-2 border-b border-default">
        <span className="text-xs font-semibold text-muted uppercase tracking-wider">{label}</span>
        <span className={`text-sm text-right max-w-[200px] ${mono ? "font-mono text-xs" : ""} ${bold ? "font-bold text-primary" : "font-medium text-secondary"}`}>
            {value}
        </span>
    </div>
);

export default VerifyInvoice;
