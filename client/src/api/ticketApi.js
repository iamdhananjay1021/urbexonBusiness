import api from "./axios";

export const createTicket = (payload) => api.post("/tickets", payload);
export const getMyTickets = () => api.get("/tickets/my");
export const getMyTicketDetail = (id) => api.get(`/tickets/${id}`);
export const replyToTicket = (id, payload) => api.post(`/tickets/${id}/reply`, payload);
