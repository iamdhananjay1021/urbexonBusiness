// ═══════════════════════════════════════════════════
// FILE 2: client/src/api/categoryApi.js
// ═══════════════════════════════════════════════════
import api from "./axios";

// Public — active categories only (for Home.jsx category section)
export const fetchActiveCategories = (config) => api.get("/categories", config);
export const fetchCategoryBySlug = (slug) => api.get(`/categories/${slug}`);
export const fetchCategorySubcategories = (slug) => api.get(`/categories/${slug}/subcategories`);