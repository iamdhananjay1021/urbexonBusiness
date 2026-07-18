import api from "./axios";

// Collection Engine — public endpoints
export const fetchCollections = (config) => api.get("/collections", config);
export const fetchCollectionProducts = (slug, params, config) =>
    api.get(`/collections/${slug}`, { params, ...config });
