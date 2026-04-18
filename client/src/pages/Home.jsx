/**
 * Home.jsx — Urbexon Production v3.0
 * ✅ Matches Figma: Hero split layout, categories, trending, featured sellers, why choose, UH section
 * ✅ All API calls preserved + working
 * ✅ No static/dummy categories or nav data
 * ✅ Full sections: Hero, Categories, Featured, Flash Deals, Featured Sellers, Why Choose, UH Section, Footer CTA
 * ✅ FIXED: Hero banner image now covers full section properly
 */
import { useState, useEffect, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import SEO from "../components/SEO";
import api from "../api/axios";
import { fetchActiveBanners } from "../api/bannerApi";
import { fetchActiveCategories } from "../api/categoryApi";
import CategoryBrowser from "../components/CategoryBrowser";
import { useCart } from "../hooks/useCart";
import { useWishlist } from "../hooks/useWishlist";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useAuth } from "../contexts/AuthContext";
import {
    FaArrowRight, FaTruck, FaUndo, FaShieldAlt, FaHeadset,
    FaShoppingCart, FaBolt, FaStar, FaChevronLeft, FaChevronRight,
    FaSearch, FaHeart, FaRegHeart,
    FaCheckCircle, FaFire, FaTag, FaStore,
} from "react-icons/fa";

/* ── Search history helpers ── */
const SEARCH_HISTORY_KEY = "ux_search_history";
const getSearchHistory = () => {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; } catch { return []; }
};
const saveSearchTerm = (term) => {
    if (!term?.trim()) return;
    const t = term.trim();
    const hist = getSearchHistory().filter(h => h.toLowerCase() !== t.toLowerCase());
    hist.unshift(t);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(hist.slice(0, 15)));
};

/* ─── helpers ────────────────────────────────────────────── */
const imgSrc = p => p?.images?.[0]?.url || (typeof p?.image === "string" ? p.image : p?.image?.url) || "";
const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const disc = p => p.mrp && p.mrp > p.price ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;

