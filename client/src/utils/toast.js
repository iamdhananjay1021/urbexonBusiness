/**
 * toast.js — fires the same "api:error" event api/axios.js's interceptor
 * already dispatches on network/HTTP failures. App.jsx's listener (mounted
 * once at the root) is type-agnostic despite the event name, so this is
 * the existing global toast pipeline, not a new one — reused here so page
 * components can show a success/info/warning toast without each wiring up
 * its own useToast()+<Toast/> pair.
 */
export const showToast = (message, type = "info") => {
    window.dispatchEvent(new CustomEvent("api:error", { detail: { message, type } }));
};
