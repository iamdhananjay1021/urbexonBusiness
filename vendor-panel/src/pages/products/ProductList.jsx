import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaSearch } from "react-icons/fa";

const fmt = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

const ProductList = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 15;

  // Debounce search — 400ms
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/products/vendor/mine?page=${page}&limit=${LIMIT}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ""}`);
      setProducts(data.products || []); setTotal(data.total || 0);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, [page, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (id, current) => {
    try {
      await api.put(`/products/vendor/${id}`, { isActive: !current });
      load();
    } catch { alert("Failed"); }
  };

  const deleteProduct = async (id) => {
    if (!confirm("Remove this product?")) return;
    try { await api.delete(`/products/vendor/${id}`); load(); }
    catch { alert("Failed"); }
  };

  const S = {
    root: {},
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 },
    title: { fontSize: 22, fontWeight: 800, color: "#1e293b", margin: 0 },
    addBtn: { display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", background: "#1a1740", border: "none", color: "#c9a84c", fontWeight: 700, fontSize: 13, borderRadius: 8, cursor: "pointer" },
    searchWrap: { position: "relative", width: 260 },
    searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" },
    searchInp: { width: "100%", padding: "9px 14px 9px 36px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" },
    table: { width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" },
    th: { padding: "11px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1, textTransform: "uppercase", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" },
    td: { padding: "13px 14px", fontSize: 13, color: "#1e293b", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
  };

  return (
    <div style={S.root}>
      <div style={S.header}>
        <div>
          <h1 style={S.title}>My Products</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>These appear in Urbexon Hour section</p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={S.searchWrap}>
            <FaSearch size={12} style={S.searchIcon} />
            <input style={S.searchInp} placeholder="Search products…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <button style={S.addBtn} onClick={() => navigate("/products/new")}>
            <FaPlus size={12} /> Add Product
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>Loading…</div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <FaPlus size={32} color="#e2e8f0" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 700, color: "#64748b", marginBottom: 8 }}>No products yet</div>
          <button onClick={() => navigate("/products/new")} style={{ padding: "10px 20px", background: "#1a1740", border: "none", color: "#c9a84c", borderRadius: 8, cursor: "pointer", fontWeight: 700 }}>Add First Product</button>
        </div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
              <thead><tr>
                {["Product", "Category", "Price", "Stock", "Status", "Actions"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={S.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {p.images?.[0]?.url ? (
                          <img src={p.images[0].url} alt={p.name} style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 42, height: 42, borderRadius: 8, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📦</div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                          {p.discountPercent > 0 && <div style={{ fontSize: 10, color: "#22c55e", fontWeight: 700 }}>{p.discountPercent}% OFF</div>}
                        </div>
                      </div>
                    </td>
                    <td style={S.td}>{p.category}</td>
                    <td style={S.td}>
                      <div style={{ fontWeight: 700 }}>{fmt(p.price)}</div>
                      {p.mrp && <div style={{ fontSize: 11, color: "#94a3b8", textDecoration: "line-through" }}>{fmt(p.mrp)}</div>}
                    </td>
                    <td style={S.td}>
                      <span style={{ fontWeight: 700, color: p.stock > 5 ? "#22c55e" : p.stock > 0 ? "#f59e0b" : "#ef4444" }}>{p.stock}</span>
                    </td>
                    <td style={S.td}>
                      <button onClick={() => toggleActive(p._id, p.isActive)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: p.isActive ? "#22c55e" : "#94a3b8" }}>
                        {p.isActive ? <><FaToggleOn size={18} />Active</> : <><FaToggleOff size={18} />Inactive</>}
                      </button>
                    </td>
                    <td style={S.td}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => navigate(`/products/${p._id}/edit`)} style={{ padding: "6px 10px", background: "#eff6ff", border: "none", color: "#2563eb", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <FaEdit size={11} />Edit
                        </button>
                        <button onClick={() => deleteProduct(p._id)} style={{ padding: "6px 10px", background: "#fef2f2", border: "none", color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                          <FaTrash size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, fontSize: 13 }}>
            <span style={{ color: "#64748b" }}>Showing {products.length} of {total}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: "6px 14px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", background: page === 1 ? "#f1f5f9" : "#fff" }}>←</button>
              <span style={{ padding: "6px 12px", background: "#1a1740", color: "#c9a84c", borderRadius: 6, fontWeight: 700 }}>{page}</span>
              <button disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)} style={{ padding: "6px 14px", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", background: page * LIMIT >= total ? "#f1f5f9" : "#fff" }}>→</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
export default ProductList;
