import api from "./axios";

export const getReviews = (productId, config) => api.get(`/reviews/${productId}`, config);
export const submitReview = (productId, payload) => api.post(`/reviews/${productId}`, payload);
export const deleteReview = (reviewId) => api.delete(`/reviews/${reviewId}`);
