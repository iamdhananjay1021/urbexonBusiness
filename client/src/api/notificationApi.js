import api from "./axios";

export const getUnreadCount = () => api.get("/user-notifications/unread-count");
export const getNotifications = (page, limit) => api.get(`/user-notifications?page=${page}&limit=${limit}`);
export const markNotificationRead = (id) => api.put(`/user-notifications/${id}/read`);
export const markAllNotificationsRead = () => api.put("/user-notifications/read-all");
export const deleteNotification = (id) => api.delete(`/user-notifications/${id}`);
