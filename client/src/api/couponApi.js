import api from "./axios";

export const getActiveCoupons = () => api.get("/coupons/active");