/* ─── CSS ─────────────────────────────────────────────────── */
const CSS = `
/* fonts loaded from index.html */

:where(.h-root), :where(.h-root) *, :where(.h-root) *::before, :where(.h-root) *::after {
    box-sizing: border-box; margin: 0; padding: 0;
}

@keyframes h-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes h-up      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
@keyframes h-pulse   { 0%,100%{opacity:1} 50%{opacity:.5} }
@keyframes h-float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes h-count   { from{opacity:0;transform:scale(.8)} to{opacity:1;transform:scale(1)} }
@keyframes h-slide   { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.h-root {
    font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
    background: #f5f7fa;
    color: #111827;
    overflow-x: hidden;
}

/* ── SKELETON ────────────────────────────────── */
.h-sk {
    background: linear-gradient(90deg,#eee 25%,#e0e0e0 50%,#eee 75%);
    background-size: 200% 100%;
    animation: h-shimmer 1.5s infinite;
    border-radius: 6px;
}

/* ══════════════════════════════════════════
   HERO
══════════════════════════════════════════ */
.h-hero {
    overflow: hidden;
    position: relative;
    min-height: 420px;
    width: 100%;
}
@media(min-width:768px){ .h-hero { min-height: 520px; } }

/* ── HERO SLIDE ── */
.h-hero-slide {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    min-height: 420px;
    display: none;
    align-items: center;
    justify-content: flex-start;
    overflow: hidden;
}
.h-hero-slide.on {
    display: flex;
}

/* ── BANNER BACKGROUND IMAGE ── */
.h-hero-slide-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
    z-index: 0;
}

/* ── DARK OVERLAY for text readability ── */
.h-hero-slide-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.60) 0%,
        rgba(0, 0, 0, 0.35) 50%,
        rgba(0, 0, 0, 0.10) 100%
    );
    z-index: 1;
}

.h-hero-in {
    max-width: 1280px;
    margin: 0 auto;
    padding: 60px clamp(20px,5vw,80px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    position: relative;
    z-index: 2;
    width: 100%;
    flex-wrap: wrap;
    min-height: 420px;
}
@media(min-width:768px){ .h-hero-in { min-height: 520px; } }

.h-hero-left { flex: 1; min-width: 0; animation: h-up .5s ease; }
@media(max-width:767px){ .h-hero-left { min-width: 100%; } }

.h-hero-tag {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 14px; border-radius: 20px;
    background: rgba(255,255,255,.2); border: 1px solid rgba(255,255,255,.3);
    font-size: 12px; font-weight: 700; color: #fff;
    letter-spacing: .5px; margin-bottom: 16px;
}

.h-hero-title {
    font-size: clamp(32px, 5vw, 64px);
    font-weight: 800; line-height: 1.08;
    color: #fff; margin-bottom: 14px;
}
.h-hero-title em { color: #ffd60a; font-style: normal; display: block; }

.h-hero-desc {
    font-size: 15px; color: rgba(255,255,255,.85);
    line-height: 1.7; margin-bottom: 28px; max-width: 460px;
}
@media(max-width:600px){ .h-hero-desc { display: none; } }
@media(max-width:480px){ .h-hero-title { font-size: 28px !important; } .h-hero-tag { font-size: 11px; } }

.h-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }

.h-hero-btn-p {
    padding: 13px 28px; border: none; border-radius: 10px;
    background: #fff; color: #5b5bf6;
    font-size: 14px; font-weight: 800; cursor: pointer;
    display: flex; align-items: center; gap: 8px;
    transition: all .2s; font-family: 'Plus Jakarta Sans', sans-serif;
    box-shadow: 0 4px 16px rgba(0,0,0,.2);
}
.h-hero-btn-p:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.25); }

.h-hero-btn-s {
    padding: 13px 24px; border: 1.5px solid rgba(255,255,255,.55);
    background: rgba(255,255,255,.1); color: #fff;
    font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 10px;
    transition: all .2s; font-family: 'Plus Jakarta Sans', sans-serif;
    backdrop-filter: blur(4px);
}
.h-hero-btn-s:hover { background: rgba(255,255,255,.2); }

.h-hero-right {
    flex-shrink: 0; animation: h-up .5s ease .1s both;
}
.h-hero-img {
    width: clamp(260px, 35vw, 480px); height: clamp(260px, 35vw, 480px);
    object-fit: contain; border-radius: 20px;
    background: rgba(255,255,255,.92);
    padding: 16px;
    box-shadow: 0 20px 60px rgba(0,0,0,.18);
    animation: h-float 4s ease-in-out infinite;
}
.h-hero-img-placeholder {
    width: clamp(260px, 35vw, 480px); height: clamp(260px, 35vw, 480px);
    background: rgba(255,255,255,.1); border-radius: 20px;
    display: flex; align-items: center; justify-content: center;
    font-size: 80px;
}
@media(max-width:767px){ .h-hero-right { display: none; } }

/* Stats in hero */
.h-hero-stats {
    display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap;
}
@media(max-width:480px){ .h-hero-stats { gap: 8px; margin-top: 20px; } .h-hero-stat { padding: 8px 12px; } .h-hero-stat-v { font-size: 15px; } }
.h-hero-stat {
    background: rgba(255,255,255,.15); border: 1px solid rgba(255,255,255,.25);
    border-radius: 10px; padding: 10px 16px;
    display: flex; flex-direction: column;
    backdrop-filter: blur(8px);
}
.h-hero-stat-v { font-size: 18px; font-weight: 800; color: #fff; }
.h-hero-stat-l { font-size: 10px; color: rgba(255,255,255,.7); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }

/* Nav arrows */
.h-nav-btn {
    position: absolute; top: 50%; transform: translateY(-50%);
    z-index: 10; width: 42px; height: 42px; border-radius: 50%;
    background: rgba(255,255,255,.9); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,.2); transition: all .18s;
    color: #374151;
}
.h-nav-btn:hover { background: #fff; transform: translateY(-50%) scale(1.05); }
.h-nav-btn.l { left: 16px; } .h-nav-btn.r { right: 16px; }
@media(max-width:600px){ .h-nav-btn { display: none; } }

/* Dots */
.h-dots {
    position: absolute; bottom: 20px; left: 50%;
    transform: translateX(-50%); display: flex; gap: 6px; z-index: 5;
}
.h-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: rgba(255,255,255,.4); border: none; cursor: pointer; padding: 0;
    transition: all .3s;
}
.h-dot.on { background: #fff; width: 24px; border-radius: 4px; }

/* ══════════════════════════════════════════
   SECTIONS
══════════════════════════════════════════ */
.h-wrap { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px,4vw,60px); }

.h-sec { padding: 52px 0; }

.h-sec-head {
    display: flex; align-items: flex-end; justify-content: space-between;
    margin-bottom: 28px; gap: 12px; flex-wrap: wrap;
}
.h-sec-title {
    font-size: clamp(20px, 2.5vw, 28px); font-weight: 800; color: #111827; margin: 0;
}
.h-sec-sub { font-size: 13px; color: #6b7280; margin-top: 3px; }
.h-view-all {
    font-size: 13px; font-weight: 700; color: #5b5bf6;
    text-decoration: none; display: flex; align-items: center; gap: 5px;
    white-space: nowrap; transition: gap .15s;
}
.h-view-all:hover { gap: 8px; }

/* ── Section reveal animation ── */
.h-sec { animation: h-reveal .45s ease both; }
@keyframes h-reveal { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } }

/* ══════════════════════════════════════════
   CATEGORIES
══════════════════════════════════════════ */
.h-catgrid {
    display: grid; gap: 10px;
    grid-template-columns: repeat(4, 1fr);
}
@media(min-width:480px){ .h-catgrid { gap: 12px; } }
@media(min-width:600px){ .h-catgrid { grid-template-columns: repeat(6, 1fr); } }
@media(min-width:900px){ .h-catgrid { grid-template-columns: repeat(8, 1fr); } }
@media(max-width:360px){ .h-catgrid { grid-template-columns: repeat(3, 1fr); } }

.h-catcard {
    background: #fff; border: 1px solid #e8edf2;
    border-radius: 12px; padding: clamp(12px, 2vw, 18px) 8px;
    text-align: center; cursor: pointer;
    transition: all .22s; display: flex;
    flex-direction: column; align-items: center; gap: 10px;
}
.h-catcard:hover {
    border-color: #5b5bf6;
    transform: translateY(-3px);
    box-shadow: 0 8px 24px rgba(91,91,246,.12);
}
.h-cat-icon {
    width: clamp(40px, 6vw, 54px); height: clamp(40px, 6vw, 54px); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 26px; transition: transform .25s;
}
.h-catcard:hover .h-cat-icon { transform: scale(1.1); }
.h-cat-nm { font-size: 11px; font-weight: 700; color: #374151; line-height: 1.3; text-align: center; }

/* ══════════════════════════════════════════
   PRODUCT CARD
══════════════════════════════════════════ */
.h-pcard {
    background: #fff; border: 1px solid #e8edf2;
    border-radius: 14px; overflow: hidden; cursor: pointer;
    transition: all .22s; position: relative;
    display: flex; flex-direction: column;
}
.h-pcard:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 32px rgba(0,0,0,.1);
    border-color: #d1d5db;
}
.h-pimg { position: relative; overflow: hidden; background: #f8fafc; }
.h-pimg img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s; display: block; }
.h-pimg { height: clamp(160px, 22vw, 220px); }
@media(min-width:900px){ .h-pimg { height: 200px; } }
.h-pcard:hover .h-pimg img { transform: scale(1.05); }
.h-pimg-empty { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px; background:#f8fafc; }

.h-disc-badge {
    position: absolute; top: 10px; left: 10px;
    background: #ef4444; color: #fff;
    font-size: 10px; font-weight: 800;
    padding: 3px 8px; border-radius: 6px;
}
.h-express-badge {
    position: absolute; bottom: 8px; left: 8px;
    background: #ff4500; color: #fff;
    font-size: 9px; font-weight: 800;
    padding: 2px 8px; border-radius: 10px;
    display: flex; align-items: center; gap: 4px;
}
.h-oos-overlay {
    position: absolute; inset: 0;
    background: rgba(255,255,255,.75);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 800; color: #6b7280;
    letter-spacing: 1px; text-transform: uppercase;
}
.h-wish-btn {
    position: absolute; top: 8px; right: 8px;
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,.95); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 2px 8px rgba(0,0,0,.1); opacity: 0; transition: opacity .2s;
}
.h-pcard:hover .h-wish-btn { opacity: 1; }
@media(max-width:768px){ .h-wish-btn { opacity: 1; width: 28px; height: 28px; } }

.h-pbody { padding: 14px; flex: 1; display: flex; flex-direction: column; }
.h-pbrand { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 3px; }
.h-pname { font-size: 13px; color: #374151; line-height: 1.4; margin-bottom: 8px; display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; flex:1; }

.h-prating { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
.h-prat-badge { background: #0d9488; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; display:flex;align-items:center;gap:3px; }
.h-prat-cnt { font-size:11px; color:#9ca3af; }

.h-pprices { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px; }
.h-pprice  { font-size: 16px; font-weight: 800; color: #111827; }
.h-pmrp    { font-size: 12px; color: #9ca3af; text-decoration: line-through; }
.h-poff    { font-size: 11px; font-weight: 700; color: #16a34a; }

.h-add-btn {
    width: 100%; padding: 9px 0;
    font-size: 11px; font-weight: 700;
    border-radius: 8px; cursor: pointer; border: none;
    transition: all .18s; font-family: 'Plus Jakarta Sans', sans-serif;
    text-transform: uppercase; letter-spacing: .5px;
    display: flex; align-items: center; justify-content: center; gap: 6px;
}
.h-add-btn.default { background: #f3f4f6; color: #374151; border: 1.5px solid #e5e7eb; }
.h-add-btn.default:hover { background: #5b5bf6; color: #fff; border-color: #5b5bf6; }
.h-add-btn.added   { background: #5b5bf6; color: #fff; }
.h-add-btn.incart  { background: #f0fdf4; color: #16a34a; border: 1.5px solid #86efac; }
.h-add-btn.oos     { background: #f9fafb; color: #9ca3af; border: 1.5px solid #e5e7eb; cursor: not-allowed; }

/* Product grids */
.h-pgrid {
    display: grid; gap: 10px;
    grid-template-columns: repeat(2, 1fr);
}
@media(min-width:520px) { .h-pgrid { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
@media(min-width:900px) { .h-pgrid { grid-template-columns: repeat(4, 1fr); } }
@media(min-width:1200px){ .h-pgrid { grid-template-columns: repeat(5, 1fr); } }

.h-hscroll {
    display: flex; gap: 14px; overflow-x: auto;
    padding-bottom: 6px; scrollbar-width: none;
}
.h-hscroll::-webkit-scrollbar { display: none; }
.h-hscroll .h-pcard { min-width: 200px; flex-shrink: 0; }
@media(max-width:600px){ .h-hscroll .h-pcard { min-width: 165px; } }

/* ══════════════════════════════════════════
   FLASH DEALS BANNER
══════════════════════════════════════════ */
.h-flash-banner {
    background: linear-gradient(135deg, #ff4500 0%, #ff6b35 50%, #ff8555 100%);
    border-radius: 20px; padding: 28px 32px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; flex-wrap: nowrap;
    position: relative; overflow: hidden;
    box-shadow: 0 12px 32px rgba(255, 69, 0, 0.25), 0 8px 16px rgba(255, 69, 0, 0.15);
    border: 2px solid rgba(255,255,255,0.15);
}
.h-flash-banner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: 
        radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0%, transparent 50%);
    pointer-events: none;
    border-radius: 20px;
}
.h-flash-left { display: flex; align-items: center; gap: 18px; position: relative; z-index: 2; }
.h-flash-icon { 
    width: 56px; height: 56px; background: rgba(255,255,255,0.25);
    backdrop-filter: blur(10px); border: 2px solid rgba(255,255,255,0.3);
    border-radius: 14px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; animation: h-flash-pulse 2s ease-in-out infinite;
}
@keyframes h-flash-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.08); opacity: 0.9; }
}
.h-flash-title { font-size: 24px; font-weight: 900; color: #fff; margin-bottom: 4px; letter-spacing: -0.5px; text-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.h-flash-sub { font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 500; letter-spacing: 0.3px; }
.h-flash-timer { 
    display: flex; gap: 8px; align-items: center; flex-shrink: 0;
    position: relative; z-index: 2;
    background: rgba(0,0,0,0.2); backdrop-filter: blur(8px);
    padding: 12px 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.15);
}
@media(max-width:768px){ 
    .h-flash-banner { padding: 20px 24px; gap: 16px; flex-wrap: wrap; } 
    .h-flash-title { font-size: 20px; } 
    .h-flash-tv { font-size: 16px; } 
    .h-flash-time-box { padding: 6px 10px; min-width: 40px; }
    .h-flash-icon { width: 48px; height: 48px; }
}
@media(max-width:480px){ 
    .h-flash-banner { padding: 16px 18px; gap: 12px; flex-direction: column; align-items: stretch; } 
    .h-flash-left { width: 100%; }
    .h-flash-title { font-size: 18px; } 
    .h-flash-tv { font-size: 14px; } 
    .h-flash-time-box { padding: 5px 8px; min-width: 36px; }
    .h-flash-timer { width: 100%; justify-content: center; padding: 10px 14px; }
}
.h-flash-time-box {
    background: rgba(0,0,0,0.3); backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.15); border-radius: 10px;
    padding: 7px 12px; text-align: center; min-width: 48px;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.h-flash-time-box:hover { background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.25); transform: scale(1.05); }
.h-flash-tv { font-size: 20px; font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; text-shadow: 0 2px 6px rgba(0,0,0,0.2); }
.h-flash-tl { font-size: 9px; color: rgba(255,255,255,0.7); margin-top: 2px; font-weight: 600; letter-spacing: 0.3px; }
.h-flash-colon { font-size: 22px; font-weight: 900; color: rgba(255,255,255,0.7); animation: h-flash-blink 1s ease-in-out infinite; }
@keyframes h-flash-blink { 0%, 49%, 100% { opacity: 1; } 50%, 99% { opacity: 0.4; } }

/* ══════════════════════════════════════════
   FEATURED SELLERS
══════════════════════════════════════════ */
.h-sellers-grid {
    display: grid; gap: 16px;
    grid-template-columns: repeat(2, 1fr);
}
@media(min-width:700px){ .h-sellers-grid { grid-template-columns: repeat(4, 1fr); } }

.h-seller-card {
    background: #fff; border: 1px solid #e8edf2;
    border-radius: 14px; padding: 20px;
    transition: all .22s; cursor: pointer;
}
.h-seller-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(0,0,0,.08); border-color: #d1d5db; }
.h-seller-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.h-seller-av  {
    width: 52px; height: 52px; border-radius: 12px; flex-shrink: 0;
    background: linear-gradient(135deg, #5b5bf6, #7c3aed);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800; color: #fff; overflow: hidden;
}
.h-seller-av img { width: 100%; height: 100%; object-fit: cover; }
.h-seller-name { font-size: 14px; font-weight: 800; color: #111827; margin-bottom: 2px; }
.h-seller-rat  { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #374151; font-weight: 600; }
.h-seller-stats{ display: flex; justify-content: space-between; margin-bottom: 14px; }
.h-seller-stat { font-size: 11px; color: #6b7280; }
.h-seller-stat b { display: block; font-size: 13px; font-weight: 700; color: #111827; }
.h-seller-sales{ color: #16a34a!important; }
.h-visit-btn {
    width: 100%; padding: 9px; border: none;
    background: #5b5bf6; color: #fff; border-radius: 8px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    font-family: 'Plus Jakarta Sans', sans-serif; transition: background .18s;
}
.h-visit-btn:hover { background: #4949d6; }

/* ══════════════════════════════════════════
   WHY CHOOSE
══════════════════════════════════════════ */
.h-why { background: #f5f7fa; }
.h-why-grid {
    display: grid; gap: 16px;
    grid-template-columns: repeat(2, 1fr);
}
@media(min-width:700px){ .h-why-grid { grid-template-columns: repeat(4, 1fr); } }

.h-why-card {
    background: #fff; border: 1px solid #e8edf2;
    border-radius: 14px; padding: 28px 20px;
    text-align: center; transition: all .22s;
}
.h-why-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.07); }
.h-why-icon {
    width: 60px; height: 60px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 14px; font-size: 24px;
}
.h-why-title { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 6px; }
.h-why-sub   { font-size: 12px; color: #6b7280; line-height: 1.5; }

/* ══════════════════════════════════════════
   URBEXON HOUR QUICK STRIP
══════════════════════════════════════════ */
.h-uh-strip {
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    cursor: pointer; transition: all .25s; position: relative;
    overflow: hidden; border-bottom: 3px solid #3b82f6;
}
.h-uh-strip::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(circle at 10% 50%, rgba(59,130,246,.15) 0%, transparent 60%);
    pointer-events: none;
}
.h-uh-strip:hover { filter: brightness(1.06); }

.h-uh-strip-inner {
    position: relative; z-index: 2;
    display: flex; align-items: center; gap: 16px;
    padding: 14px 0;
}
.h-uh-strip-logo { flex-shrink: 0; }
.h-uh-strip-icon {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(135deg, #3b82f6, #2563eb);
    display: flex; align-items: center; justify-content: center;
    color: #fbbf24; font-size: 20px;
    box-shadow: 0 4px 16px rgba(59,130,246,.35);
}
.h-uh-strip-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.h-uh-strip-title { font-size: 16px; color: #fff; letter-spacing: -.3px; font-weight: 500; }
.h-uh-strip-title strong { font-weight: 800; color: #60a5fa; }
.h-uh-strip-sub { font-size: 12px; color: rgba(255,255,255,.65); font-weight: 500; }
.h-uh-strip-sub strong { color: #34d399; font-weight: 700; }
.h-uh-strip-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.h-uh-strip-tag {
    background: rgba(59,130,246,.2); border: 1px solid rgba(59,130,246,.35);
    padding: 5px 12px; border-radius: 20px;
    font-size: 10px; font-weight: 800; color: #60a5fa;
    letter-spacing: .8px; white-space: nowrap;
}
.h-uh-strip-arrow { color: rgba(255,255,255,.5); transition: transform .2s; }
.h-uh-strip:hover .h-uh-strip-arrow { transform: translateX(3px); color: #fff; }

@media(max-width:640px) {
    .h-uh-strip-inner { gap: 12px; padding: 12px 0; }
    .h-uh-strip-icon { width: 38px; height: 38px; font-size: 16px; border-radius: 10px; }
    .h-uh-strip-title { font-size: 14px; }
    .h-uh-strip-sub { font-size: 11px; }
    .h-uh-strip-tag { display: none; }
}

/* ══════════════════════════════════════════
   NEWSLETTER
══════════════════════════════════════════ */
.h-newsletter { background: #111827; padding: 52px 0; text-align: center; }
.h-nl-icon { font-size: 32px; margin-bottom: 12px; }
.h-nl-title { font-size: 22px; font-weight: 800; color: #fff; margin-bottom: 6px; }
.h-nl-sub   { font-size: 14px; color: #9ca3af; margin-bottom: 24px; }
.h-nl-form  { display: flex; gap: 0; max-width: 500px; margin: 0 auto; border-radius: 10px; overflow: hidden; border: 2px solid #374151; width: calc(100% - 32px); }
@media(max-width:480px){ .h-nl-form { flex-direction: column; border-radius: 10px; } .h-nl-inp { border-radius: 10px 10px 0 0; } .h-nl-btn { border-radius: 0 0 10px 10px; padding: 14px; } }
.h-nl-inp   { flex:1; padding:13px 18px; background:#1f2937; border:none; outline:none; font-size:14px; color:#fff; font-family:'Plus Jakarta Sans',sans-serif; }
.h-nl-inp::placeholder { color: #6b7280; }
.h-nl-btn   { padding:13px 24px; background:#5b5bf6; border:none; color:#fff; font-size:14px; font-weight:700; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; transition:background .18s; white-space:nowrap; }
.h-nl-btn:hover { background: #4949d6; }

/* ══════════════════════════════════════════
   SEARCH EMPTY
══════════════════════════════════════════ */
.h-empty { text-align:center; padding:80px 0; color:#9ca3af; }
`;

