import api from "./axios";

// Urbexon Hour pincode serviceability check — distinct from addressApi's
// ecommerce COD/pincode check (different backend route, different purpose).
export const checkPincode = (code) => api.get(`/pincode/check/${code}`);
// Cross-checks raw GPS coordinates against our own serviceable-pincode
// database — used to correct a reverse geocoder's occasionally-wrong
// postal_code for coordinates near a pincode boundary.
export const resolveNearestPincode = (lat, lng) => api.get("/pincode/nearest", { params: { lat, lng } });
export const joinPincodeWaitlist = (payload) => api.post("/pincode/waitlist", payload);
export const getUhPincode = () => api.get("/addresses/uh-pincode");
export const saveUhPincode = (payload) => api.post("/addresses/uh-pincode", payload);
