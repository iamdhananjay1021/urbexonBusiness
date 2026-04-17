/**
 * emailTemplates.js — Branded Urbexon email templates for ALL roles
 * Consistent dark navy + gold theme across all transactional emails
 */

const BRAND = {
    name: "Urbexon",
    color: "#1a1740",
    gold: "#d4a843",
    url: process.env.CLIENT_URL || "https://urbexon.in",
    adminUrl: process.env.ADMIN_URL || "https://admin.urbexon.in",
    vendorUrl: process.env.VENDOR_URL || "https://vendor.urbexon.in",
    deliveryUrl: process.env.DELIVERY_URL || "https://delivery.urbexon.in",
};

const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const shortId = (id) => String(id).slice(-8).toUpperCase();

const baseLayout = (title, bodyHtml, footerExtra = "") => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px">
  <div style="text-align:center;padding:20px 0">
    <h1 style="margin:0;font-size:24px;font-weight:900;color:${BRAND.color};letter-spacing:1px">${BRAND.name}</h1>
  </div>
  <div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">
    <div style="background:${BRAND.color};padding:20px 24px">
      <h2 style="margin:0;font-size:18px;font-weight:700;color:${BRAND.gold}">${title}</h2>
    </div>
    <div style="padding:24px">${bodyHtml}</div>
  </div>
  <div style="text-align:center;padding:24px 0;color:#9ca3af;font-size:11px">
    ${footerExtra}
    <p style="margin:4px 0">&copy; ${new Date().getFullYear()} Urbexon. All rights reserved.</p>
    <p style="margin:4px 0">This is an automated email. Please do not reply directly.</p>
  </div>
</div>
</body></html>`;

/* ═══════════════════════════════════════════════════
   VENDOR EMAILS
═══════════════════════════════════════════════════ */

/**
 * New order notification for vendor
 */
export const vendorNewOrderEmail = (order, vendorItems, vendorName) => {
    const oid = shortId(order._id);
    const isUH = order.orderMode === "URBEXON_HOUR";
    const itemsHtml = vendorItems.map(item => `
        <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px">${item.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:center">${item.quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:right">${fmt(item.price * item.quantity)}</td>
        </tr>
    `).join("");

    const total = vendorItems.reduce((s, i) => s + (i.price * i.quantity), 0);

    const body = `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${vendorName || "Vendor"},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151">
            You have a new ${isUH ? '<span style="color:#f59e0b;font-weight:700">⚡ Urbexon Hour</span>' : ""} order!
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 16px">
            <p style="margin:0 0 6px;font-size:12px;color:#6b7280">Order ID</p>
            <p style="margin:0;font-size:18px;font-weight:800;color:${BRAND.color}">#${oid}</p>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
            <thead><tr style="background:#f8fafc">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Product</th>
                <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase">Qty</th>
                <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase">Amount</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
            <tfoot><tr style="background:#f0fdf4">
                <td colspan="2" style="padding:10px 12px;font-size:14px;font-weight:700;color:#065f46">Total</td>
                <td style="padding:10px 12px;font-size:14px;font-weight:700;color:#065f46;text-align:right">${fmt(total)}</td>
            </tr></tfoot>
        </table>
        ${isUH ? `<div style="background:#fef3c7;border-radius:8px;padding:12px;margin:0 0 16px">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">⚡ Urbexon Hour — Please prepare this order immediately for quick delivery.</p>
        </div>` : ""}
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">
            <strong>Customer:</strong> ${order.customerName || "N/A"}<br>
            <strong>Phone:</strong> ${order.phone || "N/A"}<br>
            <strong>Address:</strong> ${order.address || "N/A"}
        </p>
        <div style="text-align:center;margin:24px 0 0">
            <a href="${BRAND.vendorUrl}/orders" style="display:inline-block;padding:12px 32px;background:${BRAND.color};color:${BRAND.gold};text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">View in Dashboard</a>
        </div>
    `;

    return {
        subject: `🛒 New Order #${oid}${isUH ? " ⚡ Urbexon Hour" : ""} — Action Required`,
        html: baseLayout("New Order Received! 🎉", body),
    };
};

/**
 * Vendor payout info email
 */
