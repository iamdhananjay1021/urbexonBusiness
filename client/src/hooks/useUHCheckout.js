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
    serializeItems,
    formatAddressString,
} from "../services/checkoutService";
import { initiateOnlinePayment } from "../services/paymentService";

export const useUHCheckout = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { uhItems, clearUH } = useCart();
    const checkoutItems = uhItems || [];

    const [step, setStep] = useState(1);
    const [error, setError] = useState("");

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
                    { deliveryType, pincode: selectedAddress?.pincode }
                );
                setPricing(data);
            } catch { /* keep existing */ }
            finally { setPricingLoading(false); }
        }, 300);
    }, [checkoutItems, paymentMethod, selectedAddress?.pincode]);

    // Cleanup debounce on unmount
    useEffect(() => () => clearTimeout(pricingDebounce.current), []);

    useEffect(() => {
        if (checkoutItems?.length > 0) refreshPricing("RAZORPAY");
    }, []); // eslint-disable-line

    useEffect(() => {
        if (paymentMethod) refreshPricing(paymentMethod === "cod" ? "COD" : "RAZORPAY");
    }, [paymentMethod]); // eslint-disable-line

    /* ── COD availability check (Flipkart-style) ── */
    useEffect(() => {
        if (step !== 3 || !selectedAddress?.pincode) {
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
    }, [selectedAddress?.pincode, step]);

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
    const handleCOD = useCallback(async () => {
        try {
            setLoading(true); setError("");
            const data = await placeCODOrder({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                pincode: selectedAddress?.pincode,
                deliveryType,
                distanceKm: 0,
            });
            clearUH();
            navigate(`/order-success/${data.orderId}`, {
                replace: true,
                state: { paymentMethod: "COD", orderId: data.orderId, finalTotal: data.finalTotal },
            });
        } catch (err) {
            setError(err.response?.data?.message || "Order placement failed. Please try again.");
        } finally { setLoading(false); }
    }, [checkoutItems, contact, selectedAddress, clearUH, navigate]);

    /* ── Online ── */
    const handlePayOnline = useCallback(async () => {
        try {
            setLoading(true); setError(""); setPayState("processing");
            await initiateOnlinePayment({
                items: checkoutItems,
                contact,
                address: selectedAddress,
                navigate,
                onSuccess: () => { clearUH(); setPayState("success"); },
                onFailure: (msg) => { setError(msg); setPayState("failed"); setLoading(false); },
                onCancel: (msg) => { setError(msg); setPayState("failed"); setLoading(false); },
                deliveryType,
                distanceKm: 0,
            });
        } catch (err) {
            setError(err.message || "Payment initialization failed.");
            setPayState("failed");
        } finally { setLoading(false); }
    }, [checkoutItems, contact, selectedAddress, clearUH, navigate]);

    const selectPaymentMethod = useCallback((method) => {
        setPaymentMethod(method); setError(""); setPayState("idle");
        refreshPricing(method === "cod" ? "COD" : "RAZORPAY");
    }, [refreshPricing]);

    return {
        step, setStep: goToStep, error, setError,
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
