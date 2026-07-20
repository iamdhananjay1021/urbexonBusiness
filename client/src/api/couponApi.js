import api from "./axios";

export const getActiveCoupons = () => api.get("/coupons/active");
// Cart-context ranked coupons — includes near-miss entries ("Add ₹120 more
// to unlock SAVE10") for the cart/checkout "Available coupons" panel.
export const getEligibleCoupons = (payload) => api.post("/coupons/eligible", payload);
