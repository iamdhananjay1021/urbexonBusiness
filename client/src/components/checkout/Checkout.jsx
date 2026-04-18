/**
 * Checkout.jsx — Final Production Fix
 *
 * KEY FIXES:
 * ✅ Standalone page — renders its OWN minimal header (no MainLayout navbar)
 * ✅ No Footer — checkout pe footer nahi hona chahiye
 * ✅ Mobile CTA always visible + correct z-index
 * ✅ No sticky conflict with global navbar
 * ✅ Pricing from backend only
 * ✅ COD available PAN-INDIA
 * ✅ WhatsApp completely removed
 *
 * IMPORTANT — AppRoutes.jsx mein Checkout ko MainLayout ke BAHAR rakho:
 *
 *   // ❌ Wrong (current):
 *   <Route element={<MainLayout />}>
 *     <Route path="/checkout" element={<Checkout />} />
 *   </Route>
 *
 *   // ✅ Correct:
 *   <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
 */

import { useLocation, useNavigate, Link } from "react-router-dom";
import {
    FaArrowLeft, FaShieldAlt, FaTruck, FaCheckCircle,
    FaUser, FaMapMarkerAlt, FaClipboardList,
    FaPencilAlt, FaCreditCard, FaLock, FaRedo, FaMoneyBillWave,
    FaImage, FaSpinner, FaPlus, FaEdit, FaTrash,
    FaHome, FaBriefcase, FaBookmark, FaChevronDown, FaChevronUp,
    FaStar, FaShoppingCart,
} from "react-icons/fa";
import { useCheckout } from "../../hooks/useCheckout";
import PriceSummary from "./PriceSummary";
import AddressForm from "./AddressForm";
import SEO from "../SEO";

const fmt = (n) => Number(n || 0).toLocaleString("en-IN");

const LABEL_ICONS = {
    Home: <FaHome size={10} />,
    Work: <FaBriefcase size={10} />,
    Other: <FaMapMarkerAlt size={10} />,
};

const STEPS = [
    { id: 1, label: "Contact", icon: <FaUser size={11} /> },
    { id: 2, label: "Address", icon: <FaMapMarkerAlt size={11} /> },
    { id: 3, label: "Payment", icon: <FaCreditCard size={11} /> },
];

