/**
 * checkoutService.js
 * ✅ All checkout API calls in one place
 * ✅ No pricing logic here — that's backend's job
 */

import api from "../api/axios";

/**
 * Fetch server-calculated pricing for given cart items
 * @param {Array} items - cart items
 * @param {"COD"|"RAZORPAY"} paymentMethod
 */
export const fetchCheckoutPricing = async (items, paymentMethod = "RAZORPAY", options = {}) => {
    if (!items || items.length === 0) return null; // ← YEH LINE ADD KARO
    const { data } = await api.post("/orders/pricing", {
        items: serializeItems(items),
        paymentMethod,
        deliveryType: options.deliveryType,
        distanceKm: options.distanceKm,
        pincode: options.pincode,
        ...(options.couponId && { couponId: options.couponId }),
        ...(options.couponCode && { couponCode: options.couponCode }),
    });
    return data;
    // Returns: { itemsTotal, deliveryCharge, platformFee, finalTotal, freeDeliveryThreshold, amountForFreeDelivery }
};

/**
 * Fetch saved addresses for logged-in user
 */
export const fetchAddresses = async () => {
    const { data } = await api.get("/addresses");
    return Array.isArray(data) ? data : [];
};

/**
 * Verify pincode — returns COD availability from backend
 */
export const verifyPincode = async (pincode) => {
    const { data } = await api.get(`/addresses/pincode/${pincode}`);
    return data;
    // Returns: { city, state, codAllowed, codStatus, deliveryETA, ... }
};

/**
 * Fetch Shiprocket shipping rate for a pincode
 */
export const fetchShippingRate = async (pincode, paymentMethod = "online", weight = 500) => {
    const { data } = await api.post("/shiprocket/rate", {
        pincode,
        weight,
        paymentMethod: paymentMethod === "cod" ? "COD" : "PREPAID",
    });
    return data;
    // Returns: { success, rate, courier, etd, mock }
};

/**
 * Add new address
 */
export const addAddress = async (form) => {
    const { data } = await api.post("/addresses", form);
    return data; // { addresses, success }
};

/**
 * Update existing address
 */
export const updateAddress = async (addressId, form) => {
    const { data } = await api.put(`/addresses/${addressId}`, form);
    return data;
};

/**
 * Delete address
 */
export const deleteAddress = async (addressId) => {
    const { data } = await api.delete(`/addresses/${addressId}`);
    return data;
};

/**
 * Set default address
 */
export const setDefaultAddress = async (addressId) => {
    const { data } = await api.put(`/addresses/${addressId}/default`);
    return data;
};

/**
 * Place COD order
 * ✅ Does NOT send totalAmount — backend calculates
 */
export const placeCODOrder = async ({ items, contact, address, pincode, deliveryType = "ECOMMERCE_STANDARD", distanceKm = 0, coupon = null }) => {
    const { data } = await api.post("/orders", {
        items: serializeItems(items),
        customerName: contact.name,
        phone: address.phone || contact.phone,
        email: contact.email,
        address: formatAddressString(address),
        pincode: address.pincode,
        city: address.city || "",
        state: address.state || "",
        latitude: address.lat,
        longitude: address.lng,
        paymentMethod: "COD",
        deliveryType,
        distanceKm,
        ...(coupon?.couponId && { couponId: coupon.couponId }),
        ...(coupon?.code && { couponCode: coupon.code }),

    });
    return data;
    // Returns: { orderId, invoiceNumber, orderStatus, itemsTotal, deliveryCharge, finalTotal }
};

/**
 * Serialize items for API — only send IDs + qty + customization
 * ✅ Never send prices from frontend
 */
export const serializeItems = (items) =>
    items.map((item) => ({
        productId: item.productId || item._id,
        name: item.name,                    // for display only, backend fetches from DB
        qty: Number(item.quantity) || 1,
        image: typeof item.image === "string" ? item.image : item.images?.[0]?.url || "",
        customization: {
            text: item.customization?.text?.trim() || "",
            imageUrl: item.customization?.imageUrl?.trim() || "",
            note: item.customization?.note?.trim() || "",
        },
        selectedSize: item.selectedSize || "",
        // ✅ price NOT sent — backend uses DB price
    }));

/**
 * Format address object to string
 */
export const formatAddressString = (addr) => {
    if (!addr) return "";
    const { house, area, landmark, city, state, pincode } = addr;
    return `${house}, ${area},${landmark ? " " + landmark + "," : ""} ${city}, ${state} - ${pincode}`;
};