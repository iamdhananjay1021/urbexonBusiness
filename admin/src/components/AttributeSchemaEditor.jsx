/**
 * AttributeSchemaEditor — defines a category's dynamic product attributes
 * (the heart of the metadata-driven Product Discovery Engine).
 *
 * Each row: key ("fabric"), label ("Fabric"), type (text/select),
 * options (for select), filterable (appears in the storefront filter
 * sidebar). The order of rows = filter sidebar priority.
 *
 * Used by both Add Category and Edit Category. Product forms (admin +
 * vendor) auto-render input fields from this schema — adding "Saree"
 * with material/border/work here makes those fields and filters exist
 * everywhere with zero code changes.
 */
import { useState } from "react";
import { FiPlus, FiTrash2, FiArrowUp, FiArrowDown } from "react-icons/fi";
import { Button, Input } from "./ui";

const KEY_RE = /^[a-zA-Z0-9 _-]{1,40}$/;

const AttributeSchemaEditor = ({ value = [], onChange }) => {
    const [draftKey, setDraftKey] = useState("");

    const update = (i, patch) => {
        const next = value.map((row, j) => (j === i ? { ...row, ...patch } : row));
        onChange(next);
    };

    const move = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= value.length) return;
        const next = [...value];
        [next[i], next[j]] = [next[j], next[i]];
        onChange(next.map((row, idx) => ({ ...row, order: idx })));
    };

    const addRow = () => {
        const key = draftKey.trim();
        if (!KEY_RE.test(key)) return;
        if (value.some((r) => r.key.toLowerCase() === key.toLowerCase())) return;
        onChange([...value, {
            key,
            label: key.charAt(0).toUpperCase() + key.slice(1),
            type: "text",
            options: [],
            required: false,
            filterable: true,
            order: value.length,
        }]);
        setDraftKey("");
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {value.map((row, i) => (
                <div key={row.key}
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(90px,1fr) minmax(90px,1fr) 84px minmax(120px,1.4fr) auto",
                        gap: 8, alignItems: "center",
                        padding: "10px 12px",
                        border: "1px solid var(--adm-border)",
                        borderRadius: "var(--adm-radius-md)",
                        background: "var(--adm-surface-alt)",
                    }}>
                    <div>
                        <p style={{ fontSize: 9, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>Key</p>
                        <code style={{ fontSize: 12, color: "var(--adm-text-primary)", fontWeight: 700 }}>{row.key}</code>
                    </div>
                    <div>
                        <p style={{ fontSize: 9, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>Label</p>
                        <Input value={row.label} onChange={(e) => update(i, { label: e.target.value })}
                            placeholder={row.key} style={{ width: "100%", fontSize: 12, padding: "5px 8px" }} />
                    </div>
                    <div>
                        <p style={{ fontSize: 9, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>Type</p>
                        <select value={row.type} onChange={(e) => update(i, { type: e.target.value })}
                            style={{ width: "100%", fontSize: 12, padding: "5px 6px", border: "1px solid var(--adm-border)", borderRadius: "var(--adm-radius-sm)", background: "var(--adm-surface)", color: "var(--adm-text-primary)", fontFamily: "inherit" }}>
                            <option value="text">Text</option>
                            <option value="select">Select</option>
                        </select>
                    </div>
                    <div>
                        <p style={{ fontSize: 9, color: "var(--adm-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>
                            {row.type === "select" ? "Options (comma separated)" : "Filterable"}
                        </p>
                        {row.type === "select" ? (
                            <Input
                                value={(row.options || []).join(", ")}
                                onChange={(e) => update(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })}
                                placeholder="Cotton, Silk, Linen"
                                style={{ width: "100%", fontSize: 12, padding: "5px 8px" }}
                            />
                        ) : (
                            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--adm-text-secondary)", cursor: "pointer" }}>
                                <input type="checkbox" checked={row.filterable !== false}
                                    onChange={(e) => update(i, { filterable: e.target.checked })} />
                                Show in filters
                            </label>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" onClick={() => move(i, -1)} title="Move up" disabled={i === 0}
                            style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: "var(--adm-muted)", opacity: i === 0 ? 0.3 : 1, padding: 4 }}>
                            <FiArrowUp size={13} />
                        </button>
                        <button type="button" onClick={() => move(i, 1)} title="Move down" disabled={i === value.length - 1}
                            style={{ background: "none", border: "none", cursor: i === value.length - 1 ? "default" : "pointer", color: "var(--adm-muted)", opacity: i === value.length - 1 ? 0.3 : 1, padding: 4 }}>
                            <FiArrowDown size={13} />
                        </button>
                        <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remove"
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--adm-danger)", padding: 4 }}>
                            <FiTrash2 size={13} />
                        </button>
                    </div>
                </div>
            ))}

            <div style={{ display: "flex", gap: 8 }}>
                <Input
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addRow(); } }}
                    placeholder='Attribute key — e.g. "fabric", "fit", "ram", "storage"'
                    style={{ flex: 1 }}
                />
                <Button type="button" variant="secondary" icon={FiPlus} onClick={addRow}
                    disabled={!KEY_RE.test(draftKey.trim())}>
                    Add
                </Button>
            </div>
            <p style={{ fontSize: 10, color: "var(--adm-muted)" }}>
                Row order = filter sidebar priority. Product forms (admin &amp; vendor) auto-render these
                fields for this category, and the storefront filter sidebar picks them up automatically.
            </p>
        </div>
    );
};

export default AttributeSchemaEditor;