export const vendorPayoutEmail = (vendorName, amount, status, txnId) => {
    const statusColors = {
        approved: { bg: "#d1fae5", text: "#065f46", label: "Approved" },
        processing: { bg: "#dbeafe", text: "#1e40af", label: "Processing" },
        completed: { bg: "#d1fae5", text: "#065f46", label: "Completed" },
        rejected: { bg: "#fee2e2", text: "#991b1b", label: "Rejected" },
    };
    const sc = statusColors[status] || statusColors.processing;

    const body = `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${vendorName},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Your payout request has been updated:</p>
        <div style="background:#f8fafc;border-radius:8px;padding:20px;text-align:center;margin:0 0 16px">
            <p style="margin:0 0 8px;font-size:28px;font-weight:900;color:${BRAND.color}">${fmt(amount)}</p>
            <span style="display:inline-block;padding:4px 16px;border-radius:20px;background:${sc.bg};color:${sc.text};font-size:13px;font-weight:700">${sc.label}</span>
        </div>
        ${txnId ? `<p style="margin:0 0 16px;font-size:13px;color:#6b7280">Transaction ID: <strong>${txnId}</strong></p>` : ""}
        <p style="margin:0;font-size:13px;color:#6b7280">Payouts are processed within 2-3 business days after approval.</p>
    `;

    return {
        subject: `💰 Payout ${sc.label} — ${fmt(amount)} | Urbexon`,
        html: baseLayout(`Payout ${sc.label}`, body),
    };
};

/* ═══════════════════════════════════════════════════
   DELIVERY PARTNER EMAILS
═══════════════════════════════════════════════════ */

/**
 * New delivery assignment email
 */
export const deliveryAssignedEmail = (riderName, order) => {
    const oid = shortId(order._id);
    const isUH = order.orderMode === "URBEXON_HOUR";

    const body = `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${riderName || "Delivery Partner"},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151">
            A new ${isUH ? '<span style="color:#f59e0b;font-weight:700">⚡ Urbexon Hour</span>' : ""} delivery has been assigned to you.
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 16px">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
                <tr>
                    <td style="padding:6px 0;font-size:12px;color:#6b7280">Order ID</td>
                    <td style="padding:6px 0;font-size:14px;font-weight:700;color:${BRAND.color};text-align:right">#${oid}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;font-size:12px;color:#6b7280">Customer</td>
                    <td style="padding:6px 0;font-size:13px;color:#111;text-align:right">${order.customerName || "N/A"}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;font-size:12px;color:#6b7280">Phone</td>
                    <td style="padding:6px 0;font-size:13px;color:#111;text-align:right">${order.phone || "N/A"}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;font-size:12px;color:#6b7280">Delivery Address</td>
                    <td style="padding:6px 0;font-size:13px;color:#111;text-align:right">${order.address || "N/A"}</td>
                </tr>
                <tr>
                    <td style="padding:6px 0;font-size:12px;color:#6b7280">Payment</td>
                    <td style="padding:6px 0;font-size:13px;font-weight:600;color:#111;text-align:right">${order.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid"} — ${fmt(order.total)}</td>
                </tr>
            </table>
        </div>
        ${isUH ? `<div style="background:#fef3c7;border-radius:8px;padding:12px;margin:0 0 16px">
            <p style="margin:0;font-size:13px;color:#92400e;font-weight:600">⚡ Quick delivery required. Please pick up and deliver within the estimated time.</p>
        </div>` : ""}
        <div style="text-align:center;margin:24px 0 0">
            <a href="${BRAND.deliveryUrl}" style="display:inline-block;padding:12px 32px;background:#059669;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Open Delivery App</a>
        </div>
    `;

    return {
        subject: `🚚 New Delivery Assigned — #${oid}${isUH ? " ⚡ UH" : ""}`,
        html: baseLayout("New Delivery Assignment 🚚", body),
    };
};

/**
 * Delivery pickup details email
 */
export const deliveryPickupEmail = (riderName, order, pickupAddress) => {
    const oid = shortId(order._id);

    const body = `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Hi ${riderName},</p>
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Pickup details for order <strong>#${oid}</strong>:</p>
        <div style="background:#eff6ff;border-radius:8px;padding:16px;margin:0 0 16px;border-left:4px solid #3b82f6">
            <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1e40af">📍 Pickup Location</p>
            <p style="margin:0;font-size:13px;color:#1e40af">${pickupAddress || "Check dashboard for details"}</p>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280">
            <strong>Items:</strong> ${order.items?.length || 0} item(s)<br>
            <strong>Payment:</strong> ${order.paymentMethod === "COD" ? `COD — Collect ${fmt(order.total)}` : "Prepaid"}
        </p>
    `;

    return {
        subject: `📍 Pickup Details — Order #${oid}`,
        html: baseLayout("Pickup Details", body),
    };
};

