// ═══════════════════════════════════════════════════
// FILE 2: client/src/api/categoryApi.js
// ═══════════════════════════════════════════════════
import api from "./axios";

// Public — active categories only (for Home.jsx category section)
export const fetchActiveCategories = (config) => api.get("/categories", config);
export const fetchCategoryBySlug = (slug, config) => api.get(`/categories/${slug}`, config);
export const fetchCategorySubcategories = (slug, config) => api.get(`/categories/${slug}/subcategories`, config);
// Discovery metadata: attribute schema, SEO, breadcrumbs, default sort
export const fetchCategoryMetadata = (slug, config) => api.get(`/categories/${slug}/metadata`, config);