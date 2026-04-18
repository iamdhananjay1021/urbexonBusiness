/**
 * Shiprocketservice.js
 * ─────────────────────────────────────────────────────────
 * MOCK MODE  → SHIPROCKET_MOCK=true  (default — no account needed)
 * REAL MODE  → SHIPROCKET_MOCK=false (set when Shiprocket account ready)
 *
 * .env required for real mode:
 *   SHIPROCKET_EMAIL=you@email.com
 *   SHIPROCKET_PASSWORD=yourpassword
 *   SHIPROCKET_CHANNEL_ID=123456   (optional)
 *   SHIPROCKET_PICKUP_LOCATION=Primary  (default: Primary)
 * ─────────────────────────────────────────────────────────
 */

const MOCK_MODE = process.env.SHIPROCKET_MOCK !== "false"; // true by default
const SR_BASE = "https://apiv2.shiprocket.in/v1/external";
const PICKUP_LOCATION = process.env.SHIPROCKET_PICKUP_LOCATION || "Primary";
const CHANNEL_ID = process.env.SHIPROCKET_CHANNEL_ID || null;

/* ── Token cache (real mode — valid 24hrs, we refresh at 23hrs) ── */
let _token = null;
let _tokenExp = 0;

/* ══════════════════════════════════════════════════════
   AUTH — Get token (cached 23hrs)
══════════════════════════════════════════════════════ */
const getToken = async () => {
    if (_token && Date.now() < _tokenExp) return _token;

    const res = await fetch(`${SR_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: process.env.SHIPROCKET_EMAIL,
            password: process.env.SHIPROCKET_PASSWORD,
        }),
        signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();
    if (!data.token) throw new Error("Shiprocket auth failed: " + JSON.stringify(data));

    _token = data.token;
    _tokenExp = Date.now() + 23 * 60 * 60 * 1000;
    console.log("[Shiprocket] Token refreshed");
    return _token;
};

const srHeaders = async () => ({
    "Content-Type": "application/json",
    "Authorization": `Bearer ${await getToken()}`,
});

/* ══════════════════════════════════════════════════════
   MOCK HELPERS
══════════════════════════════════════════════════════ */
const mockAwb = () => `SR${Date.now().toString().slice(-10)}`;
const mockShipId = () => Math.floor(Math.random() * 9_000_000) + 1_000_000;
const mockCouriers = ["Delhivery", "BlueDart", "DTDC", "Ekart", "XpressBees"];
const mockCourier = () => mockCouriers[Math.floor(Math.random() * mockCouriers.length)];

const mockActivities = (awb) => [
    { date: new Date().toISOString(), activity: "Shipment picked up from seller", location: "Akbarpur Hub" },
    { date: new Date(Date.now() - 3_600_000).toISOString(), activity: "Out for pickup", location: "Akbarpur" },
];

/* ══════════════════════════════════════════════════════
   1. CHECK SERVICEABILITY / RATE
   Used in checkout — live rate per pincode
══════════════════════════════════════════════════════ */
export const calculateShippingRate = async ({ deliveryPincode, weight = 500, cod = false }) => {
    const pickupPincode = process.env.SHOP_PINCODE || "224122";
    const wtKg = Math.max(0.1, weight / 1000);

    if (MOCK_MODE) {
        const base = wtKg <= 0.5 ? 49 : wtKg <= 1 ? 79 : wtKg <= 2 ? 99 : 149;
        const codExtra = cod ? 30 : 0;
        return {
            success: true,
            mock: true,
            rate: base + codExtra,
            courier: "Standard Courier",
            etd: "3–5 business days",
            weight_kg: wtKg,
        };
    }

    try {
        const token = await getToken();
        const url = `${SR_BASE}/courier/serviceability/?pickup_postcode=${pickupPincode}&delivery_postcode=${deliveryPincode}&weight=${wtKg}&cod=${cod ? 1 : 0}`;
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json();

        const couriers = data?.data?.available_courier_companies || [];
        if (!couriers.length)
            return { success: false, rate: 49, courier: "Standard", etd: "5–7 days", mock: false };

        const best = couriers.sort((a, b) => a.freight_charge - b.freight_charge)[0];
        return {
            success: true,
            mock: false,
            rate: Math.round(best.freight_charge),
            courier: best.courier_name,
            etd: best.estimated_delivery_days ? `${best.estimated_delivery_days} days` : "3–5 days",
            weight_kg: wtKg,
        };
    } catch (err) {
        console.error("[Shiprocket] Rate error:", err.message);
        return { success: false, rate: 49, courier: "Standard", etd: "5–7 days", mock: false };
    }
};

/* ══════════════════════════════════════════════════════
   2. CREATE SHIPROCKET ORDER
   Called automatically after order is saved + payment confirmed
══════════════════════════════════════════════════════ */
export const createShiprocketOrder = async ({ order, totalWeight = 500 }) => {
    if (MOCK_MODE) {
        const awb = mockAwb();
        const shipmentId = mockShipId();
        const courier = mockCourier();
        console.log(`[Shiprocket MOCK] Created — AWB: ${awb}, Courier: ${courier}`);
        return {
            success: true,
            mock: true,
            awb_code: awb,
            shipment_id: shipmentId,
            courier_name: courier,
            tracking_url: `https://shiprocket.co/tracking/${awb}`,
            label_url: null,
        };
    }

    try {
        const headers = await srHeaders();
        const isCOD = order.payment?.method === "COD";
        const weightKg = Math.max(0.1, totalWeight / 1000);

        // Use structured fields (city, state, pincode) if available,
        // otherwise fall back to parsing from address string
        const pincode = order.pincode
            || order.address?.match(/\b\d{6}\b/)?.[0]
            || process.env.SHOP_PINCODE || "000000";

        const addrParts = order.address?.split(",") || [];
        const city = order.city
            || (addrParts.length >= 2 ? addrParts[addrParts.length - 2]?.trim() : "")
            || "Unknown";

        const state = order.state
            || (addrParts.length >= 1 ? addrParts[addrParts.length - 1]?.replace(/[\s\-]*\d{6}[\s]*$/, "").trim() : "")
            || "Unknown";

        const orderItems = order.items.map(item => ({
            name: (item.name || "Product").slice(0, 100),
            sku: item.productId?.toString() || "PROD",
            units: item.qty,
            selling_price: item.price,
            discount: 0,
            tax: 0,
            hsn: item.hsnCode || 91059990,
        }));

        const body = {
            order_id: `UBX-${order._id.toString().slice(-8).toUpperCase()}`,
            order_date: new Date(order.createdAt).toISOString().slice(0, 10),
            pickup_location: PICKUP_LOCATION,
            ...(CHANNEL_ID && { channel_id: CHANNEL_ID }),
            comment: "",
            billing_customer_name: order.customerName,
            billing_last_name: "",
            billing_address: (order.address || "").slice(0, 200),
            billing_city: city,
            billing_pincode: pincode,
            billing_state: state,
            billing_country: "India",
            billing_email: order.email || process.env.SHOP_EMAIL || "support@urbexon.in",
            billing_phone: order.phone,
            shipping_is_billing: true,
            order_items: orderItems,
            payment_method: isCOD ? "COD" : "Prepaid",
            sub_total: order.totalAmount,
            length: 15,
            breadth: 12,
            height: 10,
            weight: weightKg,
        };

        const res = await fetch(`${SR_BASE}/orders/create/adhoc`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15_000),
        });
        const data = await res.json();

        if (!data.shipment_id) {
            console.error("[Shiprocket] Create failed:", JSON.stringify(data));
            return { success: false, error: data.message || "Unknown error from Shiprocket" };
        }

        return {
            success: true,
            mock: false,
            awb_code: data.awb_code || "",
            shipment_id: data.shipment_id,
            courier_name: data.courier_name || "",
            tracking_url: data.awb_code ? `https://shiprocket.co/tracking/${data.awb_code}` : "",
            label_url: data.label || null,
        };
    } catch (err) {
        console.error("[Shiprocket] createOrder error:", err.message);
        return { success: false, error: err.message };
    }
};

