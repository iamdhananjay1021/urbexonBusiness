/**
 * Home.jsx — Urbexon Production v4.1
 * ✅ Categories: only ecommerce (UH categories filtered out)
 * ✅ Deals section: fixed layout + improved UI
 * ✅ Full production-ready polish
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
    FaArrowRight, FaBolt, FaStar, FaChevronLeft, FaChevronRight,
    FaSearch, FaHeart, FaRegHeart, FaStore, FaThLarge, FaTag,
    FaShippingFast, FaLock, FaMedal, FaHeadset,
} from "react-icons/fa";

/* ─────────────────────────────────────────────
   SEARCH HISTORY
───────────────────────────────────────────── */
const SEARCH_HISTORY_KEY = "ux_search_history";
const getSearchHistory = () => {
    try { return JSON.parse(localStorage.getItem(SEARCH_HISTORY_KEY)) || []; }
    catch { return []; }
};
const saveSearchTerm = (term) => {
    if (!term?.trim()) return;
    const t = term.trim();
    const hist = getSearchHistory().filter(h => h.toLowerCase() !== t.toLowerCase());
    hist.unshift(t);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(hist.slice(0, 15)));
};

/* ─────────────────────────────────────────────
   UTILS
───────────────────────────────────────────── */
const imgSrc = p =>
    p?.images?.[0]?.url ||
    (typeof p?.image === "string" ? p.image : p?.image?.url) || "";

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const disc = p =>
    p?.mrp && p.mrp > p.price
        ? Math.round(((p.mrp - p.price) / p.mrp) * 100)
        : 0;

/* ─────────────────────────────────────────────
   MODULE-LEVEL CACHE
───────────────────────────────────────────── */
let _homeCache = null;
const CACHE_TTL = 3 * 60 * 1000;

/* ─────────────────────────────────────────────
   CSS
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');

.h-root, .h-root *, .h-root *::before, .h-root *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}

@keyframes h-shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
@keyframes h-up       { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
@keyframes h-blink    { 0%,49%,100%{opacity:1} 50%,99%{opacity:.35} }
@keyframes h-pulse    { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
@keyframes h-spin     { to { transform: rotate(360deg); } }
@keyframes h-fadein   { from{opacity:0} to{opacity:1} }

.h-root {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f5f7fa;
  color: #111827;
  overflow-x: hidden;
}

/* ── Skeleton ── */
.h-sk {
  background: linear-gradient(90deg,#ececec 25%,#e4e4e4 50%,#ececec 75%);
  background-size: 200% 100%;
  animation: h-shimmer 1.4s infinite;
  border-radius: 6px;
}

/* ── Layout ── */
.h-wrap { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px,4vw,60px); }
.h-sec  { padding: 44px 0; }

