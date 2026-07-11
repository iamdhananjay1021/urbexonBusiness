import api from "./axios";

export const getWishlist = () => api.get("/wishlist");
export const checkWishlist = (productId) => api.get(`/wishlist/check/${productId}`);
export const addToWishlist = (productId) => api.post(`/wishlist/${productId}`);
export const removeFromWishlist = (productId) => api.delete(`/wishlist/${productId}`);