/* ══════════════════════════════════════════════════════
   3. TRACK SHIPMENT by AWB
══════════════════════════════════════════════════════ */
export const trackShipment = async ({ awbCode }) => {
    if (MOCK_MODE) {
        const mockStatuses = [
            { status: "PICKUP_SCHEDULED", label: "Pickup Scheduled", detail: "Courier pickup scheduled from hub" },
            { status: "PICKED_UP", label: "Picked Up", detail: "Package picked up from seller" },
            { status: "IN_TRANSIT", label: "In Transit", detail: "Package is on the way" },
            { status: "OUT_FOR_DELIVERY", label: "Out for Delivery", detail: "Out for delivery today" },
        ];
        const pick = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
        return {
            success: true,
            mock: true,
            awb: awbCode,
            status: pick.status,
            label: pick.label,
            detail: pick.detail,
            courier: mockCourier(),
            tracking_url: `https://shiprocket.co/tracking/${awbCode}`,
            activities: mockActivities(awbCode),
        };
    }

    try {
        const token = await getToken();
        const res = await fetch(`${SR_BASE}/courier/track/awb/${awbCode}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
        });
        const data = await res.json();
        const track = data?.tracking_data;

        return {
            success: true,
            mock: false,
            awb: awbCode,
            status: track?.shipment_status || "UNKNOWN",
            label: track?.shipment_status_label || "In Process",
            detail: track?.current_status || "",
            courier: track?.courier_name || "",
            tracking_url: `https://shiprocket.co/tracking/${awbCode}`,
            activities: track?.activities || [],
        };
    } catch (err) {
        console.error("[Shiprocket] Track error:", err.message);
        return { success: false, error: err.message };
    }
};

