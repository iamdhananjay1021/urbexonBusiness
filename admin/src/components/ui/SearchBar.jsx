import { FiSearch, FiX } from "react-icons/fi";

/**
 * SearchBar.jsx — the one search-input system for the admin panel.
 * Replaces 9 independent hand-rolled search bars (AdminBanners,
 * AdminCoupons, AdminCustomers, AdminDeliveryBoys, AdminOrders,
 * AdminPincodes, AdminProducts, AdminSubscriptions, AdminVendors).
 */
const SearchBar = ({ value, onChange, placeholder = "Search…", onSubmit, className = "" }) => (
    <form
        className={`adm-searchbar ${className}`}
        onSubmit={(e) => { e.preventDefault(); onSubmit?.(value); }}
        role="search"
    >
        <FiSearch size={14} />
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
        />
        {value && (
            <button
                type="button"
                onClick={() => onChange("")}
                aria-label="Clear search"
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-muted)", display: "flex" }}
            >
                <FiX size={14} />
            </button>
        )}
    </form>
);

export default SearchBar;
