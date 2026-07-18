/**
 * DynamicAttributeFields — renders product-form inputs from a category's
 * attributeSchema (Product Discovery metadata). Shared by AdminAddProduct
 * and AdminEditProduct so neither form hardcodes attribute names.
 *
 * value    — { key: value } attributes object
 * schema   — [{ key, label, type, options, required }]
 * onChange — (nextValue) => void
 */
const DynamicAttributeFields = ({ schema = [], value = {}, onChange }) => {
    if (!schema.length) return null;

    const set = (key, v) => onChange({ ...value, [key]: v });

    return (
        <div style={{
            border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-lg)",
            padding: 16, background: "var(--adm-surface-alt)", marginTop: 16,
        }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "var(--adm-text-primary)", marginBottom: 4 }}>
                🏷️ Product Attributes
            </p>
            <p style={{ fontSize: 10.5, color: "var(--adm-muted)", marginBottom: 14 }}>
                Auto-loaded from this category's metadata — these values power the storefront filter sidebar.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {schema.map((attr) => (
                    <div key={attr.key}>
                        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--adm-text-secondary)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 5 }}>
                            {attr.label || attr.key}{attr.required && <span style={{ color: "var(--adm-danger)" }}> *</span>}
                        </label>
                        {attr.type === "select" && attr.options?.length > 0 ? (
                            <select
                                value={value[attr.key] || ""}
                                onChange={(e) => set(attr.key, e.target.value)}
                                style={{ width: "100%", padding: "9px 10px", fontSize: 13, border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-surface)", color: "var(--adm-text-primary)", fontFamily: "inherit" }}
                            >
                                <option value="">Select {attr.label || attr.key}</option>
                                {attr.options.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                        ) : (
                            <input
                                value={value[attr.key] || ""}
                                onChange={(e) => set(attr.key, e.target.value)}
                                placeholder={attr.options?.[0] ? `e.g. ${attr.options[0]}` : ""}
                                style={{ width: "100%", padding: "9px 10px", fontSize: 13, border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-md)", background: "var(--adm-surface)", color: "var(--adm-text-primary)", fontFamily: "inherit", boxSizing: "border-box" }}
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DynamicAttributeFields;
