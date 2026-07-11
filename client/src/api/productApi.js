import api from "./axios";

// `queryString` is passed through exactly as callers already build it
// (e.g. "?search=foo&limit=8") so existing query construction/encoding is preserved byte-for-byte.
export const getProducts = (queryString = "", config) => api.get(`/products${queryString}`, config);
export const getProductById = (id, config) => api.get(`/products/${id}`, config);
export const getRelatedProducts = (id, config) => api.get(`/products/${id}/related`, config);
export const getHomepageProducts = () => api.get("/products/homepage");
export const getProductSuggestions = (query, productType, config) =>
    api.get(`/products/suggestions?q=${encodeURIComponent(query)}&productType=${productType}`, config);
export const getDeals = () => api.get("/products/deals");
export const getUHProducts = (params) => api.get("/products/urbexon-hour", { params });
export const getUHDeals = (params) => api.get("/products/urbexon-hour/deals", { params });
export const getUHHomepage = (params) => api.get("/products/urbexon-hour/homepage", { params });
export const subscribeStockNotify = (payload) => api.post("/stock-notify/subscribe", payload);
