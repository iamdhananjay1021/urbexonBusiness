import api from "./axios";

export const googleAuth = (payload) => api.post("/auth/google", payload);
export const login = (payload) => api.post("/auth/login", payload);
export const verifyOtp = (payload) => api.post("/auth/verify-otp", payload);
export const register = (payload) => api.post("/auth/register", payload);
export const resendOtp = (payload) => api.post("/auth/resend-otp", payload);
export const forgotPassword = (payload) => api.post("/auth/forgot-password", payload);
export const resetPassword = (token, payload) => api.post(`/auth/reset-password/${token}`, payload);
export const getProfile = (config) => api.get("/auth/profile", config);
export const updateProfile = (payload) => api.put("/auth/profile", payload);
export const changePassword = (payload) => api.put("/auth/change-password", payload);
export const saveLocation = (payload) => api.post("/auth/save-location", payload);
