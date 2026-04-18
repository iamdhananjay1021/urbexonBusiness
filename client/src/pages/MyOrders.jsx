import { useEffect, useState } from "react";
import { useWebSocket } from "../hooks/useWebSocket";
import { useOrderRealtime } from "../hooks/useOrderRealtime";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { getMyOrders } from "../features/orders/orderSlice";
import { FaBoxOpen, FaSync, FaShoppingBag, FaArrowRight, FaCheckCircle, FaFileInvoice, FaFilter, FaTimes, FaBolt } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";
import api from "../api/axios";
import SEO from "../components/SEO";

const STATUS_CONFIG = {
    PLACED: { label: "Order Placed", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", dot: "bg-yellow-400" },
    CONFIRMED: { label: "Confirmed", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" },
    PACKED: { label: "Packed", color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200", dot: "bg-indigo-400" },
    READY_FOR_PICKUP: { label: "Ready for Pickup", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
    SHIPPED: { label: "Shipped", color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200", dot: "bg-purple-400" },
    OUT_FOR_DELIVERY: { label: "Out for Delivery", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200", dot: "bg-orange-400" },
    DELIVERED: { label: "Delivered", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
    CANCELLED: { label: "Cancelled", color: "text-red-500", bg: "bg-red-50", border: "border-red-200", dot: "bg-red-400" },
};

const ECOM_FLOW = ["PLACED", "CONFIRMED", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
const UH_FLOW = ["PLACED", "CONFIRMED", "PACKED", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED"];
const CANCELLABLE = ["PLACED", "CONFIRMED"];
const STALE_MS = 60_000;

const getItemImage = (item) => item.images?.[0]?.url || item.image || null;

const MyOrders = () => {
    const dispatch = useDispatch();
    const { token: authToken } = useAuth();

    useWebSocket(authToken, {
        onMessage: (msg) => {
            if (msg.type === "new_order" || msg.type === "order_status_updated") dispatch(getMyOrders());
        },
    });

    const { orders = [], status, error, lastFetched } = useSelector((s) => s.orders);

    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [activeTab, setActiveTab] = useState("ECOMMERCE"); // "ECOMMERCE" | "URBEXON_HOUR"
    const [cancellingId, setCancellingId] = useState(null);
    const [confirmCancelId, setConfirmCancelId] = useState(null);
    const [downloadingId, setDownloadingId] = useState(null);
    const [liveMessage, setLiveMessage] = useState("");
    const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

    useOrderRealtime({
        enabled: true,
        onStatusUpdate: async (payload) => {
            setLiveMessage(
                `Live: Order #${String(payload.orderId).slice(-6).toUpperCase()} → ${String(payload.status || "updated").replaceAll("_", " ")}`
            );
            await dispatch(getMyOrders());
        },
    });

    useEffect(() => {
        const isStale = !lastFetched || Date.now() - lastFetched > STALE_MS;
        if (isStale || (orders.length === 0 && status !== "loading")) dispatch(getMyOrders());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await dispatch(getMyOrders());
        setRefreshing(false);
    };

    const handleCancel = async (orderId) => {
        try {
            setCancellingId(orderId);
            await api.patch(`/orders/${orderId}/cancel`);
            dispatch(getMyOrders());
            setConfirmCancelId(null);
        } catch (err) {
            alert(err.response?.data?.message || "Cancel failed");
        } finally {
            setCancellingId(null);
        }
    };

    const handleDownloadInvoice = async (orderId) => {
        try {
            setDownloadingId(orderId);
            const response = await api.get(`/invoice/${orderId}/download`, { responseType: "blob" });
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
            setDownloadingId(null);
        }
    };

    const tabOrders = orders.filter((o) => (o.orderMode || "ECOMMERCE") === activeTab);
    const filtered = activeFilter === "ALL" ? tabOrders : tabOrders.filter((o) => o.orderStatus === activeFilter);
    const ecomCount = orders.filter((o) => (o.orderMode || "ECOMMERCE") === "ECOMMERCE").length;
    const uhCount = orders.filter((o) => o.orderMode === "URBEXON_HOUR").length;
    const isUHTab = activeTab === "URBEXON_HOUR";
    const activeFlow = isUHTab ? UH_FLOW : ECOM_FLOW;

    if (status === "loading" && !refreshing && orders.length === 0)
        return (
            <div className="min-h-screen bg-[#f1f3f6] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-zinc-400 text-sm">Loading your orders…</p>
                </div>
            </div>
        );

    return (
        <div className="min-h-screen" style={{ background: "#f1f3f6", fontFamily: "'DM Sans', sans-serif" }}>
            <SEO title="My Orders" noindex />
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
                .mo-root { padding: 24px 16px; }
                @media(min-width:640px) { .mo-root { padding: 24px; } }
                .mo-layout { display: flex; gap: 16px; align-items: flex-start; max-width: 960px; margin: 0 auto; }
                .mo-sidebar { width: 220px; flex-shrink: 0; display: none; }
                @media(min-width:1024px) { .mo-sidebar { display: block; } }
                .mo-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
                .mo-header-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; }
                @media(min-width:640px) { .mo-header-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; } }
                .mo-header-actions { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
                @media(min-width:640px) { .mo-header-actions { margin-top: 0; margin-left: auto; } }
                .mo-item-row { display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; }
                .mo-item-status { text-align: right; flex-shrink: 0; }
                @media(max-width:480px) { .mo-item-status { display: none; } }
                .mo-item-status-mobile { display: none; margin-top: 4px; }
                @media(max-width:480px) { .mo-item-status-mobile { display: flex; align-items: center; gap: 4px; } }
                .mo-tracker { display: flex; align-items: flex-start; overflow-x: auto; scrollbar-width: none; gap: 0; padding: 4px 0; }
                .mo-tracker::-webkit-scrollbar { display: none; }
                .mo-tracker-step { display: flex; align-items: center; flex: 1; min-width: 48px; }
                .mo-filter-chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding: 2px 0; }
                .mo-filter-chips::-webkit-scrollbar { display: none; }
                .mo-mobile-filter { display: flex; align-items: center; }
                @media(min-width:1024px) { .mo-mobile-filter { display: none; } }
                .mo-overlay { display: none; position: fixed; inset: 0; z-index: 40; background: rgba(0,0,0,.4); }
                .mo-overlay.open { display: block; }
                .mo-drawer { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #fff; border-top-left-radius: 16px; border-top-right-radius: 16px; max-height: 60vh; overflow-y: auto; transform: translateY(100%); transition: transform .25s ease; }
                .mo-drawer.open { transform: translateY(0); }
                .mo-mode-tabs { display: flex; gap: 0; max-width: 960px; margin: 0 auto 16px; background: #fff; border-radius: 12px; border: 1px solid #e7e5e4; overflow: hidden; }
                .mo-mode-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 16px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; background: transparent; color: #78716c; transition: all .2s; position: relative; font-family: inherit; }
                .mo-mode-tab.active { color: #1c1917; background: #fafaf9; }
                .mo-mode-tab.active::after { content: ''; position: absolute; bottom: 0; left: 16px; right: 16px; height: 2.5px; border-radius: 2px; }
                .mo-mode-tab.ecom.active::after { background: #f59e0b; }
                .mo-mode-tab.uh.active::after { background: #6366f1; }
                .mo-mode-tab-count { font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 20px; }
                .mo-mode-tab.ecom .mo-mode-tab-count { background: #fef3c7; color: #d97706; }
                .mo-mode-tab.uh .mo-mode-tab-count { background: #ede9fe; color: #7c3aed; }
                .mo-uh-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 20px; background: #ede9fe; color: #7c3aed; border: 1px solid #ddd6fe; }
            `}</style>

            <div className="mo-root">

                {/* Mode Tabs: Ecommerce vs Urbexon Hour */}
                <div className="mo-mode-tabs">
                    <button
                        className={`mo-mode-tab ecom${activeTab === "ECOMMERCE" ? " active" : ""}`}
                        onClick={() => { setActiveTab("ECOMMERCE"); setActiveFilter("ALL"); }}
                    >
                        <FaShoppingBag size={13} /> Ecommerce
                        <span className="mo-mode-tab-count">{ecomCount}</span>
                    </button>
                    <button
                        className={`mo-mode-tab uh${activeTab === "URBEXON_HOUR" ? " active" : ""}`}
                        onClick={() => { setActiveTab("URBEXON_HOUR"); setActiveFilter("ALL"); }}
                    >
                        <FaBolt size={13} /> Urbexon Hour
                        <span className="mo-mode-tab-count">{uhCount}</span>
                    </button>
                </div>

                {/* Mobile filter drawer overlay */}
                <div className={`mo-overlay${mobileFilterOpen ? " open" : ""}`} onClick={() => setMobileFilterOpen(false)} />
                <div className={`mo-drawer${mobileFilterOpen ? " open" : ""}`}>
                    <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                        <p className="font-bold text-zinc-900 text-sm">Filter Orders</p>
                        <button onClick={() => setMobileFilterOpen(false)} className="p-1 text-zinc-400"><FaTimes size={14} /></button>
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

                <div className="mo-layout">

                    {/* ── SIDEBAR (desktop only) ── */}
                    <aside className="mo-sidebar space-y-3">
                        <div className="bg-white rounded-lg border border-stone-200 px-4 py-3 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center text-base">{isUHTab ? "⚡" : "📦"}</div>
                            <div>
                                <p className="font-semibold text-zinc-800 text-sm leading-tight">{isUHTab ? "Urbexon Hour" : "My Orders"}</p>
                                <p className="text-xs text-zinc-400">{tabOrders.length} orders</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                            <p className="px-4 py-2.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-stone-100">Filter</p>
                            <FilterBtn active={activeFilter === "ALL"} onClick={() => setActiveFilter("ALL")} label="All Orders" count={tabOrders.length} />
                            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                                const count = tabOrders.filter((o) => o.orderStatus === key).length;
                                if (!count) return null;
                                return <FilterBtn key={key} active={activeFilter === key} onClick={() => setActiveFilter(key)} dot={cfg.dot} label={cfg.label} count={count} />;
                            })}
                        </div>
                    </aside>

                    {/* ── MAIN ── */}
                    <div className="mo-main">

                        {/* Topbar */}
                        <div className="bg-white rounded-lg border border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="mo-mobile-filter">
                                    <button onClick={() => setMobileFilterOpen(true)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 bg-stone-100 px-3 py-1.5 rounded-full hover:bg-stone-200 transition">
                                        <FaFilter size={9} />
                                        {activeFilter === "ALL" ? "Filter" : STATUS_CONFIG[activeFilter]?.label}
                                    </button>
                                </div>
                                <h1 className="font-bold text-zinc-900 text-sm truncate">
                                    {activeFilter === "ALL" ? (isUHTab ? "Urbexon Hour Orders" : "All Orders") : STATUS_CONFIG[activeFilter]?.label}
                                    <span className="ml-1.5 text-zinc-400 font-normal">({filtered.length})</span>
                                </h1>
                            </div>
                            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 text-xs text-zinc-500 font-semibold hover:text-amber-600 transition-colors disabled:opacity-50 shrink-0">
                                <FaSync size={10} className={refreshing ? "animate-spin" : ""} />
                                <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Refresh"}</span>
                            </button>
                        </div>

                        {/* Alerts */}
                        {status === "failed" && error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2.5 rounded-lg text-sm">⚠️ {error}</div>
                        )}
                        {liveMessage && (
                            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-lg text-xs font-semibold">{liveMessage}</div>
                        )}

                        {/* Empty states */}
                        {orders.length === 0 && status === "succeeded" && (
                            <EmptyState
                                icon={<FaShoppingBag size={36} className="text-stone-200 mx-auto mb-3" />}
                                title="No orders yet!"
                                sub="Looks like you haven't placed any orders."
                                action={
                                    <Link to="/" className="inline-flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white rounded-lg font-semibold text-sm hover:bg-amber-600 transition active:scale-95">
                                        Start Shopping <FaArrowRight size={10} />
                                    </Link>
                                }
                            />
                        )}
                        {tabOrders.length === 0 && orders.length > 0 && status === "succeeded" && (
                            <EmptyState
                                icon={isUHTab ? <FaBolt size={28} className="text-stone-300 mx-auto mb-2" /> : <FaShoppingBag size={28} className="text-stone-300 mx-auto mb-2" />}
                                title={isUHTab ? "No Urbexon Hour orders" : "No Ecommerce orders"}
                                sub={isUHTab ? "Your express delivery orders will appear here." : "Your standard delivery orders will appear here."}
                                action={
                                    <Link to={isUHTab ? "/urbexon-hour" : "/"} className="text-xs text-blue-600 font-semibold hover:underline">
                                        {isUHTab ? "Browse Urbexon Hour" : "Start Shopping"}
                                    </Link>
                                }
                            />
                        )}
                        {tabOrders.length > 0 && filtered.length === 0 && (
                            <EmptyState
                                icon={<FaBoxOpen size={28} className="text-stone-300 mx-auto mb-2" />}
                                title={`No ${STATUS_CONFIG[activeFilter]?.label} orders`}
                                action={
                                    <button onClick={() => setActiveFilter("ALL")} className="text-xs text-blue-600 font-semibold hover:underline">View all orders</button>
                                }
                            />
                        )}

                        {/* Order cards */}
                        {filtered.map((order) => {
                            const cfg = STATUS_CONFIG[order.orderStatus] || STATUS_CONFIG.PLACED;
                            const canCancel = CANCELLABLE.includes(order.orderStatus);
                            const orderIsUH = order.orderMode === "URBEXON_HOUR";
                            const flow = orderIsUH ? UH_FLOW : ECOM_FLOW;
                            const stepIdx = flow.indexOf(order.orderStatus);
                            const isCancelled = order.orderStatus === "CANCELLED";
                            const isDelivered = order.orderStatus === "DELIVERED";
                            const isDownloading = downloadingId === order._id;

                            const payMethod = order.payment?.method || "COD";
                            const payStatus = order.payment?.status || "PENDING";
                            const isPaid = payMethod === "RAZORPAY" && payStatus === "PAID";
                            const isCOD = payMethod === "COD";

                            return (
                                <div key={order._id} className="bg-white rounded-lg border border-stone-200 overflow-hidden hover:shadow-sm transition-shadow">

                                    {/* ── Order header — responsive grid ── */}
                                    <div className="px-4 py-3 bg-stone-50/60 border-b border-stone-100">
                                        <div className="mo-header-meta">
                                            <Meta label="Order ID" value={`#${order._id.slice(-8).toUpperCase()}`} mono />
                                            <Meta label="Placed On" value={new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
                                            <Meta label="Total" value={`₹${Number(order.totalAmount).toLocaleString("en-IN")}`} bold />
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Payment</p>
                                                <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${isPaid ? "bg-emerald-50 text-emerald-700 border-emerald-200" : isCOD ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-stone-50 text-zinc-500 border-stone-200"}`}>
                                                    {isPaid ? "Paid Online" : isCOD ? "COD" : "Pending"}
                                                </span>
                                            </div>
                                            {orderIsUH && (
                                                <div>
                                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">Mode</p>
                                                    <span className="mo-uh-badge"><FaBolt size={9} /> Express</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="mo-header-actions">
                                            {isDelivered && (
                                                <button onClick={() => handleDownloadInvoice(order._id)} disabled={isDownloading} className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition disabled:opacity-50">
                                                    <FaFileInvoice size={11} />{isDownloading ? "…" : "Invoice"}
                                                </button>
                                            )}
                                            <Link to={`/orders/${order._id}`} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition">
                                                Details <FaArrowRight size={8} />
                                            </Link>
                                        </div>
                                    </div>

                                    {/* ── Items ── */}
                                    <div className="divide-y divide-stone-50">
                                        {order.items?.map((item, idx) => {
                                            const img = getItemImage(item);
                                            const qty = item.qty || item.quantity || 1;
                                            return (
                                                <div key={idx} className="mo-item-row">
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg border border-stone-100 bg-stone-50 flex items-center justify-center shrink-0 overflow-hidden">
                                                        {img
                                                            ? <img src={img} alt={item.name} className="w-full h-full object-contain p-1" onError={(e) => (e.target.style.display = "none")} />
                                                            : <FaBoxOpen size={16} className="text-stone-300" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-zinc-800 text-sm leading-snug line-clamp-2">{item.name}</p>
                                                        <p className="text-xs text-zinc-400 mt-0.5">{qty} × ₹{item.price?.toLocaleString("en-IN")}</p>
                                                        {item.customization?.text && (
                                                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">✏ {item.customization.text}</span>
                                                        )}
                                                        {/* Mobile status inline */}
                                                        <div className="mo-item-status-mobile">
                                                            {isCancelled ? (
                                                                <span className="text-xs font-semibold text-red-500">Cancelled</span>
                                                            ) : isDelivered ? (
                                                                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1"><FaCheckCircle size={10} /> Delivered</span>
                                                            ) : (
                                                                <span className={`text-xs font-semibold ${cfg.color} flex items-center gap-1`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />{cfg.label}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {/* Desktop status */}
                                                    <div className="mo-item-status">
                                                        {isCancelled ? (
                                                            <p className="text-sm font-semibold text-red-500">Cancelled</p>
                                                        ) : isDelivered ? (
                                                            <span className="flex items-center gap-1 justify-end text-sm font-semibold text-emerald-600"><FaCheckCircle size={12} /> Delivered</span>
                                                        ) : (
                                                            <span className={`flex items-center gap-1.5 justify-end text-sm font-semibold ${cfg.color}`}><span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />{cfg.label}</span>
                                                        )}
                                                        <p className="text-xs text-zinc-400 mt-0.5">₹{(qty * item.price)?.toLocaleString("en-IN")}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* ── Shipment tracking ── */}
                                    {order.shipping?.trackingUrl && ["PACKED", "SHIPPED", "OUT_FOR_DELIVERY"].includes(order.orderStatus) && (
                                        <div className="px-4 py-3 border-t border-stone-100 bg-indigo-50/40 flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs text-zinc-600 font-medium">
                                                Via <span className="font-semibold text-indigo-700">{order.shipping.courierName || "Courier"}</span>
                                                {order.shipping.awbCode && <span className="ml-2 text-zinc-400 font-mono text-[11px]">AWB: {order.shipping.awbCode}</span>}
                                            </p>
                                            <a href={order.shipping.trackingUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-700 border border-indigo-200 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition">
                                                Track →
                                            </a>
                                        </div>
                                    )}

                                    {/* ── Live rider tracking ── */}
                                    {["OUT_FOR_DELIVERY", "READY_FOR_PICKUP"].includes(order.orderStatus) && order.delivery?.assignedTo && (
                                        <div className="px-4 py-3 border-t border-stone-100 bg-orange-50/50 flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                                                <p className="text-xs text-orange-700 font-semibold">
                                                    🛵 {order.delivery.riderName || "Delivery Partner"} is {order.orderStatus === "OUT_FOR_DELIVERY" ? "on the way" : "heading to pick up"}
                                                </p>
                                            </div>
                                            <Link to={`/orders/${order._id}`} className="text-xs font-bold text-white bg-orange-500 px-4 py-1.5 rounded-lg hover:bg-orange-600 transition no-underline flex items-center gap-1.5">
                                                📍 Live Track
                                            </Link>
                                        </div>
                                    )}

                                    {/* ── Progress tracker (scrollable on mobile) ── */}
                                    {!isCancelled && (
                                        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/40">
                                            {orderIsUH && !isDelivered && (
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FaBolt size={10} className="text-violet-500" />
                                                    <span className="text-[11px] font-bold text-violet-600">Express Delivery • 45-120 min</span>
                                                </div>
                                            )}
                                            <div className="mo-tracker">
                                                {flow.map((step, i) => (
                                                    <div key={step} className="mo-tracker-step">
                                                        <div className="flex flex-col items-center">
                                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${i <= stepIdx ? (orderIsUH ? "bg-violet-500" : "bg-amber-500") : "bg-stone-200"}`}>
                                                                {i < stepIdx
                                                                    ? <FaCheckCircle size={10} className="text-white" />
                                                                    : i === stepIdx
                                                                        ? <span className="w-2 h-2 rounded-full bg-white" />
                                                                        : <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />}
                                                            </div>
                                                            <p className={`text-[8px] sm:text-[9px] font-semibold mt-1 text-center leading-tight whitespace-nowrap ${i <= stepIdx ? (orderIsUH ? "text-violet-600" : "text-amber-600") : "text-zinc-300"}`}>
                                                                {STATUS_CONFIG[step]?.label.split(" ")[0]}
                                                            </p>
                                                        </div>
                                                        {i < flow.length - 1 && (
                                                            <div className="flex-1 h-px mx-1 bg-stone-200 overflow-hidden min-w-[8px]">
                                                                <div className={`h-full transition-all duration-500 ${i < stepIdx ? (orderIsUH ? "bg-violet-400" : "bg-amber-400") + " w-full" : "w-0"}`} />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Cancel footer ── */}
                                    {canCancel && (
                                        <div className="px-4 py-2.5 border-t border-stone-100 flex flex-wrap items-center justify-end gap-2">
                                            {confirmCancelId === order._id ? (
                                                <>
                                                    <span className="text-xs text-zinc-500">Cancel this order?</span>
                                                    <button onClick={() => handleCancel(order._id)} disabled={cancellingId === order._id} className="px-3 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition disabled:opacity-60">
                                                        {cancellingId === order._id ? "Cancelling…" : "Yes, Cancel"}
                                                    </button>
                                                    <button onClick={() => setConfirmCancelId(null)} className="px-3 py-1.5 bg-stone-100 text-zinc-600 text-xs font-semibold rounded-lg hover:bg-stone-200 transition">
                                                        Keep Order
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => setConfirmCancelId(order._id)}
                                                    className="text-xs text-red-500 font-semibold border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 transition"
                                                >
                                                    Cancel Order
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
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
        className={`w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold transition-colors ${active ? "bg-blue-50 text-blue-600 border-l-2 border-blue-500" : "text-zinc-600 hover:bg-stone-50"}`}
    >
        <span className="flex items-center gap-2">
            {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />}
            {label}
        </span>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? "bg-blue-100 text-blue-600" : "bg-stone-100 text-zinc-500"}`}>
            {count}
        </span>
    </button>
);

const Meta = ({ label, value, mono = false, bold = false }) => (
    <div>
        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-xs text-zinc-700 ${mono ? "font-mono font-bold" : ""} ${bold ? "font-bold text-zinc-800" : "font-medium"}`}>{value}</p>
    </div>
);

const EmptyState = ({ icon, title, sub, action }) => (
    <div className="bg-white rounded-lg border border-stone-200 py-14 text-center">
        {icon}
        <p className="text-zinc-600 font-semibold text-base mb-1">{title}</p>
        {sub && <p className="text-zinc-400 text-sm mb-5">{sub}</p>}
        {action && <div className="mt-2">{action}</div>}
    </div>
);

export default MyOrders;