/**
 * UHLocationContext — single source of truth for "what pincode is the
 * user currently shopping under" on the Urbexon Hour side of the app.
 *
 * Why this exists: the UH pincode used to be read/written directly against
 * localStorage from three separate places (Navbar.jsx, UrbexonHour.jsx,
 * DeliveryEstimate.jsx's UHDeliveryEstimate), kept in sync only via a
 * hand-rolled `window.dispatchEvent("uh-pincode-changed")` that every
 * writer had to remember to fire. Any new consumer that forgot to listen
 * for that event (or any writer that forgot to dispatch it) would show
 * stale data — which is exactly what happened with the Navbar's "Set
 * delivery pincode" pill staying static after a pincode was checked
 * elsewhere. A React Context makes every consumer reactive automatically;
 * no event bus to maintain.
 *
 * This context only owns the pincode *value* — it does NOT own product
 * fetching, availability business logic, or the pincode-serviceability
 * check itself. UrbexonHour.jsx still owns "what happens once a pincode
 * is confirmed" (fetching products/deals/homepage data); it just reports
 * the confirmed value here via setUhPincode() instead of writing
 * localStorage directly.
 */
import { createContext, useContext, useState, useCallback, useMemo } from "react";
import { readUhPincode } from "../utils/uhPincode";

const UHLocationContext = createContext(null);

export const UHLocationProvider = ({ children }) => {
    const [uhPincode, setUhPincodeState] = useState(readUhPincode);

    const setUhPincode = useCallback((data) => {
        if (!data?.code) {
            try { localStorage.removeItem("uh_pincode"); } catch { /* storage unavailable */ }
            setUhPincodeState(null);
            return;
        }
        try { localStorage.setItem("uh_pincode", JSON.stringify(data)); } catch { /* storage unavailable — state still updates below */ }
        setUhPincodeState(data);
    }, []);

    const clearUhPincode = useCallback(() => {
        try { localStorage.removeItem("uh_pincode"); } catch { /* storage unavailable */ }
        setUhPincodeState(null);
    }, []);

    const value = useMemo(
        () => ({ uhPincode, setUhPincode, clearUhPincode }),
        [uhPincode, setUhPincode, clearUhPincode]
    );

    return <UHLocationContext.Provider value={value}>{children}</UHLocationContext.Provider>;
};

export const useUHLocation = () => {
    const ctx = useContext(UHLocationContext);
    if (!ctx) throw new Error("useUHLocation must be used inside UHLocationProvider");
    return ctx;
};
