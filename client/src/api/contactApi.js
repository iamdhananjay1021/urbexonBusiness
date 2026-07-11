import api from "./axios";

export const submitContactForm = (payload) => api.post("/contact", payload);
export const subscribeNewsletter = (payload) => api.post("/contact/newsletter", payload);
