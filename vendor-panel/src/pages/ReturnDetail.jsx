/**
 * ReturnDetail.jsx — single return detail. Reads GET /vendor/returns/:id
 * (vendorReturnController.js::getMyReturnDetail) — no new business logic,
 * pure presentation.
 *
 * The "Timeline" section here is intentionally minimal (return/refund
 * dates only) — Module 4 of this phase builds the full unified timeline
 * (actors, audit-log integration); this is the functional baseline so
 * Module 2 isn't left incomplete while that's still pending.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/axios";
import { FiArrowLeft, FiPackage, FiUser, FiClock } from "react-icons/fi";

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const STATUS_STYLES = {
  REQUESTED: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
  APPROVED: { bg: "#dbeafe", color: "#1d4ed8", label: "Approved" },
  REJECTED: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
  PICKED_UP: { bg: "#ede9fe", color: "#6d28d9", label: "In Transit" },
  REFUNDED: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
};
const REFUND_STATUS_STYLES = {
  NONE: { bg: "#f3f4f6", color: "#6b7280", label: "—" },
  REQUESTED: { bg: "#fef3c7", color: "#92400e", label: "Requested" },
  PROCESSING: { bg: "#dbeafe", color: "#1d4ed8", label: "Processing" },
  PROCESSED: { bg: "#d1fae5", color: "#065f46", label: "Refunded" },
  FAILED: { bg: "#fee2e2", color: "#b91c1c", label: "Failed" },
  REJECTED: { bg: "#fee2e2", color: "#b91c1c", label: "Rejected" },
};
const StatusPill = ({ status, map }) => {
  const s = map[status] || { bg: "#f3f4f6", color: "#6b7280", label: status };
  return <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
};

const Card = ({ title, children }) => (
  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", padding: 20, marginBottom: 16 }}>
    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>{title}</h3>
    {children}
  </div>
);
const Field = ({ label, value }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>{label}</div>
    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginTop: 2 }}>{value || "—"}</div>
  </div>
);

const ReturnDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data: res } = await api.get(`/vendor/returns/${id}`);
        setData(res.return);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load return");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
      <div style={{ width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#7c3aed", borderRadius: "50%", animation: "spin .8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (error || !data) return (
    <div style={{ textAlign: "center", padding: 60, color: "#6b7280" }}>{error || "Return not found"}</div>
  );

  // Unified timeline — built only from data that actually exists.
  // return/refund transitions don't push to order.timeline (unlike
  // orderStatus changes), so there's a single processedAt/processedBy per
  // return, not a full per-step history — the "current milestone reached"
  // step below is exactly that one real data point, not a reconstruction
  // of every intermediate step. Actors are shown at role level only.
  const CURRENT_MILESTONE_LABEL = {
    APPROVED: "Return Approved", REJECTED: "Return Rejected",
    PICKED_UP: "Item Picked Up", REFUNDED: "Return Completed",
  };
  const roleLabel = (r) => r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
  const timeline = [
    data.statusTimeline?.deliveredAt && { label: "Order Delivered", when: data.statusTimeline.deliveredAt, actor: roleLabel(data.deliveredByRole) },
    data.return.requestedAt && { label: "Return Requested", when: data.return.requestedAt, actor: "Customer" },
    CURRENT_MILESTONE_LABEL[data.return.status] && data.return.processedAt &&
      { label: CURRENT_MILESTONE_LABEL[data.return.status], when: data.return.processedAt, actor: "Admin" },
    data.refund.requestedAt && { label: "Refund Initiated", when: data.refund.requestedAt, actor: "Admin" },
    data.refund.status === "PROCESSED" && data.refund.processedAt && { label: "Refund Completed", when: data.refund.processedAt, actor: "System" },
    data.walletAdjustmentStatus === "applied" && { label: "Wallet Adjustment Applied", when: null, actor: "System" },
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate("/returns")} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 10, border: "1px solid #e5e7eb",
          background: "#fff", color: "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
          <FiArrowLeft size={13} /> Back
        </button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 800, color: "#111827", margin: 0 }}>
            {data.invoiceNumber || `#${data._id.slice(-6).toUpperCase()}`}
          </h1>
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{fmtDateTime(data.createdAt)}</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <StatusPill status={data.return.status} map={STATUS_STYLES} />
          <StatusPill status={data.refund.status} map={REFUND_STATUS_STYLES} />
        </div>
      </div>

      {/* Return Information */}
      <Card title="Return Information">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: data.return.images?.length ? 16 : 0 }}>
          <Field label="Reason" value={data.return.reason} />
          <Field label="Requested At" value={fmtDateTime(data.return.requestedAt)} />
          <Field label="Deadline" value={fmtDateTime(data.return.deadlineAt)} />
          <Field label="Refund Amount" value={fmt(data.return.refundAmount)} />
          <Field label="Tracking URL" value={data.return.trackingUrl ? <a href={data.return.trackingUrl} target="_blank" rel="noreferrer" style={{ color: "#7c3aed" }}>View</a> : "—"} />
          <Field label="Note" value={data.return.adminNote} />
        </div>
        {data.return.images?.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {data.return.images.map((img, i) => (
              <a key={i} href={img} target="_blank" rel="noreferrer" style={{ width: 72, height: 72, borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", display: "block" }}>
                <img src={img} alt={`Return evidence ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </a>
            ))}
          </div>
        )}
      </Card>

      {/* Customer */}
      <Card title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><FiUser size={14} /> Customer</span>}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Field label="Name" value={data.customerName} />
          <Field label="Phone" value={data.phone} />
        </div>
      </Card>

      {/* Products */}
      <Card title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><FiPackage size={14} /> Product{data.items.length !== 1 ? "s" : ""}</span>}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.items.map((item, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: i < data.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
              {item.image && <img src={item.image} alt={item.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.name}</div>
                <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>
                  Qty: {item.qty} {item.selectedSize ? `· Size: ${item.selectedSize}` : ""} {item.selectedColor ? `· Color: ${item.selectedColor}` : ""}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{fmt(item.price)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Order Information */}
      <Card title="Order Information">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Field label="Order Status" value={data.orderStatus} />
          <Field label="Order Mode" value={data.orderMode} />
          <Field label="Total Amount" value={fmt(data.totalAmount)} />
        </div>
      </Card>

      {/* Refund Dashboard — Module 3: Amount/Status/Date/Method/Wallet
          Adjustment Status/Settlement Status/Return Status, all in one
          panel rather than splitting into a second overlapping card. */}
      <Card title="Refund Dashboard">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
          <Field label="Refund Amount" value={fmt(data.refund.amount)} />
          <Field label="Refund Status" value={<StatusPill status={data.refund.status} map={REFUND_STATUS_STYLES} />} />
          <Field label="Refund Date" value={fmtDateTime(data.refund.processedAt)} />
          <Field label="Refund Method" value={data.refundMethod === "RAZORPAY" ? "Razorpay Gateway" : data.refundMethod === "COD" ? "Manual (COD)" : "—"} />
          <Field
            label="Wallet Adjustment"
            value={
              data.walletAdjustmentStatus === "applied" ? <span style={{ color: "#065f46", fontWeight: 700 }}>Applied</span>
              : data.walletAdjustmentStatus === "not_applied" ? <span style={{ color: "#92400e", fontWeight: 700 }}>Pending</span>
              : <span style={{ color: "#9ca3af" }}>Not Applicable</span>
            }
          />
          <Field label="Settlement Status" value={data.settlement ? data.settlement.status : <span style={{ color: "#9ca3af" }}>No settlement</span>} />
          <Field label="Return Status" value={<StatusPill status={data.return.status} map={STATUS_STYLES} />} />
          {data.refund.rejectionReason && <Field label="Rejection Reason" value={data.refund.rejectionReason} />}
        </div>
      </Card>

      {/* Settlement (read-only) */}
      <Card title="Settlement Information">
        {data.settlement ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16 }}>
            <Field label="Settlement Status" value={data.settlement.status} />
            <Field label="Vendor Earning" value={fmt(data.settlement.vendorEarning)} />
            <Field label="Commission Rate" value={`${data.settlement.commissionRate}%`} />
            <Field label="Settled On" value={fmtDateTime(data.settlement.settlementDate)} />
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "#9ca3af", margin: 0 }}>
            No settlement exists for this order — this order type doesn't generate a vendor settlement.
          </p>
        )}
      </Card>

      {/* Timeline */}
      <Card title={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><FiClock size={14} /> Timeline</span>}>
        {timeline.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "#9ca3af", margin: 0 }}>No timeline events yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {timeline.map(({ label, when, actor }, i) => (
              <div key={label} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#7c3aed", marginTop: 4 }} />
                  {i < timeline.length - 1 && <div style={{ width: 2, flex: 1, minHeight: 24, background: "#e5e7eb" }} />}
                </div>
                <div style={{ paddingBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>
                    {when ? fmtDateTime(when) : "—"}{actor ? ` · by ${actor}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default ReturnDetail;
