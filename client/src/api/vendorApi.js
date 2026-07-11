import api from "./axios";

export const registerVendor = (formData) =>
    api.post("/vendor/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
    });

export const getVendorStatus = () => api.get("/vendor/status");

export const getNearbyVendors = (params) => api.get("/vendor/nearby", { params });
export const getVendorStore = (slug, params) => api.get(`/vendor/store/${slug}`, { params });
