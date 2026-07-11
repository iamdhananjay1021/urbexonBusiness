import api from "./axios";

export const uploadCustomImage = (formData) => api.post("/uploads/custom-image", formData);
