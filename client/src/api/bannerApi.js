// ═══════════════════════════════════════════════════
// FILE 1: client/src/api/bannerApi.js
// ═══════════════════════════════════════════════════
import api from "./axios";

// Public — banners filtered by arbitrary params (type, placement, ...)
export const fetchBanners = (params) => api.get("/banners", { params });

// Public — active ecommerce banners only (for Home.jsx hero slider)
export const fetchActiveBanners = () => fetchBanners({ type: "ecommerce" });