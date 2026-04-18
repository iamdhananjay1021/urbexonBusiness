import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/axios";
import SEO from "../components/SEO";

const VerifyInvoice = () => {
    const { invoiceNumber } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const verify = async () => {
            try {
                const res = await api.get(`/invoice/${invoiceNumber}/verify`);
                setData(res.data);
            } catch (err) {
                setError(err.response?.data?.message || "Verification server error. Please try again.");
            } finally {
                setLoading(false);
            }
        };
        verify();
    }, [invoiceNumber]);

    const statusColor = {
        PLACED: "bg-blue-100 text-blue-700",
        CONFIRMED: "bg-indigo-100 text-indigo-700",
        PACKED: "bg-purple-100 text-purple-700",
        SHIPPED: "bg-amber-100 text-amber-700",
        OUT_FOR_DELIVERY: "bg-orange-100 text-orange-700",
        DELIVERED: "bg-emerald-100 text-emerald-700",
        CANCELLED: "bg-red-100 text-red-700",
    };

    return (
        <div
            className="min-h-screen bg-stone-100 flex flex-col items-center justify-center px-4 py-12"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
            <SEO title="Verify Invoice" description="Verify your Urbexon order invoice authenticity online." path="/verify-invoice" noindex />
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

            {/* Logo */}
            <Link to="/" className="mb-8 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center">
                    <span className="font-black text-white text-sm tracking-tight">UX</span>
                </div>
                <span className="font-black text-zinc-800 text-xl">Urbexon</span>
            </Link>

            <div className="w-full max-w-md">

                {/* Loading */}
                {loading && (
                    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-10 text-center">
                        <div className="w-12 h-12 border-4 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="text-zinc-500 font-medium text-sm">Verifying invoice...</p>
                        <p className="text-zinc-400 text-xs mt-1">{invoiceNumber}</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
                        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                        </div>
                        <h2 className="font-black text-zinc-800 text-xl mb-2">Server Error</h2>
                        <p className="text-zinc-500 text-sm">{error}</p>
                    </div>
                )}

                {/* VALID Invoice */}
                {!loading && data?.valid && (
                    <div className="bg-white rounded-2xl border border-emerald-200 shadow-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-emerald-500 px-6 py-5 text-center">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h2 className="font-black text-white text-xl">Invoice Verified</h2>
                            <p className="text-emerald-100 text-sm mt-1">This is an authentic Urbexon invoice</p>
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
                            <div className="flex justify-between items-center py-2 border-b border-stone-100">
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Order Status</span>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[data.orderStatus] || "bg-stone-100 text-zinc-600"}`}>
                                    {data.orderStatus}
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payment</span>
                                <span className={`text-xs font-bold px-3 py-1 rounded-full ${data.paymentStatus === "PAID"
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                    }`}>
                                    {data.paymentStatus || "PENDING"}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-stone-50 border-t border-stone-100 px-6 py-4 text-center">
                            <p className="text-xs text-zinc-400">
                                Verified by{" "}
                                <span className="font-bold text-zinc-600">urbexon.in</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* FAKE / Not Found */}
                {!loading && data && !data.valid && (
                    <div className="bg-white rounded-2xl border border-red-200 shadow-lg overflow-hidden">
                        {/* Header */}
                        <div className="bg-red-500 px-6 py-5 text-center">
                            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
                                <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <h2 className="font-black text-white text-xl">Invoice Not Found</h2>
                            <p className="text-red-100 text-sm mt-1">This invoice could not be verified</p>
                        </div>

                        <div className="p-6 text-center space-y-4">
                            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-red-700 font-bold text-sm mb-1">Possible Fake Invoice</p>
                                <p className="text-red-600 text-xs leading-relaxed">
                                    Invoice number{" "}
                                    <span className="font-mono font-bold">{invoiceNumber}</span>{" "}
                                    does not exist in our system. If you received this from Urbexon, please contact us immediately.
                                </p>
                            </div>
                            <p className="text-zinc-400 text-xs">
                                Contact:{" "}
                                <span className="font-bold text-zinc-600">+91 88084 85840</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Back link */}
                {!loading && (
                    <div className="text-center mt-6">
                        <Link
                            to="/"
                            className="text-zinc-600 font-semibold text-sm hover:text-zinc-800 transition-colors"
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
    <div className="flex justify-between items-center py-2 border-b border-stone-100">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</span>
        <span className={`text-sm text-right max-w-[200px] ${mono ? "font-mono text-xs" : ""} ${bold ? "font-black text-zinc-900" : "font-medium text-zinc-700"}`}>
            {value}
        </span>
    </div>
);

export default VerifyInvoice;