/* ─── Skeleton ───────────────────────────────────────────── */
const SkCard = () => (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e8edf2" }}>
        <div className="h-sk" style={{ height: 200 }} />
        <div style={{ padding: 14 }}>
            <div className="h-sk" style={{ height: 9, width: "30%", marginBottom: 7 }} />
            <div className="h-sk" style={{ height: 13, marginBottom: 5 }} />
            <div className="h-sk" style={{ height: 13, width: "80%", marginBottom: 12 }} />
            <div className="h-sk" style={{ height: 17, width: "40%", marginBottom: 10 }} />
            <div className="h-sk" style={{ height: 36 }} />
        </div>
    </div>
);

/* ─── Product Card ───────────────────────────────────────── */
const PCard = memo(({ product }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { addItem, isInEcommerceCart, isInUHCart } = useCart();
    const { inWishlist, toggle: toggleWish } = useWishlist(product._id);
    const [flash, setFlash] = useState(false);

    const isUH = product?.productType === "urbexon_hour";
    const inCart = isUH ? isInUHCart(product._id) : isInEcommerceCart(product._id);
    const isOOS = !product.inStock || product.stock === 0;
    const d = disc(product);
    const img = imgSrc(product);

    const handleCart = useCallback(e => {
        e.stopPropagation();
        if (inCart || isOOS) return;
        addItem(product);
        setFlash(true);
        setTimeout(() => setFlash(false), 1200);
    }, [inCart, isOOS, product, addItem]);

    const handleWish = useCallback(e => {
        e.stopPropagation();
        if (!user) { navigate("/login"); return; }
        toggleWish();
    }, [user, navigate, toggleWish]);

    const btnClass = isOOS ? "oos" : inCart || flash ? (flash ? "added" : "incart") : "default";
    const btnText = isOOS ? "Out of Stock" : inCart ? "✓ In Cart" : flash ? "Added!" : isUH ? "⚡ Express" : "+ Add to Cart";

    return (
        <div className="h-pcard" onClick={() => navigate(`/products/${product.slug || product._id}`)}>
            <div className="h-pimg">
                {img ? <img src={img} alt={product.name} loading="lazy" /> : <div className="h-pimg-empty">🛍️</div>}
                {d > 0 && <div className="h-disc-badge">{d}% OFF</div>}
                {isUH && <div className="h-express-badge"><FaBolt size={8} /> EXPRESS</div>}
                {isOOS && <div className="h-oos-overlay">Out of Stock</div>}
                <button className="h-wish-btn" onClick={handleWish}>
                    {inWishlist ? <FaHeart size={13} color="#ef4444" /> : <FaRegHeart size={13} color="#9ca3af" />}
                </button>
            </div>
            <div className="h-pbody">
                {product.brand && <div className="h-pbrand">{product.brand}</div>}
                <div className="h-pname">{product.name}</div>
                {product.rating > 0 && (
                    <div className="h-prating">
                        <span className="h-prat-badge"><FaStar size={8} /> {product.rating.toFixed(1)}</span>
                        {product.numReviews > 0 && <span className="h-prat-cnt">({product.numReviews.toLocaleString()})</span>}
                    </div>
                )}
                <div className="h-pprices">
                    <span className="h-pprice">{fmt(product.price)}</span>
                    {product.mrp > product.price && <span className="h-pmrp">{fmt(product.mrp)}</span>}
                    {d > 0 && <span className="h-poff">{d}% off</span>}
                </div>
                <button className={`h-add-btn ${btnClass}`} onClick={handleCart} disabled={isOOS}>
                    {btnText}
                </button>
            </div>
        </div>
    );
});
PCard.displayName = "PCard";

