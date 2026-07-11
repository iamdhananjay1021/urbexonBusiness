import api from "./axios";

export const createRazorpayOrder = (payload) => api.post("/payment/create-order", payload);
export const verifyRazorpayPayment = (payload) => api.post("/payment/verify", payload);
export const requestRefund = (orderId, payload) => api.post(`/payment/refund/${orderId}`, payload);
