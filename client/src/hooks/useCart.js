/**
 * useCart.js — Urbexon Dual Cart Hook
 * ─────────────────────────────────────
 * Provides unified interface for both ecommerce + UH carts.
 * Components just call addItem(product) — routing happens automatically.
 */

import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    addToCart,
    addToUHCart,
    addToEcommerceCart,
    buyNowSingle,
    updateQuantity,
    incQty,
    decQty,
    removeFromCart,
    clearEcommerceCart,
    clearUHCart,
    clearCart,
    selectEcommerceItems,
    selectUHItems,
    selectEcommerceTotalItems,
    selectUHTotalItems,
    selectTotalItems,
    selectEcommerceTotalPrice,
    selectUHTotalPrice,
} from "../features/cart/cartSlice";

export const useCart = () => {
    const dispatch = useDispatch();

    const ecommerceItems = useSelector(selectEcommerceItems);
    const uhItems = useSelector(selectUHItems);
    const ecommerceTotalQty = useSelector(selectEcommerceTotalItems);
    const uhTotalQty = useSelector(selectUHTotalItems);
    const totalItems = useSelector(selectTotalItems);
    const ecommerceTotal = useSelector(selectEcommerceTotalPrice);
    const uhTotal = useSelector(selectUHTotalPrice);

    // BUG FIX: every function below was recreated on every render, so any
    // memoized child (React.memo/PureComponent) receiving them as props —
    // e.g. ProductCard's addItem — re-rendered whenever ANYTHING using this
    // hook re-rendered, not just when the cart actually changed. dispatch
    // is a stable reference from react-redux, so wrapping in useCallback
    // with it as the only dep gives every consumer a stable identity for
    // free without altering what any of these functions do.

    // ── Add to correct cart automatically ─────────────────
    const addItem = useCallback((product) => dispatch(addToCart(product)), [dispatch]);
    const addUHItem = useCallback((product) => dispatch(addToUHCart(product)), [dispatch]);
    const addEcommerceItem = useCallback((product) => dispatch(addToEcommerceCart(product)), [dispatch]);

    // ── Buy now ───────────────────────────────────────────
    const buyNow = useCallback((product) => dispatch(buyNowSingle(product)), [dispatch]);

    // ── Quantity controls ─────────────────────────────────
    const increment = useCallback((id, cartType = "ecommerce") => dispatch(incQty({ id, cartType })), [dispatch]);
    const decrement = useCallback((id, cartType = "ecommerce") => dispatch(decQty({ id, cartType })), [dispatch]);
    const setQuantity = useCallback(
        (id, quantity, cartType = "ecommerce") => dispatch(updateQuantity({ id, quantity, cartType })),
        [dispatch]
    );

    // ── Remove ────────────────────────────────────────────
    const removeItem = useCallback(
        (id, cartType = "ecommerce") => dispatch(removeFromCart({ id, cartType })),
        [dispatch]
    );

    // ── Clear ─────────────────────────────────────────────
    const clearEcommerce = useCallback(() => dispatch(clearEcommerceCart()), [dispatch]);
    const clearUH = useCallback(() => dispatch(clearUHCart()), [dispatch]);
    const clearAll = useCallback(() => dispatch(clearCart()), [dispatch]);

    // ── Check if in cart ──────────────────────────────────
    const isInEcommerceCart = useCallback((id) => ecommerceItems.some((i) => i._id === id), [ecommerceItems]);
    const isInUHCart = useCallback((id) => uhItems.some((i) => i._id === id), [uhItems]);
    const isInCart = useCallback(
        (id) => isInEcommerceCart(id) || isInUHCart(id),
        [isInEcommerceCart, isInUHCart]
    );

    // ── Legacy aliases (backward compat) ──────────────────
    const cartItems = ecommerceItems;   // pages using cartItems get ecommerce cart
    const cartCount = ecommerceTotalQty;
    const mixTypeError = null;           // no longer applicable
    const clearMixError = useCallback(() => { }, []); // no-op

    // The returned object itself was also a fresh reference every render —
    // memoizing it means a component that only destructures e.g. `addItem`
    // still gets a stable object if that's ever passed down whole.
    return useMemo(() => ({
        // Data
        ecommerceItems,
        uhItems,
        cartItems,          // legacy alias → ecommerceItems
        ecommerceTotalQty,
        uhTotalQty,
        totalItems,         // both carts combined
        cartCount,          // legacy alias → ecommerceTotalQty
        ecommerceTotal,
        uhTotal,

        // Actions
        addItem,            // auto-routes to correct cart
        addUHItem,
        addEcommerceItem,
        buyNow,
        increment,
        decrement,
        setQuantity,
        removeItem,
        clearEcommerce,
        clearUH,
        clearAll,

        // Checks
        isInCart,
        isInEcommerceCart,
        isInUHCart,

        // Legacy
        mixTypeError,
        clearMixError,
    }), [
        ecommerceItems, uhItems, cartItems, ecommerceTotalQty, uhTotalQty,
        totalItems, cartCount, ecommerceTotal, uhTotal,
        addItem, addUHItem, addEcommerceItem, buyNow, increment, decrement,
        setQuantity, removeItem, clearEcommerce, clearUH, clearAll,
        isInCart, isInEcommerceCart, isInUHCart, mixTypeError, clearMixError,
    ]);
};