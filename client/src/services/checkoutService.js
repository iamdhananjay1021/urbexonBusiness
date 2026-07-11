/**
 * checkoutService.js
 * ✅ All checkout API calls in one place
 * ✅ No pricing logic here — that's backend's job
 * ✅ FIX: orderMode now passed in placeCODOrder & serializeItems
 */

import * as orderApi from "../api/orderApi";
import * as addressApi from "../api/addressApi";

/**
 * Fetch server-calculated pricing for given cart items
 */
export const fetchCheckoutPricing = async (items, paymentMethod = "RAZORPAY", options = {}) => {
    if (!items || items.length === 0) return null;
    const { data } = await orderApi.getCheckoutPricing({
        items: serializeItems(items),
        paymentMethod,
        deliveryType: options.deliveryType,
        distanceKm: options.distanceKm,
        pincode: options.pincode,
        ...(options.couponId && { couponId: options.couponId }),
        ...(options.couponCode && { couponCode: options.couponCode }),
    });
    return data;
};

/**
 * Fetch saved addresses for logged-in user
 */
export const fetchAddresses = async () => {
    const { data } = await addressApi.getAddresses();
    return Array.isArray(data) ? data : [];
};

/**
 * Verify pincode — returns COD availability from backend
 */
export const verifyPincode = async (pincode) => {
    const { data } = await addressApi.verifyPincode(pincode);
    return data;
};

/**
 * Fetch Shiprocket shipping rate for a pincode
 */
export const fetchShippingRate = async (pincode, paymentMethod = "online", weight = 500) => {
    const { data } = await orderApi.getShiprocketRate({
        pincode,
        weight,
        paymentMethod: paymentMethod === "cod" ? "COD" : "PREPAID",
    });
    return data;
};

/**
 * Add new address
 */
export const addAddress = async (form) => {
    const { data } = await addressApi.addAddress(form);
    return data;
};

/**
 * Update existing address
 */
export const updateAddress = async (addressId, form) => {
    const { data } = await addressApi.updateAddress(addressId, form);
    return data;
};

/**
 * Delete address
 */
export const deleteAddress = async (addressId) => {
    const { data } = await addressApi.deleteAddress(addressId);
    return data;
};

/**
 * Set default address
 */
export const setDefaultAddress = async (addressId) => {
    const { data } = await addressApi.setDefaultAddress(addressId);
    return data;
};

/**
 * Place COD order
 * ✅ FIX: orderMode now accepted and sent to backend
 * ✅ Does NOT send totalAmount — backend calculates
 */
export const placeCODOrder = async ({
    items,
    contact,
    address,
    deliveryType = "ECOMMERCE_STANDARD",
    orderMode = "ECOMMERCE",          // ✅ FIX: was missing entirely
    distanceKm = 0,
    coupon = null,
}) => {
    const { data } = await orderApi.createOrder({
        items: serializeItems(items),
        customerName: contact.name,
        phone: address.phone || contact.phone,
        email: contact.email,
        address: formatAddressString(address),
        pincode: address.pincode,
        city: address.city || "",
        state: address.state || "",
        latitude: address.latitude || address.lat || null,
        longitude: address.longitude || address.lng || null,
        paymentMethod: "COD",
        deliveryType,
        orderMode,                    // ✅ FIX: now sent to backend
        distanceKm,
        ...(coupon?.couponId && { couponId: coupon.couponId }),
        ...(coupon?.code && { couponCode: coupon.code }),
    });
    return data;
};

/**
 * Serialize items for API — only send IDs + qty + customization
 * ✅ Never send prices from frontend
 */
export const serializeItems = (items) =>
    items.map((item) => ({
        productId: item.productId || item._id,
        name: item.name,
        qty: Number(item.quantity) || 1,
        image: typeof item.image === "string" ? item.image : item.images?.[0]?.url || "",
        customization: {
            text: item.customization?.text?.trim() || "",
            imageUrl: item.customization?.imageUrl?.trim() || "",
            note: item.customization?.note?.trim() || "",
        },
        selectedSize: item.selectedSize || "",
        selectedColor: item.selectedColor || "",  // ✅ color variant support
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