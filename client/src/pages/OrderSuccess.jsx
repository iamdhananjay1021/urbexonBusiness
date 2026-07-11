import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getOrderById } from "../api/orderApi";
import { imgUrl } from "../utils/imageUrl";
import {
    FiShoppingBag, FiClipboard, FiCheckCircle, FiMapPin, FiPhone, FiUser,
    FiTruck, FiFileText,
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Loader from "../design-system/Loader";

const OrderSuccess = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();

    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const paymentMethod = location.state?.paymentMethod || null;

    useEffect(() => {
        if (!id) { navigate("/orders"); return; }
        if (!user) { navigate("/login"); return; }
        const fetchOrder = async () => {
            try {
                setLoading(true);
                const { data } = await getOrderById(id);
                setOrder(data);
            } catch {
                setError("Order not found");
                setTimeout(() => navigate("/orders"), 2000);
            } finally { setLoading(false); }
        };
        fetchOrder();
    }, [id, user, navigate]);

    if (loading) return (
        <div className="min-h-screen bg-canvas flex items-center justify-center">
            <div className="text-center">
                <Loader size="lg" className="mb-4" />
                <p className="text-muted text-sm">Processing your order...</p>
            </div>
        </div>
    );

    if (error || !order) return (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center">
            <p className="text-secondary font-semibold mb-2">Order not found</p>
            <p className="text-muted text-sm">Redirecting...</p>
        </div>
    );

    const isCOD = order.payment?.method === "COD" || paymentMethod === "COD";
    const cleanPhone = order.phone?.replace(/[^0-9]/g, "") || "";
    const finalPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const userWhatsApp = `https://wa.me/${finalPhone}?text=${encodeURIComponent(
        `✅ ORDER CONFIRMED\n\nHi ${order.customerName},\n\nOrder ID: #${order._id.slice(-8).toUpperCase()}\nTotal: ₹${order.totalAmount}\nPayment: ${isCOD ? "Cash on Delivery" : "Online Paid"}\n\nThank you for shopping with Urbexon💝`
    )}`;

    return (
        <div className="min-h-screen bg-canvas px-4 pt-6 pb-12">
            <SEO title="Order Confirmed" description="Your Urbexon order has been placed successfully!" noindex />

            <div className="max-w-[560px] mx-auto space-y-3">

                {/* ── Success Banner ── */}
                <Card padding="none" className="overflow-hidden">
                    <div className="h-1 bg-accent" />
                    <div className="p-5 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-accent-tint border-2 border-[var(--accent-primary)] flex items-center justify-center flex-shrink-0">
                            <FiCheckCircle size={26} className="text-accent" aria-hidden="true" />
                        </div>
                        <div>
                            <h1 className="text-[17px] font-bold text-primary">
                                Order Placed Successfully! 🎉
                            </h1>
                            <p className="text-[13px] text-secondary mt-1">
                                Thank you, <strong className="text-primary">{order.customerName}</strong>! Your order has been confirmed.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* ── Order Summary ── */}
                <Card padding="none" className="overflow-hidden">
                    <div className="px-5 py-3 border-b border-default flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FiFileText size={13} className="text-accent" aria-hidden="true" />
                            <span className="text-[13px] font-bold text-primary">Order Summary</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-muted">
                            #{order._id.slice(-8).toUpperCase()}
                        </span>
                    </div>
                    <div className="grid grid-cols-3">
                        {[
                            { label: "Order ID", value: `#${order._id.slice(-8).toUpperCase()}` },
                            { label: "Total", value: `₹${Number(order.totalAmount).toLocaleString("en-IN")}`, gold: true },
                            { label: "Payment", value: isCOD ? "COD" : "Online ✓" },
                        ].map(({ label, value, gold }, i) => (
                            <div key={i} className={`py-3.5 px-3 text-center ${i < 2 ? "border-r border-default" : ""}`}>
                                <div className="text-[9px] font-extrabold text-muted uppercase tracking-wide mb-1.5">
                                    {label}
                                </div>
                                <div className={`font-extrabold ${gold ? "text-lg text-accent" : "text-[13px] text-primary"}`}>
                                    {value}
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Delivery charge + breakdown */}
                    {(order.deliveryCharge !== undefined || order.platformFee !== undefined) && (
                        <div className="px-5 py-3 border-t border-default bg-canvas">
                            <div className="flex flex-col gap-1.5">
                                <div className="flex justify-between text-xs text-secondary">
                                    <span>Items Total</span>
                                    <span className="font-semibold">
                                        ₹{(Number(order.totalAmount) - Number(order.deliveryCharge || 0) - Number(order.platformFee || 0)).toLocaleString("en-IN")}
                                    </span>
                                </div>
                                {order.deliveryCharge > 0 && (
                                    <div className="flex justify-between text-xs text-secondary">
                                        <span>Delivery</span>
                                        <span className="font-semibold">+₹{order.deliveryCharge}</span>
                                    </div>
                                )}
                                {order.platformFee > 0 && (
                                    <div className="flex justify-between text-xs text-secondary">
                                        <span>Platform Fee</span>
                                        <span className="font-semibold">+₹{order.platformFee}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-[13px] font-extrabold text-primary pt-1.5 border-t border-dashed border-default">
                                    <span>Grand Total</span>
                                    <span className="text-accent">₹{Number(order.totalAmount).toLocaleString("en-IN")}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {/* ── Items ── */}
                <Card padding="none" className="overflow-hidden">
                    <div className="px-5 py-3 border-b border-default flex items-center gap-2">
                        <FiShoppingBag size={13} className="text-accent" aria-hidden="true" />
                        <span className="text-[13px] font-bold text-primary">
                            Items Ordered ({order.items?.length || 0})
                        </span>
                    </div>
                    {order.items?.map((item, idx) => {
                        const rawImg = item.images?.[0]?.url || item.image || null;
                        const thumbImg = rawImg ? (imgUrl?.thumbnail ? imgUrl.thumbnail(rawImg) : rawImg) : null;
                        return (
                            <div key={idx} className={`px-5 py-3.5 flex gap-3.5 items-center ${idx < order.items.length - 1 ? "border-b border-[var(--color-graphite-100)]" : ""}`}>
                                <div className="w-[60px] h-[60px] rounded-[var(--radius-sm)] border border-[var(--color-graphite-100)] bg-canvas overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {thumbImg ? (
                                        <img
                                            src={thumbImg}
                                            alt={item.name}
                                            loading="lazy"
                                            className="w-full h-full object-cover"
                                            onError={(e) => { e.target.style.display = "none"; }}
                                        />
                                    ) : (
                                        <span className="text-2xl">🎁</span>
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[13px] text-primary mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {item.name}
                                    </p>
                                    <p className="text-xs text-muted">
                                        Qty: {item.qty || item.quantity || 1} × ₹{Number(item.price).toLocaleString("en-IN")}
                                    </p>
                                    <div className="flex gap-1.5 flex-wrap mt-1">
                                        {item.selectedSize && (
                                            <span className="text-[10px] font-bold text-warning bg-warning-tint border border-[var(--color-warning-100)] px-2 py-0.5 rounded-full">Size: {item.selectedSize}</span>
                                        )}
                                        {item.selectedColor && (
                                            <span className="text-[10px] font-bold text-info bg-info-tint border border-[var(--color-info-100)] px-2 py-0.5 rounded-full">Color: {item.selectedColor}</span>
                                        )}
                                        {item.customization?.text && (
                                            <span className="text-[10px] font-bold text-warning bg-warning-tint border border-[var(--color-warning-100)] px-2 py-0.5 rounded-full">✏️ {item.customization.text}</span>
                                        )}
                                    </div>
                                </div>
                                <p className="font-extrabold text-sm text-primary flex-shrink-0">
                                    ₹{((item.qty || item.quantity || 1) * item.price).toLocaleString("en-IN")}
                                </p>
                            </div>
                        );
                    })}
                </Card>

                {/* ── Delivery Info ── */}
                <Card padding="none" className="overflow-hidden">
                    <div className="px-5 py-3 border-b border-default flex items-center gap-2">
                        <FiTruck size={13} className="text-accent" aria-hidden="true" />
                        <span className="text-[13px] font-bold text-primary">Delivery Details</span>
                    </div>
                    <div className="px-5 py-4 flex flex-col gap-3">
                        {[
                            { icon: FiUser, text: order.customerName },
                            { icon: FiPhone, text: order.phone },
                            { icon: FiMapPin, text: order.address },
                        ].map(({ icon: Icon, text }, i) => ( // eslint-disable-line no-unused-vars -- Icon rendered as <Icon/> below; false positive without eslint-plugin-react's jsx-uses-vars
                            <div key={i} className="flex items-start gap-3">
                                <div className="w-7 h-7 bg-accent-tint rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0">
                                    <Icon size={11} className="text-accent" aria-hidden="true" />
                                </div>
                                <p className="text-[13px] text-secondary leading-relaxed pt-1">{text}</p>
                            </div>
                        ))}
                        {order.delivery?.eta && (
                            <div className="mt-1 px-3.5 py-2.5 bg-success-tint border border-[var(--color-success-100)] rounded-[var(--radius-md)] text-xs text-success font-semibold">
                                🕐 Estimated Delivery: {order.delivery.eta}
                            </div>
                        )}
                    </div>
                </Card>

                {/* ── CTAs ── */}
                <Card padding="md">
                    <a
                        href={userWhatsApp}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full mb-2.5 h-10 px-4 rounded-[var(--radius-md)] bg-[var(--color-success-500)] text-white text-sm font-medium hover:bg-[var(--color-success-700)] transition-colors duration-150 focus-ring-accent"
                    >
                        <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
                        Get WhatsApp Confirmation
                    </a>
                    <div className="flex gap-2.5">
                        <Link
                            to="/orders"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[var(--radius-md)] bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors duration-150 focus-ring-accent"
                        >
                            <FiClipboard size={13} aria-hidden="true" /> My Orders
                        </Link>
                        <Link
                            to="/"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[var(--radius-md)] bg-surface text-primary border border-strong text-sm font-medium hover:bg-canvas transition-colors duration-150 focus-ring-accent"
                        >
                            <FiShoppingBag size={13} aria-hidden="true" /> Shop More
                        </Link>
                    </div>
                </Card>

            </div>
        </div>
    );
};

export default OrderSuccess;
