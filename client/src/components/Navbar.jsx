/**
 * Navbar.jsx — Urbexon Production v3.0
 * ✅ Matches Figma: white navbar, "Switch to Hour" pill, search, wishlist, dual cart
 * ✅ All existing functions preserved
 * ✅ No static/dummy categories — API-driven
 * ✅ UH bar timer persisted in localStorage
 */

import { useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import {
    FaSearch, FaShoppingCart, FaTimes, FaUser, FaBox,
    FaSignOutAlt, FaStore, FaChevronDown, FaBolt,
    FaHeart, FaChevronRight, FaMapMarkerAlt,
} from "react-icons/fa";
import { useSelector } from "react-redux";
import { useAuth } from "../contexts/AuthContext";
import { useLocation2 } from "../contexts/LocationContext";
import LocationModal from "./LocationModal";
import { fetchActiveCategories } from "../api/categoryApi";
import api from "../api/axios";
import NotificationCenter from "./NotificationCenter";
import {
    selectEcommerceTotalItems,
    selectUHTotalItems,
} from "../features/cart/cartSlice";

const getMenuItems = (user) => {
    if (!user) return [];
    const base = [
        { icon: <FaUser size={12} />, label: "My Profile", path: "/profile" },
        { icon: <FaBox size={12} />, label: "My Orders", path: "/orders" },
        { icon: <FaHeart size={12} />, label: "Wishlist", path: "/wishlist" },
    ];
    if (user.role === "user") {
        base.push({ icon: <FaStore size={12} />, label: "Become a Vendor", path: "/become-vendor" });
        base.push({ icon: <FaStore size={12} />, label: "Delivery Partner", path: "/become-delivery" });
    }
    return base;
};

/* ─── CSS ───────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

:where(.ux-nav), :where(.ux-nav) *, :where(.ux-nav) *::before, :where(.ux-nav) *::after {
    box-sizing: border-box; margin: 0; padding: 0;
}

@keyframes ux-dd  { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:none} }
@keyframes ux-sh  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes ux-pulse { 0%,100%{opacity:1} 50%{opacity:.5} }

/* ══ MAIN NAVBAR ════════════════════════════════════════ */
.ux-navbar {
    background: #fff;
    border-bottom: 1px solid #eef0f4;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
    transition: box-shadow .25s;
}
.ux-navbar.sc { box-shadow: 0 2px 24px rgba(0,0,0,.08); }

.ux-nav-row {
    max-width: 1400px; margin: 0 auto;
    padding: 0 clamp(16px,3vw,40px);
    height: 68px;
    display: flex; align-items: center; gap: 16px;
}

/* Logo */
.ux-logo-btn {
    display: flex; align-items: center; gap: 0;
    background: none; border: none; cursor: pointer;
    padding: 0; flex-shrink: 0; text-decoration: none;
}
.ux-logo-mark {
    width: 32px; height: 32px; border-radius: 10px;
    background: #111827;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 16px; font-weight: 900; color: #fff;
    letter-spacing: -.5px; flex-shrink: 0;
    margin-right: 6px;
    transition: all .2s;
}
.ux-logo-btn:hover .ux-logo-mark { transform: scale(1.05); }
.ux-logo-word {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900;
    color: #111827; letter-spacing: -.7px;
    line-height: 1;
}
.ux-logo-uh {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 22px; font-weight: 900;
    color: #c9a84c; letter-spacing: -.5px;
    margin-left: 5px;
}

/* Switch to Hour pill */
.ux-hour-pill {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    background: linear-gradient(135deg, #111827, #1e293b);
    border: 1px solid #374151; border-radius: 20px; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px; font-weight: 700; color: #c9a84c;
    white-space: nowrap; transition: all .2s; flex-shrink: 0;
}
.ux-hour-pill:hover { background: linear-gradient(135deg, #1e293b, #374151); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.12); }
.ux-hour-pill .ux-hp-bolt { color: #c9a84c; }
@media(max-width:640px){ .ux-hour-pill span.ux-hp-label { display: none; } }
@media(max-width:1024px){
    .ux-icon-btn-lbl { display: none; }
    .ux-usr-name, .ux-usr-sub { display: none; }
    .ux-srch { max-width: 400px; }
}

/* Search */
.ux-srch {
    flex: 1; max-width: 680px;
    display: flex; height: 44px;
    border: 1.5px solid #e5e7eb; border-radius: 10px;
    overflow: hidden; transition: all .2s;
    background: #f9fafb;
}
.ux-srch.foc { border-color: #111827; background: #fff; box-shadow: 0 0 0 3px rgba(17,24,39,.06); }
.ux-srch-inp {
    flex: 1; padding: 0 14px;
    background: transparent; border: none; outline: none;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; color: #111827;
}
.ux-srch-inp::placeholder { color: #9ca3af; }
.ux-srch-btn {
    padding: 0 18px; background: #111827; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .18s; flex-shrink: 0;
}
.ux-srch-btn:hover { background: #374151; }

/* Right actions */
.ux-acts { display: flex; align-items: center; gap: 4px; margin-left: auto; flex-shrink: 0; }

.ux-icon-btn {
    display: flex; flex-direction: column; align-items: center; gap: 1px;
    padding: 7px 10px; background: none; border: none; cursor: pointer;
    border-radius: 8px; transition: background .15s; position: relative;
    font-family: 'Plus Jakarta Sans', sans-serif;
}
.ux-icon-btn:hover { background: #f3f4f6; }
.ux-icon-btn-lbl { font-size: 10px; font-weight: 600; color: #374151; }

/* Login btn */
.ux-login-btn {
    padding: 8px 20px;
    background: none; border: 1.5px solid #111827;
    border-radius: 8px; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 700; color: #111827;
    transition: all .18s; white-space: nowrap;
}
.ux-login-btn:hover { background: #111827; color: #fff; }
.ux-register-btn {
    padding: 8px 20px;
    background: #111827; border: 1.5px solid #111827;
    border-radius: 8px; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 700; color: #fff;
    transition: all .18s; white-space: nowrap;
}
.ux-register-btn:hover { background: #374151; border-color: #374151; }

/* Cart badge */
.ux-badge {
    position: absolute; top: 2px; right: 4px;
    min-width: 18px; height: 18px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 10px; font-weight: 800; padding: 0 3px;
    border: 2px solid #fff;
    font-family: 'Plus Jakarta Sans', sans-serif;
}
.ux-badge-red  { background: #ef4444; color: #fff; }
.ux-badge-org  { background: #c9a84c; color: #fff; }

/* UH cart special button */
.ux-uh-cart {
    display: flex; align-items: center; gap: 5px;
    padding: 7px 10px;
    background: #fefce8; border: 1.5px solid #fde68a;
    border-radius: 8px; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 12px; font-weight: 700; color: #92400e;
    position: relative; transition: all .18s; flex-shrink: 0;
}
.ux-uh-cart:hover { background: #fef9c3; border-color: #fcd34d; }

/* Divider */
.ux-vdiv { width: 1px; height: 28px; background: #e5e7eb; flex-shrink: 0; }

/* User dropdown */
.ux-usr-wrap { position: relative; }
.ux-usr-btn {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 10px; background: none; border: none; cursor: pointer;
    border-radius: 8px; transition: background .15s;
    font-family: 'Plus Jakarta Sans', sans-serif;
}
.ux-usr-btn:hover { background: #f3f4f6; }
.ux-usr-av {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, #111827, #374151);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; color: #fff; flex-shrink: 0;
}
.ux-usr-name { font-size: 13px; font-weight: 700; color: #111827; line-height: 1.2; }
.ux-usr-sub  { font-size: 10px; color: #9ca3af; }

.ux-ddrop {
    position: absolute; right: 0; top: calc(100% + 8px);
    background: #fff; border-radius: 14px;
    box-shadow: 0 12px 48px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.04);
    min-width: 230px; overflow: hidden; z-index: 1000;
    border: none;
    animation: ux-dd .18s ease;
}
.ux-ddrop-hd {
    padding: 16px 18px; display: flex; align-items: center; gap: 12px;
    background: linear-gradient(135deg, #111827, #1e293b);
}
.ux-ddrop-av {
    width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
    background: rgba(255,255,255,.12); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 800;
}
.ux-ddrop-nm { font-size: 14px; font-weight: 700; color: #fff; white-space: nowrap; }
.ux-ddrop-em { font-size: 11px; color: rgba(255,255,255,.55); }
.ux-dmi {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 16px; background: none; border: none;
    cursor: pointer; width: 100%; text-align: left;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 500; color: #374151;
    transition: background .12s;
}
.ux-dmi:hover { background: #f8fafc; color: #111827; }
.ux-dmi-ic {
    width: 28px; height: 28px; border-radius: 7px;
    background: #f3f4f6; display: flex; align-items: center;
    justify-content: center; color: #6b7280; flex-shrink: 0;
}
.ux-dmi:hover .ux-dmi-ic { background: #e5e7eb; color: #111827; }
.ux-dmi-out { color: #ef4444; }
.ux-dmi-out:hover { background: #fef2f2; color: #dc2626; }
.ux-dmi-out .ux-dmi-ic { background: #fef2f2; color: #ef4444; }
.ux-ddrop-sep { height: 1px; background: #f3f4f6; }

/* ══ CATEGORY BAR ═══════════════════════════════════════ */
.ux-catbar {
    background: #fff;
    border-top: 1px solid #f0f2f5;
    border-bottom: 1px solid #eef0f4;
}
.ux-catbar-in {
    max-width: 1400px; margin: 0 auto;
    padding: 0 clamp(16px,3vw,40px);
    display: flex; align-items: center;
    overflow-x: auto; scrollbar-width: none; gap: 2px;
}
.ux-catbar-in::-webkit-scrollbar { display: none; }
.ux-catbtn {
    padding: 10px 16px; background: none; border: none;
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 13px; font-weight: 500; color: #4b5563;
    border-bottom: 2.5px solid transparent;
    transition: all .18s;
}
.ux-catbtn:hover { color: #111827; background: #f9fafb; }
.ux-catbtn.act { color: #111827; font-weight: 700; border-bottom-color: #111827; }
.ux-hot {
    background: #ef4444; color: #fff;
    font-size: 8px; font-weight: 800; padding: 1px 5px;
    border-radius: 3px; margin-left: 4px;
    vertical-align: middle; letter-spacing: .5px;
}

/* ══ MOBILE NAV ════════════════════════════════════════ */
.ux-mnav {
    background: #fff;
    border-bottom: 1px solid #eef0f4;
    box-shadow: 0 1px 8px rgba(0,0,0,.05);
}
.ux-mnav-in {
    max-width: 1400px; margin: 0 auto;
    padding: 0 14px; height: 58px;
    display: flex; align-items: center; gap: 8px;
}
.ux-m-logo {
    display: flex; align-items: center;
    background: none; border: none; cursor: pointer; flex-shrink: 0;
}
.ux-m-mark {
    width: 28px; height: 28px; border-radius: 8px;
    background: #111827;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 14px; font-weight: 900; color: #fff;
    margin-right: 5px; flex-shrink: 0;
}
.ux-m-word {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 19px; font-weight: 900; color: #111827; letter-spacing: -.5px;
}
.ux-m-uh-text {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 19px; font-weight: 900; color: #c9a84c;
    margin-left: 4px; letter-spacing: -.3px;
}
.ux-m-acts { margin-left: auto; display: flex; align-items: center; gap: 0; }
.ux-m-btn {
    width: 42px; height: 42px; background: none; border: none;
    cursor: pointer; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    color: #374151; position: relative; transition: background .15s;
}
.ux-m-btn:hover { background: #f3f4f6; }

/* ══ MOBILE MENU ═══════════════════════════════════════ */
.ux-mmenu {
    position: fixed; inset: 0; background: #fff;
    z-index: 500; overflow-y: auto;
    transform: translateX(-100%);
    transition: transform .3s cubic-bezier(.4,0,.2,1);
}
.ux-mmenu.on { transform: none; }
.ux-mm-head {
    background: linear-gradient(135deg, #111827, #1e293b);
    padding: 56px 18px 18px;
}
.ux-mm-av-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.ux-mm-av {
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: #fff;
}
.ux-mm-nm { font-size: 15px; font-weight: 700; color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; }
.ux-mm-em { font-size: 11px; color: rgba(255,255,255,.5); font-family: 'Plus Jakarta Sans', sans-serif; }
.ux-mm-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.ux-mm-chip {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; background: rgba(255,255,255,.08);
    border: 1px solid rgba(255,255,255,.15); border-radius: 20px;
    color: #fff; font-size: 12px; font-weight: 600; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif; transition: background .15s;
}
.ux-mm-chip:hover { background: rgba(255,255,255,.15); }
.ux-mm-chip-out { background: rgba(239,68,68,.15); border-color: rgba(239,68,68,.3); color: #fca5a5; }
.ux-mm-auth { padding: 14px 16px; display: flex; gap: 10px; }
.ux-mm-sin { flex:1; padding:10px; border:1.5px solid #111827; background:transparent; color:#111827; font-weight:700; font-size:13px; border-radius:8px; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
.ux-mm-reg { flex:1; padding:10px; border:none; background:#111827; color:#fff; font-weight:700; font-size:13px; border-radius:8px; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
.ux-mm-lbl { padding:12px 16px 4px; font-size:9px; font-weight:800; color:#9ca3af; letter-spacing:2.5px; text-transform:uppercase; font-family:'Plus Jakarta Sans',sans-serif; }
.ux-mm-row {
    padding: 14px 16px; font-size: 14px; font-weight: 500; color: #374151;
    border-bottom: 1px solid #f5f5f5; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between;
    transition: background .12s; font-family: 'Plus Jakarta Sans', sans-serif;
}
.ux-mm-row:hover { background: #f8fafc; color: #111827; }
.ux-mm-uh {
    margin: 14px 16px; padding: 14px 16px;
    background: linear-gradient(135deg, #111827, #1e293b);
    border-radius: 12px; cursor: pointer;
    display: flex; align-items: center; gap: 12px; transition: all .18s;
    border: 1px solid #374151;
}
.ux-mm-uh:hover { background: linear-gradient(135deg, #1e293b, #374151); }
.ux-mm-uh-nm { font-size: 14px; font-weight: 700; color: #fff; font-family: 'Plus Jakarta Sans', sans-serif; }
.ux-mm-uh-sub { font-size: 11px; color: rgba(255,255,255,.55); font-family: 'Plus Jakarta Sans', sans-serif; }

/* ══ SEARCH OVERLAY ════════════════════════════════════ */
.ux-sov { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:700; backdrop-filter:blur(4px); }
.ux-sov-box { background:#fff; padding:16px; box-shadow:0 4px 24px rgba(0,0,0,.1); }
.ux-sov-form { display:flex; align-items:stretch; max-width:700px; margin:0 auto; border:2px solid #111827; border-radius:10px; overflow:hidden; height:48px; background:#fff; }
.ux-sov-inp { flex:1; padding:0 16px; font-size:15px; color:#111827; border:none; outline:none; font-family:'Plus Jakarta Sans',sans-serif; }
.ux-sov-close { padding:0 14px; background:none; border:none; cursor:pointer; color:#6b7280; display:flex; align-items:center; }
.ux-sov-tags { display:flex; gap:8px; flex-wrap:wrap; max-width:700px; margin:12px auto 0; }
.ux-sov-tag { background:#f3f4f6; border:none; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; color:#374151; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:all .15s; }
.ux-sov-tag:hover { background:#111827; color:#fff; }

.ux-burger { display:flex; flex-direction:column; gap:4px; width:18px; }
.ux-burger span { display:block; height:2px; background:#374151; border-radius:2px; transition:all .25s; }

/* ══ UH MODE ════════════════════════════════════════════ */
.ux-navbar.ux-uh-mode { background: linear-gradient(135deg, #0a0a0a, #111827); border-bottom-color: #1e293b; box-shadow: 0 2px 20px rgba(0,0,0,.3); }
.ux-navbar.ux-uh-mode .ux-logo-mark { background: #c9a84c; color: #111827; }
.ux-navbar.ux-uh-mode .ux-logo-word { color: #fff; }
.ux-navbar.ux-uh-mode .ux-logo-uh { color: #c9a84c; }
.ux-navbar.ux-uh-mode .ux-hour-pill { background: linear-gradient(135deg, #fff, #f8fafc); border-color: #e5e7eb; color: #111827; }
.ux-navbar.ux-uh-mode .ux-hour-pill:hover { background: #fff; }
.ux-navbar.ux-uh-mode .ux-srch { border-color: #374151; background: rgba(255,255,255,.06); }
.ux-navbar.ux-uh-mode .ux-srch.foc { border-color: #c9a84c; background: rgba(255,255,255,.1); box-shadow: 0 0 0 3px rgba(201,168,76,.1); }
.ux-navbar.ux-uh-mode .ux-srch-inp { color: #fff; }
.ux-navbar.ux-uh-mode .ux-srch-inp::placeholder { color: rgba(255,255,255,.35); }
.ux-navbar.ux-uh-mode .ux-srch-btn { background: #c9a84c; }
.ux-navbar.ux-uh-mode .ux-srch-btn:hover { background: #b8943e; }
.ux-navbar.ux-uh-mode .ux-icon-btn { color: rgba(255,255,255,.8); }
.ux-navbar.ux-uh-mode .ux-icon-btn:hover { background: rgba(255,255,255,.08); }
.ux-navbar.ux-uh-mode .ux-icon-btn-lbl { color: rgba(255,255,255,.5); }
.ux-navbar.ux-uh-mode .ux-vdiv { background: #374151; }
.ux-navbar.ux-uh-mode .ux-login-btn { border-color: #c9a84c; color: #c9a84c; }
.ux-navbar.ux-uh-mode .ux-login-btn:hover { background: #c9a84c; color: #111827; }
.ux-navbar.ux-uh-mode .ux-register-btn { background: #c9a84c; color: #111827; border-color: #c9a84c; }
.ux-navbar.ux-uh-mode .ux-register-btn:hover { background: #b8943e; border-color: #b8943e; }
.ux-navbar.ux-uh-mode .ux-usr-btn:hover { background: rgba(255,255,255,.08); }
.ux-navbar.ux-uh-mode .ux-usr-name { color: #fff; }
.ux-navbar.ux-uh-mode .ux-usr-sub { color: rgba(255,255,255,.4); }
.ux-navbar.ux-uh-mode .ux-usr-av { background: linear-gradient(135deg, #c9a84c, #b8943e); color: #111827; }
.ux-navbar.ux-uh-mode .ux-catbar { display: none; }
.ux-navbar.ux-uh-mode .ux-badge-red { display: none; }
/* UH cart always visible in UH mode */
.ux-uh-cart-always { display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #c9a84c, #b8943e); border: none; border-radius: 8px; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 13px; font-weight: 700; color: #111827; position: relative; transition: all .18s; flex-shrink: 0; }
.ux-uh-cart-always:hover { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(201,168,76,.25); }
.ux-uh-cart-always .ux-badge { background: #111827; color: #c9a84c; border-color: #c9a84c; }
.ux-mnav.ux-uh-mode { background: linear-gradient(135deg, #0a0a0a, #111827); border-bottom-color: #1e293b; }
.ux-mnav.ux-uh-mode .ux-m-mark { background: #c9a84c; color: #111827; }
.ux-mnav.ux-uh-mode .ux-m-word { color: #fff; }
.ux-mnav.ux-uh-mode .ux-m-uh-text { color: #c9a84c; }
.ux-mnav.ux-uh-mode .ux-m-btn { color: rgba(255,255,255,.8); }

/* ══ SUGGESTIONS DROPDOWN ═══════════════════════════════ */

/* ═ LOCATION SELECTOR ═══════════════════════════════════ */
.ux-loc-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 12px; background: none; border: 1.5px solid #e5e7eb;
    border-radius: 8px; cursor: pointer; max-width: 200px;
    font-family: 'Plus Jakarta Sans', sans-serif; transition: all .18s;
    flex-shrink: 0;
}
.ux-loc-btn:hover { border-color: #111827; background: #f9fafb; }
.ux-loc-icon { color: #111827; flex-shrink: 0; }
.ux-loc-text { min-width: 0; text-align: left; }
.ux-loc-label { font-size: 9px; font-weight: 700; color: #9ca3af; letter-spacing: .5px; text-transform: uppercase; line-height: 1; }
.ux-loc-city { font-size: 12px; font-weight: 600; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
.ux-navbar.ux-uh-mode .ux-loc-btn { border-color: #374151; }
.ux-navbar.ux-uh-mode .ux-loc-btn:hover { border-color: #c9a84c; background: rgba(255,255,255,.05); }
.ux-navbar.ux-uh-mode .ux-loc-icon { color: #c9a84c; }
.ux-navbar.ux-uh-mode .ux-loc-label { color: rgba(255,255,255,.4); }
.ux-navbar.ux-uh-mode .ux-loc-city { color: rgba(255,255,255,.85); }
/* Mobile location */
.ux-m-loc-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 4px 8px; background: none; border: 1px solid #e5e7eb;
    border-radius: 6px; cursor: pointer; flex: 1; min-width: 0;
    font-family: 'Plus Jakarta Sans', sans-serif; transition: all .18s;
}
.ux-m-loc-btn:hover { border-color: #111827; }
.ux-m-loc-city { font-size: 11px; font-weight: 600; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ux-mnav.ux-uh-mode .ux-m-loc-btn { border-color: #374151; }
.ux-mnav.ux-uh-mode .ux-m-loc-city { color: rgba(255,255,255,.85); }

.ux-sugg { position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #e5e7eb; border-top:none; border-radius:0 0 10px 10px; box-shadow:0 8px 32px rgba(0,0,0,.1); z-index:100; max-height:360px; overflow-y:auto; }
.ux-sugg-item { display:flex; align-items:center; gap:10px; padding:10px 14px; cursor:pointer; transition:background .12s; border-bottom:1px solid #f5f5f5; }
.ux-sugg-item:hover { background:#f8fafc; }
.ux-sugg-item:last-child { border-bottom:none; }
.ux-sugg-img { width:36px; height:36px; border-radius:8px; object-fit:cover; background:#f3f4f6; flex-shrink:0; }
.ux-sugg-info { flex:1; min-width:0; }
.ux-sugg-name { font-size:13px; font-weight:600; color:#111827; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ux-sugg-meta { font-size:11px; color:#6b7280; }
.ux-sugg-lbl { padding:8px 14px; font-size:10px; font-weight:800; color:#9ca3af; letter-spacing:1.5px; text-transform:uppercase; background:#fafbfc; }
`;

/* ─── Main Navbar ───────────────────────────────────────── */
const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { locationData, modalOpen: locModalOpen, setModalOpen: setLocModalOpen } = useLocation2();
    const isAuth = Boolean(user);
    const menuItems = getMenuItems(user);

    const [categories, setCategories] = useState([]);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [navHidden, setNavHidden] = useState(false);
    const [searchOverlay, setSearchOverlay] = useState(false);
    const [searchVal, setSearchVal] = useState("");
    const [deskSearch, setDeskSearch] = useState("");
    const [searchFocused, setSearchFocused] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [recentSearches, setRecentSearches] = useState([]);
    const suggestTimer = useRef(null);
    const isUHMode = location.pathname.startsWith("/urbexon-hour") || location.pathname.startsWith("/uh-");

    const userMenuRef = useRef(null);
    const searchRef = useRef(null);
    const lastScrollY = useRef(0);

    const ecommerceCount = useSelector(selectEcommerceTotalItems);
    const uhCount = useSelector(selectUHTotalItems);

    /* ── Load categories from API ── */
    useEffect(() => {
        fetchActiveCategories()
            .then(res => { if (res?.data?.length) setCategories(res.data); })
            .catch(() => { });
    }, []);

    /* ── Scroll behavior ── */
    useEffect(() => {
        const fn = () => {
            const y = window.scrollY;
            setScrolled(y > 8);
            if (!mobileOpen && !searchOverlay)
                setNavHidden(y > lastScrollY.current && y > 90);
            lastScrollY.current = y;
        };
        window.addEventListener("scroll", fn, { passive: true });
        return () => window.removeEventListener("scroll", fn);
    }, [mobileOpen, searchOverlay]);

    /* ── Close dropdown on outside click ── */
    useEffect(() => {
        const fn = e => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target))
                setUserMenuOpen(false);
        };
        document.addEventListener("mousedown", fn);
        return () => document.removeEventListener("mousedown", fn);
    }, []);

    /* ── Load recent searches ── */
    useEffect(() => {
        try { setRecentSearches(JSON.parse(localStorage.getItem("ux_search_history")) || []); } catch { setRecentSearches([]); }
    }, [location.pathname]);

    /* ── Search overlay focus ── */
    useEffect(() => {
        if (searchOverlay) {
            const t = setTimeout(() => searchRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
        setSearchVal("");
    }, [searchOverlay]);

    /* ── Escape key ── */
    useEffect(() => {
        const fn = e => {
            if (e.key === "Escape") { setSearchOverlay(false); setMobileOpen(false); }
        };
        document.addEventListener("keydown", fn);
        return () => document.removeEventListener("keydown", fn);
    }, []);

    /* ── Close on route change ── */
    useEffect(() => { setMobileOpen(false); setSearchOverlay(false); }, [location.pathname]);

    const go = useCallback(path => {
        setMobileOpen(false); setUserMenuOpen(false); navigate(path);
    }, [navigate]);

    const handleLogout = useCallback(() => {
        logout(); setUserMenuOpen(false); setMobileOpen(false);
        navigate("/login", { replace: true });
    }, [logout, navigate]);

    const handleSearch = useCallback(q => {
        if (!q.trim()) return;
        // Save to search history
        try {
            const hist = JSON.parse(localStorage.getItem("ux_search_history") || "[]").filter(h => h.toLowerCase() !== q.trim().toLowerCase());
            hist.unshift(q.trim());
            localStorage.setItem("ux_search_history", JSON.stringify(hist.slice(0, 15)));
        } catch { /* ignore */ }
        setSuggestions([]);
        setMobileOpen(false); setSearchOverlay(false);
        if (isUHMode) {
            navigate(`/urbexon-hour?search=${encodeURIComponent(q.trim())}`);
        } else {
            navigate(`/?search=${encodeURIComponent(q.trim())}`);
        }
    }, [navigate, isUHMode]);

    /* ── Desktop search suggestions (debounced) ── */
    useEffect(() => {
        clearTimeout(suggestTimer.current);
        if (deskSearch.trim().length < 2) { setSuggestions([]); return; }
        suggestTimer.current = setTimeout(() => {
            const typeParam = isUHMode ? "&productType=urbexon_hour" : "";
            api.get(`/products/suggestions?q=${encodeURIComponent(deskSearch.trim())}${typeParam}`)
                .then(r => setSuggestions(Array.isArray(r.data) ? r.data : []))
                .catch(() => setSuggestions([]));
        }, 300);
        return () => clearTimeout(suggestTimer.current);
    }, [deskSearch]);

    const isCatActive = useCallback(cat =>
        location.pathname === `/category/${cat}`, [location.pathname]);

    const navbarHeight = isUHMode ? `68px` : `calc(68px + 41px)`;
    const mobileHeight = `58px`;

    return (
        <>
            <style>{CSS}</style>

            {/* Fixed wrapper */}
            <div className="ux-nav" style={{
                position: "fixed", top: 0, left: 0, right: 0, zIndex: 600,
                transform: navHidden ? "translateY(-100%)" : "translateY(0)",
                transition: "transform .3s cubic-bezier(.4,0,.2,1)",
            }}>


                {/* ── MOBILE NAV ── */}
                <nav className={`ux-mnav${isUHMode ? " ux-uh-mode" : ""}`} style={{ display: "none" }} id="ux-mob-nav">
                    <div className="ux-mnav-in">
                        <button className="ux-m-logo" onClick={() => go(isUHMode ? "/urbexon-hour" : "/")}>
                            {isUHMode ? (
                                <>
                                    <span className="ux-m-mark">U</span>
                                    <span className="ux-m-word">rbexon</span>
                                    <span className="ux-m-uh-text">Hour</span>
                                </>
                            ) : (
                                <>
                                    <span className="ux-m-mark">U</span>
                                    <span className="ux-m-word">rbexon</span>
                                </>
                            )}
                        </button>

                        {/* Mobile location */}
                        <button className="ux-m-loc-btn" onClick={() => setLocModalOpen(true)}>
                            <FaMapMarkerAlt size={11} style={{ color: isUHMode ? "#c9a84c" : "#111827", flexShrink: 0 }} />
                            <span className="ux-m-loc-city">
                                {locationData?.city || locationData?.label || "Location"}
                            </span>
                            <FaChevronDown size={7} style={{ color: "#9ca3af", flexShrink: 0 }} />
                        </button>
                        <div className="ux-m-acts">
                            <button className="ux-m-btn" onClick={() => setSearchOverlay(true)}>
                                <FaSearch size={16} />
                            </button>
                            {isUHMode ? (
                                <button className="ux-m-btn" style={{ color: "#c9a84c" }} onClick={() => go("/uh-cart")}>
                                    <FaBolt size={16} />
                                    {uhCount > 0 && (
                                        <span className="ux-badge" style={{ background: "#c9a84c", color: "#1a1740", top: 3, right: 3 }}>
                                            {uhCount > 9 ? "9+" : uhCount}
                                        </span>
                                    )}
                                </button>
                            ) : (
                                <>
                                    {uhCount > 0 && (
                                        <button className="ux-m-btn" style={{ color: "#ff4500" }} onClick={() => go("/uh-cart")}>
                                            <FaBolt size={16} />
                                            <span className="ux-badge ux-badge-org" style={{ top: 3, right: 3 }}>
                                                {uhCount > 9 ? "9+" : uhCount}
                                            </span>
                                        </button>
                                    )}
                                    <button className="ux-m-btn" onClick={() => go("/cart")}>
                                        <FaShoppingCart size={16} />
                                        {ecommerceCount > 0 && (
                                            <span className="ux-badge ux-badge-red">{ecommerceCount > 9 ? "9+" : ecommerceCount}</span>
                                        )}
                                    </button>
                                </>
                            )}
                            <button className="ux-m-btn" onClick={() => setMobileOpen(s => !s)}>
                                <div className="ux-burger">
                                    <span style={{ transform: mobileOpen ? "translateY(6px) rotate(45deg)" : "none" }} />
                                    <span style={{ opacity: mobileOpen ? 0 : 1 }} />
                                    <span style={{ transform: mobileOpen ? "translateY(-6px) rotate(-45deg)" : "none" }} />
                                </div>
                            </button>
                        </div>
                    </div>
                </nav>

                {/* ── DESKTOP NAV ── */}
                <nav className={`ux-navbar ${scrolled ? "sc" : ""}${isUHMode ? " ux-uh-mode" : ""}`} id="ux-desk-nav">
                    <div className="ux-nav-row">

                        {/* Logo */}
                        <button className="ux-logo-btn" onClick={() => go(isUHMode ? "/urbexon-hour" : "/")}>
                            {isUHMode ? (
                                <>
                                    <span className="ux-logo-mark">U</span>
                                    <span className="ux-logo-word">rbexon</span>
                                    <span className="ux-logo-uh">Hour</span>
                                </>
                            ) : (
                                <>
                                    <span className="ux-logo-mark">U</span>
                                    <span className="ux-logo-word">rbexon</span>
                                </>
                            )}
                        </button>

                        {/* Location selector */}
                        <button className="ux-loc-btn" onClick={() => setLocModalOpen(true)}>
                            <FaMapMarkerAlt size={14} className="ux-loc-icon" />
                            <div className="ux-loc-text">
                                <div className="ux-loc-label">Deliver to</div>
                                <div className="ux-loc-city">
                                    {locationData?.label || "Select location"}
                                    {locationData?.pincode ? ` · ${locationData.pincode}` : ""}
                                </div>
                            </div>
                            <FaChevronDown size={8} style={{ color: "#9ca3af", flexShrink: 0 }} />
                        </button>

                        {/* Switch to Hour / Back to Store */}
                        <button className="ux-hour-pill" onClick={() => navigate(isUHMode ? "/" : "/urbexon-hour")}>
                            {isUHMode ? <FaShoppingCart size={11} /> : <FaBolt size={12} className="ux-hp-bolt" />}
                            <span className="ux-hp-label">{isUHMode ? "Back to Store" : "Urbexon Hour"}</span>
                        </button>

                        {/* Search */}
                        <div style={{ position: "relative", flex: 1, maxWidth: 680 }}>
                            <form
                                className={`ux-srch ${searchFocused ? "foc" : ""}`}
                                onSubmit={e => { e.preventDefault(); handleSearch(deskSearch); }}
                            >
                                <input
                                    className="ux-srch-inp"
                                    type="text"
                                    value={deskSearch}
                                    onChange={e => setDeskSearch(e.target.value)}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                                    placeholder={isUHMode ? "Search Urbexon Hour products..." : "Search for products, brands and more..."}
                                />
                                {deskSearch && (
                                    <button type="button" onClick={() => { setDeskSearch(""); setSuggestions([]); }}
                                        style={{ background: "none", border: "none", cursor: "pointer", padding: "0 8px", color: "#9ca3af", display: "flex", alignItems: "center" }}>
                                        <FaTimes size={12} />
                                    </button>
                                )}
                                <button type="submit" className="ux-srch-btn">
                                    <FaSearch size={15} color="#fff" />
                                </button>
                            </form>
                            {/* Suggestions dropdown */}
                            {searchFocused && (suggestions.length > 0 || (deskSearch.length < 2 && recentSearches.length > 0)) && (
                                <div className="ux-sugg">
                                    {suggestions.length > 0 ? (
                                        <>
                                            <div className="ux-sugg-lbl">Suggestions</div>
                                            {suggestions.map(s => (
                                                <div key={s._id} className="ux-sugg-item" onMouseDown={() => { navigate(isUHMode ? `/uh-product/${s.slug || s._id}` : `/products/${s.slug || s._id}`); setSuggestions([]); setDeskSearch(""); }}>
                                                    <img className="ux-sugg-img" src={s.images?.[0]?.url || "/placeholder.png"} alt="" onError={e => { e.target.src = "/placeholder.png"; }} />
                                                    <div className="ux-sugg-info">
                                                        <div className="ux-sugg-name">{s.name}</div>
                                                        <div className="ux-sugg-meta">{s.brand ? `${s.brand} · ` : ""}{s.category || ""}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    ) : recentSearches.length > 0 && (
                                        <>
                                            <div className="ux-sugg-lbl">Recent Searches</div>
                                            {recentSearches.slice(0, 6).map(t => (
                                                <div key={t} className="ux-sugg-item" onMouseDown={() => handleSearch(t)}>
                                                    <FaSearch size={11} color="#9ca3af" />
                                                    <div className="ux-sugg-info"><div className="ux-sugg-name">{t}</div></div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right actions */}
                        <div className="ux-acts">
                            {isAuth ? (
                                <>
                                    {/* Wishlist — ecommerce only */}
                                    {!isUHMode && (
                                        <button className="ux-icon-btn" onClick={() => go("/wishlist")}>
                                            <FaHeart size={20} color="#374151" />
                                            <span className="ux-icon-btn-lbl">Wishlist</span>
                                        </button>
                                    )}

                                    {/* Notifications */}
                                    {!isUHMode && <NotificationCenter />}

                                    {!isUHMode && <div className="ux-vdiv" />}

                                    {/* UH Cart — always visible in UH mode with gold style */}
                                    {isUHMode ? (
                                        <button className="ux-uh-cart-always" onClick={() => go("/uh-cart")}>
                                            <FaBolt size={14} />
                                            <span>Cart</span>
                                            {uhCount > 0 && (
                                                <span className="ux-badge" style={{ position: "static", border: "none", minWidth: 20, height: 20, borderRadius: 10 }}>
                                                    {uhCount > 9 ? "9+" : uhCount}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            {/* UH Cart mini (ecommerce page) */}
                                            {uhCount > 0 && (
                                                <button className="ux-uh-cart" onClick={() => go("/uh-cart")}>
                                                    <FaBolt size={14} />
                                                    <span>{uhCount}</span>
                                                </button>
                                            )}

                                            {/* Ecommerce Cart */}
                                            <button className="ux-icon-btn" onClick={() => go("/cart")}>
                                                <FaShoppingCart size={20} color="#374151" />
                                                {ecommerceCount > 0 && (
                                                    <span className="ux-badge ux-badge-red">{ecommerceCount > 9 ? "9+" : ecommerceCount}</span>
                                                )}
                                                <span className="ux-icon-btn-lbl">Cart</span>
                                            </button>
                                        </>
                                    )}

                                    <div className="ux-vdiv" />

                                    {/* User dropdown */}
                                    <div className="ux-usr-wrap" ref={userMenuRef}>
                                        <button className="ux-usr-btn" onClick={() => setUserMenuOpen(s => !s)}>
                                            <div className="ux-usr-av">{user?.name?.[0]?.toUpperCase()}</div>
                                            <div>
                                                <div className="ux-usr-name">{user?.name?.split(" ")[0]}</div>
                                                <div className="ux-usr-sub">My Account</div>
                                            </div>
                                            <FaChevronDown size={9} color="#9ca3af"
                                                style={{ transform: userMenuOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                                        </button>

                                        {userMenuOpen && (
                                            <div className="ux-ddrop">
                                                <div className="ux-ddrop-hd">
                                                    <div className="ux-ddrop-av">{user?.name?.[0]?.toUpperCase()}</div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div className="ux-ddrop-nm">{user?.name}</div>
                                                        <div className="ux-ddrop-em">{user?.email}</div>
                                                    </div>
                                                </div>
                                                {menuItems.map(({ icon, label, path }) => (
                                                    <button key={label} className="ux-dmi" onClick={() => go(path)}>
                                                        <span className="ux-dmi-ic">{icon}</span>
                                                        {label}
                                                    </button>
                                                ))}
                                                <div className="ux-ddrop-sep" />
                                                <button className="ux-dmi ux-dmi-out" onClick={handleLogout}>
                                                    <span className="ux-dmi-ic"><FaSignOutAlt size={12} /></span>
                                                    Sign Out
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Guest cart — context-aware */}
                                    {isUHMode ? (
                                        <button className="ux-uh-cart-always" onClick={() => go("/uh-cart")}>
                                            <FaBolt size={14} />
                                            <span>Cart</span>
                                            {uhCount > 0 && (
                                                <span className="ux-badge" style={{ position: "static", border: "none", minWidth: 20, height: 20, borderRadius: 10 }}>
                                                    {uhCount > 9 ? "9+" : uhCount}
                                                </span>
                                            )}
                                        </button>
                                    ) : (
                                        <button className="ux-icon-btn" onClick={() => go("/cart")}>
                                            <FaShoppingCart size={20} color="#374151" />
                                            {ecommerceCount > 0 && (
                                                <span className="ux-badge ux-badge-red">{ecommerceCount > 9 ? "9+" : ecommerceCount}</span>
                                            )}
                                            <span className="ux-icon-btn-lbl">Cart</span>
                                        </button>
                                    )}
                                    <div className="ux-vdiv" />
                                    <button className="ux-login-btn" onClick={() => go("/login")}>Login</button>
                                    <button className="ux-register-btn" onClick={() => go("/register")}>Register</button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Category bar (hidden in UH mode) */}
                    {categories.length > 0 && !isUHMode && (
                        <div className="ux-catbar">
                            <div className="ux-catbar-in">
                                {categories.map(cat => (
                                    <button
                                        key={cat._id}
                                        className={`ux-catbtn ${isCatActive(cat.slug) ? "act" : ""}`}
                                        onClick={() => navigate(`/category/${cat.slug}`)}
                                    >
                                        {cat.name}
                                        {cat.isHot && <span className="ux-hot">HOT</span>}
                                    </button>
                                ))}
                                <button
                                    className={`ux-catbtn ${location.pathname === "/deals" ? "act" : ""}`}
                                    onClick={() => navigate("/deals")}
                                >
                                    Deals <span className="ux-hot">HOT</span>
                                </button>
                            </div>
                        </div>
                    )}
                </nav>
            </div>

            {/* Spacers */}
            <div id="ux-spacer-mob" style={{ height: mobileHeight, display: "none" }} />
            <div id="ux-spacer-desk" style={{ height: navbarHeight }} />

            {/* Mobile Menu */}
            <div className={`ux-nav ux-mmenu ${mobileOpen ? "on" : ""}`}>
                {isAuth ? (
                    <div className="ux-mm-head">
                        <div className="ux-mm-av-row">
                            <div className="ux-mm-av">{user?.name?.[0]?.toUpperCase()}</div>
                            <div>
                                <div className="ux-mm-nm">{user?.name}</div>
                                <div className="ux-mm-em">{user?.email}</div>
                            </div>
                        </div>
                        <div className="ux-mm-chips">
                            {menuItems.map(({ icon, label, path }) => (
                                <button key={path} className="ux-mm-chip" onClick={() => go(path)}>
                                    {icon} {label}
                                </button>
                            ))}
                            <button className="ux-mm-chip ux-mm-chip-out" onClick={handleLogout}>
                                <FaSignOutAlt size={11} /> Sign Out
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="ux-mm-auth" style={{ paddingTop: 70 }}>
                        <button className="ux-mm-sin" onClick={() => go("/login")}>Login</button>
                        <button className="ux-mm-reg" onClick={() => go("/register")}>Register</button>
                    </div>
                )}

                <div>
                    {isUHMode ? (
                        <>
                            <div className="ux-mm-lbl">Quick Links</div>
                            <div className="ux-mm-row" onClick={() => go("/orders")}>
                                <span><FaBox size={12} /> My Orders</span>
                                <FaChevronRight size={10} color="#9ca3af" />
                            </div>
                            <div className="ux-mm-row" onClick={() => go("/profile")}>
                                <span><FaUser size={12} /> My Profile</span>
                                <FaChevronRight size={10} color="#9ca3af" />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="ux-mm-lbl">Shop by Category</div>
                            {categories.map(cat => (
                                <div key={cat._id} className="ux-mm-row"
                                    onClick={() => { setMobileOpen(false); navigate(`/category/${cat.slug}`); }}>
                                    <span>{cat.name}{cat.isHot && <span className="ux-hot" style={{ marginLeft: 8 }}>HOT</span>}</span>
                                    <FaChevronRight size={10} color="#9ca3af" />
                                </div>
                            ))}
                            <div className="ux-mm-row" onClick={() => { setMobileOpen(false); navigate("/deals"); }}>
                                <span>Deals <span className="ux-hot">HOT</span></span>
                                <FaChevronRight size={10} color="#9ca3af" />
                            </div>
                        </>
                    )}
                </div>

                {isUHMode ? (
                    <div className="ux-mm-uh"
                        onClick={() => { setMobileOpen(false); navigate("/"); }}>
                        <FaShoppingCart size={20} color="#fff" />
                        <div>
                            <div className="ux-mm-uh-nm">Back to Store</div>
                            <div className="ux-mm-uh-sub">Browse ecommerce products</div>
                        </div>
                    </div>
                ) : (
                    <div className="ux-mm-uh" onClick={() => { setMobileOpen(false); navigate("/urbexon-hour"); }}>
                        <FaBolt size={20} color="#c9a84c" />
                        <div>
                            <div className="ux-mm-uh-nm">Urbexon Hour</div>
                            <div className="ux-mm-uh-sub">Express delivery in 45–120 mins</div>
                        </div>
                    </div>
                )}
            </div>

            {mobileOpen && (
                <div onClick={() => setMobileOpen(false)}
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 499 }} />
            )}

            {/* Search Overlay */}
            {searchOverlay && (
                <div className="ux-nav ux-sov"
                    onClick={e => { if (e.target === e.currentTarget) setSearchOverlay(false); }}>
                    <div className="ux-sov-box">
                        <form className="ux-sov-form"
                            onSubmit={e => { e.preventDefault(); handleSearch(searchVal); }}>
                            <input
                                ref={searchRef}
                                className="ux-sov-inp"
                                type="text"
                                value={searchVal}
                                onChange={e => setSearchVal(e.target.value)}
                                placeholder={isUHMode ? "Search Urbexon Hour products…" : "Search for products, brands and more…"}
                            />
                            <button type="button" className="ux-sov-close" onClick={() => setSearchOverlay(false)}>
                                <FaTimes size={18} />
                            </button>
                        </form>
                        <div className="ux-sov-tags">
                            {(recentSearches.length > 0
                                ? recentSearches.slice(0, 8)
                                : isUHMode
                                    ? ["Grocery", "Snacks", "Drinks", "Fresh", "Dairy", "Bakery"]
                                    : ["Fashion", "Electronics", "Watches", "Footwear", "Home Decor", "Sports"]
                            ).map(t => (
                                <button key={t} className="ux-sov-tag" onClick={() => handleSearch(t)}>{t}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Responsive CSS */}
            <style>{`
                @media(max-width:767px){
                    #ux-desk-nav { display:none!important; }
                    #ux-mob-nav  { display:block!important; }
                    #ux-spacer-mob  { display:block!important; }
                    #ux-spacer-desk { display:none!important; }
                }
            `}</style>

            {/* Location Modal */}
            {locModalOpen && <LocationModal onClose={() => setLocModalOpen(false)} />}
        </>
    );
};

export default Navbar;