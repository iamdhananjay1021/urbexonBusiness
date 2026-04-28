/**
 * useFcm.js — Hook for FCM push notification setup in delivery panel
 * Registers service worker, gets token, saves to backend, listens for foreground messages
 *
 * ✅ RE-RENDER FIX: onNewOrder is stored in a ref so the FCM listener
 * is NOT re-registered on every parent render (was causing listener churn).
 */
import { useEffect, useRef, useCallback } from "react";
import api from "../api/axios";
import { initFirebaseApp, requestFcmToken, onForegroundMessage } from "../utils/firebase";
import { startAlert } from "../utils/notificationSound";

const useFcm = ({ onNewOrder } = {}) => {
    const registered = useRef(false);
    // ✅ FIX: Keep latest callback in ref — avoids FCM effect re-running on every render
    const onNewOrderRef = useRef(onNewOrder);
    useEffect(() => { onNewOrderRef.current = onNewOrder; }, [onNewOrder]);

    const registerToken = useCallback(async () => {
        if (registered.current) return;
        registered.current = true;

        try {
            initFirebaseApp();
            const token = await requestFcmToken();
            if (token) {
                await api.patch("/delivery/fcm-token", { token });
                console.log("[FCM] Token registered with backend");
            }
        } catch (err) {
            console.warn("[FCM] Registration failed:", err.message);
            registered.current = false;
        }
    }, []);

    useEffect(() => {
        registerToken();

        // Listen for foreground FCM messages — always reads latest onNewOrder via ref
        const unsubscribe = onForegroundMessage((payload) => {
            const data = payload.data || {};
            if (data.type === "NEW_ORDER" && onNewOrderRef.current) {
                onNewOrderRef.current({
                    orderId: data.orderId,
                    amount: Number(data.amount || 0),
                    items: Number(data.items || 0),
                    distanceKm: Number(data.distanceKm || 0),
                    address: data.address || "",
                });
                startAlert();
            }
        });

        // Listen for service worker messages (accept/reject from notification actions)
        const handleSwMessage = (event) => {
            const { type, orderId } = event.data || {};
            if (type === "FCM_ACCEPT_ORDER" && orderId) {
                api.patch(`/delivery/orders/${orderId}/accept`)
                    .then(() => onNewOrderRef.current?.({ accepted: true, orderId }))
                    .catch(err => console.warn("[FCM] Accept failed:", err.message));
            }
            if (type === "FCM_REJECT_ORDER" && orderId) {
                api.patch(`/delivery/orders/${orderId}/reject`)
                    .catch(err => console.warn("[FCM] Reject failed:", err.message));
            }
        };

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.addEventListener("message", handleSwMessage);
        }

        return () => {
            if (typeof unsubscribe === "function") unsubscribe();
            if ("serviceWorker" in navigator) {
                navigator.serviceWorker.removeEventListener("message", handleSwMessage);
            }
        };
    }, [registerToken]); // ✅ No onNewOrder dep — ref handles latest value
};

export default useFcm;
