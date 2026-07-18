import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:9000/api",
    timeout: 30000,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// BUG FIX: requireActiveSubscription (backend/middlewares/vendorMiddleware.js)
// already returns a structured 403 — {subscriptionRequired|subscriptionExpired,
// redirectTo:"/subscription"} — specifically so a subscription that expires
// mid-session (not just at page load, which SubscriptionRoute already
// handles) still sends the vendor to pay. Nothing was consuming that
// signal — a vendor mid-session on e.g. /orders would just see a raw
// "failed to load" error instead of being routed to /subscription. Follows
// the same interceptor + guarded window.location.replace() pattern already
// used for the 401 case in client/src/api/axios.js and admin/src/api/adminApi.js.
api.interceptors.response.use(
    (res) => res,
    (err) => {
        const data = err?.response?.data;
        if (err?.response?.status === 403 && (data?.subscriptionExpired || data?.subscriptionRequired)) {
            const target = data.redirectTo || "/subscription";
            if (!window.location.pathname.startsWith(target)) {
                window.location.replace(target);
            }
        }
        return Promise.reject(err);
    }
);

export default api;