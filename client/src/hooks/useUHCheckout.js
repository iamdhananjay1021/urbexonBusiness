/**
 * useUHCheckout.js — Urbexon Hour Checkout Hook
 * ─────────────────────────────────────────────────
 * Same pattern as useCheckout but hardcoded to:
 *   • deliveryType = URBEXON_HOUR
 *   • UH cart items only
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "./useCart";
import {
    fetchAddresses,
    fetchCheckoutPricing,
    verifyPincode,
    addAddress as apiAddAddress,
    updateAddress as apiUpdateAddress,
    deleteAddress as apiDeleteAddress,
    setDefaultAddress as apiSetDefaultAddress,
    placeCODOrder,
} from "../services/checkoutService";
import { initiateOnlinePayment } from "../services/paymentService";

// BUG FIX: this hook never accepted a buyNowItem, unlike useCheckout — so
// "Buy Now" on a UH product (ProductCard.jsx already navigated here with
// one in location.state) landed on this page with the buy-now item
// silently discarded, showing whatever was in the UH cart instead (or the
// empty-cart guard, if the cart was empty). Mirrors useCheckout's exact
// buyNowItem-bypasses-cart pattern.
//
// BUG FIX: this hook never accepted/stored/forwarded a coupon at all —
// unlike useCheckout.js, refreshPricing() here never sent couponId/
// couponCode to the pricing endpoint, and handleCOD/handlePayOnline both
// hardcoded `coupon: null`. So a coupon applied on UHCart.jsx (and passed
// via navigate state) was silently dropped, and there was no way to apply
// one on this page either. Mirrors useCheckout's coupon plumbing, but with
// a mutable setter (not read-only) so it can also be applied/removed here.
export const useUHCheckout = (buyNowItem = null, couponFromCart = null) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { uhItems, clearUH } = useCart();
    const checkoutItems = buyNowItem ? [buyNowItem] : (uhItems || []);

    const [step, setStep] = useState(1);
    const [error, setError] = useState("");
    const [coupon, setCoupon] = useState(couponFromCart);

    const [contact, setContact] = useState({
        name: user?.name || "",
        phone: "",
        email: user?.email || "",
    });

    const [addresses, setAddresses] = useState([]);
    const [addrLoading, setAddrLoading] = useState(false);
    const [selectedAddrId, setSelectedAddrId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingAddr, setEditingAddr] = useState(null);
    const [savingAddr, setSavingAddr] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const [paymentMethod, setPaymentMethod] = useState("");
    const [payState, setPayState] = useState("idle");
    const [loading, setLoading] = useState(false);

    const [pricing, setPricing] = useState(null);
    const [pricingLoading, setPricingLoading] = useState(false);
    const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

    /* ── COD availability (Flipkart-style) ── */
    const [codStatus, setCodStatus] = useState(null);
    const [codChecking, setCodChecking] = useState(false);

    const deliveryType = "URBEXON_HOUR";
    const selectedAddress = addresses.find((a) => a._id === selectedAddrId);

    /* ── Load addresses ── */
    const loadAddresses = useCallback(async () => {
        if (!user) return;
        try {
            setAddrLoading(true);
            const data = await fetchAddresses();
            setAddresses(data);
            const def = data.find((a) => a.isDefault);
            setSelectedAddrId(def?._id || data[0]?._id || null);
        } catch { /* silent */ }
        finally { setAddrLoading(false); }
    }, [user]);

    useEffect(() => {
        if (checkoutItems.length > 0) loadAddresses();
    }, []); // eslint-disable-line

    /* ── Pricing ── */
    const pricingDebounce = useRef(null);

    const refreshPricing = useCallback(async (method) => {
        if (!checkoutItems || checkoutItems.length === 0) { setPricing(null); return; }
        clearTimeout(pricingDebounce.current);
        pricingDebounce.current = setTimeout(async () => {
            try {
                setPricingLoading(true);
                const data = await fetchCheckoutPricing(
                    checkoutItems,
                    method || paymentMethod || "RAZORPAY",
                    {
                        deliveryType,
                        pincode: selectedAddress?.pincode,
                        state: selectedAddress?.state,
                        ...(coupon?.couponId && { couponId: coupon.couponId }),
                        ...(coupon?.code && { couponCode: coupon.code }),
                    }
                );
                setPricing(data);
            } catch { /* keep existing */ }
            finally { setPricingLoading(false); }
        }, 300);
    }, [checkoutItems, paymentMethod, selectedAddress?.pincode, coupon]);

    // Cleanup debounce on unmount
    useEffect(() => () => clearTimeout(pricingDebounce.current), []);

    useEffect(() => {
        if (checkoutItems?.length > 0) refreshPricing("RAZORPAY");
    }, []); // eslint-disable-line

    useEffect(() => {
        if (paymentMethod) refreshPricing(paymentMethod === "cod" ? "COD" : "RAZORPAY");
    }, [paymentMethod]); // eslint-disable-line

    // BUG FIX: applying/removing a coupon on this page updates `coupon`
    // state but nothing re-fetched pricing to reflect it — same gap fixed
    // in useCheckout.js.
    useEffect(() => {
        if (checkoutItems?.length > 0) refreshPricing(paymentMethod === "cod" ? "COD" : "RAZORPAY");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [coupon]);

    /* ── COD availability check (Flipkart-style) ──
       BUG FIX: this used to also gate on `step === 3` ("Order Summary"),
       but the COD option itself is only shown/selectable one step later, at
       step 4 ("Payment"). Since `step` was a dependency, advancing 3→4
       re-ran this effect, hit the `step !== 3` early-return, and wiped the
       just-fetched result back to `setCodStatus(null)` — so COD always
       rendered as unavailable on the Payment step, on every UH order.
       Keying only on the pincode (not the step) also means re-entering
       step 3 with an unchanged address no longer re-fires an identical
       network call. */
    useEffect(() => {
        if (!selectedAddress?.pincode) {
            setCodStatus(null);
            return;
        }
        const checkCOD = async () => {
            try {
                setCodChecking(true);
                const data = await verifyPincode(selectedAddress.pincode);
                setCodStatus(data.codStatus || (data.codAllowed ? "available" : "unavailable"));
            } catch {
                setCodStatus("unavailable");
            } finally {
                setCodChecking(false);
            }
        };
        checkCOD();
    }, [selectedAddress?.pincode]);

    const codAvailable = codStatus === "available";

    /* ── Steps ── */
    const goToStep = useCallback((n) => { setError(""); setStep(n); }, []);

    const handleContactContinue = useCallback(() => {
        if (!contact.name.trim()) return setError("Please enter your full name");
        if (!/^[6-9]\d{9}$/.test(contact.phone.trim())) return setError("Enter valid 10-digit mobile number");
        setError(""); setStep(2);
    }, [contact]);

    const handleAddressContinue = useCallback(() => {
        if (!selectedAddress) return setError("Please select or add a delivery address");
        setError(""); setStep(3);
    }, [selectedAddress]);

    /* ── Address CRUD ── */
    const handleAddAddress = useCallback(async (form) => {
        try {
            setSavingAddr(true);
            const data = await apiAddAddress({ ...form, isDefault: addresses.length === 0 });
            setAddresses(data.addresses);
            setSelectedAddrId(data.addresses[data.addresses.length - 1]._id);
            setShowAddForm(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save address");
        } finally { setSavingAddr(false); }
    }, [addresses.length]);

    const handleEditAddress = useCallback(async (form) => {
        if (!editingAddr) return;
        try {
            setSavingAddr(true);
            const data = await apiUpdateAddress(editingAddr._id, form);
            setAddresses(data.addresses);
            setEditingAddr(null);
            setShowAddForm(false);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update address");
        } finally { setSavingAddr(false); }
    }, [editingAddr]);

    const handleDeleteAddress = useCallback(async (id) => {
        try {
            const data = await apiDeleteAddress(id);
            setAddresses(data.addresses);
            if (selectedAddrId === id) {
                const def = data.addresses.find((a) => a.isDefault);
                setSelectedAddrId(def?._id || data.addresses[0]?._id || null);
            }
            setDeleteConfirmId(null);
        } catch { setError("Failed to delete address"); }
    }, [selectedAddrId]);

    const handleSetDefault = useCallback(async (id) => {
        try {
            const data = await apiSetDefaultAddress(id);
            setAddresses(data.addresses);
        } catch { /* silent */ }
    }, []);

    /* ── COD ── */
    // ✅ handleCOD — fixed
    const handleCOD = useCallback(async () => {
        try {
            setLoading(true); setError("");

            const data = await placeCODOrder({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                pincode: selectedAddress?.pincode,
                // ✅ FIX: extract lat/lng from the selected address and send them
                // top-level — createOrder() (orderController.js) reads
                // req.body.latitude/longitude directly, NOT from inside `address`.
                // Without this, order.latitude/order.longitude were always
                // undefined, so distance/ETA could never be computed for the
                // customer leg of delivery, no matter how good the rider's GPS was.
                latitude: selectedAddress?.lat,
                longitude: selectedAddress?.lng,
                deliveryType: "URBEXON_HOUR",
                orderMode: "URBEXON_HOUR",
                distanceKm: 0,
                coupon: coupon || null,
            });
            if (!buyNowItem) clearUH();
            navigate(`/order-success/${data.orderId}`, {
                replace: true,
                state: { paymentMethod: "COD", orderId: data.orderId, finalTotal: data.finalTotal },
            });
        } catch (err) {
            console.error("=== COD Error ===", err.response?.data || err.message);
            setError(err.response?.data?.message || "Order placement failed. Please try again.");
        } finally { setLoading(false); }
    }, [checkoutItems, contact, selectedAddress, clearUH, navigate, buyNowItem, coupon]);

    /* ── Online ── */
    // ✅ handlePayOnline — fixed
    const handlePayOnline = useCallback(async () => {
        try {
            setLoading(true); setError(""); setPayState("processing");
            await initiateOnlinePayment({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                // ✅ FIX: same missing lat/lng issue as handleCOD above.
                latitude: selectedAddress?.lat,
                longitude: selectedAddress?.lng,
                navigate,
                onSuccess: () => { if (!buyNowItem) clearUH(); setPayState("success"); },
                onFailure: (msg) => { setError(msg); setPayState("failed"); setLoading(false); },
                onCancel: (msg) => { setError(msg); setPayState("failed"); setLoading(false); },
                deliveryType: "URBEXON_HOUR",
                orderMode: "URBEXON_HOUR",
                distanceKm: 0,
                coupon: coupon || null,
            });
        } catch (err) {
            setError(err.message || "Payment initialization failed.");
            setPayState("failed");
        } finally { setLoading(false); }
    }, [checkoutItems, contact, selectedAddress, clearUH, navigate, buyNowItem, coupon]);

    // BUG FIX: this called refreshPricing() directly AND setPaymentMethod()
    // — but the effect above already re-runs refreshPricing() whenever
    // paymentMethod changes, so every method selection fired the identical
    // pricing request twice back-to-back. Let the effect own it.
    const selectPaymentMethod = useCallback((method) => {
        setPaymentMethod(method); setError(""); setPayState("idle");
    }, []);

    return {
        step, setStep: goToStep, error, setError,
        coupon, setCoupon,
        contact, setContact,
        addresses, addrLoading, selectedAddrId, setSelectedAddrId, selectedAddress,
        showAddForm, setShowAddForm, editingAddr, setEditingAddr,
        savingAddr, deleteConfirmId, setDeleteConfirmId,
        paymentMethod, selectPaymentMethod, payState, loading,
        codStatus, codChecking, codAvailable,
        pricing, pricingLoading,
        mobileSummaryOpen, setMobileSummaryOpen,
        checkoutItems,
        handleContactContinue, handleAddressContinue,
        handleAddAddress, handleEditAddress, handleDeleteAddress, handleSetDefault,
        handleCOD, handlePayOnline,
    };
};