/* ══════════════════════════════════════════════════════
   4. GENERATE SHIPPING LABEL PDF URL
══════════════════════════════════════════════════════ */
export const generateLabel = async ({ shipmentId }) => {
    if (MOCK_MODE)
        return { success: true, mock: true, label_url: "https://shiprocket.co/label/mock.pdf" };

    try {
        const headers = await srHeaders();
        const res = await fetch(`${SR_BASE}/courier/generate/label`, {
            method: "POST",
            headers,
            body: JSON.stringify({ shipment_id: [shipmentId] }),
            signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        return { success: true, mock: false, label_url: data.label_url || "" };
    } catch (err) {
        console.error("[Shiprocket] Label error:", err.message);
        return { success: false, error: err.message };
    }
};

/* ══════════════════════════════════════════════════════
   5. GENERATE MANIFEST (for pickup)
══════════════════════════════════════════════════════ */
export const generateManifest = async ({ shipmentId }) => {
    if (MOCK_MODE)
        return { success: true, mock: true, manifest_url: "https://shiprocket.co/manifest/mock.pdf" };

    try {
        const headers = await srHeaders();
        const res = await fetch(`${SR_BASE}/manifests/generate`, {
            method: "POST",
            headers,
            body: JSON.stringify({ shipment_id: [shipmentId] }),
            signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        return { success: true, mock: false, manifest_url: data.manifest_url || "" };
    } catch (err) {
        console.error("[Shiprocket] Manifest error:", err.message);
        return { success: false, error: err.message };
    }
};

/* ══════════════════════════════════════════════════════
   6. SCHEDULE PICKUP REQUEST
══════════════════════════════════════════════════════ */
export const schedulePickup = async ({ shipmentId }) => {
    if (MOCK_MODE)
        return { success: true, mock: true, pickup_token: "MOCK_PICKUP_TOKEN" };

    try {
        const headers = await srHeaders();
        const res = await fetch(`${SR_BASE}/courier/generate/pickup`, {
            method: "POST",
            headers,
            body: JSON.stringify({ shipment_id: [shipmentId] }),
            signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        return { success: true, mock: false, pickup_token: data.pickup_token || "" };
    } catch (err) {
        console.error("[Shiprocket] Pickup error:", err.message);
        return { success: false, error: err.message };
    }
};

export const isMockMode = () => MOCK_MODE;

/* ══════════════════════════════════════════════════════
   7. CANCEL SHIPROCKET ORDER
══════════════════════════════════════════════════════ */
export const cancelShiprocketOrder = async ({ orderId }) => {
    if (MOCK_MODE)
        return { success: true, mock: true };

    try {
        const headers = await srHeaders();
        const res = await fetch(`${SR_BASE}/orders/cancel`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ids: [orderId] }),
            signal: AbortSignal.timeout(10_000),
        });
        const data = await res.json();
        return { success: true, mock: false, data };
    } catch (err) {
        console.error("[Shiprocket] Cancel error:", err.message);
        return { success: false, error: err.message };
    }
};