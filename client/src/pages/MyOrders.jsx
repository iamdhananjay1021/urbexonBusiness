import { useEffect, useRef, useState, useCallback } from "react";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getMyOrders } from "../features/orders/orderSlice";
import { FiPackage, FiRefreshCw, FiShoppingBag, FiArrowRight, FiCheckCircle, FiFileText, FiFilter, FiX, FiZap } from "react-icons/fi";
import * as orderApi from "../api/orderApi";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Tabs from "../design-system/Tabs";
import Loader from "../design-system/Loader";
import { EmptyState } from "../design-system/EmptyState";
import { cn } from "../design-system/utils/cn";

const STATUS_CONFIG = {
    PLACED: { label: "Order Placed", color: "text-[var(--color-warning-700)]", bg: "bg-warning-tint", border: "border-[var(--color-warning-100)]", dot: "bg-[var(--color-warning-500)]" },
    CONFIRMED: { label: "Confirmed", color: "text-info", bg: "bg-info-tint", border: "border-[var(--color-info-100)]", dot: "bg-[var(--color-info-500)]" },
    PACKED: { label: "Packed", color: "text-accent", bg: "bg-accent-tint", border: "border-[var(--accent-primary-tint)]", dot: "bg-accent" },
    READY_FOR_PICKUP: { label: "Ready for Pickup", color: "text-[var(--color-warning-700)]", bg: "bg-warning-tint", border: "border-[var(--color-warning-100)]", dot: "bg-[var(--color-warning-500)]" },
    SHIPPED: { label: "Shipped", color: "text-accent", bg: "bg-accent-tint", border: "border-[var(--accent-primary-tint)]", dot: "bg-accent" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-[var(--accent-hour-hover)]", bg: "bg-hour-tint", border: "border-[var(--color-amber-100)]", dot: "bg-hour" },
    DELIVERED: { label: "Delivered", color: "text-success", bg: "bg-success-tint", border: "border-[var(--color-success-100)]", dot: "bg-[var(--color-success-500)]" },
    CANCELLED: { label: "Cancelled", color: "text-error", bg: "bg-error-tint", border: "border-[var(--color-error-100)]", dot: "bg-[var(--color-error-500)]" },
};

const ECOM_FLOW = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_FLOW = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCELLABLE = ["PLACED", "CONFIRMED"];
const STALE_MS = 60_000;
// BUG FIX #6: Online payment methods — not just RAZORPAY
const ONLINE_PAYMENT_METHODS = ["RAZORPAY", "UPI", "ONLINE", "STRIPE", "PAYTM"];

const getItemImage = (item) => item.images?.[0]?.url || item.image || null;

const MyOrders = () => {
    const dispatch = useDispatch();

    // BUG FIX #7: isMounted guard to prevent setState on unmounted component
    const isMounted = useRef(true);
    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    // BUG FIX #3: "order_status_updated" is handled exclusively by
    // useOrderRealtime to avoid double dispatch.
    // BUG FIX: this used to open its OWN dedicated WebSocket connection via
    // useWebSocket just to catch "new_order" — a second live socket on top
    // of the always-on GlobalWebSocket connection (mounted app-wide while
    // logged in) AND the SSE connection from useOrderRealtime below, i.e.
    // three simultaneous realtime channels open on this one page.
    // GlobalWebSocket already receives every message (including
    // "new_order") on the same server-side per-user broadcast and forwards
    // it via a "client:ws_message" window event — listening for that here
    // delivers the identical payload with zero extra connections.
    useEffect(() => {
        const handler = (e) => {
            if (e.detail?.type === "new_order") dispatch(getMyOrders());
        };
        window.addEventListener("client:ws_message", handler);
        return () => window.removeEventListener("client:ws_message", handler);
    }, [dispatch]);

    const { orders = [], status, error, lastFetched } = useSelector((s) => s.orders);

    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState("ECOMMERCE"); // "ECOMMERCE" | "URBEXON_HOUR"
    const [cancellingId, setCancellingId] = useState(null);
    const [confirmCancelId, setConfirmCancelId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [liveMessage, setLiveMessage] = useState("");
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

    // BUG FIX #2: liveMessage auto-clear ref
    const liveMessageTimer = useRef(null);

    useOrderRealtime({
        enabled: true,
        onStatusUpdate: useCallback(async (payload) => {
            // Clear existing timer before setting new message
            if (liveMessageTimer.current) clearTimeout(liveMessageTimer.current);

            if (isMounted.current) {
                setLiveMessage(
                    `Live: Order #${String(payload.orderId).slice(-6).toUpperCase()} → ${String(payload.status || "updated").replaceAll("_", " ")}`
                );
                // BUG FIX #2: Auto-clear live message after 5 seconds
                liveMessageTimer.current = setTimeout(() => {
                    if (isMounted.current) setLiveMessage("");
                }, 5000);
            }

            await dispatch(getMyOrders());
        }, [dispatch]),
    });

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (liveMessageTimer.current) clearTimeout(liveMessageTimer.current);
        };
    }, []);

    useEffect(() => {
        const isStale = !lastFetched || Date.now() - lastFetched > STALE_MS;
        if (isStale || (orders.length === 0 && status !== "loading")) {
            dispatch(getMyOrders());
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: mount-only fetch

    // BUG FIX #4 & #5: Tab switch resets all stale UI state
    const handleTabChange = useCallback((tab) => {
        setActiveTab(tab);
        setActiveFilter("ALL");
        setConfirmCancelId(null);   // BUG FIX #4: clear stale cancel dialog
        setMobileFilterOpen(false); // BUG FIX #5: close mobile drawer
    }, []);

    const handleRefresh = async () => {
        if (isMounted.current) setRefreshing(true);
        await dispatch(getMyOrders());
        if (isMounted.current) setRefreshing(false);
    };

    const handleCancel = async (orderId) => {
        try {
            if (isMounted.current) setCancellingId(orderId);
            await orderApi.cancelOrder(orderId);
            dispatch(getMyOrders());
            if (isMounted.current) setConfirmCancelId(null);
        } catch (err) {
            alert(err.response?.data?.message || "Cancel failed");
        } finally {
            // BUG FIX #7: guard before setState
            if (isMounted.current) setCancellingId(null);
        }
    };

    const handleDownloadInvoice = async (orderId) => {
        try {
            if (isMounted.current) setDownloadingId(orderId);
            const response = await orderApi.downloadInvoice(orderId, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Urbexon_Invoice_${orderId.slice(-8).toUpperCase()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch {
            alert("Failed to download invoice. Please try again.");
        } finally {
            // BUG FIX #7: guard before setState
            if (isMounted.current) setDownloadingId(null);
        }
    };

    const tabOrders = orders.filter((o) => (o.orderMode || "ECOMMERCE") === activeTab);
    const filtered = activeFilter === "ALL" ? tabOrders : tabOrders.filter((o) => o.orderStatus === activeFilter);
    const ecomCount = orders.filter((o) => (o.orderMode || "ECOMMERCE") === "ECOMMERCE").length;
    const uhCount = orders.filter((o) => o.orderMode === "URBEXON_HOUR").length;
    const isUHTab = activeTab === "URBEXON_HOUR";
    // BUG FIX #1: Removed unused `activeFlow` variable. Each order card uses its own `flow` variable
    // based on that order's `orderMode` — which is correct since a single list can have mixed modes.

    if (status === "loading" && !refreshing && orders.length === 0)
        return (
            <div className="min-h-screen bg-canvas flex items-center justify-center">
                <div className="text-center">
                    <Loader size="lg" className="mb-3" />
                    <p className="text-muted text-sm">Loading your orders…</p>
                </div>
            </div>
        );

    return (
        <div className="min-h-screen bg-canvas">
            <SEO title="My Orders" noindex />

            <div className="p-4 sm:p-6">
                {/* Mode Tabs: Ecommerce vs Urbexon Hour */}
                <div className="max-w-[960px] mx-auto mb-4">
                    <Tabs
                        className="bg-surface rounded-[var(--radius-md)] border border-default overflow-hidden"
                        tabs={[
                            { value: "ECOMMERCE", label: `Ecommerce (${ecomCount})` },
                            { value: "URBEXON_HOUR", label: `Urbexon Hour (${uhCount})` },
                        ]}
                        active={activeTab}
                        onChange={handleTabChange}
                    />
                </div>

                {/* Mobile filter drawer overlay */}
                {mobileFilterOpen && (
                    <div className="fixed inset-0 z-40 bg-[var(--bg-overlay)]" onClick={() => setMobileFilterOpen(false)} />
                )}
                <div className={cn(
                    "fixed bottom-0 left-0 right-0 z-50 bg-surface rounded-t-2xl max-h-[60vh] overflow-y-auto transition-transform duration-250",
                    mobileFilterOpen ? "translate-y-0" : "translate-y-full"
                )}>
                    <div className="px-4 py-3 border-b border-default flex items-center justify-between">
                        <p className="font-bold text-primary text-sm">Filter Orders</p>
                        <button onClick={() => setMobileFilterOpen(false)} aria-label="Close" className="p-1 text-muted"><FiX size={14} aria-hidden="true" /></button>
                    </div>
                    <div className="p-2">
                        <FilterBtn active={activeFilter === "ALL"} onClick={() => { setActiveFilter("ALL"); setMobileFilterOpen(false); }} label="All Orders" count={tabOrders.length} />
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                            const count = tabOrders.filter((o) => o.orderStatus === key).length;
                            if (!count) return null;
                            return <FilterBtn key={key} active={activeFilter === key} onClick={() => { setActiveFilter(key); setMobileFilterOpen(false); }} dot={cfg.dot} label={cfg.label} count={count} />;
                        })}
                    </div>
                </div>

                <div className="flex gap-4 items-start max-w-[960px] mx-auto">

                    {/* ── SIDEBAR (desktop only) ── */}
                    <aside className="w-[220px] flex-shrink-0 hidden lg:flex flex-col gap-3">
                        <Card className="flex items-center gap-3" padding="md">
                            <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center text-base">{isUHTab ? "⚡" : "📦"}</div>
                            <div>
                                <p className="font-semibold text-primary text-sm leading-tight">{isUHTab ? "Urbexon Hour" : "My Orders"}</p>
                                <p className="text-xs text-muted">{tabOrders.length} orders</p>
                            </div>
                        </Card>
                        <Card padding="none" className="overflow-hidden">
                            <p className="px-4 py-2.5 text-[10px] font-bold text-muted uppercase tracking-widest border-b border-default">Filter</p>
                            <FilterBtn active={activeFilter === "ALL"} onClick={() => setActiveFilter("ALL")} label="All Orders" count={tabOrders.length} />
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                const count = tabOrders.filter((o) => o.orderStatus === key).length;
                                if (!count) return null;
                                return <FilterBtn key={key} active={activeFilter === key} onClick={() => setActiveFilter(key)} dot={cfg.dot} label={cfg.label} count={count} />;
                            })}
                        </Card>
                    </aside>

                    {/* ── MAIN ── */}
                    <div className="flex-1 min-w-0 flex flex-col gap-3">

                        {/* Topbar */}
                        <Card className="flex items-center justify-between gap-3" padding="md">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="lg:hidden">
                                    <button onClick={() => setMobileFilterOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-secondary bg-canvas px-3 py-1.5 rounded-full hover:bg-[var(--color-graphite-100)] transition-colors">
                                        <FiFilter size={9} aria-hidden="true" />
                                        {activeFilter === "ALL" ? "Filter" : STATUS_CONFIG[activeFilter]?.label}
                                    </button>
                                </div>
                                <h1 className="font-bold text-primary text-sm truncate">
                                    {activeFilter === "ALL" ? (isUHTab ? "Urbexon Hour Orders" : "All Orders") : STATUS_CONFIG[activeFilter]?.label}
                                    <span className="ml-1.5 text-muted font-normal">({filtered.length})</span>
                                </h1>
                            </div>
                            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-secondary font-semibold hover:text-accent transition-colors disabled:opacity-50 flex-shrink-0">
                                <FiRefreshCw size={10} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
                                <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
                            </button>
                        </Card>

                        {/* Alerts */}
                        {status === "failed" && error && <Alert variant="error">{error}</Alert>}
                        {liveMessage && (
                            <Alert variant="info" onDismiss={() => setLiveMessage("")}>{liveMessage}</Alert>
                        )}

                        {/* Empty states */}
                        {orders.length === 0 && status === "succeeded" && (
                            <EmptyState
                                icon={FiShoppingBag}
                                title="No orders yet!"
                                description="Looks like you haven't placed any orders."
                                action={
                                    <Link to="/">
                                        <Button variant="primary" icon={FiArrowRight}>Start Shopping</Button>
                                    </Link>
                                }
                            />
                        )}
                        {tabOrders.length === 0 && orders.length > 0 && status === "succeeded" && (
                            <EmptyState
                                icon={isUHTab ? FiZap : FiShoppingBag}
                                title={isUHTab ? "No Urbexon Hour orders" : "No Ecommerce orders"}
                                description={isUHTab ? "Your express delivery orders will appear here." : "Your standard delivery orders will appear here."}
                                action={
                                    <Link to={isUHTab ? "/urbexon-hour" : "/"} className="text-xs text-info font-semibold hover:underline">
                                        {isUHTab ? "Browse Urbexon Hour" : "Start Shopping"}
                                    </Link>
                                }
                            />
                        )}
                        {tabOrders.length > 0 && filtered.length === 0 && (
                            <EmptyState
                                icon={FiPackage}
                                title={`No ${STATUS_CONFIG[activeFilter]?.label} orders`}
                                action={
                                    <button onClick={() => setActiveFilter("ALL")} className="text-xs text-info font-semibold hover:underline">View all orders</button>
                                }
                            />
                        )}

                        {/* Order cards */}
                        {filtered.map((order) => {
                            const cfg = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PLACED;
                            const canCancel = CANCELLABLE.includes(order.orderStatus);
                            const orderIsUH = order.orderMode === "URBEXON_HOUR";
                            // BUG FIX #1: `flow` is correctly per-order (not from the dead `activeFlow`)
                            const flow = orderIsUH ? UH_FLOW : ECOM_FLOW;
                            const stepIdx = flow.indexOf(order.orderStatus);
                            const isCancelled = order.orderStatus === "CANCELLED";
                            const isDelivered = order.orderStatus === "DELIVERED";
                            const isDownloading = downloadingId === order._id;

                            const payMethod = order.payment?.method?.toUpperCase() || "COD";
                            const payStatus = order.payment?.status?.toUpperCase() || "PENDING";
                            // BUG FIX #6: isPaid handles all online methods, not just RAZORPAY
                            const isCOD = payMethod === "COD";
                            const isPaid = !isCOD && ONLINE_PAYMENT_METHODS.includes(payMethod) && payStatus === "PAID";

                            // BUG FIX #8: Don't render card if items array is empty
                            if (!order.items?.length) return null;

                            return (
                                <Card key={order._id} padding="none" className="overflow-hidden hover:shadow-sm transition-shadow">

                                    {/* ── Order header ── */}
                                    <div className="px-4 py-3 bg-canvas border-b border-default">
                                        <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-1.5 sm:gap-4">
                                            <Meta label="Order ID" value={`#${order._id.slice(-8).toUpperCase()}`} mono />
                                            <Meta label="Placed On" value={new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                                            <Meta label="Total" value={`₹${Number(order.totalAmount).toLocaleString("en-IN")}`} bold />
                                            <div>
                                                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Payment</p>
                                                <span className={cn(
                                                    "inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border",
                                                    isPaid ? "bg-success-tint text-success border-[var(--color-success-100)]" : isCOD ? "bg-warning-tint text-[var(--color-warning-700)] border-[var(--color-warning-100)]" : "bg-canvas text-secondary border-default"
                                                )}>
                                                    {isPaid ? "Paid Online" : isCOD ? "COD" : "Pending"}
                                                </span>
                                            </div>
                                            {orderIsUH && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Mode</p>
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-hour-tint text-on-hour border border-[var(--color-amber-100)]"><FiZap size={9} aria-hidden="true" /> Express</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:ml-auto">
                                            {isDelivered && (
                                                <button onClick={() => handleDownloadInvoice(order._id)} disabled={isDownloading} className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-hour-hover)] bg-hour-tint border border-[var(--color-amber-100)] px-3 py-1.5 rounded-[var(--radius-sm)] hover:brightness-95 transition disabled:opacity-50">
                                                    <FiFileText size={11} aria-hidden="true" />{isDownloading ? "…" : "Invoice"}
                                                </button>
                                            )}
                                            <Link to={`/orders/${order._id}`} className="flex items-center gap-1 text-xs font-semibold text-info hover:brightness-90 transition">
                                                Details <FiArrowRight size={8} aria-hidden="true" />
                                            </Link>
                                        </div>
                                    </div>

                                    {/* ── Items ── */}
                                    <div className="divide-y divide-[var(--color-graphite-100)]">
                                        {order.items.map((item, idx) => {
                                            const img = getItemImage(item);
                                            const qty = item.qty || item.quantity || 1;
                                            return (
                                                <div key={item._id || idx} className="flex gap-3 items-start px-4 py-3">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[var(--radius-md)] border border-default bg-canvas flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                        {img
                                                            ? <img src={img} alt={item.name} className="w-full h-full object-contain p-1" loading="lazy" onError={(e) => (e.target.style.display = "none")} />
                                                            : <FiPackage size={16} className="text-[var(--color-graphite-300)]" aria-hidden="true" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-primary text-sm leading-snug line-clamp-2">{item.name}</p>
                                                        <p className="text-xs text-muted mt-0.5">{qty} × ₹{item.price?.toLocaleString("en-IN")}</p>
                                                        <div className="flex gap-1.5 flex-wrap mt-1">
                                                            {item.selectedSize && <span className="inline-flex items-center text-[10px] font-semibold text-secondary bg-canvas border border-default px-2 py-0.5 rounded-full">Size: {item.selectedSize}</span>}
                                                            {item.selectedColor && <span className="inline-flex items-center text-[10px] font-semibold text-info bg-info-tint border border-[var(--color-info-100)] px-2 py-0.5 rounded-full">Color: {item.selectedColor}</span>}
                                                            {item.customization?.text && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--color-warning-700)] bg-warning-tint border border-[var(--color-warning-100)] px-2 py-0.5 rounded-full">✏ {item.customization.text}</span>}
                                                        </div>
                                                        {/* Mobile status inline */}
                                                        <div className="flex items-center gap-1 mt-1 sm:hidden">
                                                            {isCancelled ? (
                                                                <span className="text-xs font-semibold text-error">Cancelled</span>
                                                            ) : isDelivered ? (
                                                                <span className="text-xs font-semibold text-success flex items-center gap-1"><FiCheckCircle size={10} aria-hidden="true" /> Delivered</span>
                                                            ) : (
                                                                <span className={cn("text-xs font-semibold flex items-center gap-1", cfg.color)}><span className={cn("w-1.5 h-1.5 rounded-full animate-pulse", cfg.dot)} />{cfg.label}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Desktop status */}
                                                    <div className="text-right flex-shrink-0 hidden sm:block">
                                                        {isCancelled ? (
                                                            <p className="text-sm font-semibold text-error">Cancelled</p>
                                                        ) : isDelivered ? (
                                                            <span className="flex items-center gap-1 justify-end text-sm font-semibold text-success"><FiCheckCircle size={12} aria-hidden="true" /> Delivered</span>
                                                        ) : (
                                                            <span className={cn("flex items-center gap-1.5 justify-end text-sm font-semibold", cfg.color)}><span className={cn("w-2 h-2 rounded-full animate-pulse", cfg.dot)} />{cfg.label}</span>
                                                        )}
                                                        <p className="text-xs text-muted mt-0.5">₹{(qty * item.price)?.toLocaleString("en-IN")}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ── Shipment tracking ── */}
                                    {order.shipping?.trackingUrl && ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY"].includes(order.orderStatus) && (
                                        <div className="px-4 py-3 border-t border-default bg-accent-tint flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs text-secondary font-medium">
                                                Via <span className="font-semibold text-accent">{order.shipping.courierName || "Courier"}</span>
                                                {order.shipping.awbCode && <span className="ml-2 text-muted font-mono text-[11px]">AWB: {order.shipping.awbCode}</span>}
                                            </p>
                                            <a href={order.shipping.trackingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-accent border border-[var(--accent-primary-tint)] bg-accent-tint px-3 py-1.5 rounded-[var(--radius-sm)] hover:brightness-95 transition">
                                                Track →
                                            </a>
                                        </div>
                                    )}

                                    {/* ── Live rider tracking ── */}
                                    {["OUT_FOR_DELIVERY", "READY_FOR_PICKUP"].includes(order.orderStatus) && order.delivery?.assignedTo && (
                                        <div className="px-4 py-3 border-t border-default bg-hour-tint flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-hour animate-pulse" />
                                                <p className="text-xs text-[var(--accent-hour-hover)] font-semibold">
                                                    🛵 {order.delivery.riderName || "Delivery Partner"} is {order.orderStatus === "OUT_FOR_DELIVERY" ? "on the way" : "heading to pick up"}
                                                </p>
                                            </div>
                                            <Link to={`/orders/${order._id}`} className="text-xs font-bold text-on-hour bg-hour px-4 py-1.5 rounded-[var(--radius-sm)] hover:bg-hour-hover transition-colors no-underline flex items-center gap-1.5">
                                                📍 Live Track
                                            </Link>
                                        </div>
                                    )}

                                    {/* ── Progress tracker ── */}
                                    {!isCancelled && (
                                        <div className="px-4 py-3 border-t border-default bg-canvas">
                                            {orderIsUH && !isDelivered && (
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FiZap size={10} className="text-accent" aria-hidden="true" />
                                                    <span className="text-[11px] font-bold text-accent">Express Delivery • 45-120 min</span>
                                                </div>
                                            )}
                                            <div className="flex items-start overflow-x-auto scrollbar-hide py-1">
                                                {flow.map((step, i) => (
                                                    <div key={step} className="flex items-center flex-1 min-w-[48px]">
                                                        <div className="flex flex-col items-center">
                                                            <div className={cn("w-5 h-5 rounded-full flex items-center justify-center", i <= stepIdx ? (orderIsUH ? "bg-accent" : "bg-hour") : "bg-[var(--color-graphite-200)]")}>
                                                                {i < stepIdx
                                                                    ? <FiCheckCircle size={10} className="text-white" aria-hidden="true" />
                                                                    : i === stepIdx
                                                                        ? <span className="w-2 h-2 rounded-full bg-white" />
                                                                        : <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-graphite-300)]" />}
                                                            </div>
                                                            <p className={cn("text-[8px] sm:text-[9px] font-semibold mt-1 text-center leading-tight whitespace-nowrap", i <= stepIdx ? (orderIsUH ? "text-accent" : "text-[var(--accent-hour-hover)]") : "text-[var(--color-graphite-300)]")}>
                                                                {STATUS_CONFIG[step]?.label.split(" ")[0]}
                                                            </p>
                                                        </div>
                                                        {i < flow.length - 1 && (
                                                            <div className="flex-1 h-px mx-1 bg-[var(--color-graphite-200)] overflow-hidden min-w-[8px]">
                                                                <div className={cn("h-full transition-all duration-500", i < stepIdx ? (orderIsUH ? "bg-accent" : "bg-hour") + " w-full" : "w-0")} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Cancel footer ── */}
                                    {canCancel && (
                                        <div className="px-4 py-2.5 border-t border-default flex flex-wrap items-center justify-end gap-2">
                                            {confirmCancelId === order._id ? (
                                                <>
                                                    <span className="text-xs text-secondary">Cancel this order?</span>
                                                    <Button variant="danger" size="sm" loading={cancellingId === order._id} onClick={() => handleCancel(order._id)}>
                                                        Yes, Cancel
                                                    </Button>
                                                    <Button variant="secondary" size="sm" onClick={() => setConfirmCancelId(null)}>
                                                        Keep Order
                                                    </Button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmCancelId(order._id)}
                                                    className="text-xs text-error font-semibold border border-[var(--color-error-100)] px-3 py-1.5 rounded-[var(--radius-sm)] hover:bg-error-tint transition"
                                                >
                                                    Cancel Order
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ── Small reusable sub-components ── */

const FilterBtn = ({ active, onClick, dot, label, count }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors",
            active ? "bg-info-tint text-info border-l-2 border-[var(--color-info-500)]" : "text-secondary hover:bg-canvas"
        )}
    >
        <span className="flex items-center gap-2">
            {dot && <span className={cn("w-1.5 h-1.5 rounded-full", dot)} />}
            {label}
        </span>
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", active ? "bg-[var(--color-info-100)] text-info" : "bg-canvas text-secondary")}>
            {count}
        </span>
    </button>
);

const Meta = ({ label, value, mono = false, bold = false }) => (
    <div>
        <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">{label}</p>
        <p className={cn("text-xs text-secondary", mono && "font-mono font-bold", bold && "font-bold text-primary")}>{value}</p>
    </div>
);

export default MyOrders;
