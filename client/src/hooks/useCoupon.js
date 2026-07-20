/**
 * useCoupon.js — shared coupon apply/remove state.
 *
 * Before this, four separate places (Cart.jsx, UHCart.jsx,
 * checkout/Checkout.jsx, the UH checkout page) each hand-rolled their own
 * couponCode/couponData/couponErr state + validateCoupon() call + minOrder
 * auto-clear effect — the exact same "drift" problem the backend had
 * across three separate coupon implementations, just on the frontend.
 * This hook is the one implementation; every apply/remove UI consumes it.
 *
 * Money is never computed here — `couponData` is whatever the server's
 * /coupons/validate response says (discount, code, minOrderValue, …) and
 * that's it. The actual order total always comes from a further server
 * round-trip (/orders/pricing) at checkout — this hook only decides
 * *which* coupon is currently requested, never what it's worth.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { validateCoupon } from "../api/orderApi";

export const useCoupon = ({ orderTotal, orderType, initialCoupon = null }) => {
    const [couponCode, setCouponCode] = useState(initialCoupon?.code || "");
    const [couponData, setCouponData] = useState(initialCoupon || null);
    const [couponErr, setCouponErr] = useState("");
    const [applying, setApplying] = useState(false);
    // Once the user (or an auto-apply pass) has explicitly acted, further
    // auto-apply attempts stop — manual intent always wins, per the coupon
    // engine's resolution rule (see couponEngine.js::resolveBestCoupon).
    const userActedRef = useRef(!!initialCoupon);

    const applyCoupon = useCallback(async (codeOverride, { silent = false } = {}) => {
        const code = (codeOverride ?? couponCode).trim();
        if (!code) return;
        userActedRef.current = true;
        setApplying(true); setCouponErr(""); if (!silent) setCouponData(null);
        try {
            const { data } = await validateCoupon({ code, orderTotal, orderType });
            setCouponData(data);
            setCouponCode(code);
        } catch (e) {
            if (!silent) setCouponErr(e.response?.data?.message || "Invalid coupon");
            // A silent (auto-apply) attempt that fails just leaves no
            // coupon applied — never surfaces an error the user never
            // asked to see.
        } finally { setApplying(false); }
    }, [couponCode, orderTotal, orderType]);

    const removeCoupon = useCallback(() => {
        userActedRef.current = true;
        setCouponData(null); setCouponCode(""); setCouponErr("");
    }, []);

    // Auto-clear if the cart total drops below the applied coupon's
    // minOrderValue (e.g. an item was removed) — same behavior every one
    // of the four duplicated implementations already had.
    useEffect(() => {
        if (couponData && couponData.minOrderValue && orderTotal < couponData.minOrderValue) {
            removeCoupon();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orderTotal]);

    /** Silently apply a server-suggested best coupon — only if the user
     *  hasn't already typed/removed a code themselves this session. */
    const autoApply = useCallback((code) => {
        if (userActedRef.current || !code) return;
        applyCoupon(code, { silent: true });
    }, [applyCoupon]);

    return { couponCode, setCouponCode, couponData, couponErr, applying, applyCoupon, removeCoupon, autoApply };
};

export default useCoupon;