/* ── Section header ── */
.h-sec-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  margin-bottom: 24px; gap: 12px; flex-wrap: wrap;
}
.h-sec-title {
  font-size: clamp(17px,2.4vw,24px); font-weight: 800; color: #0f172a;
  display: flex; align-items: center; gap: 9px;
}
.h-sec-sub { font-size: 13px; color: #64748b; margin-top: 3px; font-weight: 500; }
.h-view-all {
  font-size: 12px; font-weight: 700; color: #4f46e5;
  text-decoration: none; display: flex; align-items: center; gap: 4px;
  white-space: nowrap; padding: 6px 14px; border-radius: 20px;
  border: 1.5px solid #e0e7ff; background: #eef2ff;
  transition: all .15s;
}
.h-view-all:hover { background: #4f46e5; color: #fff; border-color: #4f46e5; gap: 7px; }

/* ══════════════════════════════════════════
   HERO
══════════════════════════════════════════ */
.h-hero {
  position: relative; overflow: hidden;
  min-height: 420px; width: 100%;
}
@media(min-width:768px){ .h-hero { min-height: 520px; } }

.h-hero-slide {
  position: absolute; inset: 0;
  width: 100%; height: 100%; min-height: 420px;
  display: none; align-items: center;
}
.h-hero-slide.on { display: flex; }

.h-hero-bg {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; object-position: center; z-index: 0;
}
.h-hero-overlay {
  position: absolute; inset: 0;
  background: linear-gradient(105deg,rgba(0,0,0,.68) 0%,rgba(0,0,0,.28) 58%,rgba(0,0,0,.04) 100%);
  z-index: 1;
}
.h-hero-body {
  max-width: 1280px; margin: 0 auto;
  padding: 60px clamp(20px,5vw,80px);
  display: flex; align-items: center;
  justify-content: space-between; gap: 40px;
  position: relative; z-index: 2;
  width: 100%; flex-wrap: wrap; min-height: 420px;
}
@media(min-width:768px){ .h-hero-body { min-height: 520px; } }

.h-hero-left { flex: 1; min-width: 0; animation: h-up .5s ease; }
@media(max-width:767px){ .h-hero-left { min-width: 100%; } }

.h-hero-tag {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 14px; border-radius: 20px;
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.28);
  font-size: 11px; font-weight: 700; color: #fff;
  letter-spacing: .6px; margin-bottom: 16px;
  backdrop-filter: blur(4px);
}
.h-hero-title {
  font-size: clamp(26px,5vw,60px);
  font-weight: 900; line-height: 1.06;
  color: #fff; margin-bottom: 14px; letter-spacing: -.5px;
}
.h-hero-title em { color: #fbbf24; font-style: normal; display: block; }
.h-hero-desc {
  font-size: 15px; color: rgba(255,255,255,.85);
  line-height: 1.7; margin-bottom: 28px; max-width: 460px;
}
@media(max-width:600px){ .h-hero-desc { display: none; } }

.h-hero-btns { display: flex; gap: 12px; flex-wrap: wrap; }
.h-hero-btn-p {
  padding: 13px 28px; border: none; border-radius: 10px;
  background: #fff; color: #4f46e5;
  font-size: 14px; font-weight: 800; cursor: pointer;
  display: flex; align-items: center; gap: 8px;
  transition: all .2s; font-family: inherit;
  box-shadow: 0 4px 20px rgba(0,0,0,.2);
}
.h-hero-btn-p:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(0,0,0,.25); }
.h-hero-btn-s {
  padding: 13px 24px; border: 1.5px solid rgba(255,255,255,.5);
  background: rgba(255,255,255,.1); color: #fff;
  font-size: 14px; font-weight: 600; cursor: pointer; border-radius: 10px;
  transition: all .2s; font-family: inherit; backdrop-filter: blur(4px);
}
.h-hero-btn-s:hover { background: rgba(255,255,255,.22); }

.h-hero-stats { display: flex; gap: 10px; margin-top: 28px; flex-wrap: wrap; }
.h-hero-stat {
  background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.22);
  border-radius: 10px; padding: 10px 16px;
  display: flex; flex-direction: column; backdrop-filter: blur(8px);
}
.h-hero-stat-v { font-size: 18px; font-weight: 800; color: #fff; }
.h-hero-stat-l { font-size: 10px; color: rgba(255,255,255,.7); font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }

.h-nav-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  z-index: 10; width: 40px; height: 40px; border-radius: 50%;
  background: rgba(255,255,255,.92); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 16px rgba(0,0,0,.18); transition: all .18s; color: #374151;
}
.h-nav-btn:hover { background: #fff; transform: translateY(-50%) scale(1.06); }
.h-nav-btn.l { left: 16px; }
.h-nav-btn.r { right: 16px; }
@media(max-width:600px){ .h-nav-btn { display: none; } }

.h-dots {
  position: absolute; bottom: 18px; left: 50%;
  transform: translateX(-50%); display: flex; gap: 6px; z-index: 5;
}
.h-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(255,255,255,.38); border: none; cursor: pointer; padding: 0;
  transition: all .3s;
}
.h-dot.on { background: #fff; width: 22px; border-radius: 4px; }

/* ══════════════════════════════════════════
   UH STRIP
══════════════════════════════════════════ */
.h-uh-strip {
  background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
  cursor: pointer; transition: filter .25s; position: relative;
  overflow: hidden; border-bottom: 3px solid #3b82f6;
}
.h-uh-strip::before {
  content: ''; position: absolute; inset: 0;
  background: radial-gradient(circle at 10% 50%, rgba(59,130,246,.15) 0%, transparent 60%);
  pointer-events: none;
}
.h-uh-strip:hover { filter: brightness(1.07); }
.h-uh-inner {
  display: flex; align-items: center; gap: 16px;
  padding: 14px 0; position: relative; z-index: 2;
}
.h-uh-icon {
  width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  display: flex; align-items: center; justify-content: center;
  color: #fbbf24; font-size: 18px;
  box-shadow: 0 4px 14px rgba(59,130,246,.3);
}
.h-uh-info { flex: 1; min-width: 0; }
.h-uh-title { font-size: 15px; color: #fff; font-weight: 500; line-height: 1.3; }
.h-uh-title strong { font-weight: 800; color: #60a5fa; }
.h-uh-sub { font-size: 12px; color: rgba(255,255,255,.6); font-weight: 500; }
.h-uh-sub strong { color: #34d399; font-weight: 700; }
.h-uh-tag {
  background: rgba(59,130,246,.18); border: 1px solid rgba(59,130,246,.32);
  padding: 5px 12px; border-radius: 20px;
  font-size: 10px; font-weight: 800; color: #60a5fa;
  letter-spacing: .8px; white-space: nowrap; flex-shrink: 0;
}
.h-uh-arrow { color: rgba(255,255,255,.45); transition: transform .2s, color .2s; flex-shrink: 0; }
.h-uh-strip:hover .h-uh-arrow { transform: translateX(4px); color: #fff; }
@media(max-width:640px){
  .h-uh-tag { display: none; }
  .h-uh-title { font-size: 13px; }
  .h-uh-icon { width: 36px; height: 36px; font-size: 15px; }
}

/* ══════════════════════════════════════════
   PRODUCT CARD
══════════════════════════════════════════ */
.h-pcard {
  background: #fff; border: 1px solid #e8edf2;
  border-radius: 14px; overflow: hidden; cursor: pointer;
  transition: transform .22s, box-shadow .22s, border-color .22s;
  position: relative; display: flex; flex-direction: column;
}
.h-pcard:hover {
  transform: translateY(-5px);
  box-shadow: 0 14px 36px rgba(0,0,0,.09);
  border-color: #d1d5db;
}

.h-pimg {
  position: relative; overflow: hidden;
  background: #f8fafc;
  height: clamp(160px,22vw,220px);
}
@media(min-width:900px){ .h-pimg { height: 200px; } }

.h-pimg img {
  width: 100%; height: 100%; object-fit: cover;
  transition: transform .42s; display: block;
}
.h-pcard:hover .h-pimg img { transform: scale(1.06); }
.h-pimg-empty {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 44px; background: #f8fafc;
}

.h-badge-disc {
  position: absolute; top: 10px; left: 10px;
  background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff;
  font-size: 10px; font-weight: 800;
  padding: 3px 8px; border-radius: 6px;
  box-shadow: 0 2px 8px rgba(239,68,68,.3);
}
.h-badge-express {
  position: absolute; bottom: 8px; left: 8px;
  background: linear-gradient(135deg,#ff4500,#ff6b35); color: #fff;
  font-size: 9px; font-weight: 800;
  padding: 3px 9px; border-radius: 10px;
  display: flex; align-items: center; gap: 4px;
}
.h-badge-oos {
  position: absolute; inset: 0;
  background: rgba(255,255,255,.78);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: #6b7280;
  letter-spacing: 1px; text-transform: uppercase;
}

.h-wish-btn {
  position: absolute; top: 8px; right: 8px;
  width: 32px; height: 32px; border-radius: 50%;
  background: rgba(255,255,255,.95); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,.1);
  opacity: 0; transition: opacity .18s, transform .18s;
}
.h-pcard:hover .h-wish-btn { opacity: 1; }
.h-wish-btn:hover { transform: scale(1.12); }
@media(max-width:768px){ .h-wish-btn { opacity: 1; width: 28px; height: 28px; } }

.h-pbody { padding: 13px; flex: 1; display: flex; flex-direction: column; }
.h-pbrand { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 3px; }
.h-pname {
  font-size: 13px; color: #334155; line-height: 1.4; margin-bottom: 8px; flex: 1;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  font-weight: 500;
}
.h-prating { display: flex; align-items: center; gap: 5px; margin-bottom: 8px; }
.h-prat-badge {
  background: #0d9488; color: #fff;
  font-size: 10px; font-weight: 700;
  padding: 2px 6px; border-radius: 5px;
  display: flex; align-items: center; gap: 3px;
}
.h-prat-cnt { font-size: 11px; color: #94a3b8; }
.h-pprices { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin-bottom: 10px; }
.h-pprice  { font-size: 16px; font-weight: 800; color: #0f172a; }
.h-pmrp    { font-size: 12px; color: #94a3b8; text-decoration: line-through; }
.h-poff    { font-size: 11px; font-weight: 700; color: #16a34a; }

.h-add-btn {
  width: 100%; padding: 9px 0; font-size: 11px; font-weight: 700;
  border-radius: 8px; cursor: pointer; border: none;
  transition: all .18s; font-family: inherit;
  text-transform: uppercase; letter-spacing: .5px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
.h-add-btn.default { background: #f8fafc; color: #475569; border: 1.5px solid #e2e8f0; }
.h-add-btn.default:hover { background: #4f46e5; color: #fff; border-color: #4f46e5; }
.h-add-btn.added   { background: #4f46e5; color: #fff; }
.h-add-btn.incart  { background: #f0fdf4; color: #16a34a; border: 1.5px solid #86efac; }
.h-add-btn.oos     { background: #f8fafc; color: #94a3b8; border: 1.5px solid #e2e8f0; cursor: not-allowed; }

/* ── Product grid ── */
.h-pgrid {
  display: grid; gap: 10px;
  grid-template-columns: repeat(2, 1fr);
}
@media(min-width:520px) { .h-pgrid { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
@media(min-width:900px) { .h-pgrid { grid-template-columns: repeat(4, 1fr); } }
@media(min-width:1200px){ .h-pgrid { grid-template-columns: repeat(5, 1fr); } }

/* ── Horizontal scroll ── */
.h-hscroll {
  display: flex; gap: 14px; overflow-x: auto;
  padding-bottom: 8px; scrollbar-width: none;
}
.h-hscroll::-webkit-scrollbar { display: none; }
.h-hscroll .h-pcard { min-width: 200px; flex-shrink: 0; }
@media(max-width:600px){ .h-hscroll .h-pcard { min-width: 162px; } }

/* ══════════════════════════════════════════
   ALL PRODUCTS SECTION
══════════════════════════════════════════ */
.h-allprod-section { background: #fff; border-top: 1px solid #e8edf2; }

.h-filter-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 22px; }
.h-filter-chip {
  padding: 7px 16px; border-radius: 20px;
  font-size: 12px; font-weight: 700;
  border: 1.5px solid #e2e8f0; background: #fff; color: #475569;
  cursor: pointer; transition: all .15s; font-family: inherit;
  white-space: nowrap;
}
.h-filter-chip:hover  { border-color: #4f46e5; color: #4f46e5; background: #eef2ff; }
.h-filter-chip.active { background: #4f46e5; color: #fff; border-color: #4f46e5; }

.h-show-more-btn {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  width: 100%; max-width: 300px; margin: 32px auto 0;
  padding: 13px 28px; border-radius: 12px;
  background: #fff; border: 2px solid #4f46e5; color: #4f46e5;
  font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit;
  transition: all .2s; letter-spacing: .3px;
}
.h-show-more-btn:hover {
  background: #4f46e5; color: #fff;
  box-shadow: 0 8px 24px rgba(79,70,229,.28);
  transform: translateY(-1px);
}
.h-show-more-btn:disabled { opacity: .55; cursor: not-allowed; transform: none; box-shadow: none; }

.h-allprod-cta { display: flex; align-items: center; justify-content: center; margin-top: 28px; }
.h-allprod-cta-btn {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 34px; border-radius: 12px;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: #fff; font-size: 15px; font-weight: 800;
  text-decoration: none; letter-spacing: .3px;
  box-shadow: 0 8px 24px rgba(79,70,229,.3);
  transition: all .2s;
}
.h-allprod-cta-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(79,70,229,.4); }

/* ══════════════════════════════════════════
   FLASH DEALS — FIXED
══════════════════════════════════════════ */
.h-deals-section { background: #fafafa; border-top: 1px solid #e8edf2; }

/* Banner card */
.h-flash-banner {
  background: linear-gradient(120deg, #ff4500 0%, #ff6b35 45%, #ff8c42 100%);
  border-radius: 18px; padding: 24px 28px;
  display: flex; align-items: center; justify-content: space-between;
  gap: 16px; flex-wrap: wrap; position: relative; overflow: hidden;
  box-shadow: 0 10px 36px rgba(255,69,0,.22);
  margin-bottom: 28px;
}
.h-flash-banner::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(circle at 15% 60%,rgba(255,255,255,.15) 0%,transparent 45%),
              radial-gradient(circle at 85% 20%,rgba(255,255,255,.08) 0%,transparent 40%);
}
.h-flash-banner::after {
  content: '⚡'; position: absolute; right: -8px; top: -18px;
  font-size: 160px; opacity: .06; line-height: 1;
  pointer-events: none; user-select: none;
}
.h-flash-left {
  display: flex; align-items: center; gap: 16px;
  position: relative; z-index: 2;
}
.h-flash-icon {
  width: 52px; height: 52px; flex-shrink: 0;
  background: rgba(255,255,255,.22); border: 2px solid rgba(255,255,255,.28);
  border-radius: 14px; display: flex; align-items: center; justify-content: center;
  animation: h-pulse 2.2s ease-in-out infinite;
  font-size: 22px;
}
.h-flash-text { }
.h-flash-title { font-size: 20px; font-weight: 900; color: #fff; margin-bottom: 3px; letter-spacing: -.3px; }
.h-flash-sub   { font-size: 13px; color: rgba(255,255,255,.88); font-weight: 500; }

.h-flash-right {
  display: flex; align-items: center; gap: 12px;
  position: relative; z-index: 2; flex-shrink: 0; flex-wrap: wrap;
}
.h-flash-label {
  font-size: 11px; font-weight: 800; color: rgba(255,255,255,.8);
  letter-spacing: .8px; text-transform: uppercase;
}
.h-flash-timer {
  display: flex; gap: 6px; align-items: center;
  background: rgba(0,0,0,.22); backdrop-filter: blur(8px);
  padding: 10px 14px; border-radius: 12px;
  border: 1px solid rgba(255,255,255,.12);
}
.h-time-box {
  background: rgba(0,0,0,.25); border: 1px solid rgba(255,255,255,.12);
  border-radius: 8px; padding: 6px 11px; text-align: center; min-width: 46px;
}
.h-time-val { font-size: 19px; font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; }
.h-time-lbl { font-size: 8px; color: rgba(255,255,255,.65); margin-top: 2px; font-weight: 700; letter-spacing: .5px; }
.h-colon    { font-size: 20px; font-weight: 900; color: rgba(255,255,255,.65); animation: h-blink 1s infinite; }

@media(max-width:768px){
  .h-flash-banner { padding: 18px 20px; }
  .h-flash-title { font-size: 17px; }
  .h-flash-icon { width: 44px; height: 44px; font-size: 18px; }
}
@media(max-width:540px){
  .h-flash-banner { flex-direction: column; align-items: flex-start; gap: 14px; }
  .h-flash-right { width: 100%; }
  .h-flash-timer { width: 100%; justify-content: center; }
}

/* Deal product badge */
.h-deal-badge {
  position: absolute; top: 10px; left: 10px;
  background: linear-gradient(135deg, #ff4500, #ff6b35); color: #fff;
  font-size: 9px; font-weight: 800; padding: 3px 8px;
  border-radius: 6px; display: flex; align-items: center; gap: 3px;
  box-shadow: 0 2px 8px rgba(255,69,0,.35);
}

/* ══════════════════════════════════════════
   WHY CHOOSE
══════════════════════════════════════════ */
.h-why { background: #fff; border-top: 1px solid #e8edf2; }
.h-why-grid {
  display: grid; gap: 14px; grid-template-columns: repeat(2, 1fr);
}
@media(min-width:700px){ .h-why-grid { grid-template-columns: repeat(4, 1fr); } }

.h-why-card {
  background: #f8fafc; border: 1.5px solid #e8edf2;
  border-radius: 16px; padding: 26px 20px; text-align: center;
  transition: all .22s;
}
.h-why-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 28px rgba(0,0,0,.07);
  border-color: #c7d2fe;
  background: #fff;
}
.h-why-icon {
  width: 58px; height: 58px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px; font-size: 22px;
}
.h-why-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 5px; }
.h-why-sub   { font-size: 12px; color: #64748b; line-height: 1.5; font-weight: 500; }

/* ══════════════════════════════════════════
   NEWSLETTER
══════════════════════════════════════════ */
.h-newsletter { background: #0f172a; padding: 52px 0; }
.h-nl-inner { text-align: center; max-width: 520px; margin: 0 auto; }
.h-nl-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 700;
  background: rgba(79,70,229,.25); color: #818cf8;
  border: 1px solid rgba(79,70,229,.3); margin-bottom: 14px; letter-spacing: .5px;
}
.h-nl-title { font-size: 22px; font-weight: 800; color: #f8fafc; margin-bottom: 6px; }
.h-nl-sub   { font-size: 14px; color: #64748b; margin-bottom: 24px; line-height: 1.6; }
.h-nl-form  {
  display: flex; border-radius: 12px; overflow: hidden;
  border: 1.5px solid #1e293b; width: 100%;
  background: #1e293b;
}
.h-nl-inp {
  flex: 1; padding: 13px 18px;
  border: none; outline: none; font-size: 14px; color: #f1f5f9; font-family: inherit;
  background: transparent;
}
.h-nl-inp::placeholder { color: #475569; }
.h-nl-btn {
  padding: 13px 22px; background: #4f46e5; border: none;
  color: #fff; font-size: 13px; font-weight: 800;
  cursor: pointer; font-family: inherit; transition: background .18s; white-space: nowrap;
}
.h-nl-btn:hover { background: #4338ca; }
@media(max-width:480px){
  .h-nl-form { flex-direction: column; }
  .h-nl-btn { border-radius: 0 0 10px 10px; }
}

/* ── Empty / Spinner ── */
.h-empty { text-align: center; padding: 72px 0; color: #94a3b8; }
.h-spinner {
  width: 20px; height: 20px; border-radius: 50%;
  border: 3px solid rgba(79,70,229,.2); border-top-color: #4f46e5;
  animation: h-spin .7s linear infinite; display: inline-block;
}

/* ── Divider strip ── */
.h-divider {
  height: 6px;
  background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%);
}
`;

/* ─────────────────────────────────────────────
   SKELETON CARD
───────────────────────────────────────────── */
const SkCard = () => (
    <div style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e8edf2" }}>
        <div className="h-sk" style={{ height: 200 }} />
        <div style={{ padding: 13 }}>
            <div className="h-sk" style={{ height: 9, width: "32%", marginBottom: 7 }} />
            <div className="h-sk" style={{ height: 12, marginBottom: 5 }} />
            <div className="h-sk" style={{ height: 12, width: "78%", marginBottom: 12 }} />
            <div className="h-sk" style={{ height: 16, width: "42%", marginBottom: 10 }} />
            <div className="h-sk" style={{ height: 34 }} />
        </div>
    </div>
);

/* ─────────────────────────────────────────────
   FLASH TIMER
───────────────────────────────────────────── */
const FlashTimer = ({ endsAt }) => {
    const calc = useCallback(() => {
        const now = Date.now();
        const end = endsAt ? new Date(endsAt).getTime() : (() => {
            const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
        })();
        const diff = Math.max(0, end - now);
        return {
            h: Math.floor(diff / 3600000),
            m: Math.floor((diff % 3600000) / 60000),
            s: Math.floor((diff % 60000) / 1000),
        };
    }, [endsAt]);

    const [t, setT] = useState(calc);
    useEffect(() => {
        const id = setInterval(() => setT(calc()), 1000);
        return () => clearInterval(id);
    }, [calc]);

    const pad = n => String(n).padStart(2, "0");
    return (
        <div className="h-flash-timer">
            {[{ v: t.h, l: "HR" }, { v: t.m, l: "MIN" }, { v: t.s, l: "SEC" }].map(({ v, l }, i) => (
                <div key={l} style={{ display: "contents" }}>
                    <div className="h-time-box">
                        <div className="h-time-val">{pad(v)}</div>
                        <div className="h-time-lbl">{l}</div>
                    </div>
                    {i < 2 && <span className="h-colon">:</span>}
                </div>
            ))}
        </div>
    );
};

/* ─────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────── */
const SecHead = ({ title, sub, to, label = "View All", icon }) => (
    <div className="h-sec-head">
        <div>
            <h2 className="h-sec-title">
                {icon && icon}
                {title}
            </h2>
            {sub && <p className="h-sec-sub">{sub}</p>}
        </div>
        {to && (
            <Link to={to} className="h-view-all">
                {label} <FaArrowRight size={10} />
            </Link>
        )}
    </div>
);

/* ─────────────────────────────────────────────
   WHY FEATURES
───────────────────────────────────────────── */
const WHY = [
    { Icon: FaShippingFast, label: "Fast Delivery", sub: "Free shipping on orders over ₹499", bg: "#eff6ff", iconColor: "#3b82f6" },
    { Icon: FaLock, label: "Secure Payment", sub: "100% secure & encrypted transactions", bg: "#f0fdf4", iconColor: "#16a34a" },
    { Icon: FaMedal, label: "Quality Products", sub: "Verified & authentic items only", bg: "#fefce8", iconColor: "#d97706" },
    { Icon: FaHeadset, label: "24/7 Support", sub: "Dedicated customer service team", bg: "#fdf4ff", iconColor: "#9333ea" },
];

/* ─────────────────────────────────────────────
   PRODUCT CARD
───────────────────────────────────────────── */
const PCard = memo(({ product, showDealBadge = false }) => {
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

    const btnClass = isOOS ? "oos" : (inCart || flash) ? (flash ? "added" : "incart") : "default";
    const btnText = isOOS ? "Out of Stock" : inCart ? "✓ In Cart" : flash ? "Added!" : isUH ? "⚡ Express" : "+ Add to Cart";

    return (
        <div className="h-pcard" onClick={() => navigate(`/products/${product.slug || product._id}`)}>
            <div className="h-pimg">
                {img
                    ? <img src={img} alt={product.name} loading="lazy" />
                    : <div className="h-pimg-empty">🛍️</div>
                }
                {/* Deal badge takes priority over normal discount badge */}
                {showDealBadge && d > 0 && (
                    <div className="h-deal-badge"><FaBolt size={8} /> DEAL</div>
                )}
                {!showDealBadge && d > 0 && (
                    <div className="h-badge-disc">{d}% OFF</div>
                )}
                {isUH && <div className="h-badge-express"><FaBolt size={8} /> EXPRESS</div>}
                {isOOS && <div className="h-badge-oos">Out of Stock</div>}
                <button className="h-wish-btn" onClick={handleWish} aria-label="Wishlist">
                    {inWishlist
                        ? <FaHeart size={13} color="#ef4444" />
                        : <FaRegHeart size={13} color="#94a3b8" />
                    }
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

/* ─────────────────────────────────────────────
   ALL PRODUCTS SECTION
───────────────────────────────────────────── */
const ALL_SORT_OPTIONS = [
    { key: "newest", label: "New Arrivals" },
    { key: "rating", label: "Top Rated" },
    { key: "price_asc", label: "Price: Low → High" },
    { key: "price_desc", label: "Price: High → Low" },
    { key: "discount", label: "Best Deals" },
];
const PAGE_SIZE = 20;

const AllProductsSection = () => {
    const navigate = useNavigate();
    const [sort, setSort] = useState("newest");
    const [products, setProducts] = useState([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setProducts([]);
        setPage(1);
        setHasMore(true);

        api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=1`)
            .then(r => {
                if (cancelled) return;
                const list = r.data?.products || [];
                setProducts(list);
                setHasMore(list.length === PAGE_SIZE);
            })
            .catch(() => { })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
    }, [sort]);

    const loadMore = useCallback(async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        try {
            const r = await api.get(`/products?sort=${sort}&productType=ecommerce&limit=${PAGE_SIZE}&page=${nextPage}`);
            const list = r.data?.products || [];
            setProducts(prev => [...prev, ...list]);
            setPage(nextPage);
            setHasMore(list.length === PAGE_SIZE);
        } catch { }
        finally { setLoadingMore(false); }
    }, [sort, page, loadingMore, hasMore]);

    return (
        <div className="h-allprod-section">
            <div className="h-wrap">
                <div className="h-sec">
                    <div className="h-sec-head">
                        <div>
                            <h2 className="h-sec-title">
                                <FaThLarge size={18} color="#4f46e5" />
                                All Products
                            </h2>
                            <p className="h-sec-sub">Browse our complete catalog</p>
                        </div>
                        <Link to="/products" className="h-view-all">
                            Full Catalog <FaArrowRight size={10} />
                        </Link>
                    </div>

                    <div className="h-filter-bar">
                        {ALL_SORT_OPTIONS.map(o => (
                            <button
                                key={o.key}
                                className={`h-filter-chip${sort === o.key ? " active" : ""}`}
                                onClick={() => setSort(o.key)}
                            >
                                {o.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="h-pgrid">
                            {Array(PAGE_SIZE).fill(0).map((_, i) => <SkCard key={i} />)}
                        </div>
                    ) : products.length > 0 ? (
                        <div className="h-pgrid">
                            {products.map(p => <PCard key={p._id} product={p} />)}
                        </div>
                    ) : (
                        <div className="h-empty">
                            <FaStore size={36} color="#e2e8f0" style={{ marginBottom: 12 }} />
                            <div style={{ fontWeight: 700, fontSize: 15 }}>No products found</div>
                        </div>
                    )}

                    {!loading && hasMore && (
                        <button className="h-show-more-btn" onClick={loadMore} disabled={loadingMore}>
                            {loadingMore
                                ? <><span className="h-spinner" /> Loading…</>
                                : <><FaArrowRight size={12} /> Load More Products</>
                            }
                        </button>
                    )}

                    {!loading && products.length > 0 && (
                        <div className="h-allprod-cta">
                            <Link to="/products" className="h-allprod-cta-btn">
                                <FaStore size={15} />
                                Shop All Products
                                <FaArrowRight size={12} />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   FLASH DEALS SECTION (fixed, standalone)
───────────────────────────────────────────── */
const FlashDealsSection = ({ deals, loading, nearestDealEnd }) => {
    if (!loading && deals.length === 0) return null;

    return (
        <div className="h-deals-section">
            <div className="h-wrap">
                <div className="h-sec">
                    {/* Section header */}
                    <SecHead
                        title="Lightning Deals"
                        sub="Limited-time offers — grab them before they expire"
                        to="/deals"
                        label="All Deals"
                        icon={<FaBolt size={16} color="#ff4500" />}
                    />

                    {/* Flash banner */}
                    <div className="h-flash-banner">
                        <div className="h-flash-left">
                            <div className="h-flash-icon">⚡</div>
                            <div className="h-flash-text">
                                <div className="h-flash-title">Flash Sale Live Now!</div>
                                <div className="h-flash-sub">Massive discounts · Limited stock · Don't miss out</div>
                            </div>
                        </div>
                        <div className="h-flash-right">
                            <div className="h-flash-label">Ends in</div>
                            <FlashTimer endsAt={nearestDealEnd} />
                        </div>
                    </div>

                    {/* Products */}
                    {loading ? (
                        <div className="h-pgrid">
                            {Array(8).fill(0).map((_, i) => <SkCard key={i} />)}
                        </div>
                    ) : (
                        <div className="h-pgrid">
                            {deals.map(p => <PCard key={p._id} product={p} showDealBadge />)}
                        </div>
                    )}

                    {/* View all deals CTA */}
                    {!loading && deals.length > 0 && (
                        <div style={{ textAlign: "center", marginTop: 28 }}>
                            <Link
                                to="/deals"
                                style={{
                                    display: "inline-flex", alignItems: "center", gap: 8,
                                    padding: "12px 28px", borderRadius: 10,
                                    background: "linear-gradient(135deg,#ff4500,#ff6b35)",
                                    color: "#fff", fontWeight: 800, fontSize: 14,
                                    textDecoration: "none", letterSpacing: ".3px",
                                    boxShadow: "0 6px 20px rgba(255,69,0,.28)",
                                    transition: "all .2s",
                                }}
                            >
                                <FaTag size={13} />
                                View All Deals
                                <FaArrowRight size={12} />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ─────────────────────────────────────────────
   HOME
───────────────────────────────────────────── */
const Home = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const searchQuery = searchParams.get("search") || "";

    const [heroIdx, setHeroIdx] = useState(0);
    const [slides, setSlides] = useState(() => _homeCache?.slides || []);

    // ✅ FIX: Only ecommerce categories (filter out UH)
    const [categories, setCategories] = useState(() =>
        (_homeCache?.categories || []).filter(c =>
            c.productType !== "urbexon_hour" && c.type !== "urbexon_hour" && !c.isUrbexonHour
        )
    );

    const [featured, setFeatured] = useState(() => _homeCache?.featured || []);
    const [newArrivals, setNewArrivals] = useState(() => _homeCache?.newArrivals || []);
    const [deals, setDeals] = useState(() => _homeCache?.deals || []);
    const [stats, setStats] = useState(() => _homeCache?.stats || { products: 0, categories: 0 });
    const [nearestDealEnd, setNearestDealEnd] = useState(() => _homeCache?.nearestDealEnd || null);
    const [loading, setLoading] = useState(() => !_homeCache || Date.now() - (_homeCache?._ts || 0) > CACHE_TTL);
    const [nlEmail, setNlEmail] = useState("");
    const [nlStatus, setNlStatus] = useState("");
    const [forYouProducts, setForYouProducts] = useState([]);
    const [forYouTerm, setForYouTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const heroTimer = useRef(null);
    const { recentlyViewed } = useRecentlyViewed();

    /* ── Fetch homepage data ── */
    useEffect(() => {
        if (_homeCache && Date.now() - _homeCache._ts < CACHE_TTL) {
            setLoading(false); return;
        }
        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const [bannersRes, catsRes, homeRes] = await Promise.allSettled([
                    fetchActiveBanners(),
                    // ✅ FIX: Pass type=ecommerce to API (server-side filter)
                    fetchActiveCategories({ type: "ecommerce" }),
                    api.get("/products/homepage"),
                ]);
                if (cancelled) return;

                const cache = { _ts: Date.now() };

                if (bannersRes.status === "fulfilled" && bannersRes.value?.data?.length) {
                    const s = bannersRes.value.data; setSlides(s); cache.slides = s;
                }

                if (catsRes.status === "fulfilled" && catsRes.value?.data?.length) {
                    // ✅ FIX: Client-side safety filter in case API doesn't support type param
                    const allCats = catsRes.value.data;
                    const ecCats = allCats.filter(c =>
                        c.productType !== "urbexon_hour" &&
                        c.type !== "urbexon_hour" &&
                        !c.isUrbexonHour
                    );
                    setCategories(ecCats);
                    cache.categories = ecCats;
                }

                if (homeRes.status === "fulfilled") {
                    const d = homeRes.value.data;
                    const f = d.featured || [];
                    const na = d.newArrivals || [];
                    const dl = d.deals || [];

                    setFeatured(f); setNewArrivals(na); setDeals(dl);
                    cache.featured = f; cache.newArrivals = na; cache.deals = dl;

                    if (d.stats) { setStats(d.stats); cache.stats = d.stats; }

                    const dEnd = dl
                        .map(p => p.dealEndsAt).filter(Boolean)
                        .map(d => new Date(d)).filter(d => d > new Date());
                    if (dEnd.length) {
                        const nd = new Date(Math.min(...dEnd)).toISOString();
                        setNearestDealEnd(nd); cache.nearestDealEnd = nd;
                    }
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
        if (!history.length) return;
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
            setNlEmail(""); setNlStatus("done");
        } catch {
            setNlStatus("error");
        }
    };

    /* ═══════════════════════════════════════
       SEARCH VIEW
    ═══════════════════════════════════════ */
    if (searchQuery.trim()) return (
        <div className="h-root">
            <style>{CSS}</style>
            <div className="h-wrap" style={{ paddingTop: 40, paddingBottom: 60 }}>
                <div style={{ marginBottom: 22 }}>
                    <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
                        Results for &ldquo;{searchQuery}&rdquo;
                    </h1>
                    <p style={{ fontSize: 13, color: "#64748b", marginTop: 4, fontWeight: 500 }}>
                        {searching ? "Searching…" : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""}`}
                    </p>
                </div>
                {searching ? (
                    <div className="h-pgrid">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                ) : searchResults.length > 0 ? (
                    <div className="h-pgrid">{searchResults.map(p => <PCard key={p._id} product={p} />)}</div>
                ) : (
                    <div className="h-empty">
                        <FaSearch size={36} color="#e2e8f0" style={{ marginBottom: 12 }} />
                        <div style={{ fontWeight: 700, fontSize: 16 }}>No products found</div>
                        <div style={{ fontSize: 13, marginTop: 6 }}>Try a different search term</div>
                    </div>
                )}
            </div>
        </div>
    );

    /* ═══════════════════════════════════════
       MAIN VIEW
    ═══════════════════════════════════════ */
    return (
        <div className="h-root">
            <SEO
                title="Premium Online Shopping"
                description="Shop at Urbexon for the best deals on fashion, electronics, home essentials, and more. Fast delivery across India."
                path="/"
            />
            <style>{CSS}</style>

            {/* ━━ HERO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {loading && slides.length === 0 ? (
                <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", minHeight: 360, position: "relative", overflow: "hidden" }}>
                    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "70px clamp(20px,5vw,80px)" }}>
                        {[120, "80%", "55%"].map((w, i) => (
                            <div key={i} className="h-sk" style={{ width: w, height: i === 0 ? 18 : 38, borderRadius: 8, marginBottom: i === 0 ? 18 : 10, background: "rgba(255,255,255,.1)" }} />
                        ))}
                        <div className="h-sk" style={{ width: 140, height: 44, borderRadius: 10, background: "rgba(255,255,255,.18)", marginTop: 14 }} />
                    </div>
                </div>
            ) : slides.length > 0 ? (
                <div className="h-hero">
                    {slides.map((slide, i) => {
                        const bg = slide.image?.url || (typeof slide.image === "string" ? slide.image : null) || "/banner-fallback.jpg";
                        return (
                            <div key={slide._id} className={`h-hero-slide${i === heroIdx ? " on" : ""}`}>
                                <img className="h-hero-bg" src={bg} alt={slide.title || "Banner"} loading={i === 0 ? "eager" : "lazy"} />
                                <div className="h-hero-overlay" />
                                <div className="h-hero-body">
                                    <div className="h-hero-left">
                                        {slide.tag && <div className="h-hero-tag">🔥 {slide.tag}</div>}
                                        <h1 className="h-hero-title">
                                            {slide.title}
                                            {slide.highlight && <em>{slide.highlight}</em>}
                                        </h1>
                                        {slide.subtitle && (
                                            <p className="h-hero-desc" style={{ marginBottom: 4 }}>{slide.subtitle}</p>
                                        )}
                                        {(slide.desc || slide.description) && (
                                            <p className="h-hero-desc">{slide.desc || slide.description}</p>
                                        )}
                                        <div className="h-hero-btns">
                                            <button
                                                className="h-hero-btn-p"
                                                onClick={() => {
                                                    const t = slide.link || slide.ctaLink || "/";
                                                    t.startsWith("http") ? window.open(t, "_blank", "noopener") : navigate(t);
                                                }}
                                            >
                                                {slide.buttonText || slide.cta || "Shop Now"} <FaArrowRight size={12} />
                                            </button>
                                            {slide.secondary && (
                                                <button className="h-hero-btn-s" onClick={() => navigate(slide.secondaryLink || "/deals")}>
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
                                                <span className="h-hero-stat-v">{stats.products ? `${stats.products.toLocaleString()}+` : "—"}</span>
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
                    {slides.length > 1 && (
                        <>
                            <button className="h-nav-btn l" onClick={() => goHero(-1)} aria-label="Previous"><FaChevronLeft size={13} /></button>
                            <button className="h-nav-btn r" onClick={() => goHero(1)} aria-label="Next"><FaChevronRight size={13} /></button>
                            <div className="h-dots">
                                {slides.map((_, i) => (
                                    <button key={i} className={`h-dot${i === heroIdx ? " on" : ""}`} onClick={() => { setHeroIdx(i); resetTimer(); }} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ) : !loading && (
                <div className="h-hero" style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}>
                    <div className="h-hero-slide on" style={{ position: "relative" }}>
                        <div className="h-hero-body">
                            <div className="h-hero-left">
                                <h1 className="h-hero-title">Welcome to Urbexon<em>Shop the Best Deals</em></h1>
                                <p className="h-hero-desc">Discover amazing products from verified sellers across India.</p>
                                <div className="h-hero-btns">
                                    <button className="h-hero-btn-p" onClick={() => navigate("/deals")}>
                                        Explore Deals <FaArrowRight size={12} />
                                    </button>
                                </div>
                                <div className="h-hero-stats">
                                    <div className="h-hero-stat"><span className="h-hero-stat-v">Fast</span><span className="h-hero-stat-l">Delivery</span></div>
                                    <div className="h-hero-stat"><span className="h-hero-stat-v">{stats.products ? `${stats.products.toLocaleString()}+` : "—"}</span><span className="h-hero-stat-l">Products</span></div>
                                    <div className="h-hero-stat"><span className="h-hero-stat-v">{stats.categories || "—"}</span><span className="h-hero-stat-l">Categories</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ UH STRIP ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="h-uh-strip" onClick={() => navigate("/urbexon-hour")}>
                <div className="h-wrap">
                    <div className="h-uh-inner">
                        <div className="h-uh-icon"><FaBolt /></div>
                        <div className="h-uh-info">
                            <div className="h-uh-title">Urbexon <strong>Hour</strong></div>
                            <div className="h-uh-sub">Groceries &amp; essentials in <strong>45 min</strong></div>
                        </div>
                        <span className="h-uh-tag">FAST DELIVERY</span>
                        <FaArrowRight size={13} className="h-uh-arrow" />
                    </div>
                </div>
            </div>

            {/* ━━ CATEGORIES (ecommerce only) ━━━━━━━━ */}
            {(loading || categories.length > 0) && (
                <div style={{ background: "#fff", borderBottom: "1px solid #e8edf2" }}>
                    <div className="h-wrap">
                        <CategoryBrowser categories={categories} />
                    </div>
                </div>
            )}

            {/* ━━ NEW ARRIVALS ━━━━━━━━━━━━━━━━━━━━━━━ */}
            {(loading || newArrivals.length > 0) && (
                <div style={{ background: "#fff" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead
                                title="New Arrivals"
                                sub="Fresh drops, just for you"
                                to="/products?sort=newest"
                                label="See all"
                            />
                            {loading
                                ? <div className="h-hscroll">{Array(6).fill(0).map((_, i) => <div key={i} style={{ minWidth: 200 }}><SkCard /></div>)}</div>
                                : <div className="h-hscroll">{newArrivals.map(p => <PCard key={p._id} product={p} />)}</div>
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ RECENTLY VIEWED ━━━━━━━━━━━━━━━━━━━ */}
            {recentlyViewed.length > 0 && (
                <div style={{ background: "#f8fafc", borderTop: "1px solid #e8edf2" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead title="Recently Viewed" sub="Continue where you left off" />
                            <div className="h-hscroll">
                                {recentlyViewed.slice(0, 12).map(p => <PCard key={p._id} product={p} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ ALL PRODUCTS ━━━━━━━━━━━━━━━━━━━━━━ */}
            <AllProductsSection />

            {/* ━━ TRENDING ━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {(loading || featured.length > 0) && (
                <div style={{ background: "#f8fafc", borderTop: "1px solid #e8edf2" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead
                                title="Trending Products"
                                sub="Most popular right now"
                                to="/products?sort=rating"
                                label="See all"
                            />
                            {loading
                                ? <div className="h-pgrid">{Array(8).fill(0).map((_, i) => <SkCard key={i} />)}</div>
                                : <div className="h-pgrid">{featured.map(p => <PCard key={p._id} product={p} />)}</div>
                            }
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ FLASH DEALS (fixed) ━━━━━━━━━━━━━━━ */}
            <FlashDealsSection
                deals={deals}
                loading={loading}
                nearestDealEnd={nearestDealEnd}
            />

            {/* ━━ FOR YOU ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {forYouProducts.length > 0 && (
                <div style={{ background: "#fff", borderTop: "1px solid #e8edf2" }}>
                    <div className="h-wrap">
                        <div className="h-sec">
                            <SecHead
                                title={`Based on "${forYouTerm}"`}
                                sub="Products picked for you"
                                to={`/?search=${encodeURIComponent(forYouTerm)}`}
                                label="See all"
                            />
                            <div className="h-hscroll">
                                {forYouProducts.map(p => <PCard key={p._id} product={p} />)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ━━ WHY CHOOSE ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="h-why">
                <div className="h-wrap">
                    <div className="h-sec" style={{ textAlign: "center" }}>
                        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                            Why Choose Urbexon?
                        </h2>
                        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 32, fontWeight: 500 }}>
                            Your trusted partner for online shopping
                        </p>
                        <div className="h-why-grid">
                            {WHY.map(({ Icon, label, sub, bg, iconColor }) => (
                                <div key={label} className="h-why-card">
                                    <div className="h-why-icon" style={{ background: bg }}>
                                        <Icon size={22} color={iconColor} />
                                    </div>
                                    <div className="h-why-title">{label}</div>
                                    <div className="h-why-sub">{sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* ━━ NEWSLETTER ━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="h-newsletter">
                <div className="h-wrap">
                    <div className="h-nl-inner">
                        <div className="h-nl-chip">✉️ NEWSLETTER</div>
                        <h3 className="h-nl-title">Stay in the Loop</h3>
                        <p className="h-nl-sub">
                            Get exclusive deals, new arrivals, and offers<br />delivered straight to your inbox.
                        </p>
                        {nlStatus === "done" ? (
                            <p style={{ color: "#22c55e", fontWeight: 700, fontSize: 14 }}>✅ Successfully subscribed!</p>
                        ) : (
                            <form className="h-nl-form" onSubmit={handleNL}>
                                <input
                                    className="h-nl-inp"
                                    type="email"
                                    value={nlEmail}
                                    onChange={e => { setNlEmail(e.target.value); setNlStatus(""); }}
                                    placeholder="Enter your email address"
                                    required
                                />
                                <button type="submit" className="h-nl-btn" disabled={nlStatus === "sending"}>
                                    {nlStatus === "sending" ? "Subscribing…" : "Subscribe"}
                                </button>
                            </form>
                        )}
                        {nlStatus === "error" && (
                            <p style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>Failed to subscribe. Please try again.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;