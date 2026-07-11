import api from "./axios";

export const getDeliveryStatus = () => api.get("/delivery/status");
export const registerDelivery = (formData) => api.post("/delivery/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
});
export const estimateDelivery = (payload) => api.post("/delivery/estimate", payload);
export const getRiderLocationForOrder = (orderId) => api.get(`/delivery/orders/${orderId}/rider-location`);
