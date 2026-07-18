/**
 * useCheckout.js
 * ✅ Central state + logic for entire checkout flow
 * ✅ Pricing always fetched from server
 * ✅ No business logic in components
 * ✅ TESTING MODE: COD force-enabled (verifyPincode bypass)
 * ✅ FIX: orderMode passed for URBEXON_HOUR orders
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "./useCart";
import {
    fetchAddresses,
    fetchCheckoutPricing,
    fetchShippingRate,
    verifyPincode,
    addAddress as apiAddAddress,
    updateAddress as apiUpdateAddress,
    deleteAddress as apiDeleteAddress,
    setDefaultAddress as apiSetDefaultAddress,
    placeCODOrder,
} from "../services/checkoutService";
import { initiateOnlinePayment } from "../services/paymentService";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 TESTING FLAG — production mein false kar dena
const FORCE_COD_AVAILABLE = true;
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const useCheckout = (buyNowItem = null, couponFromCart = null) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { cartItems, clearEcommerce: clear } = useCart();

    // BUG FIX: Defensively correct the productType for a buyNowItem.
    // The product page (`/products/:slug?flow=uh`) might not correctly set the
    // productType to 'urbexon_hour' before initiating "Buy Now". This fix
    // ensures that if an item has a `vendorId`, it is ALWAYS treated as an
    // Urbexon Hour item within the checkout flow, resolving the wrong orderMode.
    const correctedBuyNowItem = buyNowItem
        ? {
            ...buyNowItem,
            productType: buyNowItem.vendorId ? 'urbexon_hour' : (buyNowItem.productType || 'ecommerce'),
        }
        : null;
    const checkoutItems = correctedBuyNowItem ? [correctedBuyNowItem] : (cartItems || []);
    /* ── Steps ── */
    const [step, setStep] = useState(1);
    const [error, setError] = useState("");

    /* ── Coupon (seeded from Cart, but mutable — BUG FIX: this used to have
       no setter, so a coupon could only ever be applied on Cart.jsx and
       arrived here read-only; there was no way to apply, change, or remove
       one directly on the Checkout page itself (e.g. after "Buy Now",
       which bypasses Cart entirely). ── */
    const [coupon, setCoupon] = useState(couponFromCart);

    /* ── Contact ── */
    const [contact, setContact] = useState({
        name: user?.name || "",
        phone: "",
        email: user?.email || "",
    });

    /* ── Addresses ── */
    const [addresses, setAddresses] = useState([]);
    const [addrLoading, setAddrLoading] = useState(false);
    const [selectedAddrId, setSelectedAddrId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAddr, setEditingAddr] = useState(null);
    const [savingAddr, setSavingAddr] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    /* ── Payment ── */
    const [paymentMethod, setPaymentMethod] = useState("");
    const [payState, setPayState] = useState("idle");
    const [loading, setLoading] = useState(false);

    /* ── COD availability ── */
    const [codStatus, setCodStatus] = useState(null);
    const [codDistance, setCodDistance] = useState(null);
    const [codChecking, setCodChecking] = useState(false);
    const [deliveryETA, setDeliveryETA] = useState("");

    /* ── Shiprocket rate info ── */
    const [shippingInfo, setShippingInfo] = useState(null);

    /* ── Pricing (server-driven) ── */
    const [pricing, setPricing] = useState(null);
    const [pricingLoading, setPricingLoading] = useState(false);

    // Auto-detect delivery type from cart product types
    const cartProductType = checkoutItems?.[0]?.productType || "ecommerce";
    const [deliveryType, setDeliveryType] = useState(
        cartProductType === "urbexon_hour" ? "URBEXON_HOUR" : "ECOMMERCE_STANDARD"
    );

    // ✅ FIX: Derive orderMode from cart items
    const orderMode = cartProductType === "urbexon_hour" ? "URBEXON_HOUR" : "ECOMMERCE";

    /* ── Mobile ── */
    const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

    const selectedAddress = addresses.find(a => a._id === selectedAddrId);

    /* ════════════════════════════════════════
       FETCH ADDRESSES
    ════════════════════════════════════════ */
    const loadAddresses = useCallback(async () => {
        if (!user) return;
        try {
            setAddrLoading(true);
            const data = await fetchAddresses();
            setAddresses(data);
            const def = data.find(a => a.isDefault);
            const first = data[0];
            setSelectedAddrId(def?._id || first?._id || null);
        } catch { /* silent */ }
        finally { setAddrLoading(false); }
    }, [user]);

    useEffect(() => {
        if (!checkoutItems || checkoutItems.length === 0) return;
        loadAddresses();
    }, [loadAddresses]);

    /* ════════════════════════════════════════
       FETCH PRICING FROM SERVER
    ════════════════════════════════════════ */
    const pricingDebounce = useRef(null);

    const refreshPricing = useCallback(async (method) => {
        if (!checkoutItems || checkoutItems.length === 0) {
            setPricing(null);
            return;
        }
        clearTimeout(pricingDebounce.current);
        pricingDebounce.current = setTimeout(async () => {
            try {
                setPricingLoading(true);
                const data = await fetchCheckoutPricing(checkoutItems, method || paymentMethod || "RAZORPAY", {
                    deliveryType,
                    distanceKm: codDistance || 0,
                    pincode: selectedAddress?.pincode,
                    ...(coupon?.couponId && { couponId: coupon.couponId }),
                    ...(coupon?.code && { couponCode: coupon.code }),
                });
                setPricing(data);
            } catch {
                // Fallback: keep existing pricing
            } finally {
                setPricingLoading(false);
            }
        }, 300);
    }, [checkoutItems, paymentMethod, deliveryType, codDistance, selectedAddress?.pincode, coupon]);

    useEffect(() => () => clearTimeout(pricingDebounce.current), []);

    useEffect(() => {
        if (checkoutItems?.length > 0) refreshPricing("RAZORPAY");
    }, []); // eslint-disable-line

    useEffect(() => {
        if (paymentMethod) refreshPricing(paymentMethod === "cod" ? "COD" : "RAZORPAY");
    }, [paymentMethod]); // eslint-disable-line

    useEffect(() => {
        if (step === 3) {
            refreshPricing(paymentMethod ? (paymentMethod === "cod" ? "COD" : "RAZORPAY") : "RAZORPAY");
        }
    }, [deliveryType, codDistance]); // eslint-disable-line

    // BUG FIX: `coupon` is now mutable (setCoupon exposed below, for the
    // Checkout page's own apply/remove UI) but nothing re-fetched pricing
    // when it changed — applying/removing a coupon here would update the
    // `coupon` state but the displayed total would silently stay stale
    // until some other unrelated field (address, payment method) happened
    // to trigger a refresh. Mirrors the existing `[paymentMethod]` effect.
    useEffect(() => {
        if (checkoutItems?.length > 0) refreshPricing(paymentMethod === "cod" ? "COD" : "RAZORPAY");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coupon]);

    /* ════════════════════════════════════════
       CHECK COD AVAILABILITY
    ════════════════════════════════════════ */
    useEffect(() => {
        if (step !== 3 || !selectedAddress?.pincode) {
            // ✅ TESTING: jab step 3 pe aao aur pincode nahi toh bhi COD available rakho
            if (FORCE_COD_AVAILABLE) setCodStatus("available");
            else setCodStatus(null);
            return;
        }

        // ✅ TESTING MODE: verifyPincode call skip, COD hamesha available
        if (FORCE_COD_AVAILABLE) {
            setCodStatus("available");
            setCodDistance(0);
            setDeliveryETA("45–120 mins");
            return;
        }

        // Production code (FORCE_COD_AVAILABLE = false hone par chalega)
        const checkCOD = async () => {
            try {
                setCodChecking(true);
                const data = await verifyPincode(selectedAddress.pincode);
                setCodStatus(data.codStatus || (data.codAllowed ? "available" : "unavailable"));
                setCodDistance(data.distanceKm);
                setDeliveryETA(data.deliveryETA || "");
            } catch {
                setCodStatus("unavailable");
            } finally {
                setCodChecking(false);
            }
        };
        checkCOD();
    }, [selectedAddress?.pincode, step]);

    /* ── Fetch Shiprocket rate ── */
    useEffect(() => {
        if (step !== 3 || !selectedAddress?.pincode || deliveryType === "URBEXON_HOUR") {
            setShippingInfo(null);
            return;
        }
        const fetchRate = async () => {
            try {
                const data = await fetchShippingRate(selectedAddress.pincode, paymentMethod || "online");
                if (data.success) setShippingInfo(data);
            } catch {
                // Non-critical
            }
        };
        fetchRate();
    }, [selectedAddress?.pincode, step, deliveryType, paymentMethod]);

    // ✅ TESTING: codAvailable always true jab FORCE_COD_AVAILABLE on ho
    const codAvailable = FORCE_COD_AVAILABLE ? true : codStatus === "available";

    // Reset payment method if COD unavailable (only in production mode)
    useEffect(() => {
        if (!FORCE_COD_AVAILABLE && paymentMethod === "cod" && codStatus && !codAvailable) {
            setPaymentMethod("");
        }
    }, [codAvailable, codStatus]); // eslint-disable-line

    useEffect(() => {
        if ((codDistance || 0) > 15 && deliveryType === "URBEXON_HOUR") {
            setDeliveryType("ECOMMERCE_STANDARD");
        }
    }, [codDistance, deliveryType]);

    /* ════════════════════════════════════════
       STEP NAVIGATION
    ════════════════════════════════════════ */
    const goToStep = useCallback((n) => {
        setError("");
        setStep(n);
    }, []);

    const handleContactContinue = useCallback(() => {
        if (!contact.name.trim()) return setError("Please enter your full name");
        if (!/^[6-9]\d{9}$/.test(contact.phone.trim())) return setError("Enter valid 10-digit mobile number");
        setError("");
        setStep(2);
    }, [contact]);

    const handleAddressContinue = useCallback(() => {
        if (!selectedAddress) return setError("Please select or add a delivery address");
        if (!FORCE_COD_AVAILABLE && paymentMethod === "cod" && !codAvailable) setPaymentMethod("");
        setError("");
        setStep(3);
    }, [selectedAddress, paymentMethod, codAvailable]);

    /* ════════════════════════════════════════
       ADDRESS CRUD
    ════════════════════════════════════════ */
    const handleAddAddress = useCallback(async (form) => {
        try {
            setSavingAddr(true);
            const data = await apiAddAddress({ ...form, isDefault: addresses.length === 0 });
            setAddresses(data.addresses);
            setSelectedAddrId(data.addresses[data.addresses.length - 1]._id);
            setShowAddForm(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save address");
        } finally {
            setSavingAddr(false);
        }
    }, [addresses.length]);

    const handleEditAddress = useCallback(async (form) => {
        if (!editingAddr) return;
        try {
            setSavingAddr(true);
            const data = await apiUpdateAddress(editingAddr._id, form);
            setAddresses(data.addresses);
            setEditingAddr(null);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update address");
        } finally {
            setSavingAddr(false);
        }
    }, [editingAddr]);

    const handleDeleteAddress = useCallback(async (id) => {
        try {
            const data = await apiDeleteAddress(id);
            setAddresses(data.addresses);
            if (selectedAddrId === id) {
                const def = data.addresses.find(a => a.isDefault);
                setSelectedAddrId(def?._id || data.addresses[0]?._id || null);
            }
            setDeleteConfirmId(null);
        } catch {
            setError("Failed to delete address");
        }
    }, [selectedAddrId]);

    const handleSetDefault = useCallback(async (id) => {
        try {
            const data = await apiSetDefaultAddress(id);
            setAddresses(data.addresses);
        } catch { /* silent */ }
    }, []);

    /* ════════════════════════════════════════
       PLACE COD ORDER
       ✅ orderMode included for UH orders
    ════════════════════════════════════════ */
    const handleCOD = useCallback(async () => {
        try {
            setLoading(true);
            setError("");

            const data = await placeCODOrder({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                pincode: selectedAddress?.pincode,
                deliveryType,
                orderMode,          // ✅ "URBEXON_HOUR" ya "ECOMMERCE"
                distanceKm: codDistance || 0,
                coupon: coupon || null,
            });

            if (!buyNowItem) clear();

            navigate(`/order-success/${data.orderId}`, {
                replace: true,
                state: {
                    paymentMethod: "COD",
                    orderId: data.orderId,
                    finalTotal: data.finalTotal,
                },
            });
        } catch (err) {
            setError(err.response?.data?.message || "Order placement failed. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [checkoutItems, contact, selectedAddress, buyNowItem, clear, navigate, orderMode, codDistance, coupon]);

    /* ════════════════════════════════════════
       ONLINE PAYMENT
       ✅ orderMode included for UH orders
    ════════════════════════════════════════ */
    const handlePayOnline = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            setPayState("processing");

            await initiateOnlinePayment({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                navigate,
                onSuccess: () => {
                    if (!buyNowItem) clear();
                    setPayState("success");
                },
                onFailure: (msg) => {
                    setError(msg);
                    setPayState("failed");
                    setLoading(false);
                },
                onCancel: (msg) => {
                    setError(msg);
                    setPayState("failed");
                    setLoading(false);
                },
                deliveryType,
                orderMode,          // ✅ "URBEXON_HOUR" ya "ECOMMERCE"
                distanceKm: codDistance || 0,
                coupon: coupon || null,
            });
        } catch (err) {
            setError(err.message || "Payment initialization failed.");
            setPayState("failed");
        } finally {
            setLoading(false);
        }
    }, [checkoutItems, contact, selectedAddress, buyNowItem, clear, navigate, orderMode, codDistance, coupon]);

    /* ════════════════════════════════════════
       SELECT PAYMENT METHOD
    ════════════════════════════════════════ */
    const selectPaymentMethod = useCallback((method) => {
        setPaymentMethod(method);
        setError("");
        setPayState("idle");
        refreshPricing(method === "cod" ? "COD" : "RAZORPAY");
    }, [refreshPricing]);

    return {
        // State
        step, setStep: goToStep,
        error, setError,
        contact, setContact,
        addresses,
        addrLoading,
        selectedAddrId, setSelectedAddrId,
        selectedAddress,
        showAddForm, setShowAddForm,
        editingAddr, setEditingAddr,
        savingAddr,
        deleteConfirmId, setDeleteConfirmId,
        paymentMethod, selectPaymentMethod,
        payState,
        loading,
        codStatus,
        codDistance,
        codChecking,
        codAvailable,
        deliveryETA,
        shippingInfo,
        pricing,
        pricingLoading,
        deliveryType,
        setDeliveryType,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        coupon, setCoupon,
        orderMode,          // ✅ expose karo agar component ko chahiye

        // Actions
        handleContactContinue,
        handleAddressContinue,
        handleAddAddress,
        handleEditAddress,
        handleDeleteAddress,
        handleSetDefault,
        handleCOD,
        handlePayOnline,
    };
};