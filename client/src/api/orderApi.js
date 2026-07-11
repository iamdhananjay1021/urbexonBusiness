import api from "./axios";

export const getCheckoutPricing = (payload) => api.post("/orders/pricing", payload);
export const createOrder = (payload) => api.post("/orders", payload);
export const getMyOrders = (queryString = "") => api.get(`/orders/my${queryString}`);
export const getOrderById = (id) => api.get(`/orders/${id}`);
export const cancelOrder = (id) => api.patch(`/orders/${id}/cancel`);
export const submitOrderReview = (id, payload) => api.put(`/orders/${id}/review`, payload);
export const requestReturn = (id, payload) => api.put(`/orders/${id}/return/request`, payload);
export const requestReplacement = (id, payload) => api.put(`/orders/${id}/replacement/request`, payload);
export const validateCoupon = (payload) => api.post("/coupons/validate", payload);
export const trackShiprocketOrder = (id) => api.get(`/shiprocket/track/${id}`);
export const getShiprocketRate = (payload) => api.post("/shiprocket/rate", payload);
export const downloadInvoice = (id, config) => api.get(`/invoice/${id}/download`, config);
export const verifyInvoice = (invoiceNumber) => api.get(`/invoice/${invoiceNumber}/verify`);