/* ═══════════════════════════════════════════════════
   ADMIN EMAILS
═══════════════════════════════════════════════════ */

/**
 * Daily summary email for admin
 */
export const adminDailySummaryEmail = (stats) => {
    const body = `
        <p style="margin:0 0 16px;font-size:14px;color:#374151">Here's your daily business summary:</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin:0 0 20px">
            <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:900;color:#065f46">${stats.todayOrders || 0}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Orders Today</p>
            </div>
            <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:8px;padding:16px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:900;color:#1e40af">${fmt(stats.todayRevenue || 0)}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Revenue Today</p>
            </div>
            <div style="flex:1;min-width:120px;background:#fef3c7;border-radius:8px;padding:16px;text-align:center">
                <p style="margin:0;font-size:24px;font-weight:900;color:#92400e">${stats.pendingOrders || 0}</p>
                <p style="margin:4px 0 0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Pending</p>
            </div>
        </div>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px">
            <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;font-size:13px;color:#6b7280">New Users Today</td>
                <td style="padding:10px 0;font-size:14px;font-weight:700;color:#111;text-align:right">${stats.newUsers || 0}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;font-size:13px;color:#6b7280">Cancelled Orders</td>
                <td style="padding:10px 0;font-size:14px;font-weight:700;color:#ef4444;text-align:right">${stats.cancelledOrders || 0}</td>
            </tr>
            <tr style="border-bottom:1px solid #f0f0f0">
                <td style="padding:10px 0;font-size:13px;color:#6b7280">Active Vendors</td>
                <td style="padding:10px 0;font-size:14px;font-weight:700;color:#111;text-align:right">${stats.activeVendors || 0}</td>
            </tr>
            <tr>
                <td style="padding:10px 0;font-size:13px;color:#6b7280">Active Delivery Partners</td>
                <td style="padding:10px 0;font-size:14px;font-weight:700;color:#111;text-align:right">${stats.activeRiders || 0}</td>
            </tr>
        </table>
        <div style="text-align:center;margin:20px 0 0">
            <a href="${BRAND.adminUrl}" style="display:inline-block;padding:12px 32px;background:${BRAND.color};color:${BRAND.gold};text-decoration:none;border-radius:8px;font-weight:700;font-size:14px">Open Admin Dashboard</a>
        </div>
    `;

    const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return {
        subject: `📊 Daily Summary — ${today} | Urbexon`,
        html: baseLayout(`Daily Summary — ${today}`, body),
    };
};

/**
 * Admin alert for new order
 */
export const adminNewOrderAlertEmail = (order) => {
    const oid = shortId(order._id);
    const isUH = order.orderMode === "URBEXON_HOUR";
    const itemsList = (order.items || []).map(i => `<li style="font-size:13px;color:#374151;margin:4px 0">${i.name} × ${i.quantity} — ${fmt(i.price * i.quantity)}</li>`).join("");

    const body = `
        <p style="margin:0 0 12px;font-size:14px;color:#374151">
            New ${isUH ? "⚡ Urbexon Hour" : "🛒 E-Commerce"} order received:
        </p>
        <div style="background:#f8fafc;border-radius:8px;padding:16px;margin:0 0 16px">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280">Order #${oid}</p>
            <p style="margin:0;font-size:22px;font-weight:900;color:${BRAND.color}">${fmt(order.total)}</p>
            <p style="margin:6px 0 0;font-size:12px;color:#6b7280">${order.paymentMethod || "N/A"} | ${order.customerName || "Guest"}</p>
        </div>
        <ul style="padding-left:20px;margin:0 0 16px">${itemsList}</ul>
        <p style="margin:0;font-size:13px;color:#6b7280"><strong>Address:</strong> ${order.address || "N/A"}</p>
    `;

    return {
        subject: `🛍️ New Order #${oid} — ${fmt(order.total)}${isUH ? " ⚡ UH" : ""}`,
        html: baseLayout("New Order Alert", body),
    };
};

export default {
    vendorNewOrderEmail,
    vendorPayoutEmail,
    deliveryAssignedEmail,
    deliveryPickupEmail,
    adminDailySummaryEmail,
    adminNewOrderAlertEmail,
};