/* ─── Flash Deal Timer ────── */
const FlashTimer = ({ endsAt }) => {
    const calcRemaining = useCallback(() => {
        if (!endsAt) {
            const now = new Date();
            const eod = new Date(now);
            eod.setHours(23, 59, 59, 999);
            const diff = Math.max(0, eod - now);
            return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) };
        }
        const diff = Math.max(0, new Date(endsAt) - Date.now());
        return { h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) };
    }, [endsAt]);
    const [time, setTime] = useState(calcRemaining);
    useEffect(() => {
        const t = setInterval(() => setTime(calcRemaining()), 1000);
        return () => clearInterval(t);
    }, [calcRemaining]);
    const pad = n => String(n).padStart(2, "0");
    return (
        <div className="h-flash-timer">
            {[{ v: time.h, l: "HR" }, { v: time.m, l: "MIN" }, { v: time.s, l: "SEC" }].map(({ v, l }, i) => (
                <div key={l} style={{ display: "contents" }}>
                    <div className="h-flash-time-box">
                        <div className="h-flash-tv">{pad(v)}</div>
                        <div className="h-flash-tl">{l}</div>
                    </div>
                    {i < 2 && <span className="h-flash-colon">:</span>}
                </div>
            ))}
        </div>
    );
};

/* ─── Section Header ─────────────────────────────────────── */
const SecHead = ({ title, sub, to, label = "View All" }) => (
    <div className="h-sec-head">
        <div>
            <h2 className="h-sec-title">{title}</h2>
            {sub && <p className="h-sec-sub">{sub}</p>}
        </div>
        {to && (
            <Link to={to} className="h-view-all">
                {label} <FaArrowRight size={11} />
            </Link>
        )}
    </div>
);

