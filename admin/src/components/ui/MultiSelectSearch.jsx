/**
 * MultiSelectSearch.jsx — debounced async search → pick multiple → chips.
 *
 * Built for the Coupon Engine's product/vendor/collection targeting
 * pickers (AdminCoupons.jsx) — no equivalent existed in ui/ before this;
 * AdminCollections.jsx's closest precedent (rules.category/brand/tags)
 * uses plain comma-separated text `Input`s because those are free-text
 * fields with no backing collection to search, but products/vendors need
 * an actual ObjectId reference, hence a real search-and-pick control.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { FiSearch, FiX } from "react-icons/fi";
import api from "../../api/adminApi";
import useDebounce from "../../hooks/useDebounce";

/**
 * @param {string[]} value - selected ids
 * @param {(ids:string[]) => void} onChange
 * @param {string} [searchUrl] - e.g. "/products/admin/all" (expects ?search=&limit=). Omit when staticItems is used.
 * @param {string} [resultsKey] - key in the response holding the array, e.g. "products"
 * @param {object[]} [staticItems] - when provided, skips the network round-trip and filters/lists this array
 *   client-side instead (e.g. a small, admin-curated collection like Category, where a real search endpoint
 *   would be overkill and where "show everything on focus" is more useful than "type to search").
 * @param {(item:object) => string} getLabel
 * @param {(item:object) => string} getId
 * @param {string} placeholder
 */
const MultiSelectSearch = ({
    value = [], onChange, searchUrl, resultsKey, staticItems,
    getLabel = (i) => i.name || i.shopName || i.code || i._id,
    getId = (i) => i._id,
    placeholder = "Search…",
}) => {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selectedLabels, setSelectedLabels] = useState({}); // id -> label, so chips survive after the search results that produced them scroll away
    const debouncedQuery = useDebounce(query, 300);
    const boxRef = useRef(null);

    useEffect(() => {
        if (staticItems) {
            const q = debouncedQuery.trim().toLowerCase();
            setResults(q ? staticItems.filter((i) => getLabel(i).toLowerCase().includes(q)) : staticItems);
            return;
        }
        if (!debouncedQuery.trim()) { setResults([]); return; }
        let cancelled = false;
        setLoading(true);
        api.get(searchUrl, { params: { search: debouncedQuery.trim(), limit: 10 } })
            .then(({ data }) => { if (!cancelled) setResults(data?.[resultsKey] || []); })
            .catch(() => { if (!cancelled) setResults([]); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [debouncedQuery, searchUrl, resultsKey, staticItems, getLabel]);

    useEffect(() => {
        const onClickOutside = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const add = useCallback((item) => {
        const id = getId(item);
        if (!value.includes(id)) {
            onChange([...value, id]);
            setSelectedLabels((p) => ({ ...p, [id]: getLabel(item) }));
        }
        setQuery(""); setResults([]); setOpen(false);
    }, [value, onChange, getId, getLabel]);

    const remove = (id) => onChange(value.filter((v) => v !== id));

    return (
        <div ref={boxRef} style={{ position: "relative" }}>
            {value.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    {value.map((id) => (
                        <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 600, padding: "3px 8px 3px 10px", borderRadius: 20, background: "var(--adm-primary-tint)", color: "var(--adm-primary)" }}>
                            {selectedLabels[id] || id.slice(-6)}
                            <button type="button" onClick={() => remove(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}>
                                <FiX size={11} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
            <div style={{ position: "relative" }}>
                <FiSearch size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--adm-muted)" }} />
                <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="adm-field-input"
                    style={{ paddingLeft: 30 }}
                />
            </div>
            {open && (query.trim() || loading || staticItems) && (
                <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--adm-surface)", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", maxHeight: 220, overflowY: "auto" }}>
                    {loading ? (
                        <div style={{ padding: 12, fontSize: 12, color: "var(--adm-muted)" }}>Searching…</div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: 12, fontSize: 12, color: "var(--adm-muted)" }}>No matches</div>
                    ) : (
                        results.map((item) => {
                            const id = getId(item);
                            const already = value.includes(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    disabled={already}
                                    onClick={() => add(item)}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", background: "none", border: "none", cursor: already ? "default" : "pointer", fontSize: 12.5, color: already ? "var(--adm-muted)" : "var(--adm-text-primary)", fontFamily: "inherit" }}
                                    onMouseEnter={(e) => { if (!already) e.currentTarget.style.background = "var(--adm-surface-alt)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                                >
                                    {getLabel(item)}{already ? " (added)" : ""}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelectSearch;
