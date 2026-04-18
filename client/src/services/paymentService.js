/**
 * paymentService.js
 * ✅ Razorpay flow — server decides amount
 * ✅ No frontend amount calculation
 */

import api from "../api/axios";
import { serializeItems, formatAddressString } from "./checkoutService";

const loadRazorpay = () =>
    new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.body.appendChild(s);
    });

/**
 * Full online payment flow
 * ✅ Server creates order with correct amount
 * ✅ Amount shown to user comes from server response
 *
 * @param {{ items, contact, address, navigate, onSuccess, onFailure, onCancel }}
 */
export const initiateOnlinePayment = async ({
    items,
    contact,
    address,
    navigate,
    onSuccess,
    onFailure,
    onCancel,
    deliveryType = "ECOMMERCE_STANDARD",
    distanceKm = 0,
    coupon = null,
}) => {
    const loaded = await loadRazorpay();
    if (!loaded) throw new Error("Payment gateway failed to load. Please refresh and try again.");

    // ✅ Server creates Razorpay order with DB-calculated amount
    const { data: rpOrder } = await api.post("/payment/create-order", {
        items: serializeItems(items),
        deliveryType,
        distanceKm,
        pincode: address?.pincode,
        ...(coupon?.couponId && { couponId: coupon.couponId }),
        ...(coupon?.code && { couponCode: coupon.code }),
    });

    return new Promise((resolve, reject) => {
        const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID,
            amount: rpOrder.amount,            // ✅ Server amount
            currency: rpOrder.currency,
            name: "UrbeXon",
            description: `Order — ${items.length} item${items.length > 1 ? "s" : ""}`,
            order_id: rpOrder.id,
            prefill: {
                name: contact.name,
                email: contact.email || "",
                contact: `+91${contact.phone}`,
            },
            theme: { color: "#c8a96e" },

            handler: async (response) => {
                try {
                    // ✅ Verify payment + create order (server recalculates from DB)
                    const { data } = await api.post("/payment/verify", {
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                        orderData: {
                            items: serializeItems(items),
                            customerName: contact.name,
                            phone: address.phone || contact.phone,
                            email: contact.email || "",
                            address: formatAddressString(address),
                            city: address.city || "",
                            state: address.state || "",
                            pincode: address?.pincode,
                            latitude: address.lat,
                            longitude: address.lng,
                            deliveryType,
                            distanceKm,
                            ...(coupon?.couponId && { couponId: coupon.couponId }),
                            ...(coupon?.code && { couponCode: coupon.code }),
                        },
                    });

                    if (data.success) {
                        resolve(data);
                        if (onSuccess) onSuccess(data);
                        navigate(`/order-success/${data.orderId}`, {
                            replace: true,
                            state: { paymentId: data.paymentId, orderId: data.orderId },
                        });
                    }
                } catch (err) {
                    const msg = err.response?.data?.message || "Payment done but order failed. Contact support with Payment ID: " + response.razorpay_payment_id;
                    reject(new Error(msg));
                    if (onFailure) onFailure(msg);
                }
            },

            modal: {
                ondismiss: () => {
                    const msg = "Payment cancelled. You can retry.";
                    reject(new Error(msg));
                    if (onCancel) onCancel(msg);
                },
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (r) => {
            const msg = `Payment failed: ${r.error.description}`;
            reject(new Error(msg));
            if (onFailure) onFailure(msg);
        });
        rzp.open();
    });
};
