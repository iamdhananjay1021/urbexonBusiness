// ═══════════════════════════════════════════════════
// FILE 4: admin/src/api/categoryApi.js
// ═══════════════════════════════════════════════════
import adminApi from "./adminApi";

// Admin — full CRUD
export const fetchAllCategories = () => adminApi.get("/categories/admin/all");
export const createCategory = (formData) => adminApi.post("/categories", formData, { headers: { "Content-Type": "multipart/form-data" } });
export const updateCategory = (slug, formData) => adminApi.put(`/categories/${slug}`, formData, { headers: { "Content-Type": "multipart/form-data" } });
export const deleteCategory = (slug) => adminApi.delete(`/categories/${slug}`);