import api from "./axios";

export const getAddresses = () => api.get("/addresses");
export const addAddress = (payload) => api.post("/addresses", payload);
export const updateAddress = (id, payload) => api.put(`/addresses/${id}`, payload);
export const deleteAddress = (id) => api.delete(`/addresses/${id}`);
export const setDefaultAddress = (id) => api.put(`/addresses/${id}/default`);
// Ecommerce COD/serviceability check — distinct endpoint from pincodeApi's
// Urbexon Hour pincode check (different backend route, different purpose).
export const verifyPincode = (pincode) => api.get(`/addresses/pincode/${pincode}`);