/* ─── Why Features config ────────────────────────────────── */
const WHY_FEATURES = [
    { icon: "🚚", label: "Fast Delivery", sub: "Free shipping on orders over ₹499", color: "#eff6ff", iconColor: "#3b82f6" },
    { icon: "🔒", label: "Secure Payment", sub: "100% secure transactions", color: "#f0fdf4", iconColor: "#16a34a" },
    { icon: "🏆", label: "Quality Products", sub: "Verified & authentic items", color: "#fefce8", iconColor: "#ca8a04" },
    { icon: "🎧", label: "24/7 Support", sub: "Dedicated customer service", color: "#fdf4ff", iconColor: "#9333ea" },
];

/* ─── Module-level cache ─── */
let _homeCache = null;
const CACHE_TTL = 3 * 60 * 1000;

/* ─── HOME ─────────────────────────────────────────────── */
const Home = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get("search") || "";

    const [heroIdx, setHeroIdx] = useState(0);
    const [slides, setSlides] = useState(() => _homeCache?.slides || []);
    const [categories, setCategories] = useState(() => _homeCache?.categories || []);
    const [featured, setFeatured] = useState(() => _homeCache?.featured || []);
    const [newArrivals, setNewArrivals] = useState(() => _homeCache?.newArrivals || []);
    const [deals, setDeals] = useState(() => _homeCache?.deals || []);
    const [vendors, setVendors] = useState(() => _homeCache?.vendors || []);
    const [loading, setLoading] = useState(() => !_homeCache || Date.now() - (_homeCache?._ts || 0) > CACHE_TTL);
    const [nlEmail, setNlEmail] = useState("");
    const [nlStatus, setNlStatus] = useState("");
    const [stats, setStats] = useState(() => _homeCache?.stats || { products: 0, categories: 0 });
    const [forYouProducts, setForYouProducts] = useState([]);
    const [forYouTerm, setForYouTerm] = useState("");
    const [nearestDealEnd, setNearestDealEnd] = useState(() => _homeCache?.nearestDealEnd || null);
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const { recentlyViewed } = useRecentlyViewed();

    const heroTimer = useRef(null);

    /* ── Data fetch ── */
    useEffect(() => {
        if (_homeCache && Date.now() - _homeCache._ts < CACHE_TTL) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const [bannersRes, catsRes, homeRes, vendorsRes] = await Promise.allSettled([
                    fetchActiveBanners(),
                    fetchActiveCategories(),
                    api.get("/products/homepage"),
                    api.get("/vendor/featured?limit=4"),
                ]);
                if (cancelled) return;

                const cache = { _ts: Date.now() };

                if (bannersRes.status === "fulfilled" && bannersRes.value?.data?.length) {
                    const s = bannersRes.value.data;
                    setSlides(s); cache.slides = s;
                }

                if (catsRes.status === "fulfilled" && catsRes.value?.data?.length) {
                    const c = catsRes.value.data;
                    setCategories(c); cache.categories = c;
                }

                if (homeRes.status === "fulfilled") {
                    const d = homeRes.value.data;
                    const f = d.featured || []; const na = d.newArrivals || []; const dl = d.deals || [];
                    setFeatured(f); setNewArrivals(na); setDeals(dl);
                    cache.featured = f; cache.newArrivals = na; cache.deals = dl;
                    if (d.stats) { setStats(d.stats); cache.stats = d.stats; }
                    const dealDates = dl.map(p => p.dealEndsAt).filter(Boolean).map(d => new Date(d)).filter(d => d > new Date());
                    if (dealDates.length > 0) {
                        const nd = new Date(Math.min(...dealDates)).toISOString();
                        setNearestDealEnd(nd); cache.nearestDealEnd = nd;
                    }
                }

                if (vendorsRes.status === "fulfilled") {
                    const v = vendorsRes.value?.data?.vendors || [];
                    setVendors(v); cache.vendors = v;
                }

                _homeCache = cache;
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    /* ── For You ── */
    useEffect(() => {
        const history = getSearchHistory();
        if (history.length === 0) return;
        const term = history[0];
        setForYouTerm(term);
        api.get(`/products?search=${encodeURIComponent(term)}&productType=ecommerce&limit=8`)
            .then(r => setForYouProducts(r.data?.products || []))
            .catch(() => { });
    }, []);

    /* ── Hero autoplay ── */
    const resetTimer = useCallback(() => {
        clearInterval(heroTimer.current);
        if (slides.length > 1)
            heroTimer.current = setInterval(() => setHeroIdx(i => (i + 1) % slides.length), 5000);
    }, [slides.length]);
    useEffect(() => { resetTimer(); return () => clearInterval(heroTimer.current); }, [resetTimer]);

    const goHero = useCallback(dir => {
        setHeroIdx(i => (i + dir + slides.length) % slides.length);
        resetTimer();
    }, [slides.length, resetTimer]);

    /* ── Search ── */
    useEffect(() => {
        if (!searchQuery.trim()) { setSearchResults([]); return; }
        saveSearchTerm(searchQuery.trim());
        const ctrl = new AbortController();
        setSearching(true);
        api.get(`/products?search=${encodeURIComponent(searchQuery)}&productType=ecommerce&limit=24`, { signal: ctrl.signal })
            .then(r => setSearchResults(r.data?.products || []))
            .catch(() => { })
            .finally(() => setSearching(false));
        return () => ctrl.abort();
    }, [searchQuery]);

    /* ── Newsletter ── */
    const handleNL = async e => {
        e.preventDefault();
        if (!nlEmail.trim()) return;
        setNlStatus("sending");
        try {
            await api.post("/contact/newsletter", { email: nlEmail.trim() });
            setNlEmail("");
            setNlStatus("done");
        } catch {
            setNlStatus("error");
        }
    };

    /* ── Search view ── */
    if (searchQuery.trim()) return (
        <div className="h-root">
            <style>{CSS}</style>
            <div className="h-wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
                <div style={{ marginBottom: 20 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                        Results for &ldquo;{searchQuery}&rdquo;
                    </h1>
                    <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                        {searching ? "Searching…" : `${searchResults.length} results`}
                    </p>
                </div>
                {searching ? (
                    <div className="h-pgrid">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                ) : searchResults.length > 0 ? (
                    <div className="h-pgrid">{searchResults.map(p => <PCard key={p._id} product={p} />)}</div>
                ) : (
                    <div className="h-empty">
                        <FaSearch size={40} color="#e5e7eb" style={{ marginBottom: 14 }} />
                        <div style={{ fontWeight: 700, fontSize: 16 }}>No products found</div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-root">
            <SEO title="Premium Online Shopping" description="Shop at Urbexon for the best deals on fashion, electronics, home essentials, and more. Fast delivery across India." path="/" />
            <style>{CSS}</style>

            {/* ════ HERO ═══════════════════════════════════ */}
            {loading && slides.length === 0 ? (
                /* Skeleton hero */
                <div style={{ background: "linear-gradient(135deg, #5b5bf6, #7c3aed)", minHeight: 340, position: "relative", overflow: "hidden" }}>
                    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "60px clamp(20px,5vw,80px)" }}>
                        <div className="h-sk" style={{ width: 120, height: 20, borderRadius: 20, marginBottom: 16, background: "rgba(255,255,255,.15)" }} />
                        <div className="h-sk" style={{ width: "80%", height: 36, borderRadius: 8, marginBottom: 10, background: "rgba(255,255,255,.12)" }} />
                        <div className="h-sk" style={{ width: "50%", height: 36, borderRadius: 8, marginBottom: 20, background: "rgba(255,255,255,.12)" }} />
                        <div className="h-sk" style={{ width: 140, height: 44, borderRadius: 10, background: "rgba(255,255,255,.2)" }} />
                    </div>
                </div>
            ) : slides.length > 0 ? (
                /* ── BANNER SLIDES ── */
                <div className="h-hero">
                    {slides.map((slide, i) => {
                        const imgUrl =
                            slide.image?.url ||
                            (typeof slide.image === "string" ? slide.image : null) ||
                            "/banner-fallback.jpg";

                        return (
                            <div
                                key={slide._id}
                                className={`h-hero-slide${i === heroIdx ? " on" : ""}`}
                            >
                                {/* ── Full-cover background image ── */}
                                <img
                                    className="h-hero-slide-bg"
                                    src={imgUrl}
                                    alt={slide.title || "Banner"}
                                    loading={i === 0 ? "eager" : "lazy"}
                                />

                                {/* ── Gradient overlay for left-side text readability ── */}
                                <div className="h-hero-slide-overlay" />

                                {/* ── Text content ── */}
                                <div className="h-hero-in">
                                    <div className="h-hero-left">
                                        {slide.tag && (
                                            <div className="h-hero-tag">🔥 {slide.tag}</div>
                                        )}
                                        <h1 className="h-hero-title">
                                            {slide.title}
                                            {slide.highlight && <em>{slide.highlight}</em>}
                                        </h1>
                                        {slide.subtitle && (
                                            <p className="h-hero-desc" style={{ fontSize: "clamp(13px,1.8vw,17px)", opacity: 0.92, marginBottom: 4 }}>{slide.subtitle}</p>
                                        )}
                                        {(slide.desc || slide.description) && (
                                            <p className="h-hero-desc">{slide.desc || slide.description}</p>
                                        )}
                                        <div className="h-hero-btns">
                                            <button
                                                className="h-hero-btn-p"
                                                onClick={() => {
                                                    const target = slide.link || slide.ctaLink || "/";
                                                    if (target.startsWith("http")) window.open(target, "_blank", "noopener");
                                                    else navigate(target);
                                                }}
                                            >
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={12} />
                                            </button>
                                            {slide.secondary && (
                                                <button
                                                    className="h-hero-btn-s"
                                                    onClick={() => navigate(slide.secondaryLink || "/deals")}
                                                >
                                                    {slide.secondary}
                                                </button>
                                            )}
                                        </div>
                                        <div className="h-hero-stats">
                                            <div className="h-hero-stat">
                                                <span className="h-hero-stat-v">Fast</span>
                                                <span className="h-hero-stat-l">Delivery</span>
                                            </div>
                                            <div className="h-hero-stat">
                                                <span className="h-hero-stat-v">
                                                    {stats.products ? `${stats.products.toLocaleString()}+` : "—"}
                                                </span>
                                                <span className="h-hero-stat-l">Products</span>
                                            </div>
                                            <div className="h-hero-stat">
                                                <span className="h-hero-stat-v">{stats.categories || "—"}</span>
                                                <span className="h-hero-stat-l">Categories</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Arrows */}
                    {slides.length > 1 && (
                        <>
                            <button className="h-nav-btn l" onClick={() => goHero(-1)}>
                                <FaChevronLeft size={14} />
                            </button>
                            <button className="h-nav-btn r" onClick={() => goHero(1)}>
                                <FaChevronRight size={14} />
                            </button>
                            <div className="h-dots">
                                {slides.map((_, i) => (
                                    <button
                                        key={i}
                                        className={`h-dot${i === heroIdx ? " on" : ""}`}
                                        onClick={() => { setHeroIdx(i); resetTimer(); }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : (
                /* Fallback hero if no banners */
                !loading && (
                    <div className="h-hero" style={{ background: "linear-gradient(135deg,#5b5bf6,#7c3aed)" }}>
                        <div className="h-hero-slide on" style={{ position: "relative" }}>
                            <div className="h-hero-in">
                                <div className="h-hero-left">
                                    <h1 className="h-hero-title">
                                        Welcome to Urbexon
                                        <em>Shop the Best Deals</em>
                                    </h1>
                                    <p className="h-hero-desc">Discover amazing products from verified sellers.</p>
                                    <div className="h-hero-btns">
                                        <button className="h-hero-btn-p" onClick={() => navigate("/deals")}>
                                            Explore Deals <FaArrowRight size={12} />
                                        </button>
                                    </div>
                                    <div className="h-hero-stats">
                                        <div className="h-hero-stat">
                                            <span className="h-hero-stat-v">Fast</span>
                                            <span className="h-hero-stat-l">Delivery</span>
                                        </div>
                                        <div className="h-hero-stat">
                                            <span className="h-hero-stat-v">
                                                {stats.products ? `${stats.products.toLocaleString()}+` : "—"}
                                            </span>
                                            <span className="h-hero-stat-l">Products</span>
                                        </div>
                                        <div className="h-hero-stat">
                                            <span className="h-hero-stat-v">{stats.categories || "—"}</span>
                                            <span className="h-hero-stat-l">Categories</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-hero-right">
                                    <div className="h-hero-img-placeholder">👗</div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}

            {/* ════ URBEXON HOUR STRIP ════ */}
            <div className="h-uh-strip" onClick={() => navigate("/urbexon-hour")}>
                <div className="h-wrap">
                    <div className="h-uh-strip-inner">
                        <div className="h-uh-strip-logo">
                            <div className="h-uh-strip-icon"><FaBolt /></div>
                        </div>
                        <div className="h-uh-strip-info">
                            <span className="h-uh-strip-title">Urbexon <strong>Hour</strong></span>
                            <span className="h-uh-strip-sub">Groceries & essentials in <strong>45 min</strong></span>
                        </div>
                        <div className="h-uh-strip-right">
                            <span className="h-uh-strip-tag">FAST DELIVERY</span>
                            <FaArrowRight size={14} className="h-uh-strip-arrow" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ════ CATEGORIES (Myntra-style browser) ══════════════════════════════ */}
            {(loading || categories.length > 0) && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ════ FLASH DEALS ══════════════════════════════ */}
            {(loading || deals.length > 0) && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <div className="h-flash-banner">
                                <div className="h-flash-left">
                                    <div className="h-flash-icon"><FaBolt size={22} color="#fff" /></div>
                                    <div>
                                        <div className="h-flash-title">Lightning Deals — Limited Time!</div>
                                        <div className="h-flash-sub">Grab the best offers before they expire</div>
                                    </div>
                                </div>
                                <FlashTimer endsAt={nearestDealEnd} />
                            </div>
                            <div style={{ marginTop: 20 }}>
                                {loading ? (
                                    <div className="h-pgrid">{Array(4).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                                ) : (
                                    <div className="h-pgrid">{deals.map(p => <PCard key={p._id} product={p} />)}</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ TRENDING / FEATURED ══════════════════════ */}
            {(loading || featured.length > 0) && (
                <div style={{ background: "#f5f7fa" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title="Trending Products" sub="Most popular right now" to="/products?sort=rating" label="See all" />
                            {loading ? (
                                <div className="h-pgrid">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                            ) : (
                                <div className="h-pgrid">{featured.map(p => <PCard key={p._id} product={p} />)}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════ NEW ARRIVALS ══════════════════════════════ */}
            {(loading || newArrivals.length > 0) && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title="New Arrivals" sub="Fresh drops, just for you" to="/products?sort=newest" label="See all" />
                            {loading ? (
                                <div className="h-hscroll">{Array(6).fill(0).map((_, i) => <div key={i} style={{ minWidth: 200 }}><SkCard /></div>)}</div>
                            ) : (
                                <div className="h-hscroll">{newArrivals.map(p => <PCard key={p._id} product={p} imgH={180} />)}</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════ FEATURED SELLERS ══════════════════════════ */}
            {(loading || vendors.length > 0) && (
                <div style={{ background: "#f5f7fa" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title="Featured Sellers" sub="Shop from our top-rated and verified vendors" />
                            {loading ? (
                                <div className="h-sellers-grid">
                                    {Array(4).fill(0).map((_, i) => (
                                        <div key={i} style={{ background: "#fff", borderRadius: 14, padding: 20, border: "1px solid #e8edf2" }}>
                                            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                                                <div className="h-sk" style={{ width: 52, height: 52, borderRadius: 12, flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
                                                    <div className="h-sk" style={{ height: 14, marginBottom: 6 }} />
                                                    <div className="h-sk" style={{ height: 11, width: "60%" }} />
                                                </div>
                                            </div>
                                            <div className="h-sk" style={{ height: 36 }} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-sellers-grid">
                                    {vendors.map(v => (
                                        <div key={v._id} className="h-seller-card"
                                            onClick={() => navigate(`/vendor/${v.shopSlug || v._id}`)}>
                                            <div className="h-seller-top">
                                                <div className="h-seller-av">
                                                    {v.shopLogo
                                                        ? <img src={v.shopLogo} alt={v.shopName} loading="lazy" />
                                                        : v.shopName?.[0]?.toUpperCase() || "S"}
                                                </div>
                                                <div>
                                                    <div className="h-seller-name">{v.shopName}</div>
                                                    <div className="h-seller-rat">
                                                        <FaStar size={11} color="#f59e0b" />
                                                        {(v.rating || 0).toFixed(1)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="h-seller-stats">
                                                <div className="h-seller-stat">
                                                    <b>{v.totalOrders || 0}</b>Products
                                                </div>
                                                <div className="h-seller-stat">
                                                    <b className="h-seller-sales">{v.totalOrders ? `${v.totalOrders}+` : "0"}</b>Total Sales
                                                </div>
                                            </div>
                                            <button className="h-visit-btn">Visit Store</button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ════ FOR YOU ═══════════════════════════════════ */}
            {forYouProducts.length > 0 && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title={`Based on "${forYouTerm}"`} sub="Products picked for you" to={`/?search=${encodeURIComponent(forYouTerm)}`} label="See all" />
                            <div className="h-hscroll">
                                {forYouProducts.map(p => <PCard key={p._id} product={p} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ RECENTLY VIEWED ═══════════════════════════ */}
            {recentlyViewed.length > 0 && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title="Recently Viewed" sub="Continue where you left off" />
                            <div className="h-hscroll">
                                {recentlyViewed.slice(0, 12).map(p => (
                                    <PCard key={p._id} product={p} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ════ WHY CHOOSE ════════════════════════════════ */}
            <div className="h-why">
                <div className="h-wrap">
                    <div className="h-sec" style={{ textAlign: "center" }}>
                        <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
                            Why Choose Urbexon?
                        </h2>
                        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>
                            Your trusted partner for online shopping
                        </p>
                        <div className="h-why-grid">
                            {WHY_FEATURES.map(f => (
                                <div key={f.label} className="h-why-card">
                                    <div className="h-why-icon" style={{ background: f.color }}>
                                        <span style={{ fontSize: 26 }}>{f.icon}</span>
                                    </div>
                                    <div className="h-why-title">{f.label}</div>
                                    <div className="h-why-sub">{f.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ════ NEWSLETTER ════════════════════════════════ */}
            <div className="h-newsletter">
                <div className="h-wrap" style={{ maxWidth: 640, textAlign: "center" }}>
                    <div className="h-nl-icon">✉️</div>
                    <h3 className="h-nl-title">Subscribe to our Newsletter</h3>
                    <p className="h-nl-sub">Get the latest deals and offers delivered to your inbox</p>
                    {nlStatus === "done" ? (
                        <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>✅ Successfully subscribed!</p>
                    ) : (
                        <form className="h-nl-form" onSubmit={handleNL}>
                            <input
                                className="h-nl-inp"
                                type="email"
                                value={nlEmail}
                                onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                placeholder="Enter your email"
                                required
                            />
                            <button type="submit" className="h-nl-btn" disabled={nlStatus === "sending"}>
                                {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                            </button>
                        </form>
                    )}
                    {nlStatus === "error" && (
                        <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>Failed to subscribe. Try again.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Home;