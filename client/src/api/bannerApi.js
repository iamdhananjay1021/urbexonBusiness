// ═══════════════════════════════════════════════════
// FILE 1: client/src/api/bannerApi.js
// ═══════════════════════════════════════════════════
import api from "./axios";

// Public — banners filtered by arbitrary params (type, placement, ...)
// `opts` is passed through to axios (e.g. { signal } for AbortController).
export const fetchBanners = (params, opts = {}) => api.get("/banners", { params, ...opts });

// Public — active ecommerce banners only (for Home.jsx hero slider)
export const fetchActiveBanners = () => fetchBanners({ type: "ecommerce" });

// Public — mid-page editorial banners (the Myntra-style clickable image
// grid on the homepage). These are admin-managed in Banner Studio
// (placement = "mid") but were never rendered on the site until the
// homepage redesign — creating them had no visible effect before.
export const fetchMidBanners = (type = "ecommerce", opts) =>
    fetchBanners({ type, placement: "mid" }, opts);