const Checkout = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Restore buyNowItem: prefer location.state, fall back to sessionStorage
    const buyNowItem = (() => {
        if (location.state?.buyNowItem) return location.state.buyNowItem;
        try {
            const stored = sessionStorage.getItem("ux_buy_now_item");
            if (stored) {
                const parsed = JSON.parse(stored);
                sessionStorage.removeItem("ux_buy_now_item");
                return parsed;
            }
        } catch { }
        return null;
    })();
    const couponFromCart = location.state?.coupon || null;

    const ck = useCheckout(buyNowItem, couponFromCart);
    const {
        step, setStep, error, setError,
        contact, setContact,
        addresses, addrLoading, selectedAddrId, setSelectedAddrId, selectedAddress,
        showAddForm, setShowAddForm, editingAddr, setEditingAddr,
        savingAddr, deleteConfirmId, setDeleteConfirmId,
        paymentMethod, selectPaymentMethod, payState, loading,
        codStatus, codDistance, codChecking, codAvailable, deliveryETA,
        pricing, pricingLoading,
        deliveryType, setDeliveryType,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        handleContactContinue, handleAddressContinue,
        handleAddAddress, handleEditAddress, handleDeleteAddress, handleSetDefault,
        handleCOD, handlePayOnline,
    } = ck;

    const finalTotal = pricing?.finalTotal || 0;

    /* ── CSS ── */
    const css = `
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=DM+Sans:wght@300;400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
        --bg:       #f5f2ec;
        --surf:     #ffffff;
        --ink:      #1c1917;
        --muted:    #78716c;
        --faint:    #a8a29e;
        --border:   #e7e5e1;
        --gold:     #c8a96e;
        --gold-d:   #a8894e;
        --gold-bg:  #fdf6ea;
        --green:    #059669;
        --green-bg: #ecfdf5;
        --red:      #dc2626;
        --red-bg:   #fef2f2;
        --blue:     #2563eb;
        --navy:     #1a1740;
        --orange:   #d97706;
        --orange-bg:#fffbeb;
    }

    @keyframes ck-up     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
    @keyframes ck-spin   { to{transform:rotate(360deg)} }
    @keyframes ck-pulse  { 0%,100%{opacity:1} 50%{opacity:.5} }
    @keyframes ck-shim   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

    /* ════════════════════════════════════
       ROOT — full page, standalone
       No MainLayout wrapping this
    ════════════════════════════════════ */
    .ck-page {
        font-family: 'DM Sans', sans-serif;
        min-height: 100vh;
        background: var(--bg);
        display: flex;
        flex-direction: column;
    }

    /* ════════════════════════════════════
       CHECKOUT HEADER (own minimal header)
    ════════════════════════════════════ */
    .ck-header {
        background: var(--navy);
        padding: 0 24px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-shrink: 0;
        position: sticky;
        top: 0;
        z-index: 50;
    }
    .ck-header-logo {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.3rem;
        font-weight: 700;
        color: white;
        text-decoration: none;
        letter-spacing: 0.05em;
    }
    .ck-header-logo span { color: var(--gold); }
    .ck-header-secure {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: rgba(255,255,255,0.55);
        font-weight: 600;
        letter-spacing: 0.06em;
    }

    /* ════════════════════════════════════
       MOBILE PRICE BAR
       Below sticky header — no z-index conflict
    ════════════════════════════════════ */
    .ck-mob-bar {
        display: none;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        background: var(--navy);
        color: #fff;
        cursor: pointer;
        border-top: 1px solid rgba(255,255,255,0.08);
    }
    @media(max-width:767px){ .ck-mob-bar{ display:flex; } }
    .ck-mob-bar-left  { font-size:12px; color:rgba(255,255,255,.65); display:flex; align-items:center; gap:6px; }
    .ck-mob-bar-right { display:flex; align-items:center; gap:8px; }
    .ck-mob-bar-total { font-family:'Cormorant Garamond',serif; font-size:1.2rem; font-weight:700; }
    .ck-mob-bar-toggle{ font-size:10px; color:rgba(255,255,255,.6); display:flex; align-items:center; gap:3px; }

    .ck-mob-accordion {
        background: var(--navy);
        overflow: hidden;
        transition: max-height .3s ease;
    }
    @media(min-width:768px){ .ck-mob-accordion{ display:none; } }
    .ck-mob-acc-inner { padding: 10px 16px 14px; }
    .ck-mob-row { display:flex; justify-content:space-between; font-size:12px; color:rgba(255,255,255,.65); margin-bottom:7px; }
    .ck-mob-row-val { color:#fff; font-weight:600; }
    .ck-mob-hr { height:1px; background:rgba(255,255,255,.1); margin:8px 0; }
    .ck-mob-total { display:flex; justify-content:space-between; align-items:baseline; }
    .ck-mob-total-lbl { font-size:13px; font-weight:700; color:#fff; }
    .ck-mob-total-val { font-family:'Cormorant Garamond',serif; font-size:1.35rem; font-weight:700; color:var(--gold); }

    /* ════════════════════════════════════
       BODY AREA
    ════════════════════════════════════ */
    .ck-body {
        flex: 1;
        /* ✅ Bottom padding = mobile CTA height */
        padding-bottom: 80px;
    }
    @media(min-width:768px){ .ck-body{ padding-bottom: 0; } }

    .ck-inner {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 16px 0;
    }
    @media(min-width:768px){ .ck-inner{ padding: 28px 24px 40px; } }

    .ck-back {
        display: inline-flex; align-items: center; gap: 10px;
        font-size: 13px; font-weight: 600; color: var(--muted);
        background: none; border: none; cursor: pointer;
        padding: 0; margin-bottom: 20px;
        font-family: 'DM Sans', sans-serif; transition: color .2s;
    }
    .ck-back:hover { color: var(--ink); }
    .ck-back-circle {
        width: 30px; height: 30px; background: var(--surf);
        border: 1px solid var(--border); border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: all .2s;
    }
    .ck-back:hover .ck-back-circle { border-color:var(--gold); color:var(--gold); }

    /* ════════════════════════════════════
       STEP BAR
    ════════════════════════════════════ */
    .ck-steps {
        background: var(--surf); border: 1px solid var(--border);
        padding: 14px 16px; margin-bottom: 14px;
        display: flex; align-items: center;
    }
    @media(min-width:480px){ .ck-steps{ padding:16px 20px; } }
    .ck-step-item { display:flex; align-items:center; flex:1; }
    .ck-step-dot {
        width:30px; height:30px; border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:11px; font-weight:700; flex-shrink:0; transition:all .3s;
    }
    .ck-step-dot.done   { background:var(--green); color:#fff; }
    .ck-step-dot.active { background:var(--gold); color:#fff; box-shadow:0 0 0 4px rgba(200,169,110,.2); }
    .ck-step-dot.pending{ background:rgba(28,25,23,.06); color:var(--faint); }
    .ck-step-lbl { font-size:11px; font-weight:600; margin-left:8px; display:none; letter-spacing:.04em; }
    @media(min-width:380px){ .ck-step-lbl{ display:block; } }
    .ck-step-lbl.done   { color:var(--green); }
    .ck-step-lbl.active { color:var(--gold); }
    .ck-step-lbl.pending{ color:var(--faint); }
    .ck-step-line { flex:1; height:1.5px; margin:0 8px; transition:background .5s; }
    .ck-step-line.done   { background:var(--green); }
    .ck-step-line.pending{ background:var(--border); }

    /* ════════════════════════════════════
       LAYOUT
    ════════════════════════════════════ */
    .ck-layout { display:flex; gap:20px; align-items:flex-start; }
    .ck-main { flex:1; min-width:0; }
    .ck-side { width:300px; flex-shrink:0; position:sticky; top:76px; }
    @media(max-width:767px){ .ck-layout{ flex-direction:column; } .ck-side{ display:none; } }

    /* ════════════════════════════════════
       CARDS
    ════════════════════════════════════ */
    .ck-card {
        background:var(--surf); border:1px solid var(--border);
        padding:18px 14px; margin-bottom:14px;
        animation:ck-up .4s cubic-bezier(.22,1,.36,1) both;
    }
    @media(min-width:480px){ .ck-card{ padding:24px; } }
    .ck-card-title {
        font-family:'Cormorant Garamond',serif; font-size:1.25rem;
        font-weight:600; color:var(--ink);
        display:flex; align-items:center; gap:10px; margin-bottom:20px;
    }
    .ck-card-icon { color:var(--gold); }

    /* ════════════════════════════════════
       FORM ELEMENTS
    ════════════════════════════════════ */
    .ck-field { margin-bottom:14px; }
    .ck-lbl {
        display:flex; align-items:center; gap:6px;
        font-size:10px; font-weight:700; letter-spacing:.08em;
        text-transform:uppercase; color:var(--faint); margin-bottom:7px;
    }
    .ck-opt { font-weight:400; text-transform:none; letter-spacing:0; color:rgba(168,162,158,.7); }
    .ck-inp {
        width:100%; padding:11px 14px; background:#faf9f7;
        border:1px solid var(--border); color:var(--ink); font-size:14px;
        font-family:'DM Sans',sans-serif; outline:none; transition:all .2s;
    }
    .ck-inp::placeholder { color:var(--faint); }
    .ck-inp:focus { border-color:var(--gold); background:var(--gold-bg); box-shadow:0 0 0 3px rgba(200,169,110,.1); }
    .ck-inp.pin-ok { border-color:var(--green); }
    .ck-inp.pin-er { border-color:var(--red); }
    .ck-g2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
    @media(max-width:380px){ .ck-g2{ grid-template-columns:1fr; } }
    .ck-phone-wrap { position:relative; }
    .ck-phone-pre { position:absolute; left:14px; top:50%; transform:translateY(-50%); font-size:13px; font-weight:600; color:var(--muted); pointer-events:none; }
    .ck-phone-inp { padding-left:44px !important; }

    /* ════════════════════════════════════
       BUTTONS
    ════════════════════════════════════ */
    .ck-btn {
        width:100%; padding:14px; font-family:'DM Sans',sans-serif;
        font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
        border:none; cursor:pointer;
        display:flex; align-items:center; justify-content:center; gap:8px;
        transition:all .2s; margin-top:6px;
    }
    .ck-btn:disabled { opacity:.5; cursor:not-allowed; }
    .ck-btn:active:not(:disabled){ transform:scale(.99); }
    .ck-btn-dark  { background:var(--ink); color:#fff; }
    .ck-btn-dark:hover:not(:disabled)  { background:#2d2926; }
    .ck-btn-gold  { background:var(--gold); color:#fff; }
    .ck-btn-gold:hover:not(:disabled)  { background:var(--gold-d); }
    .ck-btn-green { background:var(--green); color:#fff; }
    .ck-btn-green:hover:not(:disabled) { background:#047857; }
    .ck-btn-red   { background:var(--red); color:#fff; }
    .ck-btn-ghost {
        padding:12px 20px; background:rgba(28,25,23,.06); color:var(--muted);
        border:none; cursor:pointer; font-family:'DM Sans',sans-serif;
        font-size:12px; font-weight:600; transition:all .18s;
    }
    .ck-btn-ghost:hover { background:rgba(28,25,23,.1); color:var(--ink); }

    /* ════════════════════════════════════
       ERRORS
    ════════════════════════════════════ */
    .ck-err {
        background:var(--red-bg); border:1px solid rgba(220,38,38,.2);
        color:var(--red); font-size:12px; font-weight:500;
        padding:10px 14px; margin-bottom:14px;
        display:flex; align-items:flex-start; gap:8px;
    }
    .ck-ferr {
        background:var(--red-bg); border:1px solid rgba(220,38,38,.2);
        color:var(--red); font-size:12px; font-weight:500;
        padding:8px 12px; margin-top:4px;
    }

    /* ════════════════════════════════════
       ADDRESS FORM
    ════════════════════════════════════ */
    .ck-af { display:flex; flex-direction:column; gap:12px; }
    .ck-af-toprow { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .ck-af-labels { display:flex; gap:5px; flex-wrap:wrap; }
    .ck-af-lbtn {
        display:inline-flex; align-items:center; gap:5px; padding:6px 11px;
        border:1.5px solid var(--border); background:var(--surf); color:var(--muted);
        font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
        cursor:pointer; font-family:'DM Sans',sans-serif; transition:all .18s;
    }
    .ck-af-lbtn.on { background:var(--ink); color:#fff; border-color:var(--ink); }
    .ck-af-gps {
        margin-left:auto; display:inline-flex; align-items:center; gap:5px; padding:6px 11px;
        border:1px solid rgba(37,99,235,.25); background:rgba(37,99,235,.06); color:var(--blue);
        font-size:10px; font-weight:700; letter-spacing:.05em; text-transform:uppercase;
        cursor:pointer; font-family:'DM Sans',sans-serif; transition:all .18s;
    }
    .ck-af-gps:disabled { opacity:.5; cursor:not-allowed; }
    .ck-af-gmsg { font-size:11px; font-weight:500; padding:7px 10px; }
    .ck-af-gmsg.ok { background:rgba(37,99,235,.06); border:1px solid rgba(37,99,235,.15); color:var(--blue); }
    .ck-af-gmsg.er { background:var(--red-bg); border:1px solid rgba(220,38,38,.2); color:var(--red); }
    .ck-af-pinmsg { display:flex; align-items:center; gap:5px; font-size:11px; font-weight:600; margin-top:5px; }
    .ck-af-pinmsg.ok { color:var(--green); }
    .ck-af-pinmsg.er { color:var(--red); }
    .ck-af-acts { display:flex; gap:8px; padding-top:4px; }

    /* ════════════════════════════════════
       ADDRESS CARDS
    ════════════════════════════════════ */
    .ck-addr {
        border:1.5px solid var(--border); padding:14px; margin-bottom:10px;
        cursor:pointer; transition:all .2s; position:relative; background:var(--surf);
    }
    .ck-addr.sel  { border-color:var(--gold); background:var(--gold-bg); }
    .ck-addr:hover:not(.sel) { border-color:var(--muted); }
    .ck-addr-lchip {
        display:inline-flex; align-items:center; gap:5px;
        font-size:9px; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
        padding:3px 8px; margin-bottom:6px;
    }
    .lc-Home  { background:rgba(200,169,110,.15); color:var(--gold-d); }
    .lc-Work  { background:rgba(37,99,235,.1); color:var(--blue); }
    .lc-Other { background:rgba(109,40,217,.1); color:#7c3aed; }
    .ck-addr-sel-dot {
        position:absolute; top:10px; right:10px; width:20px; height:20px;
        background:var(--gold); display:flex; align-items:center; justify-content:center;
        color:#fff; font-size:10px;
    }
    .ck-addr-def-badge {
        display:inline-flex; align-items:center; gap:3px;
        font-size:8px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
        background:var(--green-bg); color:var(--green); padding:2px 6px; margin-left:6px;
    }
    .ck-addr-acts {
        display:flex; align-items:center; gap:10px;
        margin-top:10px; padding-top:10px; border-top:1px solid var(--border); flex-wrap:wrap;
    }
    .ck-addr-act {
        display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700;
        background:none; border:none; cursor:pointer; padding:0;
        font-family:'DM Sans',sans-serif; transition:color .2s;
    }
    .aa-edit { color:var(--blue); } .aa-edit:hover { color:#1d4ed8; }
    .aa-def  { color:var(--green); } .aa-def:hover { color:#047857; }
    .aa-del  { color:#ef4444; margin-left:auto; } .aa-del:hover { color:var(--red); }
    .ck-addr-del-confirm { display:flex; align-items:center; gap:6px; margin-left:auto; }
    .ck-del-yes { background:#ef4444; color:#fff; border:none; font-size:10px; font-weight:800; padding:3px 8px; cursor:pointer; }
    .ck-del-no  { background:rgba(28,25,23,.06); color:var(--muted); border:none; font-size:10px; font-weight:700; padding:3px 8px; cursor:pointer; }
    .ck-add-btn {
        width:100%; display:flex; align-items:center; justify-content:center; gap:8px;
        padding:14px; border:1.5px dashed var(--border); background:transparent; color:var(--muted);
        font-size:13px; font-weight:600; font-family:'DM Sans',sans-serif;
        cursor:pointer; transition:all .2s; margin-top:6px;
    }
    .ck-add-btn:hover { border-color:var(--gold); color:var(--gold); }
    .ck-add-form-wrap { border:1.5px dashed var(--gold); background:var(--gold-bg); padding:16px; margin-top:6px; }
    .ck-add-form-title {
        font-size:10px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
        color:var(--gold); margin-bottom:14px; display:flex; align-items:center; gap:6px;
    }

    /* ════════════════════════════════════
       ORDER ITEMS
    ════════════════════════════════════ */
    .ck-order-item {
        display:flex; align-items:flex-start; gap:12px;
        padding-bottom:14px; margin-bottom:14px; border-bottom:1px solid var(--border);
    }
    .ck-order-item:last-child { border-bottom:none; padding-bottom:0; margin-bottom:0; }
    .ck-order-img {
        width:56px; height:56px; flex-shrink:0;
        object-fit:contain; border:1px solid var(--border); background:#faf9f7; padding:4px;
    }
    .ck-custom-badge { margin-top:8px; background:var(--gold-bg); border:1px solid rgba(200,169,110,.3); padding:8px 10px; }
    .ck-custom-title {
        font-size:9px; font-weight:800; letter-spacing:.12em; text-transform:uppercase;
        color:var(--gold); margin-bottom:5px; display:flex; align-items:center; gap:4px;
    }

    /* ════════════════════════════════════
       DELIVERY BOX
    ════════════════════════════════════ */
    .ck-deliv-box { background:var(--surf); border:1px solid var(--border); padding:16px; margin-bottom:14px; }
    .ck-deliv-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
    .ck-change-btn {
        font-size:11px; font-weight:700; color:var(--gold); background:none; border:none;
        cursor:pointer; font-family:'DM Sans',sans-serif; text-transform:uppercase; letter-spacing:.06em;
    }
    .ck-eyebrow { font-size:9px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--faint); }
    .ck-eta-badge {
        display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:700;
        padding:3px 9px; background:var(--green-bg); color:var(--green); margin-top:8px;
    }

    /* ════════════════════════════════════
       PAYMENT OPTIONS
    ════════════════════════════════════ */
    .ck-pay-opt {
        display:flex; align-items:center; gap:12px; padding:14px;
        border:1.5px solid var(--border); cursor:pointer; transition:all .2s;
        margin-bottom:10px; background:var(--surf); width:100%; text-align:left;
    }
    .ck-pay-opt.sel-online { border-color:var(--gold); background:var(--gold-bg); }
    .ck-pay-opt.sel-cod    { border-color:var(--green); background:var(--green-bg); }
    .ck-pay-opt.coming-soon{ opacity:.6; cursor:default; }
    .ck-pay-icon { width:38px; height:38px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
    .pi-online { background:var(--ink); color:#fff; }
    .pi-cod    { background:var(--green); color:#fff; }
    .pi-muted  { background:rgba(28,25,23,.06); color:var(--faint); }
    .pi-load   { background:rgba(28,25,23,.04); color:var(--faint); }
    .ck-pay-badge { font-size:8.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; padding:2px 6px; margin-left:4px; }
    .pb-free  { background:var(--green-bg); color:var(--green); }
    .pb-cod   { background:var(--green-bg); color:var(--green); }
    .pb-dist  { background:rgba(37,99,235,.1); color:var(--blue); }
    .ck-pay-check { margin-left:auto; font-size:18px; flex-shrink:0; }
    .pc-online { color:var(--gold); }
    .pc-cod    { color:var(--green); }
    .ck-coming-soon-tag {
        display:inline-flex; align-items:center; gap:4px; margin-left:auto;
        font-size:9px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
        padding:3px 8px; background:var(--orange-bg); color:var(--orange);
        border:1px solid rgba(217,119,6,.2);
    }

    /* ════════════════════════════════════
       INFO CHIPS
    ════════════════════════════════════ */
    .ck-chip { display:flex; align-items:flex-start; gap:7px; padding:9px 11px; margin-top:10px; font-size:11px; }
    .ck-chip-gold   { background:var(--gold-bg); border:1px solid rgba(200,169,110,.2); color:var(--gold-d); }
    .ck-chip-green  { background:var(--green-bg); border:1px solid rgba(5,150,105,.2); color:#047857; }
    .ck-chip-muted  { background:rgba(28,25,23,.03); border:1px solid var(--border); color:var(--muted); }
    .ck-chip-orange { background:var(--orange-bg); border:1px solid rgba(217,119,6,.2); color:var(--orange); }

    /* ════════════════════════════════════
       PRICE SIDEBAR (desktop)
    ════════════════════════════════════ */
    .ck-price-box { background:var(--surf); border:1px solid var(--border); overflow:hidden; margin-bottom:12px; }
    .ck-price-header {
        padding:12px 18px; border-bottom:1px solid var(--border); background:var(--navy);
        display:flex; align-items:center; justify-content:space-between;
    }
    .ck-price-title { font-family:'Cormorant Garamond',serif; font-size:1.05rem; font-weight:600; color:#fff; }
    .ck-price-count { font-size:11px; color:rgba(255,255,255,.5); }
    .ck-price-body  { padding:16px 18px; }
    .ck-price-row   { display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--muted); margin-bottom:10px; }
    .ck-price-row-label { display:flex; align-items:center; gap:5px; }
    .ck-price-sub   { font-size:10px; color:var(--faint); margin-left:3px; }
    .ck-price-val   { font-weight:600; color:var(--ink); }
    .ck-free        { font-weight:700; color:var(--green); }
    .ck-price-divider { height:1px; background:var(--border); margin:10px 0; }
    .ck-price-total-row { display:flex; justify-content:space-between; align-items:baseline; }
    .ck-price-total-lbl { font-weight:700; font-size:14px; color:var(--ink); }
    .ck-price-total-val { font-family:'Cormorant Garamond',serif; font-size:1.6rem; font-weight:700; color:var(--ink); }
    .ck-price-skel  {
        height:14px; border-radius:3px; margin-bottom:10px;
        background:linear-gradient(90deg,#f0ede8 25%,#e8e4de 50%,#f0ede8 75%);
        background-size:200% 100%; animation:ck-shim 1.4s ease-in-out infinite;
    }

    /* Trust sidebar */
    .ck-trust { background:var(--surf); border:1px solid var(--border); padding:14px 16px; display:flex; flex-direction:column; gap:10px; }
    .ck-trust-item { display:flex; align-items:center; gap:10px; font-size:12px; color:var(--muted); }

    /* Skeleton */
    .ck-skel { background:rgba(28,25,23,.06); animation:ck-pulse 1.5s ease-in-out infinite; height:60px; margin-bottom:10px; }

    .spin { animation:ck-spin .7s linear infinite; display:inline-block; }
    .ck-no-pay { text-align:center; font-size:12px; color:var(--faint); padding:12px 0; letter-spacing:.04em; }

    /* ════════════════════════════════════
       ✅ MOBILE FIXED BOTTOM CTA
       z-index 200 — above everything
    ════════════════════════════════════ */
    .ck-mob-cta {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        z-index: 200;
        padding: 10px 16px calc(14px + env(safe-area-inset-bottom, 0px));
        background: #fff;
        border-top: 1px solid var(--border);
        box-shadow: 0 -4px 24px rgba(0,0,0,.12);
    }
    @media(min-width:768px){ .ck-mob-cta{ display:none; } }

    /* Desktop CTA */
    .ck-desk-cta { display:none; }
    @media(min-width:768px){ .ck-desk-cta{ display:block; } }
    `;

    // Guard: prevent empty-cart checkout
    if (!checkoutItems || checkoutItems.length === 0) {
        return (
            <>
                <style>{css}</style>
                <div className="ck-page" style={{ alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center", padding: 32 }}>
                    <FaShoppingCart size={40} style={{ color: "#a8a29e" }} />
                    <h2 style={{ fontFamily: "'DM Sans', sans-serif", color: "#1c1917" }}>Your cart is empty</h2>
                    <p style={{ color: "#78716c", fontSize: 14 }}>Add items to your cart before checking out</p>
                    <button onClick={() => navigate("/")} style={{ marginTop: 12, padding: "10px 28px", background: "#c8a96e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Continue Shopping</button>
                </div>
            </>
        );
    }

    return (
        <>
            <SEO title="Checkout" noindex />
            <style>{css}</style>

            <div className="ck-page">

                {/* ✅ Own minimal header — no global navbar conflict */}
                <header className="ck-header">
                    <Link to="/" className="ck-header-logo">
                        URBE<span>XON</span>
                    </Link>
                    <div className="ck-header-secure">
                        <FaShieldAlt size={11} /> Secure Checkout
                    </div>
                </header>

                {/* Mobile price bar */}
                <div className="ck-mob-bar" onClick={() => setMobileSummaryOpen(o => !o)}>
                    <div className="ck-mob-bar-left">
                        <FaShieldAlt size={11} /> Order Total
                    </div>
                    <div className="ck-mob-bar-right">
                        <span className="ck-mob-bar-total">
                            {pricingLoading ? "…" : `₹${fmt(finalTotal)}`}
                        </span>
                        <span className="ck-mob-bar-toggle">
                            {mobileSummaryOpen ? <FaChevronUp size={9} /> : <FaChevronDown size={9} />} Details
                        </span>
                    </div>
                </div>

                {/* Mobile accordion */}
                <div className="ck-mob-accordion" style={{ maxHeight: mobileSummaryOpen ? "280px" : "0" }}>
                    <div className="ck-mob-acc-inner">
                        <div className="ck-mob-row">
                            <span>Items ({checkoutItems.length})</span>
                            <span className="ck-mob-row-val">₹{fmt(pricing?.itemsTotal)}</span>
                        </div>
                        <div className="ck-mob-row">
                            <span>Delivery {paymentMethod === "cod" ? "(COD)" : ""}</span>
                            <span className="ck-mob-row-val" style={{ color: pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "#4ade80" : "#fff" }}>
                                {pricing?.deliveryCharge === 0 && paymentMethod !== "cod" ? "FREE" : `₹${fmt(pricing?.deliveryCharge)}`}
                            </span>
                        </div>
                        <div className="ck-mob-hr" />
                        <div className="ck-mob-total">
                            <span className="ck-mob-total-lbl">Total</span>
                            <span className="ck-mob-total-val">₹{fmt(finalTotal)}</span>
                        </div>
                    </div>
                </div>

                {/* ── BODY ── */}
                <div className="ck-body">
                    <div className="ck-inner">

                        <button
                            onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
                            className="ck-back"
                        >
                            <span className="ck-back-circle"><FaArrowLeft size={11} /></span>
                            {step === 1 ? "Back to Cart" : `Back to ${STEPS[step - 2].label}`}
                        </button>

                        <div className="ck-layout">
                            <div className="ck-main">

                                {/* Step bar */}
                                <div className="ck-steps">
                                    {STEPS.map((s, i) => (
                                        <div key={s.id} className="ck-step-item">
                                            <div className={`ck-step-dot ${step > s.id ? "done" : step === s.id ? "active" : "pending"}`}>
                                                {step > s.id ? <FaCheckCircle size={12} /> : s.icon}
                                            </div>
                                            <span className={`ck-step-lbl ${step > s.id ? "done" : step === s.id ? "active" : "pending"}`}>
                                                {s.label}
                                            </span>
                                            {i < STEPS.length - 1 && (
                                                <div className={`ck-step-line ${step > s.id ? "done" : "pending"}`} />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* ══ STEP 1 — Contact ══ */}
                                {step === 1 && (
                                    <div className="ck-card">
                                        <h2 className="ck-card-title"><FaUser className="ck-card-icon" /> Contact Details</h2>
                                        <div className="ck-field">
                                            <label className="ck-lbl">Full Name *</label>
                                            <input value={contact.name}
                                                onChange={e => { setContact(c => ({ ...c, name: e.target.value })); setError(""); }}
                                                placeholder="Rahul Verma" className="ck-inp" />
                                        </div>
                                        <div className="ck-field">
                                            <label className="ck-lbl">Mobile Number *</label>
                                            <div className="ck-phone-wrap">
                                                <span className="ck-phone-pre">+91</span>
                                                <input value={contact.phone} maxLength={10}
                                                    onChange={e => { setContact(c => ({ ...c, phone: e.target.value })); setError(""); }}
                                                    placeholder="10-digit number" className="ck-inp ck-phone-inp" />
                                            </div>
                                        </div>
                                        <div className="ck-field">
                                            <label className="ck-lbl">Email <span className="ck-opt">for order confirmation</span></label>
                                            <input type="email" value={contact.email}
                                                onChange={e => setContact(c => ({ ...c, email: e.target.value }))}
                                                placeholder="example@email.com" className="ck-inp" />
                                        </div>
                                        {error && <div className="ck-err"><span>⚠</span> {error}</div>}
                                        <div className="ck-desk-cta">
                                            <button onClick={handleContactContinue} className="ck-btn ck-btn-dark">
                                                Continue to Address →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ══ STEP 2 — Address ══ */}
                                {step === 2 && (
                                    <div className="ck-card">
                                        <h2 className="ck-card-title"><FaMapMarkerAlt className="ck-card-icon" /> Delivery Address</h2>
                                        {addrLoading ? (
                                            <><div className="ck-skel" /><div className="ck-skel" /></>
                                        ) : (
                                            <>
                                                {addresses.map(addr => (
                                                    <div key={addr._id}
                                                        onClick={() => { if (!editingAddr && !showAddForm) setSelectedAddrId(addr._id); }}
                                                        className={`ck-addr${selectedAddrId === addr._id ? " sel" : ""}`}>
                                                        {selectedAddrId === addr._id && (
                                                            <div className="ck-addr-sel-dot"><FaCheckCircle size={11} /></div>
                                                        )}
                                                        {editingAddr?._id === addr._id ? (
                                                            <AddressForm initial={editingAddr} onSave={handleEditAddress} onCancel={() => setEditingAddr(null)} saving={savingAddr} />
                                                        ) : (
                                                            <>
                                                                <div className={`ck-addr-lchip lc-${addr.label}`}>
                                                                    {LABEL_ICONS[addr.label] || <FaMapMarkerAlt size={9} />}
                                                                    {addr.label}
                                                                    {addr.isDefault && <span className="ck-addr-def-badge">Default</span>}
                                                                </div>
                                                                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)", marginBottom: 3 }}>
                                                                    {addr.name} · <span style={{ fontWeight: 500 }}>{addr.phone}</span>
                                                                </p>
                                                                <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                                                                    {addr.house}, {addr.area},{addr.landmark ? ` ${addr.landmark},` : ""} {addr.city}, {addr.state} — {addr.pincode}
                                                                </p>
                                                                <div className="ck-addr-acts">
                                                                    <button onClick={e => { e.stopPropagation(); setEditingAddr(addr); setShowAddForm(false); }} className="ck-addr-act aa-edit">
                                                                        <FaEdit size={9} /> Edit
                                                                    </button>
                                                                    {!addr.isDefault && (
                                                                        <button onClick={e => { e.stopPropagation(); handleSetDefault(addr._id); }} className="ck-addr-act aa-def">
                                                                            <FaBookmark size={9} /> Set Default
                                                                        </button>
                                                                    )}
                                                                    {deleteConfirmId === addr._id ? (
                                                                        <div className="ck-addr-del-confirm" onClick={e => e.stopPropagation()}>
                                                                            <span style={{ fontSize: 11, color: "var(--red)", fontWeight: 700 }}>Delete?</span>
                                                                            <button onClick={() => handleDeleteAddress(addr._id)} className="ck-del-yes">Yes</button>
                                                                            <button onClick={() => setDeleteConfirmId(null)} className="ck-del-no">No</button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(addr._id); }} className="ck-addr-act aa-del">
                                                                            <FaTrash size={9} /> Delete
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}

                                                {addresses.length < 5 && (
                                                    showAddForm ? (
                                                        <div className="ck-add-form-wrap">
                                                            <p className="ck-add-form-title"><FaPlus size={9} /> New Address</p>
                                                            <AddressForm onSave={handleAddAddress} onCancel={() => setShowAddForm(false)} saving={savingAddr} />
                                                        </div>
                                                    ) : (
                                                        <button onClick={() => { setShowAddForm(true); setEditingAddr(null); }} className="ck-add-btn">
                                                            <FaPlus size={12} /> Add New Address
                                                            <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 400 }}>({addresses.length}/5)</span>
                                                        </button>
                                                    )
                                                )}

                                                {error && <div className="ck-err"><span>⚠</span> {error}</div>}
                                                <div className="ck-desk-cta">
                                                    <button onClick={handleAddressContinue} className="ck-btn ck-btn-dark" style={{ marginTop: 12 }}>
                                                        Continue to Payment →
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* ══ STEP 3 — Payment ══ */}
                                {step === 3 && (
                                    <>
                                        {/* Order Summary */}
                                        <div className="ck-card">
                                            <h2 className="ck-card-title"><FaClipboardList className="ck-card-icon" /> Order Summary</h2>
                                            {checkoutItems.map((item, idx) => (
                                                <div key={item.cartKey || item._id || idx} className="ck-order-item">
                                                    <img src={item.images?.[0]?.url || item.image || ""} alt={item.name} className="ck-order-img" />
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <p style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                                                        <p style={{ fontSize: 11, color: "var(--faint)", marginBottom: 4 }}>
                                                            Qty: {Number(item.quantity) || 1}
                                                            {item.selectedSize && <span style={{ marginLeft: 8, background: "var(--gold-bg)", color: "var(--gold-d)", padding: "1px 6px", fontSize: 10, fontWeight: 700 }}>{item.selectedSize}</span>}
                                                        </p>
                                                        <p style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 600, fontSize: "1.05rem", color: "var(--ink)" }}>
                                                            ₹{fmt(Number(item.price) * (Number(item.quantity) || 1))}
                                                            {(Number(item.quantity) || 1) > 1 && <span style={{ fontSize: 11, color: "var(--faint)", fontWeight: 400, marginLeft: 6 }}>(₹{fmt(item.price)} × {Number(item.quantity) || 1})</span>}
                                                        </p>
                                                        {(item.customization?.text || item.customization?.imageUrl || item.customization?.note) && (
                                                            <div className="ck-custom-badge">
                                                                <p className="ck-custom-title"><FaPencilAlt size={8} /> Customization</p>
                                                                {item.customization.text && <p style={{ fontSize: 12, color: "var(--ink)", marginBottom: 4 }}>{item.customization.text}</p>}
                                                                {item.customization.imageUrl && (
                                                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                                        <FaImage size={9} style={{ color: "var(--gold)" }} />
                                                                        <img src={item.customization.imageUrl} alt="custom" style={{ height: 40, width: 40, objectFit: "cover", border: "1px solid rgba(200,169,110,.3)" }} />
                                                                        <span style={{ fontSize: 11, color: "var(--gold-d)" }}>Image uploaded</span>
                                                                    </div>
                                                                )}
                                                                {item.customization.note && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{item.customization.note}</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Delivering To */}
                                        {selectedAddress && (
                                            <div className="ck-deliv-box">
                                                <div className="ck-deliv-hdr">
                                                    <span className="ck-eyebrow">Delivering To</span>
                                                    <button onClick={() => setStep(2)} className="ck-change-btn">Change</button>
                                                </div>
                                                <p style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{selectedAddress.name}</p>
                                                <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>{selectedAddress.phone}</p>
                                                <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
                                                    {selectedAddress.house}, {selectedAddress.area},{selectedAddress.landmark ? ` ${selectedAddress.landmark},` : ""} {selectedAddress.city}, {selectedAddress.state} — {selectedAddress.pincode}
                                                </p>
                                                {deliveryETA && (
                                                    <div className="ck-eta-badge">
                                                        <FaTruck size={9} /> Delivery: {deliveryETA}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Delivery Mode (E-commerce only) */}
                                        <div className="ck-card">
                                            <h2 className="ck-card-title"><FaTruck className="ck-card-icon" /> Delivery Mode</h2>
                                            <div style={{ display: "grid", gap: 10 }}>
                                                <button
                                                    onClick={() => setDeliveryType("ECOMMERCE_STANDARD")}
                                                    className={`ck-pay-opt${deliveryType === "ECOMMERCE_STANDARD" ? " sel-online" : ""}`}>
                                                    <div className="ck-pay-icon pi-online"><FaTruck size={13} /></div>
                                                    <div style={{ flex: 1, textAlign: "left" }}>
                                                        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>E-commerce Standard</p>
                                                        <p style={{ fontSize: 12, color: "var(--faint)" }}>3–5 business days · Shiprocket managed</p>
                                                    </div>
                                                    {deliveryType === "ECOMMERCE_STANDARD" && <FaCheckCircle className="ck-pay-check pc-online" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Payment */}
                                        <div className="ck-card">
                                            <h2 className="ck-card-title"><FaCreditCard className="ck-card-icon" /> Choose Payment</h2>

                                            {/* Online */}
                                            <button
                                                onClick={() => selectPaymentMethod("online")}
                                                className={`ck-pay-opt${paymentMethod === "online" ? " sel-online" : ""}`}>
                                                <div className="ck-pay-icon pi-online"><FaLock size={14} /></div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                                                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Pay Online</span>
                                                        {pricing?.deliveryCharge === 0 && paymentMethod === "online" && (
                                                            <span className="ck-pay-badge pb-free">🚚 Free Delivery</span>
                                                        )}
                                                    </div>
                                                    <p style={{ fontSize: 12, color: "var(--faint)" }}>UPI · Cards · Net Banking · EMI</p>
                                                </div>
                                                {paymentMethod === "online" && <FaCheckCircle className="ck-pay-check pc-online" />}
                                            </button>

                                            {/* COD (pincode-based, no distance) */}
                                            {codChecking ? (
                                                <div className="ck-pay-opt">
                                                    <div className="ck-pay-icon pi-load"><FaSpinner size={13} className="spin" /></div>
                                                    <p style={{ fontSize: 13, color: "var(--faint)" }}>Checking delivery options…</p>
                                                </div>
                                            ) : codAvailable ? (
                                                <button
                                                    onClick={() => selectPaymentMethod("cod")}
                                                    className={`ck-pay-opt${paymentMethod === "cod" ? " sel-cod" : ""}`}>
                                                    <div className="ck-pay-icon pi-cod"><FaMoneyBillWave size={14} /></div>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                                                            <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>Cash on Delivery</span>
                                                            <span className="ck-pay-badge pb-cod">COD</span>
                                                        </div>
                                                        <p style={{ fontSize: 12, color: "var(--faint)" }}>
                                                            Pay on arrival · +₹{fmt(pricing?.deliveryCharge || 70)} delivery
                                                        </p>
                                                    </div>
                                                    {paymentMethod === "cod" && <FaCheckCircle className="ck-pay-check pc-cod" />}
                                                </button>
                                            ) : (
                                                <div className="ck-pay-opt coming-soon">
                                                    <div className="ck-pay-icon pi-muted"><FaMoneyBillWave size={14} /></div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontWeight: 700, fontSize: 14, color: "var(--faint)", marginBottom: 3 }}>Cash on Delivery</p>
                                                        <p style={{ fontSize: 12, color: "var(--faint)" }}>Not available for your pincode</p>
                                                    </div>
                                                    <div className="ck-coming-soon-tag">
                                                        <FaStar size={8} /> Coming Soon
                                                    </div>
                                                </div>
                                            )}

                                            {/* Coming soon info */}
                                            {codStatus === "coming_soon" && (
                                                <div className="ck-chip ck-chip-orange">
                                                    <FaStar size={10} />
                                                    <span>COD is not yet available for your pincode. Use online payment for faster checkout!</span>
                                                </div>
                                            )}

                                            {error && (
                                                <div className="ck-err" style={{ marginTop: 12, marginBottom: 0 }}>
                                                    <span>⚠</span> <span>{error}</span>
                                                </div>
                                            )}

                                            {!paymentMethod && (
                                                <p className="ck-no-pay">Select a payment method above to continue</p>
                                            )}

                                            {/* Desktop CTA */}
                                            <div className="ck-desk-cta">
                                                {paymentMethod === "cod" && (
                                                    <button onClick={handleCOD} disabled={loading} className="ck-btn ck-btn-green">
                                                        {loading
                                                            ? <><FaSpinner size={13} className="spin" /> Placing Order…</>
                                                            : <><FaMoneyBillWave size={13} /> Place Order (COD) — ₹{fmt(finalTotal)}</>}
                                                    </button>
                                                )}
                                                {paymentMethod === "online" && (
                                                    <button onClick={handlePayOnline} disabled={loading}
                                                        className={`ck-btn ${payState === "failed" ? "ck-btn-red" : "ck-btn-dark"}`}>
                                                        {loading
                                                            ? <><FaSpinner size={13} className="spin" /> Processing…</>
                                                            : payState === "failed"
                                                                ? <><FaRedo size={12} /> Retry — ₹{fmt(finalTotal)}</>
                                                                : <><FaLock size={12} /> Pay ₹{fmt(finalTotal)} Securely</>}
                                                    </button>
                                                )}
                                            </div>

                                            <p style={{ textAlign: "center", fontSize: 11, color: "var(--faint)", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                                <FaShieldAlt size={9} /> Your order is 100% secure & encrypted
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Desktop Sidebar */}
                            <div className="ck-side">
                                <PriceSummary
                                    pricing={pricing}
                                    paymentMethod={paymentMethod}
                                    checkoutItems={checkoutItems}
                                    pricingLoading={pricingLoading}
                                />
                                <div className="ck-trust">
                                    <div className="ck-trust-item">
                                        <FaShieldAlt size={12} style={{ color: "var(--gold)", flexShrink: 0 }} /> Safe & Secure Payment
                                    </div>
                                    <div className="ck-trust-item">
                                        <FaTruck size={12} style={{ color: "var(--gold)", flexShrink: 0 }} /> Delivery across India
                                    </div>
                                    <div className="ck-trust-item">
                                        <FaMoneyBillWave size={12} style={{ color: "var(--green)", flexShrink: 0 }} /> Cash on Delivery (COD)
                                    </div>
                                    <div className="ck-trust-item">
                                        <FaStar size={12} style={{ color: "var(--orange)", flexShrink: 0 }} /> COD expanding soon
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ✅ Mobile Fixed CTA — z-index 200, always above footer */}
                <div className="ck-mob-cta">
                    {step === 1 && (
                        <button onClick={handleContactContinue} className="ck-btn ck-btn-dark" style={{ margin: 0 }}>
                            Continue to Address →
                        </button>
                    )}
                    {step === 2 && (
                        <button onClick={handleAddressContinue} className="ck-btn ck-btn-dark" style={{ margin: 0 }}>
                            Continue to Payment →
                        </button>
                    )}
                    {step === 3 && paymentMethod === "cod" && (
                        <button onClick={handleCOD} disabled={loading} className="ck-btn ck-btn-green" style={{ margin: 0 }}>
                            {loading
                                ? <><FaSpinner size={13} className="spin" /> Placing Order…</>
                                : <><FaMoneyBillWave size={13} /> Place Order (COD) — ₹{fmt(finalTotal)}</>}
                        </button>
                    )}
                    {step === 3 && paymentMethod === "online" && (
                        <button onClick={handlePayOnline} disabled={loading}
                            className={`ck-btn ${payState === "failed" ? "ck-btn-red" : "ck-btn-dark"}`} style={{ margin: 0 }}>
                            {loading
                                ? <><FaSpinner size={13} className="spin" /> Processing…</>
                                : payState === "failed"
                                    ? <><FaRedo size={12} /> Retry — ₹{fmt(finalTotal)}</>
                                    : <><FaLock size={12} /> Pay ₹{fmt(finalTotal)} Securely</>}
                        </button>
                    )}
                    {step === 3 && !paymentMethod && (
                        <button disabled className="ck-btn ck-btn-dark" style={{ margin: 0, opacity: .35 }}>
                            Select Payment Method Above
                        </button>
                    )}
                </div>

            </div>
        </>
    );
};

export default Checkout;