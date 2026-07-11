/**
 * Reads the confirmed Urbexon Hour pincode that UrbexonHour.jsx persists to
 * localStorage — the single source of truth for "what pincode is this user
 * currently shopping under" on the UH side of the app (separate from the
 * ecommerce LocationContext). Shared by Navbar.jsx and VendorStore.jsx so
 * neither can drift from what the page itself is using.
 */
export const readUhPincode = () => {
    try {
        const stored = localStorage.getItem("uh_pincode");
        if (stored) {
            const p = JSON.parse(stored);
            if (p?.code) return p;
        }
    } catch { /* malformed/missing — treat as no saved pincode */ }
    return null;
};
