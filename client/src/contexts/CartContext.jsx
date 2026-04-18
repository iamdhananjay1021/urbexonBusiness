import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const CartContext = createContext(null);

export const CartProvider = ({ children }) => {
    const [cartItems, setCartItems] = useState(() => {
        // 🔥 LOAD FROM LOCALSTORAGE
        try {
            const saved = localStorage.getItem("cartItems");
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // 🔥 PERSIST CART
    useEffect(() => {
        localStorage.setItem("cartItems", JSON.stringify(cartItems));
    }, [cartItems]);

    // =====================
    // CART ACTIONS
    // =====================

    const addItem = (product, qty = 1) => {
        setCartItems((prev) => {
            const exist = prev.find((p) => p._id === product._id);

            if (exist) {
                return prev.map((p) =>
                    p._id === product._id
                        ? { ...p, quantity: p.quantity + qty }
                        : p
                );
            }

            return [...prev, { ...product, quantity: qty }];
        });
    };

    const removeItem = (id) => {
        setCartItems((prev) => prev.filter((p) => p._id !== id));
    };

    const updateItemQuantity = (id, quantity) => {
        if (quantity < 1) return;

        setCartItems((prev) =>
            prev.map((p) =>
                p._id === id ? { ...p, quantity } : p
            )
        );
    };

    const clear = () => {
        setCartItems([]);
        localStorage.removeItem("cartItems");
    };

    // =====================
    // DERIVED VALUES
    // =====================
    const totalItems = useMemo(
        () => cartItems.reduce((sum, i) => sum + i.quantity, 0),
        [cartItems]
    );

    const totalPrice = useMemo(
        () =>
            cartItems.reduce(
                (sum, i) => sum + i.price * i.quantity,
                0
            ),
        [cartItems]
    );

    return (
        <CartContext.Provider
            value={{
                cartItems,
                totalItems,
                totalPrice,
                addItem,
                removeItem,
                updateItemQuantity,
                clear,
            }}
        >
            {children}
        </CartContext.Provider>
    );
};

// 🔥 SAFE HOOK
export const useCartContext = () => {
    const ctx = useContext(CartContext);
    if (!ctx) {
        throw new Error("useCart must be used inside CartProvider");
    }
    return ctx;
}; 